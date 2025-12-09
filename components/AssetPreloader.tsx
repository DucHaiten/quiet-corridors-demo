import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { STICK_MODEL_PATH, SONAR_MODEL_PATH, MAKAROV_MODEL_PATH, GLOCK17_MODEL_PATH, PILL_BOTTLE_MODEL_PATH, HEALTH_SOLUTION_MODEL_PATH, PAPER_MODEL_PATH, TRAP_MODEL_PATH, DEAD_BODY_MODEL_PATH } from '../constants';
import { SonarScreenMaterial } from './weapon/SonarShader';

// Shared Cache to be used by InventoryScene
export const modelCache: Record<string, THREE.Object3D> = {};

export const createInventoryClone = (sourceGltf: any) => {
    const clone = sourceGltf.scene.clone();
    clone.traverse((child: any) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            
            // CRITICAL FIX: CLONE THE MATERIAL
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material = mesh.material.map(m => m.clone());
                } else {
                    mesh.material = (mesh.material as THREE.Material).clone();
                }
            }

            // Apply Inventory-specific look (Bright Metal)
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach(mat => {
                if (mat instanceof THREE.MeshStandardMaterial) {
                    mat.metalness = 0.3; 
                    mat.roughness = 0.6;
                    mat.color = new THREE.Color(0xffffff); // Bright silver base
                    mat.emissive = new THREE.Color(0x222222); // Slight ambient boost
                }
            });
        }
    });
    return clone;
};

