
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useGameStore } from '../store';
import { TRAP_MODEL_PATH, TRAP_TRIGGER_DIST, FOG_VISIBILITY_DIST, TRAP_AUDIO_MAX_DIST, TRAP_AUDIO_MIN_DIST, CULL_DIST_MEDIUM } from '../constants';
import * as THREE from 'three';
import { Trap } from '../types';
import { soundManager } from './SoundManager';

// The actual Risen Hand model
const RisenHand = ({ position, triggerTime, id }: { position: { x: number, y: number, z: number }, triggerTime: number, id: string }) => {
    const gltf = useGLTF(TRAP_MODEL_PATH);
    const groupRef = useRef<THREE.Group>(null); // Use Group as the main moving entity
    const { camera } = useThree();
    const isGodMode = useGameStore(state => state.isGodMode);
    const gameState = useGameStore(state => state.gameState);

    const randomOffset = useMemo(() => Math.random() * 100, []);
    const scene = useMemo(() => {
        const clone = gltf.scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = false; 
                child.receiveShadow = false; 
                child.frustumCulled = true;
                // TAGGING FOR HIT DETECTION (Visual Mesh)
                child.userData.type = 'trap';
                // Important: Attach ID so Weapon knows which trap to damage
                child.userData.id = id;
            }
        });
        return clone;
    }, [gltf, id]);
    
    useFrame((state) => {
        if (!groupRef.current) return;
        // PAUSE CHECK - Freeze trap animation when not playing
        if (gameState !== 'PLAYING') return;
        
        // --- DISTANCE CULLING (Technique #10) ---
        const distSq = camera.position.distanceToSquared(groupRef.current.position);
        if (distSq > CULL_DIST_MEDIUM * CULL_DIST_MEDIUM && !isGodMode) {
            groupRef.current.visible = false;
            return; 
        }
        groupRef.current.visible = true;

        // Apply God Mode Overlay Material dynamically if needed, or rely on outer group logic?
        // Simpler: If God mode, we can override material props on the children
        if (isGodMode) {
            groupRef.current.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                    if (mat.name !== 'godmode_mat') {
                         (child as THREE.Mesh).userData.origMat = mat;
                         (child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
                             color: '#ffffff',
                             depthTest: false,
                             depthWrite: false,
                             fog: false,
                             name: 'godmode_mat'
                         });
                    }
                }
            });
        }

        const now = Date.now();
        const elapsed = now - triggerTime;
        const time = state.clock.elapsedTime;
        
        const START_Y = -3.5;
        const TARGET_Y = 0.85; 
        const RISE_DURATION = 500;

        let currentY = START_Y;

        if (elapsed < RISE_DURATION) {
            const progress = Math.min(1, elapsed / RISE_DURATION);
            const easeOutBack = (x: number): number => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
            };
            currentY = START_Y + (easeOutBack(progress) * (TARGET_Y - START_Y));
            groupRef.current.position.y = currentY;
        } else {
            const bobSpeed = 2.0; 
            const bobAmp = 0.08; 
            const bobbing = Math.sin((time * bobSpeed) + randomOffset) * bobAmp;
            groupRef.current.position.y = TARGET_Y + bobbing;

            const swaySpeed = 1.5; 
            const swayAmp = 0.15; 
            const twitchSpeed = 8.0; 
            const twitchAmp = 0.02; 
            const swayX = (Math.sin((time * swaySpeed) + randomOffset) * swayAmp) + (Math.sin((time * twitchSpeed) + randomOffset) * twitchAmp);
            const swayZ = (Math.cos((time * (swaySpeed * 0.9)) + randomOffset) * swayAmp) + (Math.cos((time * (twitchSpeed * 1.2)) + randomOffset) * twitchAmp);
            const twist = Math.sin((time * 1.2) + randomOffset) * 0.05;

            groupRef.current.rotation.x = swayX;
            groupRef.current.rotation.z = swayZ;
            groupRef.current.rotation.y = twist;
        }
    });

    return (
        <group ref={groupRef} position={[position.x, -3.5, position.z]} userData={{ type: 'trap', id: id }}>
             <primitive 
                object={scene} 
                scale={[1.2, 1.2, 1.2]}
            />
        </group>
    );
};

