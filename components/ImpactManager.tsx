
import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { Impact } from '../types';

// A single impact instance that handles its own "sparks" lifecycle
// OPTIMIZATION: Removed local PointLight. Visuals only now.
const BulletImpact = ({ impact }: { impact: Impact }) => {
    const decalGroupRef = useRef<THREE.Group>(null);
    const sparksCount = 8; 
    const sparkRefs = useRef<(THREE.Mesh | null)[]>([]);
    const sparkVelocities = useRef<THREE.Vector3[]>([]);

    useEffect(() => {
        if (decalGroupRef.current) {
            // Orient decal to match surface normal
            const targetQuaternion = new THREE.Quaternion();
            const dummyUp = new THREE.Vector3(0, 0, 1);
            const normal = new THREE.Vector3(impact.normal.x, impact.normal.y, impact.normal.z);
            
            if (normal.lengthSq() > 0.1) {
                targetQuaternion.setFromUnitVectors(dummyUp, normal.normalize());
                decalGroupRef.current.quaternion.copy(targetQuaternion);
            }
            // REDUCED OFFSET: From 0.08 down to 0.005 to fit tightly against the wall
            decalGroupRef.current.translateZ(0.005);
        }

        // Initialize sparks bursting OUT from the normal
        sparkVelocities.current = Array.from({ length: sparksCount }).map(() => {
            const spread = 4.0;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread
            );
            
            const normal = new THREE.Vector3(impact.normal.x, impact.normal.y, impact.normal.z);
            velocity.addScaledVector(normal, 8.0 + Math.random() * 6.0);
            
            return velocity;
        });
    }, [impact]);

    useFrame((state, delta) => {
        // PAUSE CHECK
        const { gameState } = useGameStore.getState();
        if (gameState !== 'PLAYING') return;

        const age = Date.now() - impact.timestamp;
        
        // --- 1. DECAL ANIMATION ---
        if (decalGroupRef.current) {
            // Handle Molten Core Cooling (Child index 1)
            const moltenCore = decalGroupRef.current.children[1] as THREE.Mesh;
            if (moltenCore && moltenCore.visible) {
                const coolTime = 800; // ms to cool down
                if (age < coolTime) {
                    const t = age / coolTime;
                    const intensity = 1.0 - (t * t); // Fade out quadratic
                    if (moltenCore.material) {
                         (moltenCore.material as THREE.MeshBasicMaterial).opacity = intensity;
                    }
                    
                    // Pulse effect
                    const pulse = 1.0 + Math.sin(age * 0.05) * 0.2;
                    moltenCore.scale.setScalar(pulse);
                } else {
                    moltenCore.visible = false;
                }
            }

            // Handle Black Hole Fading (Child index 0)
            if (age > 10000) {
                const fadeOpacity = Math.max(0, 1 - ((age - 10000) / 2000));
                const blackHole = decalGroupRef.current.children[0] as THREE.Mesh;
                if (blackHole && blackHole.material) {
                    (blackHole.material as THREE.MeshBasicMaterial).opacity = fadeOpacity;
                }
            }
        }

        // --- 2. SPARKS PHYSICS ---
        if (age < 200) {
            sparkRefs.current.forEach((mesh, i) => {
                if (mesh) {
                    const vel = sparkVelocities.current[i];
                    mesh.position.addScaledVector(vel, delta);
                    vel.y -= 15.0 * delta; // Gravity
                    
                    const lifeRatio = age / 200;
                    const scale = Math.max(0, 0.08 * (1 - lifeRatio));
                    mesh.scale.setScalar(scale);
                    
                    mesh.rotation.x += delta * 15;
                    mesh.rotation.z += delta * 15;
                }
            });
        } else {
             sparkRefs.current.forEach((mesh) => {
                 if (mesh) mesh.visible = false;
             });
        }
    });

    return (
        <group position={[impact.position.x, impact.position.y, impact.position.z]}>
            <group ref={decalGroupRef}>
                {/* BLACK HOLE - Tight Z placement (0.001) */}
                <mesh renderOrder={2} position={[0,0,0.001]}>
                    <circleGeometry args={[0.035, 16]} />
                    <meshBasicMaterial 
                        color="#000000" 
                        transparent 
                        opacity={0.9} 
                        depthWrite={false}
                        side={THREE.DoubleSide} 
                        toneMapped={false}
                    />
                </mesh>
                
                {/* MOLTEN CORE (HEAT MARK) - Tight Z placement (0.002) */}
                <mesh renderOrder={3} position={[0,0,0.002]}>
                    <circleGeometry args={[0.02, 12]} />
                    <meshBasicMaterial 
                        color="#ff5500" 
                        transparent 
                        opacity={1.0} 
                        depthWrite={false}
                        side={THREE.DoubleSide}
                        toneMapped={false}
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
            </group>
            
            {/* SPARKS */}
            {Array.from({ length: sparksCount }).map((_, i) => (
                <mesh 
                    key={i} 
                    ref={(el) => sparkRefs.current[i] = el} 
                    position={[0,0,0]} 
                    renderOrder={999}
                >
                    <boxGeometry args={[1, 1, 1]} /> 
                    <meshBasicMaterial color="#ffff00" toneMapped={false} />
                </mesh>
            ))}
        </group>
    )
}

const ImpactManager = () => {
    const impacts = useGameStore(state => state.impacts);
    
    // OPTIMIZATION: SHARED LIGHT POOL (Single Light)
    // Instead of creating a light for every bullet (expensive!), we reuse ONE light
    // and teleport it to the most recent impact location.
    const sharedLightRef = useRef<THREE.PointLight>(null);
    const lastProcessedImpactId = useRef<string>("");

    useFrame((state, delta) => {
        // PAUSE CHECK
        const { gameState } = useGameStore.getState();
        if (gameState !== 'PLAYING') return;

        // 1. Fade out the shared light constantly
        if (sharedLightRef.current && sharedLightRef.current.intensity > 0) {
            sharedLightRef.current.intensity -= delta * 15.0; // Fast fade out
            if (sharedLightRef.current.intensity < 0) sharedLightRef.current.intensity = 0;
        }

        // 2. Detect new impact
        if (impacts.length > 0) {
            const latest = impacts[impacts.length - 1];
            if (latest.id !== lastProcessedImpactId.current) {
                lastProcessedImpactId.current = latest.id;
                
                if (sharedLightRef.current) {
                    // Teleport light to new hit
                    // Move slightly away from wall (normal * 0.2) to prevent clipping/harsh shadows
                    sharedLightRef.current.position.set(
                        latest.position.x + latest.normal.x * 0.2,
                        latest.position.y + latest.normal.y * 0.2,
                        latest.position.z + latest.normal.z * 0.2
                    );
                    // Flash!
                    // Intensity=1.5, Distance=3: Sáng nhẹ, cục bộ
                    sharedLightRef.current.intensity = 1.5;
                }
            }
        }
    });

    return (
        <group>
            {/* THE SINGLE SHARED LIGHT */}
            <pointLight 
                ref={sharedLightRef}
                color="#ff5500"
                distance={3} // Small radius
                decay={2}
                intensity={0}
                castShadow={false} // NEVER cast shadows for debris/particles
            />

            {impacts.map(impact => (
                <BulletImpact key={impact.id} impact={impact} />
            ))}
        </group>
    );
};

export default ImpactManager;
