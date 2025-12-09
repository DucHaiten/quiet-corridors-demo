import React, { useMemo, useEffect } from 'react';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { modelCache } from './AssetPreloader'; // Import shared cache

// 3D Preview Models for Inventory
const PreviewModel = ({ itemType }: { itemType: string }) => {
    // Access cached models directly. 
    // They are guaranteed to be populated because AssetPreloader runs before game start.
    
    // Memoize the specific clone usage to avoid primitive re-mounts if not needed
    const objectToRender = useMemo(() => {
        let obj: THREE.Object3D | null = null;
        let scale = new THREE.Vector3(1, 1, 1);
        let rotation = new THREE.Euler(0, 0, 0);
        let position = new THREE.Vector3(0, 0, 0);

        switch(itemType) {
            case 'fist':
                return null; 
            case 'red_shard':
                obj = modelCache['red_shard'];
                scale.set(0.3, 0.3, 0.3);
                rotation.set(0, 0, Math.PI / 6);
                break;
            case 'scan':
                obj = modelCache['scan'];
                scale.set(1.2, 1.2, 1.2);
                rotation.set(0, -Math.PI / 4, 0);
                break;
            case 'weapon_stick':
                obj = modelCache['weapon_stick'];
                scale.set(1, 1, 1);
                rotation.set(0, 0, Math.PI / 4);
                break;
            case 'weapon_makarov':
                obj = modelCache['weapon_makarov'];
                scale.set(8.0, 8.0, 8.0);
                position.set(0, -0.2, 0);
                rotation.set(0, -Math.PI / 2, 0);
                break;
            case 'weapon_glock17':
                obj = modelCache['weapon_glock17'];
                scale.set(0.3, 0.3, 0.3);
                position.set(0, -0.7, 0);
                rotation.set(0, -Math.PI / 2, 0);
                break;
            case 'pill_bottle':
                obj = modelCache['pill_bottle'];
                // Inventory preview uses its own size (independent from hand-held size)
                scale.set(0.0055, 0.0055, 0.0055);
                position.set(0, -0.35, 0);
                rotation.set(0, Math.PI / 3, 0);
                break;
            case 'health_solution':
                obj = modelCache['health_solution'];
                scale.set(0.0045, 0.0045, 0.0045); // half size
                position.set(-0.7, -0.14, 0); // shift further left per request
                rotation.set(0, Math.PI / 2.5, 0);
                break;
            default:
                return null; 
        }

        if (!obj) return null;

        // Return a primitive descriptor
        return (
             <primitive 
                object={obj} 
                scale={scale} 
                position={position} 
                rotation={rotation} 
            />
        );
    }, [itemType]);

    if (itemType === 'fist') {
         return (
            <group>
                <mesh>
                    <boxGeometry args={[1, 1, 2]} />
                    <meshStandardMaterial color="#eac086" roughness={0.5} />
                </mesh>
                <mesh position={[0,0,1]}>
                    <boxGeometry args={[1.1, 1.1, 0.5]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                </mesh>
            </group>
        );
    }
    
    if (!objectToRender) {
         return (
            <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.8} />
            </mesh>
         );
    }

    return objectToRender;
}

const InventoryScene = () => {
    const isInventoryOpen = useGameStore(state => state.isInventoryOpen);
    const previewItem = useGameStore(state => state.previewItem);
    const { gl, size } = useThree();

    // 1. ISOLATED SCENE
    const virtualScene = useMemo(() => new THREE.Scene(), []);

    // 2. ISOLATED CAMERA
    const virtualCam = useMemo(() => {
        const cam = new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 100);
        cam.position.set(0, 0, 4);
        return cam;
    }, []);

    // Keep camera aspect ratio in sync with window
    useEffect(() => {
        virtualCam.aspect = size.width / size.height;
        virtualCam.updateProjectionMatrix();
    }, [size, virtualCam]);

    // 3. ISOLATED LIGHTING
    useMemo(() => {
        const ambient = new THREE.AmbientLight(0xffffff, 0.8); 
        const dir = new THREE.DirectionalLight(0xffffff, 2.5); 
        dir.position.set(5, 5, 10);
        const backLight = new THREE.DirectionalLight(0xaaccff, 1.0); 
        backLight.position.set(-5, 2, -5);

        virtualScene.add(ambient, dir, backLight);
        return () => {
            virtualScene.remove(ambient, dir, backLight);
        };
    }, [virtualScene]);

    // 4. RENDER PIPELINE
    useFrame(() => {
        if (!isInventoryOpen) return;
        gl.autoClear = false;
        gl.clearDepth();
        gl.render(virtualScene, virtualCam);
    }, 1);

    const typeToRender = previewItem ? (previewItem.typeId || previewItem.id) : '';

    return createPortal(
        <>
            {previewItem && <PreviewModel itemType={typeToRender} />}
            <OrbitControls 
                camera={virtualCam} 
                enableZoom={true} 
                minDistance={1.5}
                maxDistance={8}
                enablePan={false} 
                autoRotate 
                autoRotateSpeed={3}
                makeDefault={false}
            />
        </>,
        virtualScene
    );
};

export default InventoryScene;
