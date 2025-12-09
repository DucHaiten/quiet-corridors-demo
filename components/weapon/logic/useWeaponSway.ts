
import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../../store';
import { GameState } from '../../../types';

// Reusable vectors
const _camQuat = new THREE.Quaternion();
const _deltaQuat = new THREE.Quaternion();
const _deltaEuler = new THREE.Euler();

export const useWeaponSway = (aimingProgress: React.MutableRefObject<number>) => {
    const { camera } = useThree();
    const gameState = useGameStore(state => state.gameState);
    
    // --- INPUT LAG / SWAY REFS ---
    const lastCamQuat = useRef(new THREE.Quaternion().copy(camera.quaternion));
    const swayRotState = useRef({ x: 0, y: 0 }); 
    const swayPosState = useRef({ x: 0, y: 0 }); 

    useEffect(() => {
        lastCamQuat.current.copy(camera.quaternion);
    }, []);

    useFrame((state, deltaRaw) => {
        // PAUSE CHECK - Freeze sway calculation when not playing
        if (gameState !== GameState.PLAYING) return;
        
        const delta = Math.min(deltaRaw, 0.05);

        // --- INPUT LAG / SWAY CALCULATION ---
        _camQuat.copy(camera.quaternion);
        _deltaQuat.copy(lastCamQuat.current);
        
        if (_camQuat.dot(_deltaQuat) < 0) {
            _deltaQuat.x = -_deltaQuat.x;
            _deltaQuat.y = -_deltaQuat.y;
            _deltaQuat.z = -_deltaQuat.z;
            _deltaQuat.w = -_deltaQuat.w;
        }

        _deltaQuat.invert();
        _deltaQuat.premultiply(_camQuat); 
        _deltaEuler.setFromQuaternion(_deltaQuat, 'YXZ');

        // Reduce sway when aiming (ADS)
        const aimRatio = aimingProgress.current;
        const rotSwayMult = 1.0 - (aimRatio * 0.7); 
        const posSwayMult = 1.0 - (aimRatio * 0.4);

        // 1. ROTATIONAL SWAY
        const ROT_SWAY_INTENSITY = 12.0 * rotSwayMult; 
        const ROT_SWAY_SMOOTH = 6.0; 
        const MAX_ROT_SWAY_ANGLE = 0.15 * rotSwayMult;
        
        let targetRotSwayX = -_deltaEuler.x * ROT_SWAY_INTENSITY; 
        let targetRotSwayY = -_deltaEuler.y * ROT_SWAY_INTENSITY; 
        
        targetRotSwayX = THREE.MathUtils.clamp(targetRotSwayX, -MAX_ROT_SWAY_ANGLE, MAX_ROT_SWAY_ANGLE);
        targetRotSwayY = THREE.MathUtils.clamp(targetRotSwayY, -MAX_ROT_SWAY_ANGLE, MAX_ROT_SWAY_ANGLE);
        
        swayRotState.current.x = THREE.MathUtils.lerp(swayRotState.current.x, targetRotSwayX, delta * ROT_SWAY_SMOOTH);
        swayRotState.current.y = THREE.MathUtils.lerp(swayRotState.current.y, targetRotSwayY, delta * ROT_SWAY_SMOOTH);

        // 2. POSITIONAL SWAY
        const POS_SWAY_INTENSITY = 8.0 * posSwayMult; 
        const POS_SWAY_SMOOTH = 2.0;    
        const MAX_POS_SWAY = 0.35 * posSwayMult;      
        
        let targetPosSwayX = _deltaEuler.y * POS_SWAY_INTENSITY; 
        let targetPosSwayY = -_deltaEuler.x * POS_SWAY_INTENSITY;

        targetPosSwayX = THREE.MathUtils.clamp(targetPosSwayX, -MAX_POS_SWAY, MAX_POS_SWAY);
        targetPosSwayY = THREE.MathUtils.clamp(targetPosSwayY, -MAX_POS_SWAY, MAX_POS_SWAY);
        
        swayPosState.current.x = THREE.MathUtils.lerp(swayPosState.current.x, targetPosSwayX, delta * POS_SWAY_SMOOTH);
        swayPosState.current.y = THREE.MathUtils.lerp(swayPosState.current.y, targetPosSwayY, delta * POS_SWAY_SMOOTH);

        lastCamQuat.current.copy(camera.quaternion);
    });

    return { swayRotState, swayPosState };
};
