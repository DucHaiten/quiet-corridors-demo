
import { Language } from '../types';

const STORAGE_KEY = 'MAZERUNNER_SAVE_V1';

export interface SaveData {
    maxUnlockedLevel: number;
    levelRecords: Record<number, number>;
    language: Language;
    volume: number;
    mouseSensitivity: number;
}

const DEFAULT_SAVE: SaveData = { 
    maxUnlockedLevel: 1, 
    levelRecords: {}, 
    language: 'en', 
    volume: 2, 
    mouseSensitivity: 0.5 
};

export const loadSaveData = (): SaveData => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) return { ...DEFAULT_SAVE, ...JSON.parse(data) };
    } catch (e) { console.error("Failed to load save", e); }
    return DEFAULT_SAVE;
};

export const saveGameData = (data: Partial<SaveData>) => {
    try {
        const current = loadSaveData();
        const newData = { ...current, ...data };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) { console.error("Failed to save", e); }
};

export const initialSave = loadSaveData();
