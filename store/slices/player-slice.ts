import { StateCreator } from 'zustand';
import { GameState, Vector3, PlayerTransform } from '../../types';
import { PLAYER_MAX_HP, PLAYER_MAX_STAMINA, STAMINA_REGEN_DELAY_NORMAL, STAMINA_EXHAUSTION_DURATION } from '../../constants';
import { soundManager } from '../../components/SoundManager';
import type { GameStore } from '../../store';
import { TEXT } from '../../localization';
import { v4 as uuidv4 } from 'uuid';

// Sentinel for low-HP stamina lock (stays exhausted until HP recovers)
const LOW_HP_STAMINA_LOCK = Number.MAX_SAFE_INTEGER;

export interface PlayerSlice {
    hp: number;
    stamina: number;
    sanity: number;
    isStaminaLocked: boolean;
    
    // Mechanics
    hasShard: boolean;
    shardPosition: Vector3 | null;
    hasShardEver: boolean;
    isGateOpen: boolean;
    interactionText: string | null;
    deathCause: 'normal' | 'statue' | 'trap';
    
    // Scanner
    isScanning: boolean;
    lastScanTime: number;
    // Absolute timestamp (ms) when current scan should end; 0 when inactive
    scanEndTime: number;

    // Trap Logic
    isTrapped: boolean;
    trappedPosition: Vector3 | null;

    // Reading
    readingPaperContent: string | null;

    // Movement / Control Bridge
    playerControls: any;
    isPlayerSpawned: boolean;
    playerTransform: PlayerTransform;
    
    // Jumpscare State
    isJumpscared: boolean;
    jumpscareTarget: Vector3 | null;
    jumpscareStartTime: number;

    // Stamina Internal
    lastStaminaUsageTime: number;
    isExhausted: boolean;
    exhaustionEndTime: number;

    // Actions
    damagePlayer: (amount: number) => void;
    regenerateStamina: (amount: number) => void;
    consumeStamina: (amount: number) => boolean;
    decreaseSanity: (amount: number) => void;
    collectShard: () => void;
    openGate: () => void;
    setInteractionText: (text: string | null) => void;
    triggerStatueDeath: () => void;
    triggerScan: () => boolean;
    setPlayerControls: (controls: any) => void;
    setPlayerSpawned: (spawned: boolean) => void;
    setReadingPaper: (content: string | null) => void;
    syncPlayerTransform: (pos: Vector3, rot: number) => void;
    triggerJumpscare: (target: Vector3) => void;
    setStaminaLocked: (locked: boolean) => void;
}

