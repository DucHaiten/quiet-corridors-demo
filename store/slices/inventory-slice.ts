
import { StateCreator } from 'zustand';
import { InventoryItem, Stick, DroppedItem, Language } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { soundManager } from '../../components/SoundManager';
import type { GameStore } from '../../store';
import { TEXT } from '../../localization';
import { PLAYER_MAX_HP, PILL_USE_DURATION_MS } from '../../constants';

// Helper to get default items
export const getDefaultItems = (lang: Language): InventoryItem[] => {
    const t_sonar = TEXT[lang].items.sonar;
    const t_pill = TEXT[lang].items.pillBottle;
    const t_health = TEXT[lang].items.healthSolution;
    
    return [
        { 
            id: 'scan', 
            typeId: 'scan', 
            name: t_sonar.name, 
            description: t_sonar.desc, 
            category: 'MISC', 
            effect: t_sonar.effect 
        },
        {
            id: 'pill_bottle',
            typeId: 'pill_bottle',
            name: t_pill.name,
            description: t_pill.desc,
            category: 'CONSUMABLE',
            effect: t_pill.effect
        },
        {
            id: 'health_solution',
            typeId: 'health_solution',
            name: t_health.name,
            description: t_health.desc,
            category: 'CONSUMABLE',
            effect: t_health.effect
        }
    ];
};

export interface InventorySlice {
    isInventoryOpen: boolean;
    inventory: InventoryItem[];
    previewItem: InventoryItem | null;
    isConsumingItem: boolean;
    consumingItemId: string | null;
    consumingItemType: string | null;
    consumeStartTime: number;
    consumeDuration: number;
    consumeWeaponWasActive: boolean;
    consumeHadRightHandItem: boolean;
    hasShardEver: boolean;
    
    // Dual Wielding State
    leftHandItem: InventoryItem | null;
    rightHandItem: InventoryItem | null;
    
    isWeaponActive: boolean;

    toggleInventory: () => void;
    setPreviewItem: (item: InventoryItem | null) => void;
    collectStick: (id: string) => void;
    collectDroppedItem: (id: string) => void;
    dropItem: (itemId: string) => void;
    useItem: (itemId: string) => void;
    startItemConsumption: (itemId: string, typeId: string, duration: number) => void;
    cancelItemConsumption: () => void;
    completeItemConsumption: () => void;
    unequipItem: (itemId: string) => void;
    setWeaponActive: (active: boolean) => void;
    toggleWeaponActive: () => void;
    consumeShard: () => void;
}

const getDefaultConsumptionState = (): Pick<InventorySlice, 'isConsumingItem' | 'consumingItemId' | 'consumingItemType' | 'consumeStartTime' | 'consumeDuration' | 'consumeWeaponWasActive' | 'consumeHadRightHandItem'> => ({
    isConsumingItem: false,
    consumingItemId: null,
    consumingItemType: null,
    consumeStartTime: 0,
    consumeDuration: PILL_USE_DURATION_MS,
    consumeWeaponWasActive: false,
    consumeHadRightHandItem: false
});

