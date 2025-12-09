
import { WeaponConfig } from './types';
import { MakarovConfig } from './items/weapons/MakarovPM';
import { Glock17Config } from './items/weapons/Glock17';
import { StickConfig } from './items/weapons/Stick';
import { SonarConfig } from './items/misc/Sonar';
import { PillBottleConfig } from './items/misc/PillBottle';
import { HealthSolutionConfig } from './items/misc/HealthSolution';

// Registry Map
const registry: Record<string, WeaponConfig> = {
    [MakarovConfig.typeId]: MakarovConfig,
    [Glock17Config.typeId]: Glock17Config,
    [StickConfig.typeId]: StickConfig,
    [SonarConfig.typeId]: SonarConfig,
    [PillBottleConfig.typeId]: PillBottleConfig,
    [HealthSolutionConfig.typeId]: HealthSolutionConfig
};

// Default fallback to prevent crashes if item type is missing
const DefaultConfig: WeaponConfig = {
    ...StickConfig,
    typeId: 'default'
};

export const getWeaponConfig = (typeId: string | undefined): WeaponConfig => {
    if (!typeId) return DefaultConfig;
    return registry[typeId] || DefaultConfig;
};
