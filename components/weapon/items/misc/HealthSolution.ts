import { WeaponConfig } from '../../types';
import { HEALTH_SOLUTION_MODEL_PATH } from '../../../../constants';

export const HealthSolutionConfig: WeaponConfig = {
    typeId: 'health_solution',
    name: 'Health Solution',
    category: 'TOOL',
    modelPath: HEALTH_SOLUTION_MODEL_PATH,

    // Hand-held scale (30% smaller than before, inventory preview unaffected)
    scale: [0.00098, 0.00098, 0.00098],
    // Rotate label inward toward player; add slight extra Y to center label, keep forward tilt
    baseRotation: [0.35, Math.PI / 2.5 + Math.PI + 0.50, 0],

    offsets: {
        idle: {
            pos: [-0.12, -1.65, -0.5], // shift slightly right and lower
            rot: [1.0, 0, 0]
        },
        hip: [-0.24, -0.32, -0.85] // shift slightly right and lower
    },

    animationFreq: {
        idle: 0,
        walk: 4.5,
        sprint: 8
    }
};