export const createPlayerSlice: StateCreator<GameStore, [], [], PlayerSlice> = (set, get) => ({
    hp: PLAYER_MAX_HP,
    stamina: PLAYER_MAX_STAMINA,
    sanity: 100,
    hasShard: false,
    shardPosition: null,
    hasShardEver: false,
    isGateOpen: false,
    interactionText: null,
    deathCause: 'normal',
    isScanning: false,
    lastScanTime: 0,
    scanEndTime: 0,
    isTrapped: false,
    trappedPosition: null,
    readingPaperContent: null,
    playerControls: null,
    isPlayerSpawned: false,
    playerTransform: { position: { x: 0, y: 0, z: 0 }, rotation: 0 },
    isJumpscared: false,
    jumpscareTarget: null,
    jumpscareStartTime: 0,
    lastStaminaUsageTime: 0,
    isExhausted: false,
    exhaustionEndTime: 0,
    isStaminaLocked: false,

    damagePlayer: (amount) => {
        const { hp, gameState, isBlocking, lastBlockHitTime, rightHandItem, isGhostMode, isExhausted, exhaustionEndTime } = get();
        if (gameState !== GameState.PLAYING) return;
        if (isGhostMode) return; // IMMORTALITY
        
        // BLOCKING LOGIC - Only if holding a weapon in right hand
        if (isBlocking && rightHandItem && rightHandItem.category === 'WEAPON') {
            const now = Date.now();
            if (now - lastBlockHitTime > 500) { 
                get().decreaseDurability(1, rightHandItem.id);
                soundManager.playStickHit(); 
                set({ lastBlockHitTime: now });
            }
            return; 
        }
  
        const newHp = hp - amount;
        if (newHp <= 0) {
            get().setGameState(GameState.GAME_OVER);
            set({ hp: 0, deathCause: 'normal' });
        } else {
            // If critical HP, hard-lock stamina to 0 and force exhaustion
            if (newHp <= 20) {
                set({ 
                    hp: newHp, 
                    stamina: 0, 
                    isExhausted: true, 
                    exhaustionEndTime: LOW_HP_STAMINA_LOCK 
                });
            } else {
                // If recovering above 20 HP and exhaustion was from low HP lock, clear it
                if (isExhausted && exhaustionEndTime === LOW_HP_STAMINA_LOCK) {
                    set({ isExhausted: false, exhaustionEndTime: 0 });
                }
                set({ hp: newHp });
            }
        }
    },

    regenerateStamina: (amount) => {
        const { stamina, lastStaminaUsageTime, isExhausted, exhaustionEndTime, hp } = get();
        const now = Date.now();
  
        // Lock stamina at 0 when HP is critical
        if (hp <= 20) {
            if (stamina !== 0 || !isExhausted || exhaustionEndTime !== LOW_HP_STAMINA_LOCK) {
                set({ stamina: 0, isExhausted: true, exhaustionEndTime: LOW_HP_STAMINA_LOCK });
            }
            return;
        } else if (isExhausted && exhaustionEndTime === LOW_HP_STAMINA_LOCK) {
            // Recover stamina once HP is back above 20
            set({ isExhausted: false, exhaustionEndTime: 0 });
        }

        if (isExhausted) {
            if (now >= exhaustionEndTime) {
               set({ isExhausted: false });
            }
        }
        
        if (stamina >= PLAYER_MAX_STAMINA) return;
        if (now - lastStaminaUsageTime < STAMINA_REGEN_DELAY_NORMAL) return;
  
        set({ 
            stamina: Math.min(PLAYER_MAX_STAMINA, stamina + amount)
        });
    },
  
    consumeStamina: (amount) => {
        const { stamina, exhaustionEndTime, isGhostMode, isExhausted, hp, isStaminaLocked } = get();
        if (isGhostMode) return true; // INFINITE STAMINA
        if (isStaminaLocked) return false;

        const now = Date.now();
  
        // Hard lock sprint/jump if HP is critical
        if (hp <= 20) {
            set({ stamina: 0, isExhausted: true, exhaustionEndTime: LOW_HP_STAMINA_LOCK });
            return false;
        }

        let currentlyExhausted = isExhausted;

        // If exhaustion timer has ended while still holding sprint, clear the flag immediately
        if (currentlyExhausted && now >= exhaustionEndTime) {
            set({ isExhausted: false });
            currentlyExhausted = false;
        }

        if (currentlyExhausted && now < exhaustionEndTime) {
            return false;
        }
        
        if (stamina <= 0) return false;
  
        const newStamina = Math.max(0, stamina - amount);
        const isNowExhausted = newStamina === 0;
        
        const updates: Partial<PlayerSlice> = {
            stamina: newStamina,
            lastStaminaUsageTime: now
        };
  
        if (isNowExhausted) {
            updates.isExhausted = true;
            updates.exhaustionEndTime = now + STAMINA_EXHAUSTION_DURATION;
        }
  
        set(updates);
        return true;
    },

    decreaseSanity: (amount) => {
        const { sanity, gameState, isGhostMode } = get();
        if (gameState !== GameState.PLAYING || isGhostMode) return;
        
        const newSanity = Math.max(0, sanity - amount);
        set({ sanity: newSanity });
    },

    collectShard: () => {
        const { language, inventory } = get();
        const t = TEXT[language].items.shard;
        
        set({ 
            hasShard: true, 
            hasShardEver: true,
            shardPosition: null,
            inventory: [...inventory, {
                id: uuidv4(),
                typeId: 'red_shard',
                name: t.name,
                description: t.desc,
                category: 'KEY_ITEM',
                effect: t.effect
            }]
        });
    },

    openGate: () => set({ isGateOpen: true }),
    setInteractionText: (text) => set({ interactionText: text }),
    
    triggerStatueDeath: () => {
        if (get().isGhostMode) return; // Prevent statue death in ghost mode
        get().setGameState(GameState.GAME_OVER);
        set({ hp: 0, deathCause: 'statue' });
    },

    triggerScan: () => {
        const { lastScanTime, leftHandItem, isWeaponActive } = get();
        
        // Scan item must be in left hand
        if (!leftHandItem || leftHandItem.typeId !== 'scan') {
            return false;
        }
  
        if (!isWeaponActive) {
            set({ isWeaponActive: true });
        }
  
        const now = Date.now();
        if (now - lastScanTime > 30000) {
            set({ 
                isScanning: true, 
                lastScanTime: now,
                scanEndTime: now + 10000
            });
            return true;
        }
        return false;
    },

    setPlayerControls: (controls) => set({ playerControls: controls }),
    setPlayerSpawned: (spawned) => set({ isPlayerSpawned: spawned }),
    setReadingPaper: (content) => {
        // Updated: Always play sound regardless if opening or closing
        soundManager.playTurnPage(); 
        set({ readingPaperContent: content, lastResumeTime: Date.now() }); 
    },
    syncPlayerTransform: (pos, rot) => set({ playerTransform: { position: pos, rotation: rot } }),
    
    triggerJumpscare: (target) => {
        const { isJumpscared, isGhostMode } = get();
        if (isJumpscared || isGhostMode) return;
        
        // Force-close inventory to avoid UI/camera conflicts during jumpscare
        set({ 
            isJumpscared: true, 
            jumpscareTarget: target,
            jumpscareStartTime: Date.now(),
            isInventoryOpen: false,
            previewItem: null,
            isWeaponActive: false // Force holster weapon (same effect as pressing Q)
        });
        
        // Wait 3.0s then kill (Longer duration for buildup)
        setTimeout(() => {
             const currentHp = get().hp;
             if (currentHp > 0) {
                 get().setGameState(GameState.GAME_OVER);
                 set({ hp: 0, deathCause: 'normal' });
             }
        }, 3000);
    },

    setStaminaLocked: (locked) => set({ isStaminaLocked: locked })
});