const AssetPreloader = () => {
    const isAssetLoading = useGameStore(state => state.isAssetLoading);
    const setAssetsLoaded = useGameStore(state => state.setAssetsLoaded);
    const { gl, scene } = useThree();
    const warmedUpRef = useRef(false);

    // Use hooks to get GLTFs
    const makarovGltf = useGLTF(MAKAROV_MODEL_PATH);
    const glockGltf = useGLTF(GLOCK17_MODEL_PATH);
    const stickGltf = useGLTF(STICK_MODEL_PATH);
    const sonarGltf = useGLTF(SONAR_MODEL_PATH);
    const shardGltf = useGLTF('/model/red_glass_shard.glb');
    const pillGltf = useGLTF(PILL_BOTTLE_MODEL_PATH);
    const healthSolutionGltf = useGLTF(HEALTH_SOLUTION_MODEL_PATH);

    useEffect(() => {
        // Warm once on mount, and again whenever loading is triggered.
        if (!isAssetLoading && warmedUpRef.current) return;
        warmedUpRef.current = true;

        // Defer heavy GLTF preloads until we actually enter a loading phase to avoid the menu hitch.
        useGLTF.preload(PAPER_MODEL_PATH);
        useGLTF.preload(TRAP_MODEL_PATH);
        useGLTF.preload(DEAD_BODY_MODEL_PATH);
        useGLTF.preload('/texture/stone_wall_texture.glb');
        useGLTF.preload('/texture/Wet_gravel_ground_texture.glb');
        useGLTF.preload('/model/the_angel_rig.glb');

        // 1. POPULATE CACHE
        if (!modelCache['weapon_makarov']) modelCache['weapon_makarov'] = createInventoryClone(makarovGltf);
        if (!modelCache['weapon_glock17']) modelCache['weapon_glock17'] = createInventoryClone(glockGltf);
        if (!modelCache['weapon_stick']) modelCache['weapon_stick'] = stickGltf.scene.clone(); 
        if (!modelCache['scan']) modelCache['scan'] = sonarGltf.scene.clone();
        if (!modelCache['pill_bottle']) modelCache['pill_bottle'] = createInventoryClone(pillGltf);
        if (!modelCache['health_solution']) {
            const clone = createInventoryClone(healthSolutionGltf);
            clone.traverse((child: any) => {
                if ((child as THREE.Mesh).isMesh && child.geometry?.center) {
                    child.geometry = child.geometry.clone();
                    child.geometry.center(); // keep pivot near the bottle center
                }
            });
            modelCache['health_solution'] = clone;
        }

        if (!modelCache['red_shard']) {
            const clone = shardGltf.scene.clone();
            clone.traverse((child: any) => {
                 if ((child as THREE.Mesh).isMesh) {
                     const mesh = child as THREE.Mesh;
                     if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material = mesh.material.map(m => m.clone());
                        } else {
                            mesh.material = (mesh.material as THREE.Material).clone();
                        }
                     }
                     const mat = mesh.material as THREE.MeshStandardMaterial;
                     if (mat) {
                         mat.emissive = new THREE.Color("#7f1d1d");
                         mat.emissiveIntensity = 0.5;
                         mat.roughness = 0.2;
                         mat.metalness = 0.8;
                     }
                 }
            });
            modelCache['red_shard'] = clone;
        }

        // 2. TEXTURE UPLOAD & SHADER WARMUP
        // Use a dummy scene to force compilation
        const dummyScene = new THREE.Scene();
        const ambient = new THREE.AmbientLight(0xffffff, 0.8); 
        const dir = new THREE.DirectionalLight(0xffffff, 2.5);
        // Use a camera that sees the objects
        const dummyCam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        dummyCam.position.set(0, 0, 5);

        dummyScene.add(ambient, dir);

        const heavyKeys = ['weapon_makarov', 'weapon_glock17', 'weapon_stick', 'scan', 'red_shard', 'pill_bottle', 'health_solution'];
        const disposable: Array<{ geo: THREE.BufferGeometry, mat: THREE.Material }> = [];
        
        heavyKeys.forEach(key => {
            const model = modelCache[key];
            if (model) {
                dummyScene.add(model);
                
                // FORCE TEXTURE UPLOAD
                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                        
                        mats.forEach((mat) => {
                            if (mat instanceof THREE.MeshStandardMaterial) {
                                if (mat.map) gl.initTexture(mat.map);
                                if (mat.normalMap) gl.initTexture(mat.normalMap);
                                if (mat.roughnessMap) gl.initTexture(mat.roughnessMap);
                                if (mat.metalnessMap) gl.initTexture(mat.metalnessMap);
                                if (mat.aoMap) gl.initTexture(mat.aoMap);
                                if (mat.emissiveMap) gl.initTexture(mat.emissiveMap);
                            }
                        });
                    }
                });
            }
        });

        // Warm up the sonar screen shader to avoid the first-scan hitch.
        try {
            const geo = new THREE.PlaneGeometry(0.12, 0.1);
            const mat = new (SonarScreenMaterial as any)() as THREE.Material;
            // @ts-ignore - shader uniforms exist at runtime
            if ((mat as any).uniforms?.uColor?.value?.set) {
                (mat as any).uniforms.uColor.value.set('#0011ff');
            }
            const sonarMesh = new THREE.Mesh(geo, mat);
            sonarMesh.position.set(0, 0, 2.5);
            sonarMesh.frustumCulled = false;
            dummyScene.add(sonarMesh);
            disposable.push({ geo, mat });
        } catch (e) {
            console.warn('Sonar shader warmup failed', e);
        }

        // FORCE RENDER
        // We render multiple frames to be safe, but one synchronous render is often enough.
        // We wrap in a requestAnimationFrame to allow the UI to update "Loading..." if needed,
        // but since we want to block until done, we can do it synchronously or async.
        
        // For "Loading Screen" feel, we want to ensure it's done before we report back.
        try {
            const originalViewport = new THREE.Vector4();
            gl.getViewport(originalViewport);
            gl.setViewport(0, 0, 2, 2); 
            
            const oldAutoClear = gl.autoClear;
            gl.autoClear = false;
            
            // Compile first
            gl.compile(dummyScene, dummyCam);
            
            // Draw call
            gl.render(dummyScene, dummyCam);
            
            // Restore
            gl.setViewport(originalViewport);
            gl.autoClear = oldAutoClear;
        } catch (e) {
            console.error("Asset warmup failed", e);
        }

        // Cleanup
        dummyScene.clear();
        disposable.forEach(({ geo, mat }) => {
            geo.dispose();
            mat.dispose();
        });
        
        console.log("Assets Warmed Up");
        
        // Small delay to ensure the GPU command buffer is flushed/submitted (pseudo-science, but safe)
        setTimeout(() => {
            setAssetsLoaded(true);
        }, 100);

    }, [isAssetLoading]);

    return null;
};

export default AssetPreloader;

