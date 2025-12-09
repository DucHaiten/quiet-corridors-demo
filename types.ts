
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  GAME_WON = 'GAME_WON'
}

export type Language = 'en' | 'vi';

export interface LevelRecord {
  levelId: number;
  bestTime: number; // milliseconds
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Enemy {
  id: string;
  position: Vector3;
  hp: number;
  speed: number;
  lastHit: number;
}

export type AngelState = 'IDLE' | 'CHASING' | 'SEARCHING' | 'WANDERING';

export type SoundType = 'WALK' | 'RUN' | 'MELEE' | 'GUN';

export interface TheAngel {
    position: Vector3;
    rotationY: number;
    state: AngelState;
    targetPosition: Vector3 | null;
    lastHeardSoundTime: number;
    lastHeardSoundPos: Vector3 | null;
    isActive: boolean; // Activated by first sonar scan
    // Sanity-based appearance
    sanity19Triggered: boolean; // Appeared at sanity 19
    sanity9Triggered: boolean; // Appeared at sanity 9
    sanity0Active: boolean; // Active chase when sanity = 0
    appearanceTime: number; // Time when angel appeared (for 10s timer)
}

export interface Statue {
  id: string;
  position: Vector3;
  isMoving: boolean; // Visual debug state
}

export interface Trap {
  id: string;
  position: Vector3;
  triggered: boolean;
  triggerTime: number;
  hp: number;
  isLocked: boolean; // Cooldown state
  lockedUntil: number; // Timestamp
}

export interface Stick {
  id: string;
  position: Vector3;
  rotationY: number; // Visual rotation
  durability?: number; // Current durability if dropped
}

export interface DroppedItem {
    id: string;
    item: InventoryItem;
    position: Vector3;
    rotation: Vector3;
}

export interface Impact {
  id: string;
  position: Vector3;
  normal: Vector3; // Surface normal for orientation
  timestamp: number;
}

export interface Paper {
  id: string;
  position: Vector3;
  content: string;
}

export interface MissionIntel {
  title: string;
  briefing: string;
  tacticalTip: string;
}

// Inventory Types
export type ItemCategory = 'WEAPON' | 'CONSUMABLE' | 'KEY_ITEM' | 'MISC';

export interface InventoryItem {
  id: string;
  typeId?: string; // Optional type ID for grouping logic (e.g. 'weapon_stick')
  name: string;
  description: string;
  // Removed weight and value as requested
  category: ItemCategory;
  image?: string; 
  effect?: string;
  durability?: number;     // Current durability
  maxDurability?: number;  // Max durability. If undefined, item is permanent.
}

// Player Transform for Store sync
export interface PlayerTransform {
    position: Vector3;
    rotation: number; // Y rotation (yaw)
}

// Augment the global JSX namespace to include Three.js elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}