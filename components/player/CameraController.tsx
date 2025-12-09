
import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store';
import { GameState } from '../../types';

export const CameraController = () => {
    const { camera, gl } = useThree();
    const { mouseSensitivity, gameState, isInventoryOpen, readingPaperContent, startRotation, isJumpscared, jumpscareTarget } = useGameStore();
    
    // We separate the "Target" rotation (where mouse is) from "Smoothed" rotation (where camera is)
    // CRITICAL FIX: Initialize refs with startRotation immediately to prevent snapping to 0,0,0 (looking at wall/floor)
    const targetEuler = useRef(new THREE.Euler(0, startRotation, 0, 'YXZ'));
    const smoothedEuler = useRef(new THREE.Euler(0, startRotation, 0, 'YXZ'));
    
    // Flag to ensure we only hard-set the rotation once on spawn
    const hasInitialized = useRef(false);
    
    // Dummy Object for Jumpscare LookAt Calculation (Prevents Roll)
    const dummyCam = React.useMemo(() => new THREE.Object3D(), []);

    // Sync Euler with initial camera rotation logic from Store
    useEffect(() => {
        if (!hasInitialized.current) {
            // Force Camera and Refs to match the Store's Start Rotation (looking down corridor)
            // Pitch (x) is 0 to look at horizon, not floor.
            camera.rotation.set(0, startRotation, 0);
            targetEuler.current.set(0, startRotation, 0);
            smoothedEuler.current.set(0, startRotation, 0);
            hasInitialized.current = true;
        }
        
        // Reset FOV to default (70) on mount/restart
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = 70;
            camera.updateProjectionMatrix();
        }
    }, [startRotation, camera]);

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (isInventoryOpen || readingPaperContent !== null || isJumpscared) return; // Disable looking when inventory is open, reading paper or jumpscared
            if (document.pointerLockElement !== gl.domElement && document.pointerLockElement !== document.body) return;
            if (gameState !== 'PLAYING') return;

            // Tuned Base Speed: Reduced from 0.002 to 0.0015 for a less twitchy, heavier feel
            // This helps achieve the "45 deg input -> 40 deg output" sensation of weight
            const speed = 0.0015 * mouseSensitivity;

            // FIX JITTER #1: Clamp Mouse Delta
            // Sometimes browsers report huge spikes (e.g. +500) on frame drops or edge hits.
            // We clamp this to a reasonable max "flick" speed per event to prevent snapping.
            const MAX_MOUSE_DELTA = 300; 
            const movementX = Math.max(-MAX_MOUSE_DELTA, Math.min(MAX_MOUSE_DELTA, event.movementX));
            const movementY = Math.max(-MAX_MOUSE_DELTA, Math.min(MAX_MOUSE_DELTA, event.movementY));

            // Update the TARGET, not the camera directly
            targetEuler.current.y -= movementX * speed;
            targetEuler.current.x -= movementY * speed;
            targetEuler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetEuler.current.x));
        };

        document.addEventListener('mousemove', onMouseMove);
        return () => document.removeEventListener('mousemove', onMouseMove);
    }, [mouseSensitivity, gameState, gl, isInventoryOpen, readingPaperContent, isJumpscared]);

    // Apply Smoothing in Loop
    useFrame((state, deltaRaw) => {
        if (gameState !== 'PLAYING' || isInventoryOpen || readingPaperContent !== null) return;
        
        // JUMPSCARE OVERRIDE
        if (isJumpscared && jumpscareTarget) {
             // OLD RELIABLE LOGIC: setFromUnitVectors
             // This method is robust even if it introduces slight roll (which adds to the horror/disorientation anyway)
             // The previous "lookAt" method failed because jumpscareTarget might be malformed or dummyCam context was lost
             
             const direction = new THREE.Vector3().subVectors(jumpscareTarget, camera.position).normalize();
             const targetRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
             
             // Fast Slerp
             const dt = Math.max(0.001, deltaRaw);
             camera.quaternion.slerp(targetRotation, 10.0 * dt);
             
             // Sync refs
             camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');
             targetEuler.current.copy(camera.rotation);
             smoothedEuler.current.copy(camera.rotation);
             
             // ZOOM EFFECT (FOV)
             if (camera instanceof THREE.PerspectiveCamera) {
                 const targetFOV = 30; 
                 const zoomSpeed = 60.0 * dt;
                 if (camera.fov > targetFOV) {
                     camera.fov = Math.max(targetFOV, camera.fov - zoomSpeed);
                     camera.updateProjectionMatrix();
                 }
             }
             
             return;
        }

        // FIX JITTER #2: Clamp Frame Delta
        // If a lag spike occurs (delta > 0.1s), the smooth calculation will overshoot or snap.
        // We cap delta at 50ms (0.05) for camera logic.
        const delta = Math.min(deltaRaw, 0.05);

        // Restore FOV if not jumpscared (Auto-recovery)
        if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - 70) > 0.1) {
             camera.fov = THREE.MathUtils.lerp(camera.fov, 70, delta * 5.0);
             camera.updateProjectionMatrix();
        }

        // Smoothing Factor: 
        // REDUCED from 60 to 10. 
        // A lower value means more "drag" or "weight". The camera lags behind the target slightly.
        // 10 * 0.016 (60fps) ~= 0.16 blending per frame, creating a smooth, delayed reaction.
        const smoothFactor = Math.min(1.0, 10 * delta);

        smoothedEuler.current.x = THREE.MathUtils.lerp(smoothedEuler.current.x, targetEuler.current.x, smoothFactor);
        smoothedEuler.current.y = THREE.MathUtils.lerp(smoothedEuler.current.y, targetEuler.current.y, smoothFactor);
        smoothedEuler.current.z = 0; // Lock Z to prevent rolling

        camera.quaternion.setFromEuler(smoothedEuler.current);
    });

    // Ensure pointer lock is requested when game starts (handled in App.tsx mostly, but safety check here)
    useEffect(() => {
        // Only release lock if inventory is open (cursor needed for UI)
        if (isInventoryOpen) {
            document.exitPointerLock();
            return;
        }

        // Keep pointer locked during gameplay AND when reading paper (cursor hidden)
        if (gameState === GameState.PLAYING && !document.pointerLockElement) {
             const lockRequest = document.body.requestPointerLock() as any;
             if (lockRequest && typeof lockRequest.catch === 'function') {
                lockRequest.catch(() => {});
             }
        }
    }, [gameState, isInventoryOpen, readingPaperContent]);

    return null;
};
