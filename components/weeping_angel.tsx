
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useGameStore } from '../store';
import { STATUE_SPEED, FOG_VISIBILITY_DIST, ANGEL_CRY_MAX_DIST, STATUE_KILL_DIST, CULL_DIST_MEDIUM } from '../constants';
import * as THREE from 'three';
import { soundManager } from './SoundManager';

// --- CONFIGURATION ---
const MODEL_PATH = '/model/weeping_angel.glb';
const MODEL_SCALE = 1.3;         
const WALL_CHECK_DIST = 1.2;

// --- SHADOW PROXY MATERIAL (Technique #1) ---
const ShadowProxyMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0, // Invisible
    depthWrite: false, // Don't occlude other objects
    colorWrite: false
});

const FallbackStatues: React.FC<{ count: number, levelObjects: React.MutableRefObject<THREE.Object3D[]> }> = ({ count, levelObjects }) => {
    const geometry = useMemo(() => new THREE.CapsuleGeometry(0.4, 1.8, 8, 16), []);
    // Fallback doesn't use proxies as it's already low poly
    return <StatueInstance geometry={geometry} yOffset={0.9} count={count} levelObjects={levelObjects} isFallback={true} />;
};

class ModelErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.warn("Statue Model failed to load.", error); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

const StatueInstance: React.FC<{
    geometry: THREE.BufferGeometry, 
    yOffset: number, 
    count: number, 
    levelObjects: React.MutableRefObject<THREE.Object3D[]>
    isFallback?: boolean
}> = ({ geometry, yOffset, count, levelObjects, isFallback = false }) => {
    
    // VISUAL MESH: High Poly (or Fallback), Casts NO Shadow, Receives Shadow
    const visualMeshRef = useRef<THREE.InstancedMesh>(null);
    
    // SHADOW PROXY MESH: Low Poly (Capsule), Casts Shadow, Invisible
    const shadowMeshRef = useRef<THREE.InstancedMesh>(null);
    const shadowGeo = useMemo(() => new THREE.CapsuleGeometry(0.5, 1.6, 4, 8), []);

    const { camera } = useThree();
    const triggerStatueDeath = useGameStore(state => state.triggerStatueDeath);
    const gameState = useGameStore(state => state.gameState);
    const statues = useGameStore(state => state.statues);
    const isGodMode = useGameStore(state => state.isGodMode);

    const dummy = useMemo(() => new THREE.Object3D(), []);
    const aiState = useRef<{pos: THREE.Vector3, active: boolean}[]>([]);

    useEffect(() => {
        aiState.current = statues.map(s => ({
            pos: new THREE.Vector3(s.position.x, s.position.y, s.position.z),
            active: true
        }));
    }, [statues]);

    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const wallRaycaster = useMemo(() => new THREE.Raycaster(), []);
    
    useEffect(() => {
        return () => soundManager.stopAngelCry();
    }, []);

    useFrame((state, delta) => {
        if (gameState !== 'PLAYING' || !visualMeshRef.current) {
            soundManager.stopAngelCry();
            return;
        }

        const playerPos = camera.position;
        const playerDir = new THREE.Vector3();
        camera.getWorldDirection(playerDir);
        playerDir.normalize();

        const dt = Math.min(delta, 0.1);
        const rayOrigin = playerPos; 

        let closestUnseenDist = ANGEL_CRY_MAX_DIST + 1; 
        const activeCount = Math.min(count, aiState.current.length);

        // --- DISTANCE CULLING (Technique #10) ---
        // We only process AI and rendering for statues within range.
        
        for (let i = 0; i < activeCount; i++) {
            const statue = aiState.current[i];
            const currentPos = statue.pos;

            const dx = playerPos.x - currentPos.x;
            const dz = playerPos.z - currentPos.z;
            const distFull = playerPos.distanceTo(currentPos);
            
            // CULLING CHECK
            // Only bypass if God mode (debug). Sonar no longer reveals statues.
            if (!isGodMode && distFull > CULL_DIST_MEDIUM) {
                // Move offscreen/scale zero to hide
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                visualMeshRef.current.setMatrixAt(i, dummy.matrix);
                if (shadowMeshRef.current) shadowMeshRef.current.setMatrixAt(i, dummy.matrix);
                continue; 
            }

            // A. Kill Logic
            const distXZ = Math.sqrt(dx * dx + dz * dz);
            if (distXZ < STATUE_KILL_DIST && statue.active) {
                 soundManager.playSnap();
                 soundManager.playAngelDeathCry();
                 triggerStatueDeath();
                 statue.active = false; 
            }

            // B. Visibility Logic
            let isVisible = false;
            if (distFull < FOG_VISIBILITY_DIST) {
                const targetPoint = currentPos.clone().add(new THREE.Vector3(0, 1.6, 0));
                const toStatue = new THREE.Vector3().subVectors(targetPoint, rayOrigin);
                const distToTarget = toStatue.length();
                toStatue.normalize();
                const dot = playerDir.dot(toStatue);
                
                if (dot > 0.5) {
                    raycaster.set(rayOrigin, toStatue);
                    raycaster.far = distToTarget - 0.2; 
                    const intersects = raycaster.intersectObjects(levelObjects.current, true);
                    if (intersects.length === 0) isVisible = true;
                }
            }

            // C. Audio
            if (!isVisible && statue.active) {
                if (distFull < closestUnseenDist) closestUnseenDist = distFull;
            }

            // D. Movement (Logic runs regardless of scanning, but frozen if scanning typically not affected)
            let isBlockedByWall = false;
            let shouldChase = false;

            if (!isVisible && statue.active) {
                const statueHead = currentPos.clone().add(new THREE.Vector3(0, 1.6, 0));
                const toPlayer = new THREE.Vector3().subVectors(playerPos, statueHead);
                const distToPlayer = toPlayer.length();
                toPlayer.normalize();
                raycaster.set(statueHead, toPlayer);
                raycaster.far = distToPlayer - 0.5;
                const losHits = raycaster.intersectObjects(levelObjects.current, true);
                if (losHits.length === 0) shouldChase = true;
            }

            if (shouldChase) {
                const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
                
                // Wall avoidance
                if (distFull < 25) {
                    const right = new THREE.Vector3().crossVectors(moveDir, new THREE.Vector3(0, 1, 0)).normalize();
                    const shoulderOffset = 0.4;
                    const origins = [
                        currentPos.clone().add(new THREE.Vector3(0, 1, 0)),
                        currentPos.clone().add(new THREE.Vector3(0, 1, 0)).addScaledVector(right, shoulderOffset),
                        currentPos.clone().add(new THREE.Vector3(0, 1, 0)).addScaledVector(right, -shoulderOffset)
                    ];
                    for(const origin of origins) {
                        wallRaycaster.set(origin, moveDir);
                        wallRaycaster.far = WALL_CHECK_DIST;
                        const wallHits = wallRaycaster.intersectObjects(levelObjects.current, true);
                        if (wallHits.length > 0) {
                            isBlockedByWall = true;
                            if (wallHits[0].distance < 0.5) {
                                const pushNormal = wallHits[0].face?.normal?.clone() || moveDir.clone().negate();
                                pushNormal.y = 0;
                                pushNormal.normalize();
                                currentPos.addScaledVector(pushNormal, 0.05); 
                            }
                            break;
                        }
                    }
                }

                if (!isBlockedByWall && distXZ > 0.8) {
                    const moveStep = STATUE_SPEED * dt;
                    currentPos.addScaledVector(moveDir, moveStep);
                }
                dummy.rotation.set(0, Math.atan2(dx, dz), 0);
            } else {
                dummy.rotation.set(0, Math.atan2(dx, dz), 0);
            }

            dummy.position.set(currentPos.x, currentPos.y + yOffset, currentPos.z);
            dummy.scale.setScalar(MODEL_SCALE);
            dummy.updateMatrix();
            
            // Update BOTH Visual and Shadow meshes
            visualMeshRef.current.setMatrixAt(i, dummy.matrix);
            
            if (!isFallback && shadowMeshRef.current) {
                shadowMeshRef.current.setMatrixAt(i, dummy.matrix);
            }
        }

        visualMeshRef.current.instanceMatrix.needsUpdate = true;
        if (shadowMeshRef.current) shadowMeshRef.current.instanceMatrix.needsUpdate = true;

        // E. Audio Logic
        if (closestUnseenDist < ANGEL_CRY_MAX_DIST) {
            const volume = Math.max(0, 1 - (closestUnseenDist / ANGEL_CRY_MAX_DIST));
            const curvedVolume = Math.pow(volume, 2); 
            soundManager.updateAngelCry(curvedVolume);
        } else {
            soundManager.updateAngelCry(0);
        }
    });

    return (
        <group>
            {/* VISUAL MESH: High Detail, Receives Shadow, NO CAST SHADOW */}
            <instancedMesh 
                ref={visualMeshRef} 
                args={[geometry, undefined, count]} 
                castShadow={false}
                receiveShadow={true}
                frustumCulled={false} // Manually culled inside loop
                renderOrder={isGodMode ? 999 : 0}
            >
                <meshStandardMaterial 
                    color={isGodMode ? "#ffffff" : "#64748b"}
                    roughness={0.9} 
                    metalness={0.1}
                    side={THREE.FrontSide} // Optimization #5
                    emissive={isGodMode ? "#ffffff" : "#000000"}
                    emissiveIntensity={isGodMode ? 5 : 0}
                    toneMapped={!isGodMode}
                    depthTest={!isGodMode}
                    depthWrite={!isGodMode}
                    fog={!isGodMode}
                    transparent={isGodMode}
                    opacity={isGodMode ? 0.8 : 1.0}
                />
            </instancedMesh>

            {/* SHADOW PROXY: Low Detail, CASTS SHADOW, Invisible (Technique #1) */}
            {!isFallback && (
                <instancedMesh
                    ref={shadowMeshRef}
                    args={[shadowGeo, undefined, count]}
                    castShadow={true}
                    receiveShadow={false}
                    frustumCulled={false}
                >
                    {/* Only writes depth for shadow map */}
                     <primitive object={ShadowProxyMaterial} attach="material" />
                </instancedMesh>
            )}
        </group>
    );
}

