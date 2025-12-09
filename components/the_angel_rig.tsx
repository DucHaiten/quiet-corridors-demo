import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { soundManager } from './SoundManager';
import { MAP_SIZE, CELL_SIZE, PLAYER_SPEED } from '../constants';

// Player Walk Effective Speed ~ 3.85
// Player Run Effective Speed ~ 7.5
// Target: Slightly faster than walking, slower than running
const ANGEL_SPEED = 4.3; 

// Simple BFS Pathfinding
// Returns array of Vector3 waypoints
const findPath = (start: THREE.Vector3, end: THREE.Vector3, walls: {x:number, z:number}[]): THREE.Vector3[] => {
    // Grid Setup
    const gridSize = Math.floor(MAP_SIZE / CELL_SIZE); // Match maze-generator floor
    const offset = MAP_SIZE / 2;
    
    const toGrid = (val: number) => Math.floor((val + offset) / CELL_SIZE);
    const toWorld = (gridVal: number) => (gridVal * CELL_SIZE) - offset + (CELL_SIZE/2);
    
    const startGrid = { x: toGrid(start.x), y: toGrid(start.z) };
    const endGrid = { x: toGrid(end.x), y: toGrid(end.z) };
    
    // Bounds check
    if (startGrid.x < 0 || startGrid.x >= gridSize || startGrid.y < 0 || startGrid.y >= gridSize) return [];
    if (endGrid.x < 0 || endGrid.x >= gridSize || endGrid.y < 0 || endGrid.y >= gridSize) return [];

    // Blocked Set
    const blocked = new Set<string>();
    walls.forEach(w => {
        blocked.add(`${toGrid(w.x)},${toGrid(w.z)}`);
    });
    
    // BFS
    const queue: { x: number, y: number, path: {x:number, y:number}[] }[] = [];
    const visited = new Set<string>();
    
    queue.push({ x: startGrid.x, y: startGrid.y, path: [] });
    visited.add(`${startGrid.x},${startGrid.y}`);
    
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    
    // Limit iterations to prevent freezing on large maps
    let iterations = 0;
    const MAX_ITER = 15000; // Increased significantly for large maps

    // Track best incomplete path in case we don't reach target
    let bestPath: {x:number, y:number}[] = [];
    let minDistance = Infinity;

    while (queue.length > 0 && iterations < MAX_ITER) {
        iterations++;
        const { x, y, path } = queue.shift()!;
        
        const distToEnd = Math.abs(x - endGrid.x) + Math.abs(y - endGrid.y);
        
        if (distToEnd === 0) {
            // Found! Convert back to world coordinates
            return path.map(p => new THREE.Vector3(toWorld(p.x), 0, toWorld(p.y)));
        }

        // Track closest point reachable
        if (distToEnd < minDistance) {
            minDistance = distToEnd;
            bestPath = path;
        }
        
        // Optimize: Sort neighbors by distance to goal (Greedy BFS / A*ish)
        const neighbors = dirs.map(d => ({ x: x + d[0], y: y + d[1] }))
            .filter(n => 
                n.x >= 0 && n.x < gridSize && n.y >= 0 && n.y < gridSize &&
                !visited.has(`${n.x},${n.y}`) &&
                !blocked.has(`${n.x},${n.y}`)
            );

        // Sort by distance to end
        neighbors.sort((a, b) => {
            const distA = Math.abs(a.x - endGrid.x) + Math.abs(a.y - endGrid.y);
            const distB = Math.abs(b.x - endGrid.x) + Math.abs(b.y - endGrid.y);
            return distA - distB;
        });

        for (const n of neighbors) {
            visited.add(`${n.x},${n.y}`);
            queue.push({ x: n.x, y: n.y, path: [...path, n] });
        }
    }
    
    // Fallback: If no path found (island?), go to closest reachable point
    if (bestPath.length > 0) {
        return bestPath.map(p => new THREE.Vector3(toWorld(p.x), 0, toWorld(p.y)));
    }

    return []; // Stay put if trapped
};

