
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { InventoryItem } from '../../types';
import { getWeaponConfig } from './WeaponRegistry';

export const useWeaponModel = (equippedItem: InventoryItem | null, screenMatRef: React.MutableRefObject<any>) => {
    // 1. Get Config
    const config = useMemo(() => {
        if (!equippedItem) return null;
        return getWeaponConfig(equippedItem.typeId);
    }, [equippedItem?.typeId]);

    // 2. Load GLTF (Hooks must be unconditional, but we can't load dynamic paths easily in R3F without Suspense issues)
    // To solve "Rules of Hooks" with dynamic paths, we actually need to rely on the fact that
    // useGLTF caches based on URL. Since we preloaded them in the Config files, this is safe-ish.
    // However, calling useGLTF inside a conditional or loop is bad.
    // OPTIMIZATION: We just load the specific model needed based on the Config path.
    // Since we can't conditionally call useGLTF, we rely on the component remounting when key changes (in Weapon.tsx).
    
    // NOTE: This component is mounted with a `key={item.id}` in Weapon.tsx.
    // This means strictly speaking, `equippedItem` doesn't change for the lifecycle of this hook instance.
    // So we can safely use the config path.
    
    const gltf = useGLTF(config ? config.modelPath : '', true); // true = useDraco if available (not strictly needed but good practice)

    // Clone and OPTIMIZE the scene graph for FPV usage
    const weaponModel = useMemo(() => {
        // Reset ref on re-memo to avoid stale shader references
        if (screenMatRef) screenMatRef.current = null; 
        
        if (!equippedItem || !config || !gltf.scene) return null;

        const clone = gltf.scene.clone();
            
        // --- GRAPHICS OPTIMIZATION: FPV WEAPON ---
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;

                // 1. SHADOW CULLING
                mesh.castShadow = false;
                mesh.receiveShadow = true; 

                // 2. FRUSTUM CULLING OFF (Always visible)
                mesh.frustumCulled = false;
                
                // 3. DISABLE MATRIX AUTO UPDATE (We control it manually)
                mesh.matrixAutoUpdate = false;

                // 4. CRITICAL: DISABLE RAYCASTING ON WEAPON ITSELF
                mesh.raycast = () => {}; 
                
                // 4.5 CLONE MATERIAL (Fix for Inventory Bleed)
                // We also clone here so the main game logic doesn't dirty the cache
                if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material = mesh.material.map(m => m.clone());
                        } else {
                            mesh.material = (mesh.material as THREE.Material).clone();
                        }
                }

                // 5. MATERIAL OPTIMIZATION
                if (mesh.material) {
                    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    materials.forEach((mat) => {
                        if (mat instanceof THREE.MeshStandardMaterial) {
                            mat.side = THREE.FrontSide;
                            mat.depthWrite = true;
                            mat.depthTest = true;
                            
                            // PHYSICS FIX FOR WEAPONS VISIBILITY
                            // Lowered metalness significantly (0.1) so diffuse color shows in dark (no black reflections)
                            mat.metalness = 0.1; 
                            // Increased roughness (0.7) to scatter available light
                            mat.roughness = 0.7; 
                            mat.envMapIntensity = 0.5; 

                            // Lighter base color (Light Grey instead of Dark Grey)
                            mat.color.set(0xaaaaaa);
                            
                            // Faint emissive to prevent 100% black crushing
                            mat.emissive.set(0x222222);
                            mat.emissiveIntensity = 0.1;
                        }
                    });
                }
            }
        });

        // Normalize the model
        clone.position.set(0, 0, 0);
        clone.rotation.set(0, 0, 0);
        
        // SCALE LOGIC FROM CONFIG
        clone.scale.set(config.scale[0], config.scale[1], config.scale[2]);
        
        // Initial Rotation Correction (if any)
        if (config.baseRotation) {
            clone.rotation.set(config.baseRotation[0], config.baseRotation[1], config.baseRotation[2]);
        }
        
        return clone;
    }, [equippedItem, config, gltf, screenMatRef]);

    return weaponModel;
};
