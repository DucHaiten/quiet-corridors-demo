import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../store';
import { FOG_VISIBILITY_DIST, STATUE_KILL_DIST, MAP_SIZE } from '../constants';
import * as THREE from 'three';
import { soundManager } from './SoundManager';

// Sanity drain rates per second
const BASE_DARKNESS_DRAIN = 0.2; // In darkness (default)
const MONSTER_ENCOUNTER_DRAIN = 0.2; // Additional drain when seeing/hearing monsters

// Angel spawn distances
const SANITY_40_DISTANCE = 100; // 100m away (sanity 40 chase)
const SANITY_20_DISTANCE = 100; // 100m away (sanity 20 chase)
const SANITY_0_DISTANCE = 100; // 100m away

// Angel chase durations
const SANITY_40_CHASE_DURATION_MS = 60 * 1000; // 1 minute
const SANITY_20_CHASE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

// Helper function to clamp spawn position within map bounds (more conservative)
const clampToMapBounds = (pos: { x: number, y: number, z: number }): { x: number, y: number, z: number } => {
    // Use much more conservative bounds - stay well inside the map
    const maxDist = MAP_SIZE / 2 - 30; // 30m buffer from edge to be safe
    return {
        x: Math.max(-maxDist, Math.min(maxDist, pos.x)),
        y: 0,
        z: Math.max(-maxDist, Math.min(maxDist, pos.z))
    };
};

// Helper to check if position is in a wall
const isInWall = (x: number, z: number, walls: { x: number, y: number, z: number }[]): boolean => {
    const WALL_RADIUS = 3; // Check within 3m of wall center
    for (const wall of walls) {
        const dist = Math.sqrt(Math.pow(x - wall.x, 2) + Math.pow(z - wall.z, 2));
        if (dist < WALL_RADIUS) {
            return true;
        }
    }
    return false;
};

// Find safe spawn position (not in wall, within map bounds)
const findSafeSpawn = (
    targetX: number, 
    targetZ: number, 
    walls: { x: number, y: number, z: number }[]
): { x: number, y: number, z: number } => {
    // First clamp to map bounds
    const clamped = clampToMapBounds({ x: targetX, y: 0, z: targetZ });
    
    // If not in wall, use it
    if (!isInWall(clamped.x, clamped.z, walls)) {
        return clamped;
    }
    
    // Try positions around in a circle (8 directions)
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const distances = [5, 10, 15]; // Try 5m, 10m, 15m away
    
    for (const dist of distances) {
        for (const angle of angles) {
            const rad = angle * Math.PI / 180;
            const testX = targetX + Math.cos(rad) * dist;
            const testZ = targetZ + Math.sin(rad) * dist;
            const testPos = clampToMapBounds({ x: testX, y: 0, z: testZ });
            
            if (!isInWall(testPos.x, testPos.z, walls)) {
                return testPos;
            }
        }
    }
    
    // Fallback: return clamped position (better than nothing)
    return clamped;
};