const WeepingAngel = () => {
    const { scene } = useThree();
    const statues = useGameStore(state => state.statues);
    const startTime = useGameStore(state => state.startTime);
    const count = statues.length;
    
    const levelObjects = useRef<THREE.Object3D[]>([]);
    useEffect(() => {
        const levels: THREE.Object3D[] = [];
        scene.traverse((child) => {
            if (child.userData.type === 'level') levels.push(child);
        });
        levelObjects.current = levels;
    }, [scene]);

    return (
        <ModelErrorBoundary key={startTime} fallback={<FallbackStatues count={count} levelObjects={levelObjects} />}>
            <RealStatueManager count={count} levelObjects={levelObjects} />
        </ModelErrorBoundary>
    )
};

const RealStatueManager = ({ count, levelObjects }: { count: number, levelObjects: any }) => {
    const gltf = useGLTF(MODEL_PATH);
    const { geometry, yOffset } = useMemo(() => {
        let foundGeom: THREE.BufferGeometry | null = null;
        let minY = 0;
        gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && !foundGeom) {
                const mesh = child as THREE.Mesh;
                foundGeom = mesh.geometry;
                mesh.updateMatrixWorld();
                foundGeom.computeBoundingBox();
                if (foundGeom.boundingBox) minY = foundGeom.boundingBox.min.y;
            }
        });
        if (!foundGeom) return { geometry: new THREE.CapsuleGeometry(0.5, 2, 8, 16), yOffset: 1 };
        return { geometry: foundGeom, yOffset: -minY * MODEL_SCALE };
    }, [gltf]);

    return <StatueInstance geometry={geometry} yOffset={yOffset} count={count} levelObjects={levelObjects} />
}

export default WeepingAngel;
