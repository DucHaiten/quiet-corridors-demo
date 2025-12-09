
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../../store';
import { soundManager } from '../../SoundManager';
import { WEAPON_REACH } from '../../../constants';
import { InventoryItem, GameState } from '../../../types';

const getHitInfo = (obj: THREE.Object3D): { type: string | null, id?: string } => {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
        if (curr.userData && curr.userData.type) return { type: curr.userData.type, id: curr.userData.id };
        curr = curr.parent;
    }
    return { type: null };
};

export const useStickLogic = (
    item: InventoryItem, 
    mainScene: THREE.Scene, 
    mainCamera: THREE.Camera
) => {
    const isAttacking = useRef(false);
    const attackStartTime = useRef(0);
    const hasDealtDamage = useRef(false);
    const hasPlayedSound = useRef(false);
    const isBlocking = useRef(false);

    const smoothAttackRot = useRef(new THREE.Euler());
    const smoothAttackPos = useRef(new THREE.Vector3()); 
    const raycaster = useRef(new THREE.Raycaster());

    // STANDARD MELEE SPRINT POSE
    const sprintPose = {
        pos: new THREE.Vector3(0, -0.35, 0.1),
        rot: new THREE.Euler(-0.3, 0.6, 0.2)
    };

    const processMeleeHit = () => {
        const didShoot = useGameStore.getState().shoot(); 
        if (!didShoot) return;

        raycaster.current.setFromCamera(new THREE.Vector2(0, 0), mainCamera);
        raycaster.current.far = WEAPON_REACH; 
        const hits = raycaster.current.intersectObjects(mainScene.children, true);
        let hitSomething = false;
        
        for (const hit of hits) {
            if (!hit.object.visible) continue;
            const { type, id } = getHitInfo(hit.object);
            if (!type) continue;

            if (type === 'enemy' || type === 'trap') {
                soundManager.playStickHitPerson();
                if (id && type === 'trap') useGameStore.getState().hitTrap(id, 1);
                if (id && type === 'enemy') useGameStore.getState().killEnemy(id);
                useGameStore.getState().decreaseDurability(1, item.id);
                hitSomething = true;
                break;
            } else if (type === 'level') {
                soundManager.playStickHit(); 
                useGameStore.getState().decreaseDurability(1, item.id);
                hitSomething = true;
                break;
            }
        }

        // Fallback: if ray missed but a triggered trap is very close in front, apply a hit
        if (!hitSomething) {
            const state = useGameStore.getState();
            const traps = state.traps || [];
            const camPos = mainCamera.position.clone();
            const forward = new THREE.Vector3();
            mainCamera.getWorldDirection(forward);

            for (const trap of traps) {
                if (!trap.triggered) continue;
                const trapPos = new THREE.Vector3(trap.position.x, trap.position.y, trap.position.z);
                const toTrap = trapPos.clone().sub(camPos);
                const dist = toTrap.length();
                if (dist > WEAPON_REACH) continue;
                toTrap.normalize();
                const facing = forward.dot(toTrap); // 1 = directly ahead
                if (facing < 0.25) continue; // ignore if mostly behind/side

                soundManager.playStickHitPerson();
                state.hitTrap(trap.id, 1);
                state.decreaseDurability(1, item.id);
                hitSomething = true;
                break;
            }
        }
    };

    const triggerAttack = () => {
        if (isAttacking.current) return;
        isAttacking.current = true;
        attackStartTime.current = Date.now();
        hasDealtDamage.current = false;
        hasPlayedSound.current = false;
    };

    const setBlocking = (active: boolean) => {
        isBlocking.current = active;
        useGameStore.getState().setBlocking(active);
    };

    const gameState = useGameStore(state => state.gameState);

    useFrame((state, deltaRaw) => {
        // PAUSE CHECK - Freeze weapon logic when not playing
        if (gameState !== GameState.PLAYING) return;
        
        const delta = Math.min(deltaRaw, 0.05);

        const targetAttackRot = new THREE.Euler(0, 0, 0);
        const targetAttackPos = new THREE.Vector3(0, 0, 0); 
        let attackLerpSpeed = 10 * delta; 

        if (isAttacking.current) {
            const elapsed = Date.now() - attackStartTime.current;
            const duration = 1500; 
            const progress = elapsed / duration;

            if (progress >= 1) {
                isAttacking.current = false;
            } else {
                if (progress < 0.45) {
                    targetAttackRot.set(-2.5, -0.4, -1.8); targetAttackPos.set(0.1, 0.9, 0.3); attackLerpSpeed = 8 * delta; 
                } else if (progress < 0.60) {
                    targetAttackRot.set(0.8, 0.6, 1.2); targetAttackPos.set(-0.6, -0.6, -1.8); attackLerpSpeed = 25 * delta; 
                } else {
                    targetAttackRot.set(0, 0, 0); targetAttackPos.set(0, 0, 0); attackLerpSpeed = 5 * delta; 
                }

                if (!hasPlayedSound.current && progress > 0.45) {
                    soundManager.playSwingWeapon();
                    hasPlayedSound.current = true;
                }

                if (!hasDealtDamage.current && progress > 0.52) {
                    processMeleeHit();
                    useGameStore.getState().emitSound('MELEE', mainCamera.position);
                    hasDealtDamage.current = true;
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
        isBlocking,
        isAiming: { current: false },
        aimingProgress: { current: 0 },
        triggerAttack,
        setBlocking,
        smoothAttackPos,
        smoothAttackRot,
        sprintPose
    };
};
