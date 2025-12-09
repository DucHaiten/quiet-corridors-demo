
import React, { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store';

export const CompassUpdater = () => {
    const { camera } = useThree();
    const stripRef = useRef<HTMLElement | null>(null);
    const forwardVec = useRef(new THREE.Vector3());

    useFrame(() => {
        // PAUSE CHECK
        const { gameState } = useGameStore.getState();
        if (gameState !== 'PLAYING') return;

        try {
            const el = document.getElementById('compass-strip');
            if (!el) return;
            stripRef.current = el;

            camera.getWorldDirection(forwardVec.current);
            let theta = Math.atan2(forwardVec.current.x, -forwardVec.current.z);
            let deg = THREE.MathUtils.radToDeg(theta);
            if (deg < 0) deg += 360;
            const displayDeg = deg + 360;
            const pixelsPerDeg = 5; 
            const offset = displayDeg * pixelsPerDeg;
            stripRef.current.style.transform = `translateX(-${offset}px)`;
        } catch (e) {
            // Silently fail if DOM element is missing during unmount
        }
    });

    return null;
};

export const ScannerTracker = () => {
    const { camera } = useThree();
    const isScanning = useGameStore(state => state.isScanning && !state.suppressScanVisuals);
    const shardPos = useGameStore(state => state.shardPosition);
    const hasShard = useGameStore(state => state.hasShard);
    
    useFrame(() => {
        // PAUSE CHECK
        const { gameState, isScanning: scanning, scanEndTime } = useGameStore.getState();
        if (gameState !== 'PLAYING') return;

        // Stop scan countdown while paused by deferring expiration until play resumes
        if (scanning && scanEndTime > 0 && Date.now() >= scanEndTime) {
            useGameStore.setState({ isScanning: false, scanEndTime: 0 });
        }

        try {
            const el = document.getElementById('shard-distance');
            if (!el) return;

            if (isScanning && shardPos && !hasShard) {
                const dx = camera.position.x - shardPos.x;
                const dz = camera.position.z - shardPos.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                el.style.opacity = '1';
                el.innerText = `SIGNAL DETECTED: ${Math.round(dist)}m`;
            } else {
                el.style.opacity = '0';
            }
        } catch (e) {
            // Silently fail
        }
    });

    return null;
}
