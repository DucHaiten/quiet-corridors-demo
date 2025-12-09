import { WeaponConfig } from '../../types';
import { PILL_BOTTLE_MODEL_PATH } from '../../../../constants';

export const PillBottleConfig: WeaponConfig = {
    typeId: 'pill_bottle',
    name: 'Pill Bottle',
    category: 'TOOL',
    modelPath: PILL_BOTTLE_MODEL_PATH,

    // Match inventory preview scale so hand-held size is consistent
    // Shrink to ~1/3 of previous hand-held size
    scale: [0.00183, 0.00183, 0.00183],
    // Rotate label inward toward player (flip 180° around Y)
    baseRotation: [0, Math.PI / 3 + Math.PI, 0],

    offsets: {
        idle: {
            pos: [-0.2, -1.5, -0.5],
            rot: [1.0, 0, 0]
        },
        hip: [-0.32, -0.22, -0.85]
    },

    animationFreq: {
        idle: 0,
        walk: 4.5,
        sprint: 8
    }
};

