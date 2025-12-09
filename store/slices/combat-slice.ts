
import { StateCreator } from 'zustand';
import { Impact, Vector3 } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { soundManager } from '../../components/SoundManager';
import type { GameStore } from '../../store';

export interface CombatSlice {
    impacts: Impact[];
    lastShotTime: number;
    isBlocking: boolean;
    lastBlockHitTime: number;

    shoot: () => boolean;
    setBlocking: (blocking: boolean) => void;
    decreaseDurability: (amount: number, itemId: string) => void;
    addImpact: (pos: Vector3, normal: Vector3) => void;
}

export const createCombatSlice: StateCreator<GameStore, [], [], CombatSlice> = (set, get) => ({
    impacts: [],
    lastShotTime: 0,
    isBlocking: false,
    lastBlockHitTime: 0,

    shoot: () => {
        const now = Date.now();
        const { lastShotTime } = get();
        // CHANGED: Increased to 250ms (0.25s) as requested for better sync and feel
        if (now - lastShotTime > 250) { 
          set({ lastShotTime: now });
          return true;
        }
        return false;
    },
      
    setBlocking: (blocking) => set({ isBlocking: blocking }),
    
    decreaseDurability: (amount, itemId) => {
        const { inventory, rightHandItem } = get();
        
        // Find item in inventory
        const targetItem = inventory.find(i => i.id === itemId);
        if (!targetItem || targetItem.durability === undefined) return;
  
        const newDurability = targetItem.durability - amount;
        
        if (newDurability <= 0) {
            soundManager.playBrokenStick();
            const newInventory = inventory.filter(i => i.id !== itemId);
            
            const updates: any = {
                inventory: newInventory,
                previewItem: null
            };

            // If it was equipped, unequip it
            if (rightHandItem && rightHandItem.id === itemId) {
                updates.rightHandItem = null;
            }

            set(updates);
        } else {
            const updatedItem = { ...targetItem, durability: newDurability };
            const newInventory = inventory.map(i => i.id === itemId ? updatedItem : i);
            
            const updates: any = {
                inventory: newInventory,
            };

            if (rightHandItem && rightHandItem.id === itemId) {
                updates.rightHandItem = updatedItem;
            }

            set(updates);
        }
    },

    addImpact: (pos, normal) => {
        const { impacts } = get();
        const newImpact = { id: uuidv4(), position: pos, normal: normal, timestamp: Date.now() };
        // OPTIMIZATION: Keep 20 impacts
        const keptImpacts = [...impacts, newImpact].slice(-20);
        set({ impacts: keptImpacts });
    },
});

export const createCombatSliceInitialState = () => ({
    impacts: [],
    lastShotTime: 0,
    isBlocking: false,
    lastBlockHitTime: 0,
});
