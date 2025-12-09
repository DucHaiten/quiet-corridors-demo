
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../../store';
import { soundManager } from '../../SoundManager';
import { InventoryItem, GameState } from '../../../types';

const getHitInfo = (obj: THREE.Object3D): { type: string | null, id?: string } => {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
        if (curr.userData && curr.userData.type) return { type: curr.userData.type, id: curr.userData.id };
        curr = curr.parent;
    }
    return { type: null };
};

export const useMakarovLogic = (
    item: InventoryItem,
    mainScene: THREE.Scene, 
    mainCamera: THREE.Camera,
    gunLightRef: React.MutableRefObject<THREE.PointLight | null>,
    worldLightRef: React.MutableRefObject<THREE.PointLight | null>,
    muzzleFlashRef: React.MutableRefObject<THREE.Mesh | null>,
    isSprintingEffective: React.MutableRefObject<boolean>
) => {
    const isAttacking = useRef(false);
    const attackStartTime = useRef(0);
    const hasDealtDamage = useRef(false);
    const hasPlayedSound = useRef(false);
    const isAiming = useRef(false);

    const aimingProgress = useRef(0);
    const recoilHeat = useRef(0);
    const currentShotSpread = useRef(new THREE.Vector2(0, 0));
    const flashTimer = useRef(0);

    // New Refs for Sprint-to-Fire Logic
    const sprintBlockTime = useRef(0); // Timestamp until which sprint is blocked
    const queuedShotTimer = useRef(0); // Countdown to fire after un-tucking

    const smoothAttackRot = useRef(new THREE.Euler());
    const smoothAttackPos = useRef(new THREE.Vector3()); 
    const raycaster = useRef(new THREE.Raycaster());

    // MAKAROV SPECIFIC: TACTICAL TUCK SPRINT (Muzzle Down)
    // Similar to CZ-88
    const sprintPose = {
        pos: new THREE.Vector3(-0.15, -0.4, 0.0),
        rot: new THREE.Euler(0.6, 0.6, -0.1)
    };

    const processGunshot = (origin: THREE.Vector3, direction: THREE.Vector3) => {
        const didShoot = useGameStore.getState().shoot();
        if (!didShoot) return;

        useGameStore.getState().decreaseDurability(1, item.id);

        raycaster.current.set(origin, direction);
        raycaster.current.far = 100; 

        const hits = raycaster.current.intersectObjects(mainScene.children, true);

        for (const hit of hits) {
            if (!hit.object.visible) continue;
            if (hit.object.userData.isWeapon) continue;

            const { type, id } = getHitInfo(hit.object);

            if (type === 'enemy' && id) {
                useGameStore.getState().killEnemy(id);
                soundManager.playHit(); 
            } else if (type === 'trap' && id) {
                useGameStore.getState().hitTrap(id, 35); 
                soundManager.playHit(); 
            } else {
                soundManager.playStickHit(); 
            }

            const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
            normal.transformDirection(hit.object.matrixWorld).normalize();
            
            useGameStore.getState().addImpact(hit.point, normal);
            break;
        }
    };

    // Internal function to actually start the recoil/flash sequence
    const executeFire = () => {
        isAttacking.current = true;
        attackStartTime.current = Date.now();
        hasDealtDamage.current = false;
        hasPlayedSound.current = false;

        // MAKAROV RECOIL
        const effectiveHeat = recoilHeat.current;
        const heatAdd = isAiming.current ? 1.0 : 0.3; 
        recoilHeat.current = Math.min(recoilHeat.current + heatAdd, 1.0); 

        const baseSpreadRadius = isAiming.current ? 0.0 : 0.08;
        const heatPenaltyFactor = isAiming.current ? 0.15 : 0.20;
        const heatSpreadRadius = effectiveHeat * heatPenaltyFactor;
        const maxSpreadRadius = baseSpreadRadius + heatSpreadRadius;

        const randomAngle = Math.random() * Math.PI * 2; 
        const randomRadius = Math.sqrt(Math.random()) * maxSpreadRadius; 

        currentShotSpread.current.set(
            Math.cos(randomAngle) * randomRadius, 
            Math.sin(randomAngle) * randomRadius
        );
    };

    const triggerAttack = () => {
        if (isAttacking.current) return;
        
        const now = Date.now();
        
        // CHECK: Are we currently in a "Sprint Pose"?
        const isInSprintPose = isSprintingEffective.current && (now > sprintBlockTime.current);

        if (isInSprintPose) {
             // CASE 1: GUN IS DOWN (Running)
             // Transition to Hip.
             
             // 0.5s to raise gun, then 1.0s hold.
             sprintBlockTime.current = now + 500 + 1000;
             
             // Queue the shot to happen after the transition (0.5s)
             queuedShotTimer.current = 0.5; 
             
             return;
        } else {
             // CASE 2: GUN IS READY
             executeFire();
             
             // Extend Ready State by 1.0s
             sprintBlockTime.current = now + 1000;
        }
    };

    const setBlocking = (active: boolean) => {
        isAiming.current = active;
        if (active) {
            sprintBlockTime.current = Date.now() + 1000;
        }
    };

    const gameState = useGameStore(state => state.gameState);

    useFrame((state, deltaRaw) => {
        // PAUSE CHECK - Freeze weapon logic when not playing
        if (gameState !== GameState.PLAYING) return;
        
        const delta = Math.min(deltaRaw, 0.05);

        // Handle Queued Shot
        if (queuedShotTimer.current > 0) {
            // Keep refreshing hold timer
            sprintBlockTime.current = Date.now() + 1000;
            
            queuedShotTimer.current -= delta;
            if (queuedShotTimer.current <= 0) {
                executeFire();
            }
        }

        if (isAiming.current) {
            sprintBlockTime.current = Date.now() + 100;
        }

        if (flashTimer.current > 0) {
            flashTimer.current -= delta;
            if (muzzleFlashRef.current) muzzleFlashRef.current.visible = true;
            if (gunLightRef.current) gunLightRef.current.intensity = 15.0;
            if (worldLightRef.current) worldLightRef.current.intensity = 80.0;
        } else {
            if (muzzleFlashRef.current) muzzleFlashRef.current.visible = false;
            if (gunLightRef.current) gunLightRef.current.intensity = 0;
            if (worldLightRef.current) worldLightRef.current.intensity = 0;
        }

        const targetAim = isAiming.current ? 1.0 : 0.0;
        aimingProgress.current = THREE.MathUtils.lerp(aimingProgress.current, targetAim, delta * 15);

        if (muzzleFlashRef.current) {
            const baseFlashY = 0.09;
            const adsFlashY = 0.165; 
            const currentFlashY = THREE.MathUtils.lerp(baseFlashY, adsFlashY, aimingProgress.current);
            muzzleFlashRef.current.position.set(-0.50, currentFlashY, 0);
        }

        recoilHeat.current = Math.max(0, recoilHeat.current - (delta * 2.0));

        const targetAttackRot = new THREE.Euler(0, 0, 0);
        const targetAttackPos = new THREE.Vector3(0, 0, 0); 
        let attackLerpSpeed = 10 * delta; 

        if (isAttacking.current) {
            const elapsed = Date.now() - attackStartTime.current;
            const duration = 250; 
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                isAttacking.current = false;
            } else {
                const recoilMod = 1.0 - (aimingProgress.current * 0.7);

                if (progress < 0.2) {
                    const kickX = (Math.random() - 0.5) * 0.1 * recoilMod; 
                    const kickY = (0.05 + Math.random() * 0.05) * recoilMod;
                    const kickZ = -0.45 * recoilMod;
                    
                    targetAttackRot.set(kickX, kickY, kickZ); 
                    targetAttackPos.set(0, 0.05 * recoilMod, 0.35 * recoilMod); 
                    attackLerpSpeed = 60 * delta;
                } else {
                    targetAttackRot.set(0, 0, 0);
                    targetAttackPos.set(0, 0, 0);
                    attackLerpSpeed = 12 * delta;
                }

                if (!hasPlayedSound.current && progress > 0.05) {
                    soundManager.playShoot(); 
                    useGameStore.getState().emitSound('GUN', mainCamera.position);
                    hasPlayedSound.current = true;
                    flashTimer.current = 0.1; 
                    
                    if (!hasDealtDamage.current) {
                         hasDealtDamage.current = true; 
                         
                         const weaponGroup = muzzleFlashRef.current.parent!;
                         const weaponPosLocal = weaponGroup.position.clone();
                         const muzzleOffsetLocal = new THREE.Vector3(-0.50, 0.09, 0); 
                         
                         muzzleOffsetLocal.applyEuler(weaponGroup.rotation);
                         const muzzlePosLocal = weaponPosLocal.add(muzzleOffsetLocal);
                         const originHip = muzzlePosLocal.clone().applyQuaternion(mainCamera.quaternion).add(mainCamera.position);

                         const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(mainCamera.quaternion);
                         const originADS = mainCamera.position.clone().add(cameraForward.clone().multiplyScalar(0.5));

                         const rayOrigin = new THREE.Vector3().lerpVectors(originHip, originADS, aimingProgress.current);

                         raycaster.current.setFromCamera(new THREE.Vector2(0, 0), mainCamera);
                         raycaster.current.far = 100;
                         const eyeHits = raycaster.current.intersectObjects(mainScene.children, true);
                         
                         let targetPoint = new THREE.Vector3();
                         const validEyeHit = eyeHits.find(h => {
                            if (!h.object.visible) return false;
                            if (h.object.userData.isWeapon) return false;
                            return true;
                         });

                         if (validEyeHit) {
                             targetPoint.copy(validEyeHit.point);
                         } else {
                             targetPoint = mainCamera.position.clone().add(cameraForward.multiplyScalar(50));
                         }

                         const distToTarget = validEyeHit ? validEyeHit.distance : Infinity;
                         const distToMuzzle = mainCamera.position.distanceTo(rayOrigin);
                         
                         let finalOrigin = rayOrigin;
                         if (distToTarget < distToMuzzle) {
                             finalOrigin = mainCamera.position.clone();
                         }

                         const bulletDir = new THREE.Vector3().subVectors(targetPoint, finalOrigin).normalize();

                         const right = new THREE.Vector3(1, 0, 0).applyQuaternion(mainCamera.quaternion);
                         const up = new THREE.Vector3(0, 1, 0).applyQuaternion(mainCamera.quaternion);
                         bulletDir.addScaledVector(right, currentShotSpread.current.x);
                         bulletDir.addScaledVector(up, currentShotSpread.current.y);
                         bulletDir.normalize();

                         processGunshot(finalOrigin, bulletDir);
                    }
                }
            }
        }

        smoothAttackRot.current.x = THREE.MathUtils.lerp(smoothAttackRot.current.x, targetAttackRot.x, attackLerpSpeed);
        smoothAttackRot.current.y = THREE.MathUtils.lerp(smoothAttackRot.current.y, targetAttackRot.y, attackLerpSpeed);
        smoothAttackRot.current.z = THREE.MathUtils.lerp(smoothAttackRot.current.z, targetAttackRot.z, attackLerpSpeed);
        smoothAttackPos.current.lerp(targetAttackPos, attackLerpSpeed);
    });

    return {
        isAttacking,
        isBlocking: { current: false },
        isAiming,
        aimingProgress,
        triggerAttack,
        setBlocking,
        smoothAttackPos,
        smoothAttackRot,
        sprintPose,
        sprintBlockTime // Export for main controller
    };
};
