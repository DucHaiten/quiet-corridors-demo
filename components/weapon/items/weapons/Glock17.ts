
import { WeaponConfig } from '../../types';
import { GLOCK17_MODEL_PATH } from '../../../../constants';

export const Glock17Config: WeaponConfig = {
    typeId: 'weapon_glock17',
    name: 'Glock 17',
    category: 'PISTOL',
    modelPath: GLOCK17_MODEL_PATH,
    
    // Resized to 0.15 (was 0.1)
    scale: [0.12, 0.12, 0.12],
    // Corrected Rotation: 
    // Set to -90 degrees (-Math.PI / 2) to align barrel forward.
    // Logic: Group rotates -90. If Base is -90, Net is -180 (Forward if 0 is Backwards).
    baseRotation: [0, -Math.PI / 2, 0.0],

    offsets: {
        idle: { 
            pos: [0.2, -1.5, -0.5], 
            rot: [1.0, 0, 0] 
        },
        // Lowered Y from -0.2 to -0.4
        hip: [0.4, -0.4, -1.3],
        // Lowered Y from -0.155 to -0.3
        ads: {
            pos: [-0.001, -0.43, -0.9],
            rot: [0, -Math.PI / 2 + 0.01, -0.0]
        }
    }
};