export const createInventorySlice: StateCreator<GameStore, [], [], InventorySlice> = (set, get) => ({
    isInventoryOpen: false,
    inventory: getDefaultItems('en'), // Default init, will be overwritten by game start or save load
    previewItem: null,
    ...getDefaultConsumptionState(),
    hasShardEver: false,
    leftHandItem: null,
    rightHandItem: null,
    isWeaponActive: true,

    toggleInventory: () => set(state => {
        const newState = !state.isInventoryOpen;
        return { 
            isInventoryOpen: newState,
            lastResumeTime: !newState ? Date.now() : state.lastResumeTime
        };
    }),
  
    setPreviewItem: (item) => set({ previewItem: item }),

    collectStick: (id) => {
        const { language, sticks, inventory } = get();
        const stick = sticks.find(s => s.id === id);
        const t = TEXT[language].items.stick;
  
        const currentDurability = (stick?.durability !== undefined) ? stick.durability : 20;
  
        set({
            sticks: sticks.filter(s => s.id !== id),
            inventory: [...inventory, {
                id: uuidv4(),
                typeId: 'weapon_stick',
                name: t.name,
                description: t.desc,
                category: 'WEAPON',
                effect: t.effect,
                durability: currentDurability,
                maxDurability: 20
            }]
        });
    },
  
    collectDroppedItem: (id) => {
        const { droppedItems, inventory } = get();
        const dropped = droppedItems.find(d => d.id === id);
        if (!dropped) return;
  
        const item = dropped.item;
        if (item.id === 'red_shard' || item.typeId === 'red_shard') {
            set({ hasShard: true, hasShardEver: true, shardPosition: null });
        }
  
        set({
            droppedItems: droppedItems.filter(d => d.id !== id),
            inventory: [...inventory, item]
        });
    },

    dropItem: (itemId) => {
        const { inventory, playerTransform, walls, sticks, droppedItems, papers, leftHandItem, rightHandItem } = get();
        const item = inventory.find(i => i.id === itemId);
        if (!item) return;
        if (item.id === 'red_shard' || item.typeId === 'red_shard') {
            // Shard cannot be dropped
            return;
        }
  
        // Unequip if currently held
        if (leftHandItem && leftHandItem.id === itemId) {
            set({ leftHandItem: null });
        }
        if (rightHandItem && rightHandItem.id === itemId) {
            set({ rightHandItem: null });
        }
  
        const playerPos = playerTransform.position;
        const yaw = playerTransform.rotation;
        
        const dist = 0.8;
        const forwardX = -Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        
        let dropX = playerPos.x + (forwardX * dist);
        let dropZ = playerPos.z + (forwardZ * dist);
  
        const wallCollision = walls.some(w => Math.abs(w.x - dropX) < 3.5 && Math.abs(w.z - dropZ) < 3.5);
        if (wallCollision) {
            dropX = playerPos.x;
            dropZ = playerPos.z;
        }
  
        const allObjects = [
            ...sticks.map(s => s.position), 
            ...droppedItems.map(d => d.position),
            ...papers.map(p => p.position)
        ];
  
        for (const objPos of allObjects) {
            const dx = dropX - objPos.x;
            const dz = dropZ - objPos.z;
            const d = Math.sqrt(dx*dx + dz*dz);
            if (d < 0.4) {
                dropX += (Math.random() - 0.5) * 0.5;
                dropZ += (Math.random() - 0.5) * 0.5;
            }
        }
  
        if (item.typeId === 'weapon_stick') {
            const newStick: Stick = {
                id: uuidv4(),
                position: { x: dropX, y: 0, z: dropZ },
                rotationY: Math.random() * Math.PI * 2,
                durability: item.durability
            };
            set({
                inventory: inventory.filter(i => i.id !== itemId),
                sticks: [...sticks, newStick],
                previewItem: null
            });
        } else {
            const newDropped: DroppedItem = {
                id: uuidv4(),
                item: item,
                position: { x: dropX, y: 0, z: dropZ },
                rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 }
            };
            
            const updates: any = {
                inventory: inventory.filter(i => i.id !== itemId),
                droppedItems: [...droppedItems, newDropped],
                previewItem: null
            };
            
            if (item.id === 'red_shard' || item.typeId === 'red_shard') {
                updates.hasShard = false;
                updates.hasShardEver = true; // keep ever-flag even if attempted drop
            }
  
            set(updates);
        }
    },
  
    useItem: (itemId) => {
        const { inventory, sanity } = get();
        const item = inventory.find(i => i.id === itemId);
        if (!item) return;
  
        // Hand Logic
        if (item.typeId === 'scan') {
            // Left Hand Item
            set({ 
                ...getDefaultConsumptionState(),
                leftHandItem: item, 
                isWeaponActive: true, 
                isInventoryOpen: false, 
                lastResumeTime: Date.now() 
            });
        } else if (item.category === 'WEAPON') {
            // Right Hand Item
            set({ 
                ...getDefaultConsumptionState(),
                rightHandItem: item, 
                isWeaponActive: true, 
                isInventoryOpen: false, 
                lastResumeTime: Date.now() 
            });
        } else if (item.category === 'CONSUMABLE') {
            if (item.typeId === 'pill_bottle' || item.id === 'pill_bottle') {
                set({
                    ...getDefaultConsumptionState(),
                    // Equip to left hand, consume via hold logic
                    leftHandItem: item,
                    isWeaponActive: true,
                    previewItem: null,
                    isInventoryOpen: false,
                    lastResumeTime: Date.now()
                });
            } else if (item.typeId === 'health_solution' || item.id === 'health_solution') {
                set({
                    ...getDefaultConsumptionState(),
                    leftHandItem: item,
                    isWeaponActive: true,
                    previewItem: null,
                    isInventoryOpen: false,
                    lastResumeTime: Date.now()
                });
            }
        }
    },

    startItemConsumption: (itemId, typeId, duration) => {
        const { leftHandItem, rightHandItem, isWeaponActive } = get();
        if (!leftHandItem || leftHandItem.id !== itemId || leftHandItem.typeId !== typeId) return;
        if (typeId === 'pill_bottle') soundManager.startPillBottleHold(duration);
        if (typeId === 'health_solution') soundManager.startHealthSolutionHold(duration);
        const hadRightHand = !!rightHandItem;
        const shouldHolsterRight = hadRightHand && isWeaponActive;
        set({
            isConsumingItem: true,
            consumingItemId: itemId,
            consumingItemType: typeId,
            consumeStartTime: Date.now(),
            consumeDuration: duration,
            consumeWeaponWasActive: isWeaponActive,
            consumeHadRightHandItem: hadRightHand,
            ...(shouldHolsterRight ? { isWeaponActive: false } : {})
        });
        get().setStaminaLocked(true);
    },

    cancelItemConsumption: () => {
        soundManager.stopPillBottleHold();
        soundManager.stopHealthSolutionHold();
        const { consumeHadRightHandItem, consumeWeaponWasActive, rightHandItem } = get();
        const shouldRestoreWeapon = consumeHadRightHandItem && consumeWeaponWasActive && !!rightHandItem;
        const updates: any = { ...getDefaultConsumptionState() };
        if (shouldRestoreWeapon) updates.isWeaponActive = true;
        set(updates);
        get().setStaminaLocked(false);
    },

    completeItemConsumption: () => {
        const { consumingItemId, consumingItemType, inventory, leftHandItem, sanity, consumeHadRightHandItem, consumeWeaponWasActive, rightHandItem } = get();
        if (!consumingItemId) {
            set(getDefaultConsumptionState());
            get().setStaminaLocked(false);
            return;
        }

        const sanitizedLeftHand = leftHandItem && leftHandItem.id === consumingItemId ? null : leftHandItem;
        const shouldRestoreWeapon = consumeHadRightHandItem && consumeWeaponWasActive && !!rightHandItem;

        if (consumingItemType === 'pill_bottle') {
            const newSanity = Math.min(100, sanity + 40);
            set({
                sanity: newSanity,
                inventory: inventory.filter(i => i.id !== consumingItemId),
                leftHandItem: sanitizedLeftHand,
                ...getDefaultConsumptionState(),
                ...(shouldRestoreWeapon ? { isWeaponActive: true } : {})
            });
            soundManager.stopPillBottleHold();
        } else if (consumingItemType === 'health_solution') {
            const healAmount = PLAYER_MAX_HP * 0.3;
            const currentHp = get().hp;
            const newHp = Math.min(PLAYER_MAX_HP, currentHp + healAmount);

            set({
                hp: newHp,
                inventory: inventory.filter(i => i.id !== consumingItemId),
                leftHandItem: sanitizedLeftHand,
                ...getDefaultConsumptionState(),
                ...(shouldRestoreWeapon ? { isWeaponActive: true } : {})
            });
            soundManager.stopHealthSolutionHold();
        } else {
            set(getDefaultConsumptionState());
        }
        get().setStaminaLocked(false);
    },

    consumeShard: () => {
        const { inventory, hasShard, previewItem } = get();
        if (!hasShard) return;
        set({
            hasShard: false,
            hasShardEver: true,
            inventory: inventory.filter(i => i.id !== 'red_shard' && i.typeId !== 'red_shard'),
            previewItem: previewItem && (previewItem.id === 'red_shard' || previewItem.typeId === 'red_shard') ? null : previewItem
        });
    },

    unequipItem: (itemId) => {
        const { leftHandItem, rightHandItem } = get();
        
        // Remove from Left Hand if present
        if (leftHandItem && leftHandItem.id === itemId) {
            set({ leftHandItem: null });
        }

        // Remove from Right Hand if present
        if (rightHandItem && rightHandItem.id === itemId) {
            set({ rightHandItem: null });
        }
    },
    
    setWeaponActive: (active) => set({ isWeaponActive: active }),
    toggleWeaponActive: () => set(state => ({ isWeaponActive: !state.isWeaponActive })),
});

export const createInventorySliceInitialState = (lang: Language) => ({
    isInventoryOpen: false,
    inventory: getDefaultItems(lang),
    previewItem: null,
    ...getDefaultConsumptionState(),
    leftHandItem: null,
    rightHandItem: null,
    isWeaponActive: true,
});
