
import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { 
  PLAYER_SPEED, RUN_SPEED_MULTI, CROUCH_SPEED_MULTI, PLAYER_HEIGHT, PLAYER_HEIGHT_CROUCH,
  GRAVITY, JUMP_FORCE, STAMINA_COST_JUMP, 
  STAMINA_COST_RUN_PER_SEC, STAMINA_REGEN_RATE, DASH_DURATION,
  MAP_SIZE, CELL_SIZE, FOOTSTEP_INTERVAL_WALK, FOOTSTEP_INTERVAL_RUN
} from '../constants';
import { soundManager } from './SoundManager';
import { GameState } from '../types';
import Weapon, { WeaponHandle } from './Weapon';

// Imported Logic
import { CameraController } from './player/CameraController';
import { CompassUpdater, ScannerTracker } from './player/HUDUpdaters';
import { usePlayerControls } from './player/usePlayerControls';
import { useInteraction } from './player/useInteraction';

const Player = ({ weaponScene }: { weaponScene: THREE.Scene }) => {
  const { camera, scene } = useThree();
  const gameState = useGameStore(state => state.gameState);
  const setGameState = useGameStore(state => state.setGameState);
  const deathCause = useGameStore(state => state.deathCause);
  const isLoading = useGameStore(state => state.isLoading);
  const isInventoryOpen = useGameStore(state => state.isInventoryOpen);
  const startPosition = useGameStore(state => state.startPosition);
  const sanity = useGameStore(state => state.sanity);
  
  // Reading state
  const readingPaperContent = useGameStore(state => state.readingPaperContent);
  const setReadingPaper = useGameStore(state => state.setReadingPaper);
  
  // Trap state
  const isTrapped = useGameStore(state => state.isTrapped);
  const trappedPosition = useGameStore(state => state.trappedPosition);
  const isJumpscared = useGameStore(state => state.isJumpscared);
  
  // Monitor Exhaustion for Audio
  const isExhausted = useGameStore(state => state.isExhausted);
  
  const hasShard = useGameStore(state => state.hasShard);
  const prevHasShard = useRef(false);
  
  // Developer Modes
  const isGhostMode = useGameStore(state => state.isGhostMode);

  // Weapon Ref
  const weaponRef = useRef<WeaponHandle>(null);

  // --- CONTROLS HOOK ---
  const { 
      moveForward, moveBackward, moveLeft, moveRight, 
      isSprinting, crouch, jump, interactPressed, 
      isSprintingEffective, isDashing, dashStartTime, dashVelocity 
  } = usePlayerControls(weaponRef);

  // --- INTERACTION HOOK ---
  useInteraction(interactPressed);

  // Physics Refs
  const velocity = useRef(new THREE.Vector3());
  const raycaster = useRef(new THREE.Raycaster());
  const downRaycaster = useRef(new THREE.Raycaster());
  const upRaycaster = useRef(new THREE.Raycaster());
  
  // Effect Refs
  const shakeIntensity = useRef(0);
  const headBobTimer = useRef(0);
  const lastBobOffset = useRef(new THREE.Vector3()); 
  const sprintRampTime = useRef(0); 
  const footstepTimer = useRef(0);
  const trapDamageTimer = useRef(0);
  const deathAnimationPlayed = useRef(false);
  const currentCameraHeight = useRef(PLAYER_HEIGHT); // Track smoothing height
  const smoothedQuat = useRef(new THREE.Quaternion()); // For sanity-induced mouse lag
  const ghostTimer = useRef(0); // For ghost trail pulsing

  // Track previous game state to avoid snapping position when unpausing
  const previousGameState = useRef<GameState | null>(null);

  // Initialize player position
  useEffect(() => {
      if (!useGameStore.getState().isPlayerSpawned) {
          const store = useGameStore.getState();
          const startPos = store.startPosition;
          if (startPos) {
              camera.position.set(startPos.x, 4.0, startPos.z);
          } else {
              const offset = MAP_SIZE / 2;
              const startX = (1 * CELL_SIZE) - offset + (CELL_SIZE / 2);
              const startZ = (1 * CELL_SIZE) - offset + (CELL_SIZE / 2);
              camera.position.set(startX, 4.0, startZ); 
          }
          velocity.current.set(0, 0, 0);
          store.setPlayerSpawned(true);
      }
      // Reset refs
      deathAnimationPlayed.current = false;
      trapDamageTimer.current = 0;
      headBobTimer.current = 0;
      sprintRampTime.current = 0;
      lastBobOffset.current.set(0, 0, 0);
      currentCameraHeight.current = PLAYER_HEIGHT;
      smoothedQuat.current.copy(camera.quaternion);
      ghostTimer.current = 0;
  }, []);

  // Reset on game state re-enter PLAYING to avoid inherited velocity/offsets
  useEffect(() => {
      const wasPaused = previousGameState.current === GameState.PAUSED;

      if (gameState === GameState.PLAYING) {
          // Only snap back to spawn on fresh starts; keep current position on resume
          if (!wasPaused && startPosition) {
              camera.position.set(startPosition.x, startPosition.y + PLAYER_HEIGHT, startPosition.z);
          }
          
          velocity.current.set(0, 0, 0);
          lastBobOffset.current.set(0, 0, 0);
          headBobTimer.current = 0;
          sprintRampTime.current = 0;
          footstepTimer.current = 0;
          trapDamageTimer.current = 0;
          currentCameraHeight.current = PLAYER_HEIGHT;
          smoothedQuat.current.copy(camera.quaternion);
          ghostTimer.current = 0;
      }

      previousGameState.current = gameState;
  }, [gameState, startPosition, camera]);

  // Handle "Escape" from Reading State pointer lock fix
  useEffect(() => {
    const onPointerLockChange = () => {
        if (!document.pointerLockElement) {
             const store = useGameStore.getState();
             if (store.readingPaperContent !== null) {
                 store.setReadingPaper(null);
                 store.setGameState(GameState.PAUSED);
             }
        }
    }
    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => document.removeEventListener('pointerlockchange', onPointerLockChange);
  }, []);

  // Breathing Audio
  useEffect(() => {
      if (gameState !== GameState.PLAYING) {
          soundManager.stopBreathing(true);
          return;
      }
      if (isExhausted) {
          soundManager.playBreathing();
      } else {
          soundManager.stopBreathing();
      }
      
      return () => {
          soundManager.stopBreathing(true);
      };
  }, [isExhausted, gameState]);

  // Raycaster Init
  useEffect(() => {
    raycaster.current.far = 2.0; 
    downRaycaster.current.ray.direction.set(0, -1, 0);
    downRaycaster.current.far = 10; 
    upRaycaster.current.ray.direction.set(0, 1, 0);
    upRaycaster.current.ray.direction.set(0, 1, 0);
    upRaycaster.current.far = 2.0;
  }, []);

  useFrame((state, deltaRaw) => {
    if (isLoading) return;

    const store = useGameStore.getState();
    const GRACE_PERIOD = 400;

    // Pause Check
    if (store.gameState === GameState.PLAYING && !store.isInventoryOpen && store.readingPaperContent === null) {
        const timeSinceResume = Date.now() - store.lastResumeTime;
        if (!document.pointerLockElement && timeSinceResume > GRACE_PERIOD) {
            setGameState(GameState.PAUSED);
            return;
        }
    }

    const delta = Math.min(deltaRaw, 0.025);

    // Avoid accumulating headbob offsets while paused; stop processing until playing
    if (store.gameState !== GameState.PLAYING) return;

    // --- 1. RESTORE PHYSICS POSITION (Undo head bob) ---
    camera.position.sub(lastBobOffset.current);

    // === DEATH ANIMATION ===
    if (gameState === GameState.GAME_OVER && (deathCause === 'statue' || deathCause === 'trap')) {
        if (document.pointerLockElement) document.exitPointerLock();
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.4, delta * 5);
        const targetRot = -Math.PI / 2;
        camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, targetRot, delta * 5);
        camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0.2, delta * 2);
        return;
    }

    if (gameState !== GameState.PLAYING) return;
    if (isInventoryOpen) {
        // Freeze motion/bobbing when inventory is open
        velocity.current.set(0, 0, 0);
        lastBobOffset.current.set(0, 0, 0);
        headBobTimer.current = 0;
        smoothedQuat.current.copy(camera.quaternion);
        return;
    }
    
    // --- IF READING PAPER, STOP PHYSICS ---
    if (readingPaperContent !== null) {
        velocity.current.set(0,0,0);
        lastBobOffset.current.set(0, 0, 0); 
        return;
    }

    // === GHOST MODE / TA LÀ CHÚA ===
    if (isGhostMode) {
        // x2 Speed logic
        const speed = PLAYER_SPEED * 2 * delta; 
        
        // Full 3D directional movement (Flying)
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        
        const moveDir = new THREE.Vector3();
        if (moveForward.current) moveDir.add(forward);
        if (moveBackward.current) moveDir.sub(forward);
        if (moveLeft.current) moveDir.sub(right);
        if (moveRight.current) moveDir.add(right);
        
        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().multiplyScalar(speed);
            camera.position.add(moveDir);
        }
        
        // Clear physics state so we don't snap back or fall when toggling off
        velocity.current.set(0, 0, 0);
        lastBobOffset.current.set(0, 0, 0);
        return; // Skip remaining physics
    }

    // === TRAP LOGIC ===
    if (isTrapped && trappedPosition) {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, trappedPosition.x, delta * 10);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, trappedPosition.z, delta * 10);
        velocity.current.set(0, 0, 0);
        
        // Disable controls visually
        isSprinting.current = false;
        crouch.current = false;
        jump.current = false;
        isDashing.current = false;
        isSprintingEffective.current = false;
        sprintRampTime.current = 0;

        trapDamageTimer.current += delta;
        if (trapDamageTimer.current >= 1.0) {
            store.damagePlayer(5);
            trapDamageTimer.current = 0;
            shakeIntensity.current = 0.2;
            soundManager.playHit();
        }
    } else {
        trapDamageTimer.current = 0;
    }

    // Shard Event
    if (hasShard && !prevHasShard.current) {
        shakeIntensity.current = 1.5; 
        soundManager.playShardAwaken();
    }
    prevHasShard.current = hasShard;

    // Shake Effect
    if (shakeIntensity.current > 0) {
        const shakeX = (Math.random() - 0.5) * shakeIntensity.current * 0.5;
        const shakeY = (Math.random() - 0.5) * shakeIntensity.current * 0.5;
        const shakeZ = (Math.random() - 0.5) * shakeIntensity.current * 0.5;
        camera.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
        shakeIntensity.current -= delta * 0.3;
        if (shakeIntensity.current < 0) shakeIntensity.current = 0;
    }

    // WIN CONDITION
    const playerFlatPos = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    const distToExitCenter = playerFlatPos.distanceTo(new THREE.Vector3(store.exitPosition?.x || 0, 0, store.exitPosition?.z || 0));
    
    if (store.isGateOpen && distToExitCenter < 5.0 && camera.position.y > 28.0 && store.gameState === GameState.PLAYING) {
        store.setGameState(GameState.GAME_WON);
    }

    // MOVEMENT & STAMINA
    if (isDashing.current) {
        if (Date.now() - dashStartTime.current > DASH_DURATION) {
            isDashing.current = false;
        } else {
            velocity.current.x = dashVelocity.current.x;
            velocity.current.z = dashVelocity.current.z;
        }
    }

    const isMoving = moveForward.current || moveBackward.current || moveLeft.current || moveRight.current;
    let isSprintingActive = false;

    if (!isTrapped && !isJumpscared) {
        if (!isDashing.current) {
            // Can only sprint if moving AND NOT CROUCHING
            if (isSprinting.current && isMoving && !crouch.current) {
                 if (store.consumeStamina(STAMINA_COST_RUN_PER_SEC * delta)) {
                    isSprintingActive = true;
                 } else {
                    store.regenerateStamina(STAMINA_REGEN_RATE * delta);
                 }
            } else {
                 store.regenerateStamina(STAMINA_REGEN_RATE * delta);
            }
        }
    }
    
    isSprintingEffective.current = isSprintingActive;

    if (!isDashing.current && !isTrapped && !isJumpscared) {
        const direction = new THREE.Vector3();
        direction.z = Number(moveForward.current) - Number(moveBackward.current);
        direction.x = Number(moveRight.current) - Number(moveLeft.current);
        direction.normalize();

        let currentSpeed = PLAYER_SPEED;
        if (isSprintingActive) {
            currentSpeed = PLAYER_SPEED * RUN_SPEED_MULTI;
        } else if (crouch.current) {
            // Reduce speed if crouching
            currentSpeed = PLAYER_SPEED * CROUCH_SPEED_MULTI;
        }

        const ACCEL_FORCE = currentSpeed * 10.0;
        if (moveForward.current || moveBackward.current) velocity.current.z -= direction.z * ACCEL_FORCE * delta;
        if (moveLeft.current || moveRight.current) velocity.current.x += direction.x * ACCEL_FORCE * delta;

        velocity.current.x -= velocity.current.x * 10.0 * delta;
        velocity.current.z -= velocity.current.z * 10.0 * delta;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    let moveVector = new THREE.Vector3();
    if (isDashing.current) {
        moveVector.set(velocity.current.x * delta, 0, velocity.current.z * delta);
    } else {
        moveVector
            .addScaledVector(forward, -velocity.current.z * delta * 0.1)
            .addScaledVector(right, velocity.current.x * delta * 0.1);
    }

    // === GRAVITY & JUMP ===
    velocity.current.y -= GRAVITY * delta;
    if (velocity.current.y < -50) velocity.current.y = -50;
    camera.position.y += velocity.current.y * delta;

    const collisionCandidates = scene.children.filter(obj => !obj.userData.isTrapContainer && !obj.userData.isWeapon);

    // GROUND CHECK
    downRaycaster.current.set(camera.position, new THREE.Vector3(0, -1, 0));
    const groundHits = downRaycaster.current.intersectObjects(collisionCandidates, true);
    const ground = groundHits.find(h => h.object.userData.type === 'level');
    
    // --- CROUCH HEIGHT LOGIC ---
    // Smoothly interpolate current player height
    const targetHeight = crouch.current ? PLAYER_HEIGHT_CROUCH : PLAYER_HEIGHT;
    currentCameraHeight.current = THREE.MathUtils.lerp(currentCameraHeight.current, targetHeight, delta * 10);

    if (ground && ground.distance < currentCameraHeight.current && velocity.current.y <= 0) {
        if (velocity.current.y < -5.0) {
            soundManager.playLanding();
        }
        camera.position.y = ground.point.y + currentCameraHeight.current;
        velocity.current.y = 0;
        
        // Footsteps - MUTE if crouching
        if (isMoving && !isDashing.current && !isTrapped && !crouch.current) {
            footstepTimer.current += delta * 1000;
            const interval = isSprintingActive ? FOOTSTEP_INTERVAL_RUN : FOOTSTEP_INTERVAL_WALK;
            if (footstepTimer.current > interval) {
                soundManager.playFootstep();
                store.emitSound(isSprintingActive ? 'RUN' : 'WALK', camera.position);
                footstepTimer.current = 0;
            }
        } else {
            if (!isMoving) footstepTimer.current = intervalFromSpeed(isSprintingActive) * 0.8;
        }

    } else if (camera.position.y < -50) {
        camera.position.y = 10;
        velocity.current.y = 0;
    }

    // JUMP - Disable if crouching
    if (jump.current && ground && ground.distance < currentCameraHeight.current + 0.1 && !isTrapped && !crouch.current) {
         if (store.consumeStamina(STAMINA_COST_JUMP)) {
            velocity.current.y = JUMP_FORCE;
            jump.current = false;
            soundManager.playJumpGrunt(); 
         }
    }

    // CEILING CHECK
    if (velocity.current.y > 0) {
        upRaycaster.current.set(camera.position, new THREE.Vector3(0, 1, 0));
        const ceilHits = upRaycaster.current.intersectObjects(collisionCandidates, true);
        const ceil = ceilHits.find(h => h.object.userData.type === 'level');
        if (ceil && ceil.distance < 0.5) {
            camera.position.y -= (0.5 - ceil.distance);
            velocity.current.y = -2;
        }
    }

    // --- COLLISION ---
    if (!isTrapped && !isJumpscared) {
        let remainingVector = moveVector.clone();
        const iterations = 3; 
        
        if (remainingVector.lengthSq() > 0.000001) {
            for (let i = 0; i < iterations; i++) {
                const length = remainingVector.length();
                if (length < 0.00001) break;

                const dir = remainingVector.clone().normalize();
                
                raycaster.current.set(camera.position, dir);
                raycaster.current.far = length + 0.35; 

                const allHits = raycaster.current.intersectObjects(collisionCandidates, true);
                const hit = allHits.find(h => h.object.userData.type === 'level');
                
                if (hit) {
                    const distanceToHit = hit.distance;
                    if (distanceToHit < length + 0.2) {
                        const safeMoveDist = Math.max(0, distanceToHit - 0.2); 
                        const safeMove = dir.clone().multiplyScalar(safeMoveDist);
                        camera.position.add(safeMove);
                        
                        remainingVector.sub(safeMove);

                        if (hit.face) {
                            const normal = hit.face.normal.clone();
                            const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                            normal.applyMatrix3(normalMatrix).normalize();

                            const dot = remainingVector.dot(normal);
                            if (dot < 0) {
                                remainingVector.sub(normal.multiplyScalar(dot));
                                const vel2D = new THREE.Vector3(velocity.current.x, 0, velocity.current.z);
                                const velDot = vel2D.dot(normal);
                                if (velDot < 0) {
                                    velocity.current.x -= normal.x * velDot;
                                    velocity.current.z -= normal.z * velDot;
                                }
                            }
                        }
                    } else {
                        camera.position.add(remainingVector);
                        remainingVector.set(0,0,0);
                    }
                } else {
                    camera.position.add(remainingVector);
                    remainingVector.set(0,0,0);
                }
            }
        }

        // STATIC SEPARATION
        const PLAYER_RADIUS = 0.35; 
        const checkDirs = [
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
            new THREE.Vector3(0.707, 0, 0.707), new THREE.Vector3(-0.707, 0, 0.707),
            new THREE.Vector3(0.707, 0, -0.707), new THREE.Vector3(-0.707, 0, -0.707)
        ];

        for(const dir of checkDirs) {
            raycaster.current.set(camera.position, dir);
            raycaster.current.far = PLAYER_RADIUS + 0.1;
            const hits = raycaster.current.intersectObjects(collisionCandidates, true);
            const hit = hits.find(h => h.object.userData.type === 'level' || h.object.userData.type === 'angel');
            if (hit) {
                const pushDist = (PLAYER_RADIUS + 0.1) - hit.distance;
                if (pushDist > 0 && pushDist < 0.5) {
                    const pushVec = dir.clone().negate().multiplyScalar(pushDist);
                    camera.position.add(pushVec);
                }
            }
        }
    }

    // --- 2. APPLY HEAD BOBBING (Disabled if Crouching) ---
    if (!isTrapped && ground && !crouch.current) {
        const isMovingFlat = moveForward.current || moveBackward.current || moveLeft.current || moveRight.current;
        
        if (isMovingFlat) {
            const sanityBobFactor = Math.max(0, Math.min(1, (40 - sanity) / 40)); // 0 at 40+, 1 at 0
            const bobFreqBase = isSprintingActive ? 16 : 10; 
            const bobAmpBase = isSprintingActive ? 0.08 : 0.06; 
            let currentSwayAmount = 0.03; 

            // Increase amplitude/sway with lower sanity; keep frequency stable to feel heavier, not faster
            const bobFreq = bobFreqBase; // keep pace stable (feel heavy/tired)
            const bobAmpY = bobAmpBase * (1 + 2.2 * sanityBobFactor);        // up to +220% amplitude
            currentSwayAmount *= (1 + 2.6 * sanityBobFactor);                // up to +260% sway

            if (isSprintingActive) {
                sprintRampTime.current += delta;
                const MAX_RAMP_TIME = 2.5; 
                const MAX_SWAY_ADDITION = 0.30; 
                const rampRatio = Math.min(sprintRampTime.current / MAX_RAMP_TIME, 1.0);
                currentSwayAmount = 0.05 + (rampRatio * MAX_SWAY_ADDITION);
            } else {
                sprintRampTime.current = 0;
            }

            headBobTimer.current += delta * bobFreq;
            const bobY = Math.sin(headBobTimer.current) * bobAmpY;
            const bobX = Math.cos(headBobTimer.current * 0.5) * currentSwayAmount;
            
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            right.y = 0;
            right.normalize();
            
            const bobVec = new THREE.Vector3(0, bobY, 0).addScaledVector(right, bobX);
            camera.position.add(bobVec);
            lastBobOffset.current.copy(bobVec);
        } else {
            sprintRampTime.current = 0; 
            const decay = 10 * delta;
            lastBobOffset.current.lerp(new THREE.Vector3(0, 0, 0), decay);
            camera.position.add(lastBobOffset.current);
            
            // Idle sway when sanity is critically low
            if (sanity <= 20) {
                const idleFactor = (20 - sanity) / 20; // 0..1
                headBobTimer.current += delta * (1.4 + idleFactor * 0.2); // keep slow, seasick vibe
                const idleBobY = Math.sin(headBobTimer.current * 0.8) * (0.024 + idleFactor * 0.040);
                const idleSwayX = Math.cos(headBobTimer.current * 0.65) * (0.026 + idleFactor * 0.045);
                const idleRoll = Math.sin(headBobTimer.current * 0.55) * (0.010 + idleFactor * 0.018); // radians roll
                const idlePitch = Math.cos(headBobTimer.current * 0.45) * (0.006 + idleFactor * 0.012); // mild pitch

                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
                right.y = 0;
                right.normalize();

                const idleVec = new THREE.Vector3(0, idleBobY, 0).addScaledVector(right, idleSwayX);
                camera.position.add(idleVec);
                lastBobOffset.current.add(idleVec);

                // Apply mild camera roll/pitch for seasick effect
                camera.rotation.z += idleRoll;
                camera.rotation.x += idlePitch;
            }

            if (lastBobOffset.current.lengthSq() < 0.0001) {
                headBobTimer.current = 0;
                lastBobOffset.current.set(0, 0, 0);
            }
        }
    } else {
        sprintRampTime.current = 0;
        const decay = 10 * delta;
        lastBobOffset.current.lerp(new THREE.Vector3(0, 0, 0), decay);
        camera.position.add(lastBobOffset.current);
    }

    // --- SANITY EFFECTS: camera lag & ghosting intensity ---
    // Mouse lag: slerp towards target rotation when sanity is low
    if (sanity > 20) {
        smoothedQuat.current.copy(camera.quaternion);
    } else {
        const lagFactor = Math.min(1, (20 - sanity) / 20); // 0..1
        const lagAmount = 0.04 + lagFactor * 0.18; // more lag as sanity drops (0.04 -> 0.22)
        smoothedQuat.current.slerp(camera.quaternion, lagAmount);
        camera.quaternion.copy(smoothedQuat.current);
    }

    // Ghosting effect disabled to avoid white flicker when sanity drops
    let ghostStrength = 0;
    const ghostOffset = 0;
    document.documentElement.style.setProperty('--ghost-strength', ghostStrength.toFixed(2));
    document.documentElement.style.setProperty('--ghost-offset', `${ghostOffset.toFixed(2)}px`);
  });

  return (
    <>
      <CameraController />
      <Weapon 
        ref={weaponRef} 
        inputs={{ forward: moveForward, backward: moveBackward, left: moveLeft, right: moveRight, sprinting: isSprinting }} 
        isSprintingEffective={isSprintingEffective}
        weaponScene={weaponScene}
        mainScene={scene}
        mainCamera={camera}
      />
      <CompassUpdater />
      <ScannerTracker />
    </>
  );
};

// Helper
const intervalFromSpeed = (isSprinting: boolean) => isSprinting ? FOOTSTEP_INTERVAL_RUN : FOOTSTEP_INTERVAL_WALK;

export default Player;
