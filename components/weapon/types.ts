
import * as THREE from 'three';

export type WeaponCategory = 'MELEE' | 'PISTOL' | 'TOOL';

export interface WeaponConfig {
    typeId: string;
    name: string;
    category: WeaponCategory;
    modelPath: string;
    
    // Visual Transforms
    scale: [number, number, number];
    baseRotation: [number, number, number]; // Initial rotation correction (e.g. flipping model axis)
    
    // Positioning Offsets (Vector3 values)
    offsets: {
        idle: { pos: [number, number, number], rot: [number, number, number] }; // Holstered/Idle
        hip: [number, number, number]; // Active Hip Fire / Holding
        // ADS now supports explicit Position and Rotation
        ads?: {
            pos: [number, number, number];
            rot: [number, number, number];
        }; 
    };

    // Specific Logic Parameters
    animationFreq?: {
        idle: number;
        walk: number;
        sprint: number;
    };
}
