import { StateCreator } from 'zustand';
import { GameState, MissionIntel, Vector3, Language, DroppedItem } from '../../types';
import { PLAYER_MAX_HP, PLAYER_MAX_STAMINA } from '../../constants';
import { saveGameData, initialSave } from '../persistence';
import { generateMazeData } from '../maze-generator';
import type { GameStore } from '../../store';
import { createInventorySliceInitialState } from './inventory-slice';
import { createEntitySliceInitialState, generateLevelEntities } from './entity-slice';
import { createCombatSliceInitialState } from './combat-slice';
import { v4 as uuidv4 } from 'uuid';
import { TEXT } from '../../localization';

export interface GameSlice {
    gameState: GameState;
    score: number;
    startTime: number;
    endTime: number;
    missionIntel: MissionIntel | null;
    
    currentLevel: number;
    maxUnlockedLevel: number;
    levelRecords: Record<number, number>;
    language: Language;
    volume: number;
    mouseSensitivity: number;

    walls: Vector3[];
    exitPosition: Vector3 | null;
    startRotation: number;
    startPosition: Vector3 | null;
    deadBodyPosition: Vector3 | null;
    
    isLoading: boolean;
    // New: Asset Loading control
    isAssetLoading: boolean; 
    areAssetsLoaded: boolean;
    setAssetLoading: (loading: boolean) => void;
    setAssetsLoaded: (loaded: boolean) => void;

    lastResumeTime: number;
    lastEnemySpawnTime: number;

    // Developer Mode States
    isDevConsoleOpen: boolean;
    isGodMode: boolean; // Visual X-ray
    isGhostMode: boolean; // "Ta là chúa" - Invincible/Noclip
    pauseStartTime: number;

    setGameState: (state: GameState) => void;
    setIsLoading: (loading: boolean) => void;
    setLanguage: (lang: Language) => void;
    setVolume: (vol: number) => void;
    setMouseSensitivity: (val: number) => void;
    
    startGame: (intel: MissionIntel, level: number) => void;
    resumeGame: () => void;
    resetGame: () => void;
    completeLevel: () => void;

    // Dev tools in Settings
    devModeEnabled: boolean;
    showDevOverlays: boolean;
    setDevModeEnabled: (enabled: boolean) => void;
    setShowDevOverlays: (show: boolean) => void;

    // Dev Actions
    setDevConsoleOpen: (open: boolean) => void;
    setGodMode: (active: boolean) => void;
    setGhostMode: (active: boolean) => void;
}