const SanityManager = () => {
    const { camera, scene } = useThree();
    const decreaseSanity = useGameStore(state => state.decreaseSanity);
    const gameState = useGameStore(state => state.gameState);
    const isInventoryOpen = useGameStore(state => state.isInventoryOpen);
    const statues = useGameStore(state => state.statues);
    const traps = useGameStore(state => state.traps);
    const isTrapped = useGameStore(state => state.isTrapped);
    const theAngel = useGameStore(state => state.theAngel);
    const sanity = useGameStore(state => state.sanity);
    const updateTheAngel = useGameStore(state => state.updateTheAngel);
    const walls = useGameStore(state => state.walls);
    
    const lastUpdateTime = useRef(Date.now());
    const prevSanity = useRef(100);
    const hasTriggered40 = useRef(false);
    const hasTriggered20 = useRef(false);
    const hasTriggered0 = useRef(false);

    useFrame((state) => {
        // Allow sanity to keep draining while inventory is open (prevent safe AFK)
        const allowInventoryTick = isInventoryOpen && gameState === 'PAUSED';
        if (gameState !== 'PLAYING' && !allowInventoryTick) {
            lastUpdateTime.current = Date.now();
            return;
        }

        const now = Date.now();
        const deltaSeconds = (now - lastUpdateTime.current) / 1000;
        lastUpdateTime.current = now;

        let totalDrain = BASE_DARKNESS_DRAIN; // Always draining in darkness
        let encounteringMonster = false;

        const playerPos = camera.position;
        const playerDir = new THREE.Vector3();
        camera.getWorldDirection(playerDir);
        playerDir.normalize();

        // Check for statue encounters (seeing or very close)
        for (const statue of statues) {
            const statuePos = new THREE.Vector3(statue.position.x, statue.position.y, statue.position.z);
            const distance = playerPos.distanceTo(statuePos);
            
            // If very close to statue (within kill distance + buffer)
            if (distance < STATUE_KILL_DIST + 5) {
                encounteringMonster = true;
                break;
            }
            
            // If statue is visible (within fog distance and in view)
            if (distance < FOG_VISIBILITY_DIST) {
                const toStatue = new THREE.Vector3().subVectors(statuePos, playerPos);
                toStatue.normalize();
                const dot = playerDir.dot(toStatue);
                
                // In front of player (wide FOV check)
                if (dot > 0.3) {
                    encounteringMonster = true;
                    break;
                }
            }
        }

        // Check if trapped by risen claws
        if (isTrapped) {
            encounteringMonster = true;
        }

        // Check for nearby active traps
        for (const trap of traps) {
            if (!trap.triggered) continue; // Only consider active traps
            
            const trapPos = new THREE.Vector3(trap.position.x, trap.position.y, trap.position.z);
            const distance = playerPos.distanceTo(trapPos);
            
            // If close to active trap
            if (distance < 10) {
                encounteringMonster = true;
                break;
            }
        }

        // Check for The Angel Rig (if active and close)
        if (theAngel?.isActive && theAngel.position) {
            const angelPos = new THREE.Vector3(theAngel.position.x, theAngel.position.y, theAngel.position.z);
            const distance = playerPos.distanceTo(angelPos);
            
            // If close to The Angel Rig or can see it
            if (distance < 50) {
                // Check if in view
                const toAngel = new THREE.Vector3().subVectors(angelPos, playerPos);
                toAngel.normalize();
                const dot = playerDir.dot(toAngel);
                
                // If in front of player or very close
                if (dot > 0.3 || distance < 15) {
                    encounteringMonster = true;
                }
            }
        }

        // Add additional drain if encountering monsters
        if (encounteringMonster) {
            totalDrain += MONSTER_ENCOUNTER_DRAIN;
        }

        // Apply sanity drain
        const drainAmount = totalDrain * deltaSeconds;
        if (drainAmount > 0) {
            decreaseSanity(drainAmount);
        }

        // === SANITY-BASED ANGEL APPEARANCES ===
        if (!theAngel) {
            prevSanity.current = sanity;
            return;
        }

        // Debug log every 5 seconds
        if (now % 5000 < 100) {
            console.log('[SANITY] Current sanity:', Math.floor(sanity), '| Triggered:', {
                t40: hasTriggered40.current,
                t20: hasTriggered20.current,
                t0: hasTriggered0.current
            });
        }

        // Sanity 40: Appear 100m away and chase for 60 seconds
        if (sanity <= 40 && !hasTriggered40.current) {
            hasTriggered40.current = true;
            const angle = Math.random() * Math.PI * 2;
            const targetX = playerPos.x + Math.cos(angle) * SANITY_40_DISTANCE;
            const targetZ = playerPos.z + Math.sin(angle) * SANITY_40_DISTANCE;
            const spawnPos = findSafeSpawn(targetX, targetZ, walls);
            
            console.log('[SANITY] Angel appearing at sanity 40!', {
                spawnPos,
                playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                distance: Math.sqrt(
                    Math.pow(spawnPos.x - playerPos.x, 2) + 
                    Math.pow(spawnPos.z - playerPos.z, 2)
                ),
                mapLimit: MAP_SIZE / 2 - 30,
                isInBounds: Math.abs(spawnPos.x) < MAP_SIZE / 2 - 30 && Math.abs(spawnPos.z) < MAP_SIZE / 2 - 30
            });
            
            updateTheAngel({
                position: spawnPos,
                isActive: true,
                state: 'CHASING',
                targetPosition: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                sanity19Triggered: true,
                appearanceTime: now
            });
            
            // Auto-disappear after 60 seconds (unless escalated or sanity recovered)
            setTimeout(() => {
                const currentAngel = useGameStore.getState().theAngel;
                // Only deactivate if still in sanity 40 mode (not upgraded to 20 or 0)
                if (currentAngel && currentAngel.sanity19Triggered && !currentAngel.sanity9Triggered && !currentAngel.sanity0Active) {
                    // Deactivate angel immediately (this will clear effects in the_angel_rig via useEffect)
                    updateTheAngel({
                        isActive: false,
                        state: 'IDLE',
                        targetPosition: null,
                        sanity19Triggered: false
                    });
                }
            }, SANITY_40_CHASE_DURATION_MS);
        }

        // Sanity 20: Appear 100m away and chase for 120 seconds
        if (sanity <= 20 && !hasTriggered20.current) {
            hasTriggered20.current = true;
            const angle = Math.random() * Math.PI * 2;
            const targetX = playerPos.x + Math.cos(angle) * SANITY_20_DISTANCE;
            const targetZ = playerPos.z + Math.sin(angle) * SANITY_20_DISTANCE;
            const spawnPos = findSafeSpawn(targetX, targetZ, walls);
            
            console.log('[SANITY] Angel appearing at sanity 20!', {
                spawnPos,
                playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                distance: Math.sqrt(
                    Math.pow(spawnPos.x - playerPos.x, 2) + 
                    Math.pow(spawnPos.z - playerPos.z, 2)
                ),
                mapLimit: MAP_SIZE / 2 - 30,
                isInBounds: Math.abs(spawnPos.x) < MAP_SIZE / 2 - 30 && Math.abs(spawnPos.z) < MAP_SIZE / 2 - 30
            });
            
            updateTheAngel({
                position: spawnPos,
                isActive: true,
                state: 'CHASING',
                targetPosition: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                sanity9Triggered: true,
                appearanceTime: now
            });
            
            // Auto-disappear after 120 seconds (unless escalated or sanity recovered)
            setTimeout(() => {
                const currentAngel = useGameStore.getState().theAngel;
                // Only deactivate if still in sanity 20 mode (not upgraded to 0)
                if (currentAngel && currentAngel.sanity9Triggered && !currentAngel.sanity0Active) {
                    // Deactivate angel immediately (this will clear effects in the_angel_rig via useEffect)
                    updateTheAngel({
                        isActive: false,
                        state: 'IDLE',
                        targetPosition: null,
                        sanity9Triggered: false
                    });
                }
            }, SANITY_20_CHASE_DURATION_MS);
        }

        // Sanity 0: Appear 200m away and start chasing
        if (sanity <= 0 && !hasTriggered0.current) {
            hasTriggered0.current = true;
            const angle = Math.random() * Math.PI * 2;
            const targetX = playerPos.x + Math.cos(angle) * SANITY_0_DISTANCE;
            const targetZ = playerPos.z + Math.sin(angle) * SANITY_0_DISTANCE;
            const spawnPos = findSafeSpawn(targetX, targetZ, walls);
            
            console.log('[SANITY] Angel appearing at sanity 0! CHASING!', {
                spawnPos,
                playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                distance: Math.sqrt(
                    Math.pow(spawnPos.x - playerPos.x, 2) + 
                    Math.pow(spawnPos.z - playerPos.z, 2)
                ),
                mapLimit: MAP_SIZE / 2 - 30,
                isInBounds: Math.abs(spawnPos.x) < MAP_SIZE / 2 - 30 && Math.abs(spawnPos.z) < MAP_SIZE / 2 - 30
            });
            
            // CRITICAL: Clear previous sanity appearance flags to ensure chase mode works
            // Force update to CHASING state and clear all idle flags
            updateTheAngel({
                position: spawnPos,
                isActive: true,
                state: 'CHASING',
                targetPosition: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                sanity0Active: true,
                sanity19Triggered: false, // CLEAR sanity 40 flag
                sanity9Triggered: false,  // CLEAR sanity 20 flag
                appearanceTime: now
            });
            
            console.log('[SANITY] Angel state after spawn:', {
                state: 'CHASING',
                sanity0Active: true,
                sanity19Triggered: false,
                sanity9Triggered: false
            });
        }

        // Deactivate sanity 40 chase early if sanity recovers above 40
        if (sanity > 40 && hasTriggered40.current && theAngel.sanity19Triggered && !theAngel.sanity0Active) {
            hasTriggered40.current = false;
            updateTheAngel({
                isActive: false,
                sanity19Triggered: false,
                state: 'IDLE',
                targetPosition: null
            });
        }

        // Deactivate sanity 20 chase early if sanity recovers above 20
        if (sanity > 20 && hasTriggered20.current && theAngel.sanity9Triggered && !theAngel.sanity0Active) {
            hasTriggered20.current = false;
            updateTheAngel({
                isActive: false,
                sanity9Triggered: false,
                state: 'IDLE',
                targetPosition: null
            });
        }

        // Deactivate sanity 0 chase if sanity recovers above 0
        if (sanity > 0 && hasTriggered0.current && theAngel.sanity0Active) {
            hasTriggered0.current = false;
            updateTheAngel({
                isActive: false,
                sanity0Active: false,
                state: 'IDLE',
                targetPosition: null
            });
        }

        prevSanity.current = sanity;
    });

    return null;
};

export default SanityManager;

