
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InventoryItem, GameState } from '../../types';
import { getWeaponConfig } from './WeaponRegistry';
import { useGameStore } from '../../store';

// Import Specific Logic Hooks
import { useWeaponSway } from './logic/useWeaponSway';
import { useGlock17Logic } from './logic/useGlock17Logic';
import { useMakarovLogic } from './logic/useMakarovLogic';
import { useStickLogic } from './logic/useStickLogic';
import { useSonarLogic } from './logic/useSonarLogic';
import { usePillBottleLogic } from './logic/usePillBottleLogic';
import { useHealthSolutionLogic } from './logic/useHealthSolutionLogic';

// Reuse vectors
const _currentOffset = new THREE.Vector3();

interface WeaponLogicProps {
    inputs: any;
    isSprintingEffective: React.MutableRefObject<boolean>;
    item: InventoryItem;
    side: 'left' | 'right';
    isWeaponActive: boolean;
    isInventoryOpen: boolean;
    screenMatRef: React.MutableRefObject<any>;
    gunLightRef: React.MutableRefObject<THREE.PointLight | null>;
    worldLightRef: React.MutableRefObject<THREE.PointLight | null>;
    mainScene: THREE.Scene;
    mainCamera: THREE.Camera;
}

export const useWeaponLogic = ({
    inputs,
    isSprintingEffective,
    item,
    side,
    isWeaponActive,
    isInventoryOpen,
    screenMatRef,
    gunLightRef,
    worldLightRef,
    mainScene,
    mainCamera
}: WeaponLogicProps) => {
    // --- LOAD CONFIG ---
    const config = useMemo(() => getWeaponConfig(item.typeId), [item.typeId]);
    const weaponGroup = useRef<THREE.Group>(null);
    const muzzleFlashRef = useRef<THREE.Mesh>(null);

    const isStick = config.category === 'MELEE';
    const isPistol = config.category === 'PISTOL';
    const isSonar = config.category === 'TOOL';

    // --- 1. INITIALIZE SPECIFIC LOGIC HOOKS ---
    // We execute all hooks unconditionally to satisfy React rules, but only use the relevant one.
    // Passed isSprintingEffective so they can detect interrupt conditions.
    const glockLogic = useGlock17Logic(item, mainScene, mainCamera, gunLightRef, worldLightRef, muzzleFlashRef, isSprintingEffective);
    const makarovLogic = useMakarovLogic(item, mainScene, mainCamera, gunLightRef, worldLightRef, muzzleFlashRef, isSprintingEffective);
    const stickLogic = useStickLogic(item, mainScene, mainCamera);
    const sonarLogic = useSonarLogic(screenMatRef);
    const pillBottleLogic = usePillBottleLogic();
    const healthSolutionLogic = useHealthSolutionLogic();

    // --- 2. SELECT ACTIVE STRATEGY BASED ON TYPE ID ---
    let activeLogic;
    if (item.typeId === 'weapon_glock17') activeLogic = glockLogic;
    else if (item.typeId === 'weapon_makarov') activeLogic = makarovLogic;
    else if (item.typeId === 'weapon_stick') activeLogic = stickLogic;
    else if (item.typeId === 'pill_bottle') activeLogic = pillBottleLogic;
    else if (item.typeId === 'health_solution') activeLogic = healthSolutionLogic;
    else activeLogic = sonarLogic; // Default to Sonar/Tool if unknown

    const { 
        triggerAttack, setBlocking, isAttacking, isBlocking, isAiming, aimingProgress,
        smoothAttackPos, smoothAttackRot, sprintPose, sprintBlockTime
    } = activeLogic;

    // --- 3. COMMON SWAY LOGIC ---
    const { swayRotState, swayPosState } = useWeaponSway(aimingProgress);
    const gameState = useGameStore(state => state.gameState);

    // --- 4. ANIMATION & POSE LOOP ---
    const currentFreq = useRef(0);
    const currentAmpY = useRef(0);
    const currentAmpX = useRef(0);
    const bobTime = useRef(0);
    const smoothStatePos = useRef(new THREE.Vector3());
    const smoothStateRot = useRef(new THREE.Euler());

    useFrame((state, deltaRaw) => {
        if (!weaponGroup.current || isInventoryOpen) return;
        // PAUSE CHECK - Freeze weapon animation when not playing
        if (gameState !== GameState.PLAYING) return;
        
        const delta = Math.min(deltaRaw, 0.05);
        const time = state.clock.elapsedTime;

        const isMoving = inputs.forward.current || inputs.backward.current || inputs.left.current || inputs.right.current;
        
        // CHECK IF SPRINT SHOULD BE SUPPRESSED (Due to recent shooting/aiming)
        const isSprintBlocked = sprintBlockTime && (Date.now() < sprintBlockTime.current);

        // Standard Sprint check + Block check
        const isSprinting = inputs.sprinting.current && isMoving && isSprintingEffective.current && !isAttacking.current && !isBlocking.current && !isAiming.current && !isSprintBlocked;

        // DETERMINE TARGET POSE
        let targetFreq = 0;
        let targetAmpY = 0;
        let targetAmpX = 0;

        let targetStatePos = new THREE.Vector3(0, 0, 0);
        let targetStateRot = new THREE.Euler(0, 0, 0);

        const storeEarly = useGameStore.getState();
        const isBottleConsumingEarly = storeEarly.isConsumingItem && storeEarly.consumingItemType === item.typeId && (item.typeId === 'pill_bottle' || item.typeId === 'health_solution');

        if (!isWeaponActive && !isAttacking.current) {
            // HOLSTERED
            targetFreq = 0; targetAmpY = 0; targetAmpX = 0;
            targetStatePos.set(config.offsets.idle.pos[0], config.offsets.idle.pos[1], config.offsets.idle.pos[2]);
            targetStateRot.set(config.offsets.idle.rot[0], config.offsets.idle.rot[1], config.offsets.idle.rot[2]);
            
            if (smoothStatePos.current.y < -1.4 && weaponGroup.current.visible) weaponGroup.current.visible = false;
            else if (smoothStatePos.current.y > -1.4 && !weaponGroup.current.visible) weaponGroup.current.visible = true;

        } else {
            // ACTIVE
            if (!weaponGroup.current.visible) weaponGroup.current.visible = true;

            if (isBlocking.current && !isAttacking.current && isStick) {
                targetFreq = 0.5; targetAmpY = 0.005; targetAmpX = 0.005;
                targetStatePos.set(-0.05, 0.45, -0.1);
                targetStateRot.set(0.2, 0.0, 0.7);
            } else if (isAiming.current && !isAttacking.current && isPistol) {
                targetFreq = 1.5; targetAmpY = 0.002; targetAmpX = 0.001;
                targetStatePos.set(0, 0, 0); 
                targetStateRot.set(0, 0, 0);
            } else if (isSprinting) {
                // SPRINTING - Use Pose from specific logic file
                targetFreq = 11; targetAmpY = 0.15; targetAmpX = 0.08;
                if (sprintPose) {
                    targetStatePos.copy(sprintPose.pos);
                    targetStateRot.copy(sprintPose.rot);
                } else {
                    // Fallback
                    targetStatePos.set(0, -0.35, 0.1); 
                    targetStateRot.set(-0.3, 0.6, 0.2); 
                }
            } else if (isMoving) {
                targetFreq = 5; targetAmpY = 0.06; targetAmpX = 0.01;    
            } else {
                targetFreq = 0; targetAmpY = 0; targetAmpX = 0;
                const t = time * 0.8;
                targetStatePos.set(Math.sin(t) * 0.04, Math.sin(t * 2) * 0.02 - 0.06, 0);
                targetStateRot.set(Math.cos(t * 0.8) * 0.02, Math.sin(t) * 0.04, Math.sin(t * 0.5) * 0.01);
            }
        }

        // If consuming pill, freeze sway/bobbing offsets so it stays still
        if (isBottleConsumingEarly) {
            targetFreq = 0;
            targetAmpY = 0;
            targetAmpX = 0;
            targetStatePos.set(0, 0, 0);
            targetStateRot.set(0, 0, 0);
        }

        // SMOOTHING & BOBBING
        const transitionSpeed = delta * 8; 
        currentFreq.current = THREE.MathUtils.lerp(currentFreq.current, targetFreq, transitionSpeed);
        currentAmpY.current = THREE.MathUtils.lerp(currentAmpY.current, targetAmpY, transitionSpeed);
        currentAmpX.current = THREE.MathUtils.lerp(currentAmpX.current, targetAmpX, transitionSpeed);

        smoothStatePos.current.lerp(targetStatePos, transitionSpeed);
        smoothStateRot.current.x = THREE.MathUtils.lerp(smoothStateRot.current.x, targetStateRot.x, transitionSpeed);
        smoothStateRot.current.y = THREE.MathUtils.lerp(smoothStateRot.current.y, targetStateRot.y, transitionSpeed);
        smoothStateRot.current.z = THREE.MathUtils.lerp(smoothStateRot.current.z, targetStateRot.z, transitionSpeed);

        bobTime.current += delta * currentFreq.current;
        const phaseOffset = side === 'left' ? Math.PI : 0;
        const swayY = Math.sin(bobTime.current + phaseOffset) * currentAmpY.current;
        const swayX = Math.cos((bobTime.current + phaseOffset) * 0.5) * currentAmpX.current;

        // APPLY FINAL TRANSFORM
        if (isSonar) {
            _currentOffset.set(config.offsets.hip[0], config.offsets.hip[1], config.offsets.hip[2]);
        } else if (isPistol) {
            const hipPos = new THREE.Vector3(config.offsets.hip[0], config.offsets.hip[1], config.offsets.hip[2]);
            const adsData = config.offsets.ads;
            const adsPos = adsData ? new THREE.Vector3(adsData.pos[0], adsData.pos[1], adsData.pos[2]) : new THREE.Vector3(); 
            _currentOffset.lerpVectors(hipPos, adsPos, aimingProgress.current);
        } else {
            // Stick
            _currentOffset.set(config.offsets.hip[0], config.offsets.hip[1], config.offsets.hip[2]);
        }

        const store = useGameStore.getState();
        const isBottleConsuming = store.isConsumingItem && store.consumingItemType === item.typeId && (item.typeId === 'pill_bottle' || item.typeId === 'health_solution');

        const applySway = !isBottleConsuming;

        if (applySway) {
            _currentOffset.y += swayY;
            _currentOffset.x += swayX;
        }
        _currentOffset.add(smoothStatePos.current);
        _currentOffset.add(smoothAttackPos.current);
        if (applySway) {
            _currentOffset.x += swayPosState.current.x;
            _currentOffset.y += swayPosState.current.y;
        }
        weaponGroup.current.position.copy(_currentOffset);

        weaponGroup.current.rotation.set(0,0,0);
        
        // Base Rotation
        if (isBottleConsuming) {
            // Keep upright/centered while consuming; baseRotation handles label
            weaponGroup.current.rotateX(0);
            weaponGroup.current.rotateY(0);
            weaponGroup.current.rotateZ(0);
        } else if (isSonar) {
            weaponGroup.current.rotateX(-0.3); weaponGroup.current.rotateY(0.2); weaponGroup.current.rotateZ(-0.1);
        } else if (isPistol) {
            // Hardcoded Hip Rotation (Legacy values preserved for smooth feel)
            const hipRot = { x: 0, y: -Math.PI / 2 + 0.25, z: -0.12 };
            
            // ADS Rotation from Config or Fallback
            const adsData = config.offsets.ads;
            const adsRot = adsData ? { x: adsData.rot[0], y: adsData.rot[1], z: adsData.rot[2] } : { x: 0, y: -Math.PI/2, z: 0 };
            
            const rX = THREE.MathUtils.lerp(hipRot.x, adsRot.x, aimingProgress.current);
            const rY = THREE.MathUtils.lerp(hipRot.y, adsRot.y, aimingProgress.current);
            const rZ = THREE.MathUtils.lerp(hipRot.z, adsRot.z, aimingProgress.current);

            weaponGroup.current.rotation.set(rX, rY, rZ);
        } else {
            weaponGroup.current.rotateX(-0.3); weaponGroup.current.rotateY(-0.1); weaponGroup.current.rotateZ(0.6); 
        }
        
        weaponGroup.current.rotateX(smoothStateRot.current.x);
        weaponGroup.current.rotateY(smoothStateRot.current.y);
        weaponGroup.current.rotateZ(smoothStateRot.current.z);
        
        weaponGroup.current.rotateX(smoothAttackRot.current.x);
        weaponGroup.current.rotateY(smoothAttackRot.current.y);
        weaponGroup.current.rotateZ(smoothAttackRot.current.z);
        
        if (applySway) {
            weaponGroup.current.rotateX((swayY * 0.5) + swayRotState.current.x); 
            weaponGroup.current.rotateY((swayX * 0.8) + swayRotState.current.y);
        }
        
        weaponGroup.current.updateMatrix();
    });

    return { weaponGroup, triggerAttack, setBlockingState: setBlocking, muzzleFlashRef };
};
