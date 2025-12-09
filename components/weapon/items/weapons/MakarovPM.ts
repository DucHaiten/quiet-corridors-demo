
import { WeaponConfig } from '../../types';
import { MAKAROV_MODEL_PATH } from '../../../../constants';

export const MakarovConfig: WeaponConfig = {
    typeId: 'weapon_makarov',
    name: 'Makarov PM',
    category: 'PISTOL',
    modelPath: MAKAROV_MODEL_PATH,
    
    scale: [4.0, 4.0, 4.0],
    baseRotation: [0, 0, 0], // Standard rotation

    offsets: {
        idle: { 
            pos: [0.2, -1.5, -0.5], 
            rot: [1.0, 0, 0] 
        },
        hip: [0.6, -0.28, -1.8],
        ads: {
            pos: [0.0, -0.25, -0.9],
            rot: [0, -Math.PI / 2, 0]
        }
    }
};
