import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../../store';
import { GameState } from '../../../types';

const ZERO_VEC = new THREE.Vector3(0, 0, 0);
const SPRINT_POSE = {
    pos: new THREE.Vector3(0, -0.35, 0),
    rot: new THREE.Euler(0, 0, 0)
};

export const useHealthSolutionLogic = () => {
    const smoothAttackPos = useRef(new THREE.Vector3(0, 0, 0));
    const smoothAttackRot = useRef(new THREE.Euler(0, 0, 0));

    useFrame((state, deltaRaw) => {
        const delta = Math.min(deltaRaw, 0.05);
        const store = useGameStore.getState();
        if (store.gameState !== GameState.PLAYING) return;

        const isConsuming = store.isConsumingItem && store.consumingItemType === 'health_solution';
        const start = store.consumeStartTime;
        const duration = store.consumeDuration || 7000;
        const now = Date.now();

        let targetPos = ZERO_VEC;
        let targetRotX = 0;
        let targetRotY = 0;

        if (isConsuming && start > 0) {
            const elapsed = Math.max(0, now - start);
            const moveDuration = 2750; // ms: move to center/upright (longer)
            const waitDelay = 0;       // ms: no gap before tilt
            const tiltDuration = 125;  // ms: tilt into mouth (further reduced)
            const settleDuration = 250; // ms: step 3 lower & pull in (further reduced)
            const pourPos = new THREE.Vector3(0.40, 0.52, -0.05); // lift higher while pouring (slightly less right)
            const centerPos = new THREE.Vector3(0.40, 0.22, 0);   // higher baseline in step 1 (slightly less right)
            // Step 3: only slightly lower than pour height, pull closer (toward player)
            const settlePos = new THREE.Vector3(0.40, 0.42, 0.25); // raise higher while tilting/settling

            // Step 1: move to center, upright (lower so later lift feels natural)
            targetPos = centerPos.clone(); // nudge slightly right to recenter
            targetRotY = 0;

            if (elapsed <= moveDuration) {
                targetRotX = 0;
            } else if (elapsed <= moveDuration + waitDelay) {
                targetRotX = 0;
            } else if (elapsed <= moveDuration + waitDelay + tiltDuration) {
                // Step 2: tilt mouth toward player
                const t = Math.min(1, (elapsed - moveDuration - waitDelay) / tiltDuration);
                targetPos.lerp(pourPos, t);
                targetRotX = THREE.MathUtils.lerp(0, 1.6, t);
            } else {
                const phaseTime = elapsed - moveDuration - waitDelay - tiltDuration;
                if (phaseTime <= settleDuration) {
                    // Step 3: lower and pull closer
                    const t = Math.min(1, phaseTime / settleDuration);
                    targetPos.copy(pourPos).lerp(settlePos, t);
                    targetRotX = 1.6; // hold tilt
                } else {
                    // Hold final settled pose (no step 4)
                    targetPos.copy(settlePos);
                    targetRotX = 1.6;
                }
            }
        }

        // Smooth when consuming
        const lerpSpeed = isConsuming ? 2 : 10;
        smoothAttackPos.current.lerp(targetPos, delta * lerpSpeed);
        smoothAttackRot.current.x = THREE.MathUtils.lerp(smoothAttackRot.current.x, targetRotX, delta * lerpSpeed);
        smoothAttackRot.current.y = THREE.MathUtils.lerp(smoothAttackRot.current.y, targetRotY, delta * lerpSpeed);
        smoothAttackRot.current.z = 0;
    });

    return {
        isAttacking: { current: false },
        isBlocking: { current: false },
        isAiming: { current: false },
        aimingProgress: { current: 0 },
        triggerAttack: () => {},
        setBlocking: () => {},
        smoothAttackPos,
        smoothAttackRot,
        sprintPose: SPRINT_POSE
    };
};