// Visual marker for scanning hidden traps
const TrapDebugMarker = ({ position, isGodMode }: { position: {x:number, y:number, z:number}, isGodMode: boolean }) => {
    // God mode: White (#ffffff), Scan: Red (#ff0000)
    const color = isGodMode ? "#ffffff" : "#ff0000";

    return (
        <group position={[position.x, 0.05, position.z]}>
            {/* Inner Danger Zone */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={999}>
                <ringGeometry args={[0.2, 1.5, 16]} />
                <meshBasicMaterial 
                    color={color} 
                    transparent 
                    opacity={0.4} 
                    depthTest={false} 
                    depthWrite={false}
                    fog={false}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Outer Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={999}>
                <ringGeometry args={[1.5, 1.6, 16]} />
                <meshBasicMaterial 
                    color={color} 
                    transparent 
                    opacity={0.8} 
                    depthTest={false} 
                    depthWrite={false}
                    fog={false}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Spike indicator */}
            <mesh position={[0, 0.5, 0]} renderOrder={999}>
                 <coneGeometry args={[0.2, 1, 4]} />
                 <meshBasicMaterial 
                    color={color} 
                    depthTest={false} 
                    depthWrite={false}
                    fog={false}
                    wireframe
                />
            </mesh>
        </group>
    )
}

export default function RisenClawsTrap() {
    const traps = useGameStore(state => state.traps);
    const triggerTrap = useGameStore(state => state.triggerTrap);
    const gameState = useGameStore(state => state.gameState);
    const isScanning = useGameStore(state => state.isScanning);
    const isGodMode = useGameStore(state => state.isGodMode);
    const { camera } = useThree();

    const isTrapped = useGameStore(state => state.isTrapped);
    useEffect(() => {
        if (!isTrapped) soundManager.stopTrapScream();
    }, [isTrapped]);

    // Logic Loop
    useFrame(() => {
        if (gameState !== 'PLAYING') {
            soundManager.stopTrapDigging();
            return;
        }

        const playerPos = camera.position;
        let closestTrapDistSq = Infinity;
        let closestTrap: Trap | null = null;
        
        // Culling Limit for Logic
        const LOGIC_CULL_SQ = CULL_DIST_MEDIUM * CULL_DIST_MEDIUM;
        const now = Date.now();

        for (const trap of traps) {
            // Skip logic if trap is locked (in cooldown)
            // UNLESS cooldown has expired, in which case we let it run check again.
            // But strict check: isLocked=true means "recently beaten". 
            // We only process if (!isLocked OR now > lockedUntil)
            if (trap.isLocked && now < trap.lockedUntil) continue;

            if (trap.triggered) continue; // Already active

            const dx = playerPos.x - trap.position.x;
            const dz = playerPos.z - trap.position.z;
            const distSq = dx*dx + dz*dz;
            
            // Skip logic if too far
            if (distSq > LOGIC_CULL_SQ) continue;

            if (distSq < TRAP_TRIGGER_DIST * TRAP_TRIGGER_DIST) {
                triggerTrap(trap.id);
                soundManager.playTrapAttack();
                soundManager.playTrapScream();
            }

            if (distSq < closestTrapDistSq) {
                closestTrapDistSq = distSq;
                closestTrap = trap;
            }
        }

        const minSq = TRAP_AUDIO_MIN_DIST * TRAP_AUDIO_MIN_DIST; 
        const maxSq = TRAP_AUDIO_MAX_DIST * TRAP_AUDIO_MAX_DIST;

        if (closestTrap && closestTrapDistSq < maxSq && closestTrapDistSq > minSq) {
            const dist = Math.sqrt(closestTrapDistSq);
            const range = TRAP_AUDIO_MAX_DIST - TRAP_AUDIO_MIN_DIST; 
            const relativeDist = dist - TRAP_AUDIO_MIN_DIST; 
            const volume = 1 - (relativeDist / range); 

            const trapPos = new THREE.Vector3(closestTrap.position.x, 0, closestTrap.position.z);
            const toTrap = new THREE.Vector3().subVectors(trapPos, new THREE.Vector3(playerPos.x, 0, playerPos.z)).normalize();
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
            const pan = toTrap.dot(right);

            soundManager.updateTrapDigging(volume, pan);
        } else {
            soundManager.updateTrapDigging(0, 0);
        }
    });

    useEffect(() => {
        return () => {
            soundManager.stopTrapDigging();
            soundManager.stopTrapScream();
        };
    }, []);

    const showDebug = isGodMode;

    return (
        <group userData={{ isTrapContainer: true }}>
            {traps.map(trap => (
                <React.Fragment key={trap.id}>
                    {/* TRIGGERED: Show the animated model */}
                    {trap.triggered && (
                        <RisenHand position={trap.position} triggerTime={trap.triggerTime} id={trap.id} />
                    )}
                    
                    {/* SCANNING / GOD MODE: Show X-Ray debug marker for hidden/untriggered/locked traps */}
                    {showDebug && !trap.triggered && (
                        <TrapDebugMarker position={trap.position} isGodMode={isGodMode} />
                    )}
                </React.Fragment>
            ))}
        </group>
    );
}
