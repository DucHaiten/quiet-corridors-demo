
import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { InventoryItem } from '../types';

// Import New Refactored Components
import './weapon/SonarShader'; // Registers shader
import { useWeaponModel } from './weapon/useWeaponModel';
import { useWeaponLogic } from './weapon/useWeaponLogic';

export interface WeaponHandle {
    attack: () => void;
    setBlocking: (active: boolean) => void;
}

// Sub-component for individual hand rendering
const WeaponHand = forwardRef<WeaponHandle, { 
    item: InventoryItem, 
    side: 'left' | 'right',
    inputs: any,
    isSprintingEffective: React.MutableRefObject<boolean>,
    mainScene: THREE.Scene,
    mainCamera: THREE.Camera
}>(({ item, side, inputs, isSprintingEffective, mainScene, mainCamera }, ref) => {
    
    const isWeaponActive = useGameStore(state => state.isWeaponActive);
    const isInventoryOpen = useGameStore(state => state.isInventoryOpen);
    
    // Ref for the ShaderMaterial
    const screenMatRef = useRef<any>(null);
    const gunLightRef = useRef<THREE.PointLight>(null);
    const worldLightRef = useRef<THREE.PointLight>(null);

    // Model Hook
    const weaponModel = useWeaponModel(item, screenMatRef);

    // Logic Hook
    const { weaponGroup, triggerAttack, setBlockingState, muzzleFlashRef } = useWeaponLogic({
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
    });

    // Expose control methods
    useImperativeHandle(ref, () => ({
        attack: triggerAttack,
        setBlocking: setBlockingState
    }));

    const isPistol = item?.typeId === 'weapon_makarov' || item?.typeId === 'weapon_glock17';

    return (
        <group ref={weaponGroup} userData={{ isWeapon: true }} matrixAutoUpdate={false}>
            {weaponModel && (
                 <group>
                    <primitive 
                        object={weaponModel} 
                        position={[0, 0, 0]} 
                        position-y={item?.typeId === 'weapon_stick' ? 0.5 : 0} 
                        /* REMOVED hardcoded rotation={[0, 0, 0]} here to allow useWeaponModel baseRotation to work */
                    />
                    
                    {item?.typeId === 'scan' && (
                        <RoundedBox
                            args={[0.12, 0.1, 0.02]} // Locked Dimensions
                            radius={0.015} // Locked Corner Radius
                            smoothness={4} // Locked Smoothness
                            position={[0.085, -0.105, 0.08]} // Locked Position (Flush)
                            rotation={[0, 0, 0]} // Locked Rotation (Face Camera)
                            scale={[1, 1, 1]} // Locked Scale
                            name="SonarScreenOverlay"
                        >
                            {/* @ts-ignore */}
                            <sonarScreenMaterial 
                                ref={screenMatRef} 
                                side={THREE.DoubleSide} 
                                transparent={false}
                                toneMapped={false}
                                fog={false}
                            />
                        </RoundedBox>
                    )}

                    {/* MUZZLE FLASH MESH (Pistol Only) */}
                    {isPistol && (
                        <>
                            <mesh 
                                ref={muzzleFlashRef} 
                                position={[-0.50, 0.09, 0]} 
                                visible={false}
                            >
                                <sphereGeometry args={[0.08, 8, 8]} />
                                <meshBasicMaterial 
                                    color="#ffcc66" 
                                    transparent 
                                    opacity={0.8} 
                                    depthTest={true} 
                                    depthWrite={false}
                                    toneMapped={false}
                                />
                            </mesh>
                            {/* Gun Light: Illuminates the weapon model itself */}
                            <pointLight 
                                ref={gunLightRef} 
                                position={[-0.50, 0.1, 0]} 
                                color="#ffaa00" 
                                distance={3} 
                                decay={2} 
                                intensity={0} 
                                userData={{ ignoreGlobalSync: true }}
                            />
                        </>
                    )}
                 </group>
            )}

            {/* World Light: Portal to Main Camera to illuminate environment */}
            {/* OPTIMIZATION: 
                - Moved position to [0.25, -0.3, -1.0] to mimic Right Hand holding position relative to camera.
                - This helps light hit the floor and right-side walls properly.
                - decay=2 for natural falloff.
            */}
            {isPistol && createPortal(
                <pointLight 
                    ref={worldLightRef}
                    position={[0.25, -0.3, -1.0]} 
                    color="#ffddaa"
                    distance={15} 
                    decay={2} 
                    intensity={0}
                    castShadow={false}
                    userData={{ ignoreGlobalSync: true }}
                />,
                mainCamera
            )}
        </group>
    );
});

const Weapon = forwardRef<WeaponHandle, { 
    inputs: any, 
    isSprintingEffective: React.MutableRefObject<boolean>, 
    weaponScene: THREE.Scene,
    mainScene: THREE.Scene,
    mainCamera: THREE.Camera 
}>(({ inputs, isSprintingEffective, weaponScene, mainScene, mainCamera }, ref) => {
  // Store Data
  const leftHandItem = useGameStore(state => state.leftHandItem);
  const rightHandItem = useGameStore(state => state.rightHandItem);
  
  // Refs for forwarding actions
  const rightHandRef = useRef<WeaponHandle>(null);
  const leftHandRef = useRef<WeaponHandle>(null);

  // Parent Controls -> Right Hand (Main Weapon)
  useImperativeHandle(ref, () => ({
      attack: () => {
          if (rightHandRef.current) rightHandRef.current.attack();
      },
      setBlocking: (active: boolean) => {
          if (rightHandRef.current) rightHandRef.current.setBlocking(active);
      }
  }));

  // Render both hands into the portal
  return createPortal(
    <group>
        {leftHandItem && (
            <WeaponHand 
                key={leftHandItem.id} // Re-mount if item ID changes
                item={leftHandItem} 
                side="left"
                inputs={inputs}
                isSprintingEffective={isSprintingEffective}
                ref={leftHandRef}
                mainScene={mainScene}
                mainCamera={mainCamera}
            />
        )}
        {rightHandItem && (
            <WeaponHand 
                key={rightHandItem.id} 
                item={rightHandItem} 
                side="right"
                inputs={inputs}
                isSprintingEffective={isSprintingEffective}
                ref={rightHandRef}
                mainScene={mainScene}
                mainCamera={mainCamera}
            />
        )}
    </group>,
    weaponScene
  );
});

export default Weapon;
