
import { WeaponConfig } from '../../types';
import { STICK_MODEL_PATH } from '../../../../constants';

export const StickConfig: WeaponConfig = {
    typeId: 'weapon_stick',
    name: 'Stick',
    category: 'MELEE',
    modelPath: STICK_MODEL_PATH,
    
    scale: [1, 1, 1],
    baseRotation: [0, 0, 0],

    offsets: {
        idle: { 
            pos: [0.2, -1.5, -0.5], 
            rot: [1.0, 0, 0] 
        },
        hip: [0.7, -0.75, -1.8]
        // Melee has no ADS
    }
};