export const createGameSlice: StateCreator<GameStore, [], [], GameSlice> = (set, get) => ({
    gameState: GameState.MENU,
    score: 0,
    startTime: 0,
    endTime: 0,
    missionIntel: null,
    
    currentLevel: 1,
    maxUnlockedLevel: initialSave.maxUnlockedLevel,
    levelRecords: initialSave.levelRecords,
    language: initialSave.language,
    volume: initialSave.volume,
    mouseSensitivity: initialSave.mouseSensitivity !== undefined ? initialSave.mouseSensitivity : 0.5,

    walls: [],
    exitPosition: null,
    startRotation: 0,
    startPosition: null,
    deadBodyPosition: null,
    
    isLoading: false,
    isAssetLoading: false,
    areAssetsLoaded: false,

    lastResumeTime: 0,
    lastEnemySpawnTime: 0,

    isDevConsoleOpen: false,
    isGodMode: false,
    isGhostMode: false,
    pauseStartTime: 0,

    setGameState: (state) => {
        if (state === GameState.PAUSED) {
            // Force-close inventory when pausing (e.g., alt-tab/blur or manual pause)
            set({ 
                pauseStartTime: Date.now(), 
                gameState: state,
                isInventoryOpen: false,
                previewItem: null
            });
        } else if (state === GameState.GAME_WON || state === GameState.GAME_OVER) {
            // Force-close inventory on any game end (especially on death)
            set({ gameState: state, endTime: Date.now(), isInventoryOpen: false, previewItem: null });
        } else {
            set({ gameState: state });
        }
    },

    setIsLoading: (loading) => set({ isLoading: loading }),
    setAssetLoading: (loading) => set({ isAssetLoading: loading }),
    setAssetsLoaded: (loaded) => set({ areAssetsLoaded: loaded }),

    setLanguage: (lang) => {
        set({ language: lang });
        saveGameData({ language: lang });
    },

    setVolume: (vol) => {
        set({ volume: vol });
        saveGameData({ volume: vol });
    },

    setMouseSensitivity: (val) => {
        set({ mouseSensitivity: val });
        saveGameData({ mouseSensitivity: val });
    },

    devModeEnabled: false,
    showDevOverlays: false,

    resumeGame: () => {
        const now = Date.now();
        const pauseStartTime = get().pauseStartTime;
        const duration = now - pauseStartTime;
        
        if (duration > 0 && pauseStartTime > 0) {
             const state = get();
             set({
                startTime: state.startTime + duration,
                lastScanTime: state.lastScanTime + duration,
                scanEndTime: state.scanEndTime > 0 ? state.scanEndTime + duration : 0,
                exhaustionEndTime: state.exhaustionEndTime + duration,
                lastStaminaUsageTime: state.lastStaminaUsageTime + duration,
                
                // Entity Timers
                lastEnemySpawnTime: state.lastEnemySpawnTime + duration,
                traps: state.traps.map(t => ({
                    ...t,
                    triggerTime: t.triggerTime > 0 ? t.triggerTime + duration : 0,
                    lockedUntil: t.lockedUntil > 0 ? t.lockedUntil + duration : 0
                })),
                
                // Combat Timers
                lastShotTime: state.lastShotTime + duration,
                lastBlockHitTime: state.lastBlockHitTime + duration,
                impacts: state.impacts.map(i => ({
                    ...i,
                    timestamp: i.timestamp + duration
                })),
                
                // Angel Timers
                theAngel: state.theAngel ? {
                    ...state.theAngel,
                    lastHeardSoundTime: state.theAngel.lastHeardSoundTime + duration
                } : null,
                
                // Store
                pauseStartTime: 0 
             });
        }
        
        set({ gameState: GameState.PLAYING, lastResumeTime: now });
    },

    resetGame: () => {
        set({ 
            gameState: GameState.MENU, 
            isGodMode: false, 
            isGhostMode: false,
            deadBodyPosition: null,
            // Reset Jumpscare State
            isJumpscared: false,
            jumpscareTarget: null,
            jumpscareStartTime: 0,
            // Reset Player State (Partial, full reset usually happens on startGame)
            hp: PLAYER_MAX_HP,
            deathCause: 'normal',
            isTrapped: false,
            trappedPosition: null,
            readingPaperContent: null,
        });
        
        // Reset Audio
        document.documentElement.style.setProperty('--interference-opacity', '0');
    },

    completeLevel: () => {
        const { currentLevel, maxUnlockedLevel, levelRecords, startTime, endTime } = get();
        const timeElapsed = endTime - startTime;
        const currentRecord = levelRecords[currentLevel];
        const newRecords = { ...levelRecords };
        let newMaxLevel = maxUnlockedLevel;
  
        if (!currentRecord || timeElapsed < currentRecord) {
            newRecords[currentLevel] = timeElapsed;
        }
        if (currentLevel === maxUnlockedLevel) {
            newMaxLevel = maxUnlockedLevel + 1;
        }
  
        set({ 
            maxUnlockedLevel: newMaxLevel,
            levelRecords: newRecords 
        });
        saveGameData({ 
            maxUnlockedLevel: newMaxLevel, 
            levelRecords: newRecords 
        });
    },

    startGame: (intel, level) => {
        const { walls, floors, startPos, startRotation, plaza1Pos, plaza2Pos } = generateMazeData(level);
        
        // Calculate Positions
        const isSwap = Math.random() > 0.5;
        const exitPos = isSwap ? plaza1Pos : plaza2Pos;
        const shardPos = isSwap ? plaza2Pos : plaza1Pos;

        // Pick a floor tile offset from spawn toward center (farther again)
        const deadBodyPos = (() => {
            const MIN_START_GAP = 50;    // at least 50m from spawn
            const MAX_START_DIST = 160;  // no farther than 160m
            const target = {
                x: startPos.x + (0 - startPos.x) * 0.55,  // 55% toward center
                y: 0,
                z: startPos.z + (0 - startPos.z) * 0.55
            };

            const candidates = floors
                .filter(f => {
                    const dStart = Math.hypot(f.x - startPos.x, f.z - startPos.z);
                    return dStart >= MIN_START_GAP && dStart <= MAX_START_DIST;
                })
                .map(f => ({
                    pos: f,
                    score: Math.hypot(f.x - target.x, f.z - target.z)
                }));

            if (candidates.length === 0) return floors[0] ?? null;

            candidates.sort((a, b) => a.score - b.score);
            return candidates[0].pos;
        })();

        // Reset Player Slice
        const playerReset = {
            hp: PLAYER_MAX_HP,
            stamina: PLAYER_MAX_STAMINA,
            sanity: 100,
            isExhausted: false,
            exhaustionEndTime: 0,
            lastStaminaUsageTime: 0,
            hasShard: false,
            shardPosition: shardPos,
            isGateOpen: false,
            interactionText: null,
            deathCause: 'normal' as const,
            isScanning: false,
            lastScanTime: 0,
            scanEndTime: 0,
            isPlayerSpawned: false,
            readingPaperContent: null,
            isTrapped: false,
            trappedPosition: null,
            isJumpscared: false,
            jumpscareTarget: null,
            jumpscareStartTime: 0,
        };

        // Reset Inventory Slice
        const inventoryReset = createInventorySliceInitialState(get().language);

        // Reset Combat Slice
        const combatReset = createCombatSliceInitialState();

        // Generate Entities (Items, Enemies, Traps)
        const { entities, papers, sticks, traps } = generateLevelEntities(
            level, floors, startPos, exitPos, shardPos, startRotation, get().language
        );

        let paperPos: Vector3 | null = null;
        // Drop a blank paper near the dead body to help locate it
        if (deadBodyPos) {
            const language = get().language;
            const paperContent = language === 'vi' 
                ? 'Tất cả chỉ là mày tưởng tượng ra thôi.\nNhớ uống thuốc đúng giờ.'
                : 'It is all in your head.\nRemember to take your meds on time.';

            paperPos = { x: deadBodyPos.x + 0.8, y: 0.1, z: deadBodyPos.z + 0.8 };
            papers.push({
                id: uuidv4(),
                position: paperPos,
                content: paperContent
            });
        }

        const initialDrops: DroppedItem[] = [];
        if (deadBodyPos) {
            const language = get().language;
            const pillText = TEXT[language].items.pillBottle;

            // Place the bottle beside the paper and corpse without overlapping them
            const minBodyClearance = 0.9;   // keep a small gap from the corpse footprint
            const minPaperClearance = 0.45; // avoid sitting directly on the note
            const candidateOffsets = [
                { x: 1.1,  z: 0.5 },
                { x: 0.5, z: 1.1 },
                { x: -1.1, z: 0.5 },
                { x: 0.5, z: -1.1 },
            ];

            const isOffsetValid = (offset: { x: number, z: number }, avoid?: { x: number, z: number }) => {
                const distBody = Math.hypot(offset.x, offset.z);
                const worldPos = { x: deadBodyPos.x + offset.x, z: deadBodyPos.z + offset.z };
                const distPaper = paperPos
                    ? Math.hypot(worldPos.x - paperPos.x, worldPos.z - paperPos.z)
                    : Infinity;
                const distAvoid = avoid
                    ? Math.hypot(worldPos.x - (deadBodyPos.x + avoid.x), worldPos.z - (deadBodyPos.z + avoid.z))
                    : Infinity;
                return distBody >= minBodyClearance && distPaper >= minPaperClearance && distAvoid >= 0.5;
            };

            const chosenOffset = candidateOffsets.find(offset => isOffsetValid(offset)) || { x: 0.7, z: -0.7 };

            initialDrops.push({
                id: uuidv4(),
                item: {
                    id: uuidv4(),
                    typeId: 'pill_bottle',
                    name: pillText.name,
                    description: pillText.desc,
                    category: 'CONSUMABLE',
                    effect: pillText.effect,
                },
                position: { 
                    x: deadBodyPos.x + chosenOffset.x, 
                    y: 0, 
                    z: deadBodyPos.z + chosenOffset.z 
                },
                rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 }
            });
        }

        // Place a health solution near the shard paper spot to guide the player
        if (shardPos) {
            const language = get().language;
            const healthText = TEXT[language].items.healthSolution;

            // Try to place near the paper closest to the shard (immersive hint).
            const closestPaper = papers.reduce<{ paper: typeof papers[number] | null, dist: number }>((acc, p) => {
                const d = Math.hypot(p.position.x - shardPos.x, p.position.z - shardPos.z);
                if (d < acc.dist) return { paper: p, dist: d };
                return acc;
            }, { paper: null, dist: Number.POSITIVE_INFINITY }).paper;

            const basePos = closestPaper ? closestPaper.position : shardPos;
            const shardDropOffset = { x: 0.75, z: 0.55 }; // slightly farther from paper

            initialDrops.push({
                id: uuidv4(),
                item: {
                    id: uuidv4(),
                    typeId: 'health_solution',
                    name: healthText.name,
                    description: healthText.desc,
                    category: 'CONSUMABLE',
                    effect: healthText.effect,
                },
                position: { 
                    x: basePos.x + shardDropOffset.x, 
                    y: basePos.y ?? 0, 
                    z: basePos.z + shardDropOffset.z 
                },
                rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 }
            });
        }

        set({
            ...playerReset,
            ...inventoryReset,
            ...combatReset,
            gameState: GameState.PLAYING,
            currentLevel: level,
            score: 0,
            startTime: Date.now(),
            endTime: 0,
            missionIntel: intel,
            walls: walls,
            exitPosition: exitPos,
            startRotation: startRotation,
            startPosition: startPos,
            deadBodyPosition: deadBodyPos,
            
            // Entity Slice Data
            enemies: [], 
            theAngel: {
                position: { x: 0, y: -1000, z: 0 }, // Spawn far below map until activated
                rotationY: 0,
                state: 'IDLE',
                targetPosition: null,
                lastHeardSoundTime: 0,
                lastHeardSoundPos: null,
                isActive: false,
                sanity19Triggered: false,
                sanity9Triggered: false,
                sanity0Active: false,
                appearanceTime: 0
            },
            statues: entities.statues,
            traps: traps,
            sticks: sticks,
            papers: papers,
            droppedItems: initialDrops,
            impacts: [],

            lastResumeTime: Date.now(),
            lastEnemySpawnTime: Date.now(),
            isLoading: false,
            isDevConsoleOpen: false,
        });
    },

    setDevModeEnabled: (enabled) => {
        set((state) => ({
            devModeEnabled: enabled,
            showDevOverlays: enabled ? state.showDevOverlays : false,
            isGodMode: enabled ? state.isGodMode : false,
            isGhostMode: enabled ? state.isGhostMode : false,
        }));
    },
    setShowDevOverlays: (show) => {
        const state = get();
        if (!state.devModeEnabled && show) return;
        set({ showDevOverlays: show });
    },

    setDevConsoleOpen: (open) => set({ isDevConsoleOpen: open }),
    setGodMode: (active) => {
        const state = get();
        if (!state.devModeEnabled && active) return;
        set({ isGodMode: active });
    },
    setGhostMode: (active) => {
        const state = get();
        if (!state.devModeEnabled && active) return;
        set({ isGhostMode: active });
    },
});