export const TheAngelRig = () => {
    const group = useRef<THREE.Group>(null);
    const { scene: modelScene, animations } = useGLTF('/model/the_angel_rig.glb');
    const { actions } = useAnimations(animations, group);
    
    // Granular selectors to avoid re-rendering when 'position' changes in the store
    const isActive = useGameStore(state => state.theAngel?.isActive);
    const angelState = useGameStore(state => state.theAngel?.state);
    const targetPosition = useGameStore(state => state.theAngel?.targetPosition);
    const angelPosition = useGameStore(state => state.theAngel?.position);
    
    const updateTheAngel = useGameStore(state => state.updateTheAngel);
    const triggerJumpscare = useGameStore(state => state.triggerJumpscare);
    const isJumpscared = useGameStore(state => state.isJumpscared);
    const jumpscareStartTime = useGameStore(state => state.jumpscareStartTime);
    const isGodMode = useGameStore(state => state.isGodMode);
    const walls = useGameStore(state => state.walls);
    const sanity19Triggered = useGameStore(state => state.theAngel?.sanity19Triggered || false);
    const sanity9Triggered = useGameStore(state => state.theAngel?.sanity9Triggered || false);
    const sanity0Active = useGameStore(state => state.theAngel?.sanity0Active || false);
    const camera = useThree(state => state.camera);
    
    const visibleThroughWalls = isGodMode;
    const highlightColor = "#ffffff";

    const [path, setPath] = useState<THREE.Vector3[]>([]);
    const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
    const lastRecalculateTime = useRef(0);
    const lastChaseUpdate = useRef(0);
    
    // Animation references
    const idleAnimation = useRef<any>(null); // Animation 1
    const walkAnimation = useRef<any>(null); // Animation 2
    
    // Stutter & Visibility Logic
    const movementAccumulator = useRef(0);
    const visibilityTimer = useRef(0);
    
    // Initial Position Setup
    useEffect(() => {
        if (group.current) {
            const initPos = useGameStore.getState().theAngel?.position || { x: 0, y: 0, z: 0 };
            group.current.position.set(initPos.x, 0, initPos.z);
        }
    }, []);

    // Sync position when angel is activated
    useEffect(() => {
        if (isActive && group.current && angelPosition) {
            console.log('[ANGEL RIG] Syncing position:', angelPosition);
            group.current.position.set(angelPosition.x, 0, angelPosition.z);
        }
    }, [isActive, angelPosition]);

    // CRITICAL: Clear all effects immediately when angel deactivates
    useEffect(() => {
        if (!isActive) {
            console.log('[ANGEL RIG] Deactivated - clearing all effects');
            document.documentElement.style.setProperty('--interference-opacity', '0');
            soundManager.updateHeartBeat(0, 1.0);
            soundManager.updateAngelRigSound(0);
            soundManager.stopAngelCry();
            
            // Stop all animations
            if (actions) {
                Object.values(actions).forEach(action => action?.stop());
            }
            
            // Reset timers
            lastNoiseUpdate.current = 0;
            lastLightUpdate.current = 0;
            visibilityTimer.current = 0;
        }
    }, [isActive, actions]);

    // Store original light intensities to restore them later or dim them relative to base
    const sceneLights = useRef<{ light: THREE.Light, baseIntensity: number }[]>([]);
    const { scene } = useThree();
    const gameState = useGameStore(state => state.gameState); // ADDED: Needed for pause check
    const isInventoryOpen = useGameStore(state => state.isInventoryOpen);

    const blockedGrid = useMemo(() => {
        const offset = MAP_SIZE / 2;
        const set = new Set<string>();
        walls.forEach(w => {
            set.add(`${Math.floor((w.x + offset)/CELL_SIZE)},${Math.floor((w.z + offset)/CELL_SIZE)}`);
        });
        return set;
    }, [walls]);

    // Find Head Bone
    const headBone = useMemo(() => {
        let bone: THREE.Object3D | null = null;
        modelScene.traverse((child) => {
            // Check for standard naming conventions (Mixamo, Blender, etc.)
            if ((child as THREE.Bone).isBone && 
                (child.name.toLowerCase().includes('head') || child.name.toLowerCase().includes('neck'))) {
                 // Prefer "Head" over "Neck"
                 if (!bone || child.name.toLowerCase().includes('head')) {
                     bone = child;
                 }
            }
        });
        return bone;
    }, [modelScene]);

    // Initial Setup & Material Override for Scanning
    useEffect(() => {
        // PERF: Disable raycasting on high-poly model
        modelScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                // We only want to raycast against the invisible capsule for game logic
                (child as THREE.Mesh).raycast = () => {}; 
            }
        });

        // 1. Capture Scene Lights
        const lights: { light: THREE.Light, baseIntensity: number }[] = [];
        scene.traverse((obj) => {
            if ((obj as any).isLight && obj.userData.isMainLight) {
                lights.push({ 
                    light: obj as THREE.Light, 
                    baseIntensity: obj.userData.originalIntensity || (obj as THREE.Light).intensity 
                });
                // Store original in userData so re-renders don't compound-dim
                if (!obj.userData.originalIntensity) {
                    obj.userData.originalIntensity = (obj as THREE.Light).intensity;
                }
            }
        });
        sceneLights.current = lights;

        if (group.current) {
            group.current.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    
                    if (visibleThroughWalls) {
                        // Store original material if needed? For now just clone and swap
                        if (!mesh.userData.originalMat) {
                             mesh.userData.originalMat = mat.clone();
                        }
                        
                        mesh.material = new THREE.MeshStandardMaterial({
                            color: highlightColor,
                            emissive: highlightColor,
                            emissiveIntensity: 2,
                            transparent: true,
                            opacity: 0.8,
                            depthTest: false,
                            depthWrite: false,
                            fog: false
                        });
                        mesh.renderOrder = 999;
                    } else {
                        // Restore original material
                        if (mesh.userData.originalMat) {
                            mesh.material = mesh.userData.originalMat;
                            mesh.renderOrder = 0;
                        }
                    }
                }
            });
        }

        if (actions) {
            console.log("TheAngel Available animations:", Object.keys(actions));

            // Find Animation 1 (Idle) and Animation 2 (Walk)
            const keys = Object.keys(actions);
            if (keys.length >= 2) {
                // Animation 1 = Idle (standing still)
                idleAnimation.current = actions[keys[0]] || actions["Animation 1"] || null;
                // Animation 2 = Walk (movement)
                walkAnimation.current = actions[keys[1]] || actions["Animation 2"] || null;
                
                console.log("TheAngel Animations setup:", {
                    idle: keys[0],
                    walk: keys[1]
                });
            } else if (keys.length > 0) {
                // Fallback: Use first animation for both
                idleAnimation.current = actions[keys[0]];
                walkAnimation.current = actions[keys[0]];
            }

            // Start with walk animation by default
            if (walkAnimation.current) {
                Object.values(actions).forEach(action => action?.stop());
                walkAnimation.current.reset().fadeIn(0.5).play();
                walkAnimation.current.setLoop(THREE.LoopRepeat, Infinity);
                walkAnimation.current.timeScale = 1.85;
            }
        }
    }, [actions, visibleThroughWalls, highlightColor]);

    // Sonar is no longer used to activate angel
    // Angel only appears based on sanity level

    // Pathfinding Calculation
    useEffect(() => {
        if (!isActive || !targetPosition) {
            console.log('[ANGEL] Skipping pathfinding:', { isActive, hasTarget: !!targetPosition });
            return;
        }
        
        const start = group.current ? group.current.position : new THREE.Vector3(0,0,0); // Use current visual pos
        const end = new THREE.Vector3(targetPosition.x, 0, targetPosition.z);
        
        console.log('[ANGEL] Calculating path from', start, 'to', end);
        
        // Run pathfinding
        const newPath = findPath(start, end, walls);
        setPath(newPath);
        setCurrentWaypointIndex(0);
        
        console.log('[ANGEL] Path calculated:', newPath.length, 'waypoints');

    }, [targetPosition, walls, isActive]);

    useEffect(() => {
        return () => {
            soundManager.stopAngelRigSound();
            soundManager.stopHeartBeat();
            document.documentElement.style.setProperty('--interference-opacity', '0');
            // Restore all captured main lights to their original intensity on unmount
            sceneLights.current.forEach(({ light, baseIntensity }) => {
                if (light.intensity !== baseIntensity) {
                    light.intensity = baseIntensity;
                }
            });
        };
    }, []);

    const lastNoiseUpdate = useRef(0);
    const lastLightUpdate = useRef(0);

    useFrame((state, delta) => {
        // CRITICAL: Clear effects FIRST if not active, before any other checks
        if (!isActive) {
            if (modelScene.visible) {
                modelScene.visible = false;
            }
            // Force clear ALL effects
            document.documentElement.style.setProperty('--interference-opacity', '0');
            soundManager.updateHeartBeat(0, 1.0);
            soundManager.updateAngelRigSound(0);
            
            // Restore lights to base intensity
            sceneLights.current.forEach(({ light, baseIntensity }) => {
                if (light.intensity !== baseIntensity) {
                    light.intensity = baseIntensity;
                }
            });
            
            return; // Skip all logic if not active
        }

        if (!group.current) return;

        // PAUSE CHECK
        const allowInventoryTick = isInventoryOpen && gameState === 'PAUSED';
        if (gameState !== 'PLAYING' && !allowInventoryTick) {
            soundManager.updateAngelRigSound(0); // Mute
            soundManager.updateHeartBeat(0, 1.0); // Mute
            return;
        }
        
        const now = Date.now();
        const playerDist = group.current.position.distanceTo(camera.position);
        
        // VISIBILITY LOGIC
        // Sanity-based appearances (40, 20): Always visible when active (no flicker)
        // Sanity 0 chase: Use visibility cycle for horror effect
        // Scanning/GodMode: Always visible
        let shouldBeVisible = false;
        
        if (visibleThroughWalls || isJumpscared) {
            // Always visible when scanning or in jumpscare
            shouldBeVisible = true;
        } else if (sanity19Triggered || sanity9Triggered) {
            // Sanity 40 and 20: Always visible during their chase appearances
            shouldBeVisible = true;
        } else if (sanity0Active) {
            // Sanity 0 chase: Use flicker cycle for horror
            visibilityTimer.current += delta;
            const cycleTime = 8.0;
            const inVisiblePhase = (visibilityTimer.current % cycleTime) < 3.0;
            shouldBeVisible = inVisiblePhase;
        }
        
        if (modelScene.visible !== shouldBeVisible) {
            modelScene.visible = shouldBeVisible;
        }

        // JUMPSCARE CHECK
        if (playerDist < 3.0 && !isJumpscared) {
            // Reverted to simple geometric calculation for reliability
            // Group Y is at feet (0). Head is ~2.4m up.
            const headPos = group.current.position.clone().add(new THREE.Vector3(0, 2.4, 0));
            triggerJumpscare(headPos);
        }

        // --- STUTTER MOVEMENT SETUP ---
        // Default: 0.2s (5 FPS) - Low frame rate for stutter
        let stutterInterval = 0.2; 
        
        // Increase lag/stutter randomness
        const randomLag = Math.random() > 0.7 ? 0.15 : 0; // Occasional extra lag
        
        if (angelState === 'CHASING') {
            stutterInterval = 0.08 + randomLag; // ~12 FPS + spikes
        }
        // Frenzy when close or killing
        if (playerDist < 5.0 || isJumpscared) {
            stutterInterval = 0.05 + (Math.random() * 0.05); // Variable erratic stutter
        }

        movementAccumulator.current += delta;

        // --- CLIMAX EFFECTS (DURING JUMPSCARE) ---
        if (isJumpscared) {
             // Only update visuals if stutter threshold reached
             if (movementAccumulator.current >= stutterInterval) {
                 const jumpDt = movementAccumulator.current;
                 movementAccumulator.current = 0; // Consume
                 
                 // Force look at player (Face the camera) with jitter
                 const targetLookAt = camera.position.clone();
                 // Add random twitch to head position focus
                 targetLookAt.x += (Math.random() - 0.5) * 0.5;
                 targetLookAt.y = group.current.position.y; 
                 group.current.lookAt(targetLookAt);
                 
                 // Spasm/Shake effect during kill
                 const shakeAmount = 0.15;
                 group.current.position.x += (Math.random() - 0.5) * shakeAmount;
                 group.current.position.z += (Math.random() - 0.5) * shakeAmount;
             }

             const elapsed = now - jumpscareStartTime;
             const DURATION = 3000;
             const progress = Math.min(1.0, elapsed / DURATION);
             
             // RAMP UP
             const noiseOpacity = Math.pow(progress, 3); 
             document.documentElement.style.setProperty('--interference-opacity', noiseOpacity.toFixed(2));
             
             const volume = 1.0 + (progress * 4.0); 
             soundManager.updateAngelRigSound(volume);
             soundManager.updateHeartBeat(volume, 4.0); 

             return; // FREEZE ANGEL (No movement updates)
        }

        // --- 1. UPDATE NOISE & HEARTBEAT & LIGHT (Throttled) ---
        // ONLY apply effects if angel is ACTIVE
        if (now - lastNoiseUpdate.current > 50) { 
            lastNoiseUpdate.current = now;
            
            if (isActive && playerDist < 50) {
                // Intensity: 0 at 50m, 1 at 0m
                const rawIntensity = 1 - (playerDist / 50);
                
                // 1. Noise (Capped Opacity)
                const visualNoise = Math.pow(rawIntensity, 1.5) * 0.15; 
                const steppedIntensity = Math.floor(visualNoise * 20) / 20; 
                
                document.documentElement.style.setProperty('--interference-opacity', steppedIntensity.toFixed(2));
                
                // 2. Heartbeat - All sanity modes
                const heartVol = Math.pow(rawIntensity, 1.8) * 1.8; // Boosted volume and more gradual curve
                const heartRate = 1.0 + (rawIntensity * 2.5); // Faster heart rate when close (up to 3.5x)
                soundManager.updateHeartBeat(heartVol, heartRate);

                // 3. Lighting
                const lightFactor = Math.max(0.0, 1.0 - (rawIntensity * 1.3));
                
                if (now - lastLightUpdate.current > 100) { 
                    lastLightUpdate.current = now;
                    sceneLights.current.forEach(({ light, baseIntensity }) => {
                        light.intensity = baseIntensity * lightFactor;
                    });
                }

            } else if (!isActive || playerDist >= 50) {
                // Clear all effects when angel not active or too far
                document.documentElement.style.setProperty('--interference-opacity', '0');
                soundManager.updateHeartBeat(0, 1.0);
                
                if (now - lastLightUpdate.current > 500) {
                    lastLightUpdate.current = now;
                    sceneLights.current.forEach(({ light, baseIntensity }) => {
                        if (light.intensity !== baseIntensity) {
                            light.intensity = baseIntensity;
                        }
                    });
                }
            }

            // --- 4. ANGEL RIG SOUND ---
            if (playerDist < 30) {
                const rawRigIntensity = 1 - (playerDist / 30);
                const rigVol = Math.pow(rawRigIntensity, 0.3) * 1.8; // Boosted base volume + faster increase
                soundManager.updateAngelRigSound(rigVol);
            } else {
                soundManager.updateAngelRigSound(0);
            }
        }

        // --- CHASE: Update target position periodically (all chase modes) ---
        if (angelState === 'CHASING' && now - lastChaseUpdate.current > 2000) {
            lastChaseUpdate.current = now;
            // Force update target to current player position
            updateTheAngel({
                targetPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                state: 'CHASING'
            });
        }

        // --- STUTTER CHECK FOR MOVEMENT ---
        if (movementAccumulator.current < stutterInterval) {
            return; // Skip visual movement updates this frame
        }
        
        // Consume accumulator and use it as delta for movement
        const dt = movementAccumulator.current;
        movementAccumulator.current = 0;

        // "Network Lag" Effect: Jump forward significantly more than usual for the time elapsed
        // To simulate "teleporting" forward due to lag
        const lagSpikeMultiplier = Math.random() > 0.85 ? 2.5 : 1.0; 
        
        // Compensate speed to ensure average speed remains ANGEL_SPEED
        // If we jump 2.5x distance 15% of the time, and 1.0x distance 85% of the time:
        // Average multiplier = (2.5 * 0.15) + (1.0 * 0.85) = 0.375 + 0.85 = 1.225
        // So we need to divide by 1.225 to keep the average speed correct
        const compensationFactor = 1.0 / 1.225;
        
        const effectiveDelta = dt * lagSpikeMultiplier * compensationFactor;

        // --- MOVEMENT ---
        // Check if in sanity-based appearance mode
        // Sanity 40/20: Chase behavior (state-driven)
        // Sanity 0: Normal chase behavior (PRIORITY - overrides all)
        // CRITICAL: sanity0Active must override everything
        const isInSanityIdleMode = !sanity0Active && (sanity19Triggered || sanity9Triggered) && angelState !== 'CHASING';
        
        // DEBUG: Log if state seems wrong
        if (sanity0Active && isInSanityIdleMode) {
            console.error('[ANGEL] BUG: sanity0Active but still in idle mode!', {
                sanity0Active,
                sanity19Triggered,
                sanity9Triggered
            });
        }

        if (!isInSanityIdleMode) {
            // Switch to walk animation when moving
            if (walkAnimation.current && !walkAnimation.current.isRunning()) {
                if (idleAnimation.current && idleAnimation.current.isRunning()) {
                    idleAnimation.current.fadeOut(0.3);
                }
                walkAnimation.current.reset().fadeIn(0.3).play();
                walkAnimation.current.setLoop(THREE.LoopRepeat, Infinity);
                walkAnimation.current.timeScale = 1.85;
            }
            
            // Normal movement logic
            if (path.length > 0 && currentWaypointIndex < path.length) {
                // Following path
                const target = path[currentWaypointIndex];
                const currentPos = group.current.position.clone();
            
            const direction = new THREE.Vector3().subVectors(target, currentPos);
            direction.y = 0; // Flatten
            const dist = direction.length();
            
            if (dist < 0.2) { // Reduced threshold for smoother transitions
                // Reached waypoint
                setCurrentWaypointIndex(prev => prev + 1);
            } else {
                direction.normalize();
                
                // Rotation (Snap rotation more abruptly for scary effect)
                const targetRotation = Math.atan2(direction.x, direction.z);
                let rotDiff = targetRotation - group.current.rotation.y;
                while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                
                // Less smoothing on rotation for jerkiness
                group.current.rotation.y += rotDiff * 0.8; 

                // Move
                const moveAmount = ANGEL_SPEED * effectiveDelta;
                let newX = currentPos.x + direction.x * moveAmount;
                let newZ = currentPos.z + direction.z * moveAmount;
                
                // Final hard clamp to map boundaries to prevent escaping
                const limit = MAP_SIZE / 2 - 2;
                newX = Math.max(-limit, Math.min(limit, newX));
                newZ = Math.max(-limit, Math.min(limit, newZ));

                group.current.position.set(newX, 0, newZ);
                
                // Sync to store (throttled)
                if (state.clock.elapsedTime % 0.5 < dt) {
                    updateTheAngel({ position: { x: newX, y: 0, z: newZ } });
                }
            }
        } else if (angelState === 'CHASING' && targetPosition) {
             // Final Approach: Path finished (reached grid center), but we want to reach the EXACT target position
             // This fixes the issue where the enemy stops at the center of the tile (potentially >3m away)
             const currentPos = group.current.position.clone();
             const target = new THREE.Vector3(targetPosition.x, 0, targetPosition.z);
             
             const direction = new THREE.Vector3().subVectors(target, currentPos);
             direction.y = 0;
             const dist = direction.length();

             if (dist > 0.5) {
                 direction.normalize();
                 // Rotate
                 const targetRotation = Math.atan2(direction.x, direction.z);
                 let rotDiff = targetRotation - group.current.rotation.y;
                 while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                 while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                 group.current.rotation.y += rotDiff * 0.8;

                 // Move
                 const moveAmount = ANGEL_SPEED * effectiveDelta;
                 let newX = currentPos.x + direction.x * moveAmount;
                 let newZ = currentPos.z + direction.z * moveAmount;
                 
                 const limit = MAP_SIZE / 2 - 2;
                 newX = Math.max(-limit, Math.min(limit, newX));
                 newZ = Math.max(-limit, Math.min(limit, newZ));

                 group.current.position.set(newX, 0, newZ);
                 
                 // Sync
                 if (state.clock.elapsedTime % 0.5 < dt) {
                    updateTheAngel({ position: { x: newX, y: 0, z: newZ } });
                 }
             }
        } else if (angelState === 'CHASING' && path.length === 0) {
            // FALLBACK: If chasing but no path, move directly towards player
            // This handles cases where pathfinding fails or player position updated
            console.log('[ANGEL] Chasing with no path - moving directly to player');
            const currentPos = group.current.position.clone();
            const target = new THREE.Vector3(camera.position.x, 0, camera.position.z);
            
            const direction = new THREE.Vector3().subVectors(target, currentPos);
            direction.y = 0;
            const dist = direction.length();

            if (dist > 0.5) {
                direction.normalize();
                
                // Rotate
                const targetRotation = Math.atan2(direction.x, direction.z);
                let rotDiff = targetRotation - group.current.rotation.y;
                while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                group.current.rotation.y += rotDiff * 0.8;

                // Move directly towards player
                const moveAmount = ANGEL_SPEED * effectiveDelta;
                let newX = currentPos.x + direction.x * moveAmount;
                let newZ = currentPos.z + direction.z * moveAmount;
                
                const limit = MAP_SIZE / 2 - 2;
                newX = Math.max(-limit, Math.min(limit, newX));
                newZ = Math.max(-limit, Math.min(limit, newZ));

                group.current.position.set(newX, 0, newZ);
                
                // Sync
                if (state.clock.elapsedTime % 0.5 < dt) {
                   updateTheAngel({ position: { x: newX, y: 0, z: newZ } });
                }
            }
        } else if (path.length === 0 && (angelState === 'SEARCHING' || angelState === 'WANDERING')) {
             // Random wander
             if (Math.random() < 0.02) { 
                 const gridSize = Math.floor(MAP_SIZE / CELL_SIZE);
                 const offset = MAP_SIZE / 2;
                 let found = false;
                 let attempts = 0;

                 while(!found && attempts < 20) {
                     const rx = Math.floor(Math.random() * gridSize);
                     const ry = Math.floor(Math.random() * gridSize);
                     
                     if (!blockedGrid.has(`${rx},${ry}`)) {
                         found = true;
                         const tx = (rx * CELL_SIZE) - offset + CELL_SIZE/2;
                         const tz = (ry * CELL_SIZE) - offset + CELL_SIZE/2;
                         
                         updateTheAngel({ 
                            state: 'WANDERING', 
                            targetPosition: new THREE.Vector3(tx, 0, tz) 
                         });
                     }
                     attempts++;
                 }
             }
            }
        } else if (isInSanityIdleMode) {
            // Sanity-based appearance: Stand still and look at player
            // Switch to idle animation (Animation 1) when standing still
            if (idleAnimation.current && !idleAnimation.current.isRunning()) {
                if (walkAnimation.current && walkAnimation.current.isRunning()) {
                    walkAnimation.current.fadeOut(0.3);
                }
                idleAnimation.current.reset().fadeIn(0.3).play();
                idleAnimation.current.setLoop(THREE.LoopRepeat, Infinity);
                idleAnimation.current.timeScale = 1.0; // Normal speed for idle
            }
            
            // Always look at player during sanity appearances (both 40 and 20)
            const targetLookAt = camera.position.clone();
            targetLookAt.y = group.current.position.y;
            group.current.lookAt(targetLookAt);
        } else {
            // Fallback: Switch to walk animation
            if (walkAnimation.current && !walkAnimation.current.isRunning()) {
                if (idleAnimation.current && idleAnimation.current.isRunning()) {
                    idleAnimation.current.fadeOut(0.3);
                }
                walkAnimation.current.reset().fadeIn(0.3).play();
                walkAnimation.current.setLoop(THREE.LoopRepeat, Infinity);
                walkAnimation.current.timeScale = 1.85;
            }
        }
    });

    return (
        // Removed 'position' prop to decouple React renders from frame loop
        <group ref={group} userData={{ type: 'angel' }} visible={isActive}>
            <primitive object={modelScene} scale={[1, 1, 1]} /> 
            {/* Invisible Collider for Physics */}
            <mesh visible={false} userData={{ type: 'angel' }}>
                <capsuleGeometry args={[0.5, 1.8, 4, 8]} />
                <meshBasicMaterial color="red" wireframe />
            </mesh>
        </group>
    );
}
