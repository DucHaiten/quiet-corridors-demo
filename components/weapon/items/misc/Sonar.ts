
import { WeaponConfig } from '../../types';
import { SONAR_MODEL_PATH } from '../../../../constants';

export const SonarConfig: WeaponConfig = {
    typeId: 'scan',
    name: 'Sonar',
    category: 'TOOL',
    modelPath: SONAR_MODEL_PATH,
    
    scale: [0.33, 0.33, 0.33],
    baseRotation: [0, 0, 0],

    offsets: {
        idle: { 
            pos: [-0.2, -1.5, -0.5], 
            rot: [1.0, 0, 0] 
        },
        hip: [-0.35, -0.15, -0.95]
    }
};
