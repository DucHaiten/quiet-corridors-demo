
import { create } from 'zustand';
import { GameSlice, createGameSlice } from './store/slices/game-slice';
import { PlayerSlice, createPlayerSlice } from './store/slices/player-slice';
import { EntitySlice, createEntitySlice } from './store/slices/entity-slice';
import { InventorySlice, createInventorySlice } from './store/slices/inventory-slice';
import { CombatSlice, createCombatSlice } from './store/slices/combat-slice';

// Combine all slice interfaces into the main GameStore interface
export type GameStore = GameSlice & PlayerSlice & EntitySlice & InventorySlice & CombatSlice;

export const useGameStore = create<GameStore>()((...a) => ({
  ...createGameSlice(...a),
  ...createPlayerSlice(...a),
  ...createEntitySlice(...a),
  ...createInventorySlice(...a),
  ...createCombatSlice(...a),
}));
