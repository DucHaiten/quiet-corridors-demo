
import React, { useMemo } from 'react';
import { useGLTF, Instances, Instance } from '@react-three/drei';
import { useGameStore } from '../store';
import { PAPER_MODEL_PATH, STICK_MODEL_PATH, SONAR_MODEL_PATH, MAKAROV_MODEL_PATH, GLOCK17_MODEL_PATH, PILL_BOTTLE_MODEL_PATH, HEALTH_SOLUTION_MODEL_PATH } from '../constants';
import * as THREE from 'three';

// Deterministic pseudo-random number generator based on string seed (ID)
const seededRandom = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const normalized = Math.abs(hash) / 2147483647;
    return normalized;
};

const PaperManager = () => {
    const papers = useGameStore(state => state.papers);
    const sticks = useGameStore(state => state.sticks);
    const droppedItems = useGameStore(state => state.droppedItems);
    const isGodMode = useGameStore(state => state.isGodMode);
    const isScanning = useGameStore(state => state.isScanning);
    // Dev HUD toggle should not grant highlight; limit highlights to scan/god
    const highlightActive = isScanning || isGodMode;

    const paperGltf = useGLTF(PAPER_MODEL_PATH);
    const stickGltf = useGLTF(STICK_MODEL_PATH);
    const sonarGltf = useGLTF(SONAR_MODEL_PATH);
    const makarovGltf = useGLTF(MAKAROV_MODEL_PATH);
    const glock17Gltf = useGLTF(GLOCK17_MODEL_PATH);
    const shardGltf = useGLTF('/model/red_glass_shard.glb');
    const pillGltf = useGLTF(PILL_BOTTLE_MODEL_PATH);
    const healthSolutionGltf = useGLTF(HEALTH_SOLUTION_MODEL_PATH);

    const scanMat = useMemo(() => new THREE.MeshBasicMaterial({
        color: '#ff0000',
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
        fog: false
    }), []);

    const paperGlowGodMat = useMemo(() => new THREE.MeshBasicMaterial({
        color: '#00ff00',
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
    }), []);

    // Prepare Geometry/Materials for Instancing
    
    // --- PAPER ---
    const paperNode = useMemo(() => {
        let node: THREE.Mesh | null = null;
        paperGltf.scene.traverse(child => {
            if ((child as THREE.Mesh).isMesh && !node) node = child as THREE.Mesh;
        });
        return node;
    }, [paperGltf]);

    // --- STICK ---
    const stickNode = useMemo(() => {
        let node: THREE.Mesh | null = null;
        stickGltf.scene.traverse(child => {
            if ((child as THREE.Mesh).isMesh && !node) node = child as THREE.Mesh;
        });
        // Clone material to avoid modifying original GLTF cache if needed
        if (node && (node as THREE.Mesh).material) {
             const mat = ((node as THREE.Mesh).material as THREE.MeshStandardMaterial).clone();
             mat.emissive = new THREE.Color("#4a4a4a");
             mat.emissiveIntensity = 0.15;
             return { geometry: (node as THREE.Mesh).geometry, material: mat };
        }
        return null;
    }, [stickGltf]);

    // --- SONAR (For dropped items) ---
    const sonarNode = useMemo(() => {
        let node: THREE.Mesh | null = null;
        sonarGltf.scene.traverse(child => {
            if ((child as THREE.Mesh).isMesh && !node) node = child as THREE.Mesh;
        });
        // FrontSide optimization (Technique #5)
        if (node && (node as THREE.Mesh).material) {
            ((node as THREE.Mesh).material as THREE.Material).side = THREE.FrontSide;
        }
        return node;
    }, [sonarGltf]);

    // --- PISTOL (Dropped) ---
    const createPistolClone = (modelGltf: any) => {
        const clone = modelGltf.scene.clone();
        clone.traverse((child: any) => {
            if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh;
                m.castShadow = true;
                m.receiveShadow = true;
                // Clone material to ensure isolation from FPV weapon
                if (m.material) {
                    if (Array.isArray(m.material)) {
                        m.material = m.material.map(mat => mat.clone());
                    } else {
                        m.material = m.material.clone();
                    }

                    // APPLY VISIBILITY FIX (User Request: Make dropped guns visible in dark)
                    const materials = Array.isArray(m.material) ? m.material : [m.material];
                    materials.forEach(mat => {
                        if (mat instanceof THREE.MeshStandardMaterial) {
                            // Make it slightly emissive to be visible in dark
                            // 0x333333 is a dark grey, enough to separate from pitch black
                            mat.emissive = new THREE.Color(0x444444); 
                            mat.emissiveIntensity = 0.25;
                            
                            // Increase base brightness/reflectivity
                            mat.color = new THREE.Color(0xffffff); 
                            mat.metalness = 0.3; // Less metallic = less environment reflection (which is black)
                            mat.roughness = 0.7; // More diffuse light
                        }
                    });
                }
            }
        });
        return clone;
    };

    const pistolScene = useMemo(() => createPistolClone(makarovGltf), [makarovGltf]);
    const glockScene = useMemo(() => createPistolClone(glock17Gltf), [glock17Gltf]);

    // --- SHARD MODEL PREP ---
    const shardScene = useMemo(() => {
        const clone = shardGltf.scene.clone();
        clone.traverse((child) => {
             if ((child as THREE.Mesh).isMesh) {
                 const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                 if (mat) {
                     mat.emissive = new THREE.Color("#7f1d1d");
                     mat.emissiveIntensity = 0.5;
                     mat.roughness = 0.2;
                     mat.metalness = 0.8;
                 }
                 child.castShadow = true;
                 child.receiveShadow = true;
             }
        });
        return clone;
    }, [shardGltf]);

    // --- PILL BOTTLE MODEL ---
    const pillScene = useMemo(() => {
        const clone = pillGltf.scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                // Clone material to avoid sharing with inventory preview
                if (Array.isArray(mesh.material)) {
                    mesh.material = mesh.material.map(m => m.clone());
                } else if (mesh.material) {
                    mesh.material = (mesh.material as THREE.Material).clone();
                }

                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat) {
                    // Keep texture, but default emissive must stay almost off to avoid glowing when highlight is off
                    mat.emissive = mat.emissive ?? new THREE.Color('#0c0c0c');
                    mat.emissiveIntensity = 0.02;
                    mat.roughness = mat.roughness ?? 0.55;
                    mat.metalness = mat.metalness ?? 0.08;
                    mat.needsUpdate = true;
                }
            }
        });
        return clone;
    }, [pillGltf]);

    // --- HEALTH SOLUTION MODEL ---
    const healthSolutionScene = useMemo(() => {
        const clone = healthSolutionGltf.scene.clone();
        // Keep original textures; only isolate materials per instance
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                // Clone material so inventory and drop don't share state
                if (Array.isArray(mesh.material)) {
                    mesh.material = mesh.material.map(m => m.clone());
                } else if (mesh.material) {
                    mesh.material = (mesh.material as THREE.Material).clone();
                }
            }
        });
        return clone;
    }, [healthSolutionGltf]);

    // Split dropped items by type
    const sonarDrops = useMemo(() => droppedItems.filter(d => d.item.typeId === 'scan' || d.item.id === 'scan'), [droppedItems]);
    const shardDrops = useMemo(() => droppedItems.filter(d => d.item.typeId === 'red_shard' || d.item.id === 'red_shard'), [droppedItems]);
    const pistolDrops = useMemo(() => droppedItems.filter(d => d.item.typeId === 'weapon_makarov' || d.item.id === 'weapon_makarov'), [droppedItems]);
    const glockDrops = useMemo(() => droppedItems.filter(d => d.item.typeId === 'weapon_glock17' || d.item.id === 'weapon_glock17'), [droppedItems]);
    const pillDrops = useMemo(() => droppedItems.filter(d => d.item.typeId === 'pill_bottle' || d.item.id === 'pill_bottle'), [droppedItems]);
    const healthDrops = useMemo(() => droppedItems.filter(d => d.item.typeId === 'health_solution' || d.item.id === 'health_solution'), [droppedItems]);
    
    // Misc drops (Generic box)
    const miscDrops = useMemo(() => droppedItems.filter(d => 
        (d.item.typeId !== 'scan' && d.item.id !== 'scan') && 
        (d.item.typeId !== 'red_shard' && d.item.id !== 'red_shard') &&
        (d.item.typeId !== 'weapon_makarov' && d.item.id !== 'weapon_makarov') &&
        (d.item.typeId !== 'weapon_glock17' && d.item.id !== 'weapon_glock17') &&
        (d.item.typeId !== 'pill_bottle' && d.item.id !== 'pill_bottle') &&
        (d.item.typeId !== 'health_solution' && d.item.id !== 'health_solution')
    ), [droppedItems]);

    return (
        <group>
            {/* 1. INSTANCED PAPERS */}
            {paperNode && papers.length > 0 && (
                <>
                    <Instances 
                        range={papers.length} 
                        geometry={paperNode.geometry} 
                        material={highlightActive ? (isScanning ? scanMat : paperGlowGodMat) : paperNode.material}
                        frustumCulled={false} // Keep visible during scans
                        castShadow
                        receiveShadow
                    >
                    {papers.map(paper => (
                        <Instance
                            key={paper.id}
                            position={[paper.position.x, 0.01, paper.position.z]}
                            rotation={[0, Math.random() * Math.PI * 2, 0]} 
                            scale={isScanning ? [0.36, 0.36, 0.36] : [0.3, 0.3, 0.3]}
                            // Rotate flat on floor (GLTF specific)
                            quaternion={new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2, 0, 0))}
                        />
                    ))}
                    </Instances>
                </>
            )}

            {/* 2. INSTANCED STICKS */}
            {stickNode && sticks.length > 0 && (
                <>
                    <Instances
                        range={sticks.length}
                        geometry={stickNode.geometry}
                        material={highlightActive ? scanMat : stickNode.material}
                        receiveShadow
                        frustumCulled={false} // Force render to avoid disappearance near edges
                    >
                        {sticks.map(stick => {
                            // FIX: Calculate proper quaternion for "lying flat + random rotation"
                            // Rotate X 90 (lie flat), then Rotate Z (which is World Y after X-rotation)
                            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, stick.rotationY, 0));
                            
                            // FIX: Use deterministic scale based on ID to avoid jitter on re-render
                            const rng = seededRandom(stick.id);
                            // INCREASED SCALE: Was 0.4 + (rng * 0.3), now 0.6 + (rng * 0.3) (Slightly bigger)
                            const scaleVal = 0.6 + (rng * 0.3);

                            return (
                                <Instance
                                    key={stick.id}
                                    position={[stick.position.x, 0.1, stick.position.z]}
                                    scale={[scaleVal, scaleVal, scaleVal]}
                                    quaternion={q}
                                />
                            )
                        })}
                    </Instances>
                </>
            )}

            {/* 3. INSTANCED SONAR DROPS */}
            {sonarNode && sonarDrops.length > 0 && (
                <>
                    <Instances
                        range={sonarDrops.length}
                        geometry={sonarNode.geometry}
                        material={highlightActive ? scanMat : sonarNode.material}
                        castShadow={false} // Optimization: Small items don't need to cast shadows
                    >
                         {sonarDrops.map(drop => (
                            <Instance
                                key={drop.id}
                                position={[drop.position.x, 0.28, drop.position.z]} // Fix: Raised Y again to clear bottom rim (0.22 -> 0.28)
                                rotation={[drop.rotation.x, drop.rotation.y, drop.rotation.z]}
                                // INCREASED SCALE: Was 0.15 -> 0.25 (To be visibly larger than handgun but not huge)
                                scale={[0.25, 0.25, 0.25]} 
                            />
                        ))}
                    </Instances>
                </>
            )}

            {/* 4. PISTOL DROPS (Makarov) */}
            {pistolDrops.map(drop => {
                 const clone = pistolScene.clone();
                 clone.traverse((child: any) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const m = child as THREE.Mesh;
                        if (!m.userData.__origColor) {
                            m.userData.__origColor = (m.material as any).color?.clone?.();
                            m.userData.__origEmissive = (m.material as any).emissive?.clone?.();
                            m.userData.__origEmissiveIntensity = (m.material as any).emissiveIntensity;
                        }
                        const mat = m.material as THREE.MeshStandardMaterial;
                        if (highlightActive) {
                            if (mat.color) mat.color.set('#ff0000');
                            if (mat.emissive) mat.emissive.set('#ff0000');
                            mat.emissiveIntensity = 1.2;
                            mat.depthTest = false;
                            mat.depthWrite = false;
                            mat.fog = false;
                        } else if (m.userData.__origColor) {
                            mat.color?.copy(m.userData.__origColor);
                            if (mat.emissive && m.userData.__origEmissive) mat.emissive.copy(m.userData.__origEmissive);
                            if (m.userData.__origEmissiveIntensity !== undefined) mat.emissiveIntensity = m.userData.__origEmissiveIntensity;
                            mat.depthTest = true;
                            mat.depthWrite = true;
                            mat.fog = true;
                        }
                    }
                 });
                 return (
                    <group key={drop.id} position={[drop.position.x, 0.02, drop.position.z]} rotation={[0, drop.rotation.y, 0]}>
                        <primitive 
                            object={clone} 
                            // INCREASED SCALE: Was 1.5 -> 2.0 (Slightly bigger)
                            scale={[2.0, 2.0, 2.0]} 
                            rotation={[Math.PI / 2, 0, 0]} // Lie flat
                        />
                    </group>
                );
            })}

            {/* 5. GLOCK DROPS */}
            {glockDrops.map(drop => {
                 const clone = glockScene.clone();
                 clone.traverse((child: any) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const m = child as THREE.Mesh;
                        if (!m.userData.__origColor) {
                            m.userData.__origColor = (m.material as any).color?.clone?.();
                            m.userData.__origEmissive = (m.material as any).emissive?.clone?.();
                            m.userData.__origEmissiveIntensity = (m.material as any).emissiveIntensity;
                        }
                        const mat = m.material as THREE.MeshStandardMaterial;
                        if (highlightActive) {
                            if (mat.color) mat.color.set('#ff0000');
                            if (mat.emissive) mat.emissive.set('#ff0000');
                            mat.emissiveIntensity = 1.2;
                            mat.depthTest = false;
                            mat.depthWrite = false;
                            mat.fog = false;
                        } else if (m.userData.__origColor) {
                            mat.color?.copy(m.userData.__origColor);
                            if (mat.emissive && m.userData.__origEmissive) mat.emissive.copy(m.userData.__origEmissive);
                            if (m.userData.__origEmissiveIntensity !== undefined) mat.emissiveIntensity = m.userData.__origEmissiveIntensity;
                            mat.depthTest = true;
                            mat.depthWrite = true;
                            mat.fog = true;
                        }
                    }
                 });
                 return (
                    <group key={drop.id} position={[drop.position.x, 0.02, drop.position.z]} rotation={[0, drop.rotation.y, 0]}>
                        <primitive 
                            object={clone} 
                            // DECREASED SCALE: Was 0.15 -> 0.075 (Halved as requested)
                            scale={[0.075, 0.075, 0.075]} 
                            rotation={[Math.PI / 2, -Math.PI / 2, 0]} 
                        />
                     </group>
                );
            })}

            {/* 6. SHARD DROPS */}
            {shardDrops.map(drop => {
                const clone = shardScene.clone();
                clone.traverse((child: any) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const m = child as THREE.Mesh;
                        if (!m.userData.__origColor) {
                            m.userData.__origColor = (m.material as any).color?.clone?.();
                            m.userData.__origEmissive = (m.material as any).emissive?.clone?.();
                            m.userData.__origEmissiveIntensity = (m.material as any).emissiveIntensity;
                        }
                        const mat = m.material as THREE.MeshStandardMaterial;
                        if (highlightActive) {
                            if (mat.color) mat.color.set('#ff0000');
                            if (mat.emissive) mat.emissive.set('#ff0000');
                            mat.emissiveIntensity = 1.2;
                            mat.depthTest = false;
                            mat.depthWrite = false;
                            mat.fog = false;
                        } else {
                            // Force dim look regardless of original GLB emissive
                            if (m.userData.__origColor) mat.color?.copy(m.userData.__origColor);
                            mat.emissive = new THREE.Color('#0c0c0c');
                            mat.emissiveIntensity = 0.02;
                            mat.depthTest = true;
                            mat.depthWrite = true;
                            mat.fog = true;
                        }
                    }
                });
                return (
                    <group key={drop.id} position={[drop.position.x, 0.5, drop.position.z]} rotation={[0, drop.rotation.y, 0]}>
                        <primitive 
                            object={clone} 
                            scale={[0.2, 0.2, 0.2]} 
                            rotation={[0, 0, Math.PI / 6]}
                        />
                        <pointLight color="#ff0000" intensity={1} distance={2} decay={2} />
                    </group>
                );
            })}
            
            {/* 7. PILL BOTTLE DROPS */}
            {pillDrops.map(drop => {
                const clone = pillScene.clone();
                clone.traverse((child: any) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const m = child as THREE.Mesh;
                        // Ensure material is unique per instance before we mutate for highlight
                        if (Array.isArray(m.material)) {
                            m.material = m.material.map(mat => mat.clone());
                        } else if (m.material) {
                            m.material = m.material.clone();
                        }
                        if (!m.userData.__origColor) {
                            m.userData.__origColor = (m.material as any).color?.clone?.();
                            m.userData.__origEmissive = (m.material as any).emissive?.clone?.();
                            m.userData.__origEmissiveIntensity = (m.material as any).emissiveIntensity;
                        }
                        const mat = m.material as THREE.MeshStandardMaterial;
                        if (highlightActive) {
                            if (mat.color) mat.color.set('#ff0000');
                            if (mat.emissive) mat.emissive.set('#ff0000');
                            mat.emissiveIntensity = 1.1;
                            mat.depthTest = false;
                            mat.depthWrite = false;
                            mat.fog = false;
                        } else if (m.userData.__origColor) {
                            mat.color?.copy(m.userData.__origColor);
                            if (mat.emissive && m.userData.__origEmissive) mat.emissive.copy(m.userData.__origEmissive);
                            const restoreEmissiveIntensity = m.userData.__origEmissiveIntensity !== undefined ? m.userData.__origEmissiveIntensity : 0;
                            mat.emissiveIntensity = restoreEmissiveIntensity;
                            mat.depthTest = true;
                            mat.depthWrite = true;
                            mat.fog = true;
                        }
                    }
                });
                return (
                    <group key={drop.id} position={[drop.position.x, 0.01, drop.position.z]} rotation={[0, drop.rotation.y, 0]}>
                        {/* Slightly smaller (divide ~2.5x from previous) */}
                        <primitive object={clone} scale={[0.0016, 0.0016, 0.0016]} />
                    </group>
                );
            })}

            {/* 8. HEALTH SOLUTION DROPS */}
            {healthDrops.map(drop => {
                const clone = healthSolutionScene.clone(true);
                clone.traverse((child: any) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const m = child as THREE.Mesh;
                        // Ensure material is unique per instance before we mutate for highlight
                        if (Array.isArray(m.material)) {
                            m.material = m.material.map(mat => mat.clone());
                        } else if (m.material) {
                            m.material = m.material.clone();
                        }
                        if (!m.userData.__origColor) {
                            m.userData.__origColor = (m.material as any).color?.clone?.();
                            m.userData.__origEmissive = (m.material as any).emissive?.clone?.();
                            m.userData.__origEmissiveIntensity = (m.material as any).emissiveIntensity;
                        }
                        const mat = m.material as THREE.MeshStandardMaterial;
                        if (highlightActive) {
                            if (mat.color) mat.color.set('#ff0000');
                            if (mat.emissive) mat.emissive.set('#ff0000');
                            mat.emissiveIntensity = 1.1;
                            mat.depthTest = false;
                            mat.depthWrite = false;
                            mat.fog = false;
                        } else if (m.userData.__origColor) {
                            mat.color?.copy(m.userData.__origColor);
                            if (mat.emissive && m.userData.__origEmissive) mat.emissive.copy(m.userData.__origEmissive);
                            const restoreEmissiveIntensity = m.userData.__origEmissiveIntensity !== undefined ? m.userData.__origEmissiveIntensity : 0;
                            mat.emissiveIntensity = restoreEmissiveIntensity;
                            mat.depthTest = true;
                            mat.depthWrite = true;
                            mat.fog = true;
                        }
                    }
                });
                return (
                    <group key={drop.id} position={[drop.position.x, drop.position.y + 0.05, drop.position.z]} rotation={[0, drop.rotation.y, 0]}>
                        <primitive object={clone} scale={[0.0011, 0.0011, 0.0011]} />
                    </group>
                );
            })}
            
            {/* 9. MISC DROPS (Generic Box) */}
            {miscDrops.map(drop => (
                 <group key={drop.id} position={[drop.position.x, 0.1, drop.position.z]}>
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={[0.3, 0.3, 0.3]} />
                        <meshStandardMaterial 
                            color={highlightActive ? "#ff0000" : "#94a3b8"} 
                            emissive={highlightActive ? new THREE.Color("#ff0000") : undefined}
                            emissiveIntensity={highlightActive ? 0.8 : 0}
                            depthTest={!highlightActive}
                            depthWrite={!highlightActive}
                            fog={!highlightActive}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

export default PaperManager;
