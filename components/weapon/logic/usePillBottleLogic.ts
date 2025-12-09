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

export const usePillBottleLogic = () => {
    const smoothAttackPos = useRef(new THREE.Vector3(0, 0, 0));
    const smoothAttackRot = useRef(new THREE.Euler(0, 0, 0));

    useFrame((state, deltaRaw) => {
        const delta = Math.min(deltaRaw, 0.05);
        const store = useGameStore.getState();
        if (store.gameState !== GameState.PLAYING) return;

        const isConsuming = store.isConsumingItem && store.consumingItemType === 'pill_bottle';
        const start = store.consumeStartTime;
        const duration = store.consumeDuration || 7000;
        const now = Date.now();

        let targetPos = ZERO_VEC;
        let targetRotX = 0;
        let targetRotY = 0;
        let inPhase4 = false;

        if (isConsuming && start > 0) {
            const elapsed = Math.max(0, now - start);
            const moveDuration = 1500; // ms: move to center/upright
            const waitDelay = 0;       // ms: no gap before tilt
            const tiltDuration = 500;  // ms: tilt into mouth
            const settleDuration = 1000; // ms: step 3 lower & pull in (longer)
            const oscillateDuration = 1500; // ms: step 4 slow in/out near mouth
            const pourPos = new THREE.Vector3(0.35, 0.45, -0.05); // slightly less to the right
            const centerPos = new THREE.Vector3(0.35, 0.14, 0);   // slightly less to the right
            // Step 3: only slightly lower than pour height, pull closer (toward player)
            const settlePos = new THREE.Vector3(0.35, 0.35, 0.25);

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
                targetRotX = THREE.MathUtils.lerp(0, 2.0, t);
            } else {
                const phaseTime = elapsed - moveDuration - waitDelay - tiltDuration;
                if (phaseTime <= settleDuration) {
                    // Step 3: lower and pull closer
                    const t = Math.min(1, phaseTime / settleDuration);
                    targetPos.copy(pourPos).lerp(settlePos, t);
                    targetRotX = 2.0; // hold tilt
                } else {
                    // Step 4: oscillate z between 0.25 and 0.05 for 1.0s, no gap
                    const t4 = Math.min(1, (phaseTime - settleDuration) / oscillateDuration);
                    const seg = Math.min(3.999, t4 * 4); // 4 segments
                    const z0 = 0.25; // farther
                    const z1 = 0.05; // closer
                    let z = z0;
                    if (seg < 1) z = THREE.MathUtils.lerp(z0, z1, seg);
                    else if (seg < 2) z = THREE.MathUtils.lerp(z1, z0, seg - 1);
                    else if (seg < 3) z = THREE.MathUtils.lerp(z0, z1, seg - 2);
                    else z = THREE.MathUtils.lerp(z1, z0, seg - 3);

                    // Tie Y to Z: closer (z1) lifts slightly, farther lowers slightly
                    const zRange = z0 - z1 || 1;
                    const tY = (z - z1) / zRange; // 0 when close, 1 when far
                    const yClose = 0.40;
                    const yFar = 0.32;
                    const y = THREE.MathUtils.lerp(yClose, yFar, tY);

                    targetPos.set(settlePos.x, y, z);
                    targetRotX = 2.0;
                    inPhase4 = true;
                }
            }
        }

        // Faster response during phase4 so oscillation is visible; else slow for smoothness
        const lerpSpeed = isConsuming ? (inPhase4 ? 12 : 2) : 10;
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

