
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../../store';
import { GameState } from '../../../types';

export const useSonarLogic = (
    screenMatRef: React.MutableRefObject<any>
) => {
    const isScanning = useGameStore(state => state.isScanning);
    const lastScanTime = useGameStore(state => state.lastScanTime);
    const gameState = useGameStore(state => state.gameState);

    // SONAR SPRINT POSE (Low and centered)
    const sprintPose = {
        pos: new THREE.Vector3(0, -0.35, 0),
        rot: new THREE.Euler(0, 0, 0)
    };

    const triggerAttack = () => {};
    const setBlocking = () => {};

    const smoothAttackPos = useRef(new THREE.Vector3(0,0,0));
    const smoothAttackRot = useRef(new THREE.Euler(0,0,0));

    useFrame((state) => {
        // PAUSE CHECK
        if (gameState !== GameState.PLAYING) return;
        
        if (screenMatRef.current) {
            const now = Date.now();
            const elapsed = now - lastScanTime;
            screenMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
            
            let targetColorStr = '#00ff00'; 
            if (isScanning) {
                targetColorStr = '#0011ff'; 
            } else if (elapsed < 30000) {
                targetColorStr = '#ff0000';
            } else {
                targetColorStr = '#00cc00';
            }
            screenMatRef.current.uniforms.uColor.value.set(targetColorStr);
        }
    });

    return {
        isAttacking: { current: false },
        isBlocking: { current: false },
        isAiming: { current: false },
        aimingProgress: { current: 0 },
        triggerAttack,
        setBlocking,
        smoothAttackPos,
        smoothAttackRot,
        sprintPose
    };
};
