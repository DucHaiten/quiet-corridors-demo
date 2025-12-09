
import React, { useMemo, useRef, useEffect } from 'react';
import { COLORS, CELL_SIZE, WALL_HEIGHT, MAP_SIZE, DEAD_BODY_MODEL_PATH } from '../constants';
import { useGameStore } from '../store';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GameState } from '../types';

const DeadBodyProp = ({ position, highlight, showDebug }: { position: { x: number, y: number, z: number }, highlight: boolean, showDebug: boolean }) => {
    const gltf = useGLTF(DEAD_BODY_MODEL_PATH);
    const scene = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (mat) {
                    // Clone the material to avoid cross-state mutation
                    const clonedMat = mat.clone();
                    clonedMat.roughness = 0.6;
                    clonedMat.side = THREE.FrontSide;

                    if (highlight) {
                        // Keep original albedo, just boost emissive for visibility (no depth hacks)
                        clonedMat.emissive = clonedMat.emissive ?? new THREE.Color("#550000");
                        clonedMat.emissiveIntensity = 1.6;
                        clonedMat.depthTest = true;
                        clonedMat.depthWrite = true;
                        clonedMat.fog = true;
                    } else {
                        clonedMat.emissive = clonedMat.emissive ?? new THREE.Color("#1a1a1a");
                        clonedMat.emissiveIntensity = 0.35;
                        clonedMat.depthTest = true;
                        clonedMat.depthWrite = true;
                        clonedMat.fog = true;
                    }

                    (child as THREE.Mesh).material = clonedMat;
                }
            }
        });
        return clone;
    }, [gltf, highlight]);

    // Slight rotation so it does not align perfectly with grid
    const rotationY = useMemo(() => Math.PI * 1.25, []);

    return (
        <group position={[position.x, 0, position.z]} rotation={[0, rotationY, 0]}>
            <primitive object={scene} position={[0, 0.08, 0]} scale={[1.05, 1.05, 1.05]} />
            {highlight && (
                <>
                    <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={999}>
                        <planeGeometry args={[2.6, 2.6]} />
                        <meshBasicMaterial 
                            color="#ff0000" 
                            transparent 
                            opacity={0.32} 
                            depthTest={false} 
                            depthWrite={false} 
                            fog={false} 
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                    <pointLight position={[0, 1.6, 0]} color="#ff4444" intensity={4.5} distance={16} decay={1.4} />
                </>
            )}
            {showDebug && (
                <group>
                    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[2.2, 2.2]} />
                        <meshBasicMaterial color="#00ff66" transparent opacity={0.25} />
                    </mesh>
                    <mesh position={[0, 0.9, 0]}>
                        <cylinderGeometry args={[0.05, 0.05, 1.8, 8]} />
                        <meshBasicMaterial color="#00ff66" transparent opacity={0.6} />
                    </mesh>
                </group>
            )}
        </group>
    );
};

const WallInstance = ({ walls, material }: { walls: { x: number, y: number, z: number }[], material?: THREE.Material }) => {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);

  React.useLayoutEffect(() => {
    if (!meshRef.current || !walls || walls.length === 0) return;
    
    const tempObject = new THREE.Object3D();
    
    walls.forEach((wall, i) => {
      tempObject.position.set(wall.x, WALL_HEIGHT / 2, wall.z);
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [walls]);

  if (!walls || walls.length === 0) return null;

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[undefined, undefined, walls.length]} 
      castShadow 
      receiveShadow
      userData={{ type: 'level' }}
    >
      <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
      {material ? (
        <primitive object={material} attach="material" />
      ) : (
        <meshStandardMaterial color={COLORS.wall} roughness={0.3} metalness={0.1} side={THREE.FrontSide} />
      )}
    </instancedMesh>
  );
};

const ShardPillar = ({ position, hasShard, wallMaterial }: { position: {x:number, y:number, z:number}, hasShard: boolean, wallMaterial?: THREE.MeshStandardMaterial }) => {
    const groupRef = useRef<THREE.Group>(null);
    const isScanning = useGameStore(state => state.isScanning && !state.suppressScanVisuals);
    const isGodMode = useGameStore(state => state.isGodMode);
    const gameState = useGameStore(state => state.gameState);
    
    const visibleThroughWalls = isScanning || isGodMode;
    // God mode: Key Items are Yellow (#ffff00), Scan is Red (#ff0000)
    const highlightColor = isGodMode ? "#ffff00" : "#ff0000";

    // Load the shard and cherubim models
    const gltf = useGLTF('/model/red_glass_shard.glb');
    const cherubGltf = useGLTF('/model/Cherubim.glb');

    const shardScene = useMemo(() => {
        const clone = gltf.scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Enhance the material slightly for a glass look
                const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (mat) {
                    mat.emissive = new THREE.Color("#500000");
                    mat.emissiveIntensity = 0.5;
                    mat.roughness = 0.1;
                    mat.metalness = 0.8;
                }
            }
        });
        return clone;
    }, [gltf]);

    const cherubScene = useMemo(() => {
        const clone = cherubGltf.scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (mat) {
                    mat.roughness = mat.roughness ?? 0.4;
                    mat.metalness = mat.metalness ?? 0.2;
                }
            }
        });
        return clone;
    }, [cherubGltf]);

    // Scale & pedestal to make the statue feel grander
    const statueScale = 1.6;
    const pedestalHeight = 2.0;
    const pedestalRadius = 1.2;
    const pedestalSkirtHeight = 0.12;
    const pedestalSkirtRadius = pedestalRadius + 0.05;

    // Stair parameters (shared between steps and backfill)
    const stepCount = 6;
    const stepHeight = 0.32;
    const stepDepth = 0.35;
    const bottomWidth = pedestalRadius * 0.95;
    const topWidth = pedestalRadius * 0.8;
    const zTop = -(pedestalRadius - (stepDepth / 2) - 0.05);
    const totalRun = (stepCount - 1) * stepDepth;
    const totalHeight = stepCount * stepHeight;

    // Position shard slightly in front and a bit to the left, aligned to belly height
    const shardBellyOffset = 1.4; // relative belly height from ground before pedestal
    const shardBaseY = pedestalHeight + shardBellyOffset;
    const shardForwardOffset = -0.55; // forward (cherub faces -Z after 180° rotate)
    const shardSideOffset = -0.25; // left/right offset (negative = left when facing forward)

    useFrame((state) => {
        if(groupRef.current) {
            // PAUSE CHECK - Freeze shard animation when not playing
            if (gameState !== GameState.PLAYING) return;
            
            // Spin and bob the entire group (Model + Aura)
            groupRef.current.rotation.y += 0.015;
            groupRef.current.position.y = shardBaseY + Math.sin(state.clock.elapsedTime * 1.5) * 0.12;
        }
    });

    return (
        <group position={[position.x, 0, position.z]}>
            {/* Pedestal to lift the statue */}
            <mesh position={[0, pedestalHeight / 2, 0]} castShadow receiveShadow userData={{ type: 'level' }}>
                <cylinderGeometry args={[pedestalRadius, pedestalRadius, pedestalHeight, 24]} />
                {wallMaterial ? (
                    <primitive object={wallMaterial.clone()} attach="material" />
                ) : (
                    <meshStandardMaterial color="#4b5563" roughness={0.6} metalness={0.15} />
                )}
            </mesh>

            {/* Small skirt/lip to cover step edges at the top */}
            <mesh position={[0, pedestalHeight - (pedestalSkirtHeight / 2), 0]} castShadow receiveShadow userData={{ type: 'level' }}>
                <cylinderGeometry args={[pedestalSkirtRadius, pedestalSkirtRadius, pedestalSkirtHeight, 24]} />
                {wallMaterial ? (
                    <primitive object={wallMaterial.clone()} attach="material" />
                ) : (
                    <meshStandardMaterial color="#3f4754" roughness={0.6} metalness={0.12} />
                )}
            </mesh>


            {/* Front stairs up to the pedestal (facing forward: -Z) */}
            {Array.from({ length: stepCount }).map((_, i, arr) => {
                const topIndex = arr.length - 1;
                const t = i / topIndex; // 0 bottom -> 1 top
                // Taper width toward top so it doesn't stick out from the pedestal
                const stepWidth = THREE.MathUtils.lerp(bottomWidth, topWidth, t);
                const y = stepHeight / 2 + i * stepHeight;
                // Highest step hugs the pedestal; lower steps extend outward along -Z
                const z = zTop - (topIndex - i) * stepDepth;

                // Solid pillar under each step down to ground to close gaps
                const fillHeight = y + (stepHeight / 2);
                const fillCenterY = fillHeight / 2;
                const fillWidth = stepWidth * 0.98;
                const fillDepth = stepDepth * 0.98;

                return (
                    <group key={`pedestal-step-${i}`}>
                        <mesh
                            position={[0, y, z]}
                            castShadow
                            receiveShadow
                            userData={{ type: 'level' }}
                        >
                            <boxGeometry args={[stepWidth, stepHeight, stepDepth]} />
                            {wallMaterial ? (
                                <primitive object={wallMaterial.clone()} attach="material" />
                            ) : (
                                <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.1} />
                            )}
                        </mesh>
                        <mesh
                            position={[0, fillCenterY, z]}
                            castShadow
                            receiveShadow
                            userData={{ type: 'level' }}
                        >
                            <boxGeometry args={[fillWidth, fillHeight, fillDepth]} />
                            {wallMaterial ? (
                                <primitive object={wallMaterial.clone()} attach="material" />
                            ) : (
                                <meshStandardMaterial color="#3f4754" roughness={0.6} metalness={0.1} />
                            )}
                        </mesh>
                    </group>
                );
            })}

            {/* Small filler behind the top step to close the seam without hiding steps */}
            <mesh
                position={[
                    0,
                    totalHeight - (stepHeight * 0.4),
                    zTop + stepDepth * 0.35
                ]}
                castShadow
                receiveShadow
                userData={{ type: 'level' }}
            >
                <boxGeometry args={[topWidth * 1.05, stepHeight * 0.8, stepDepth * 0.6]} />
                {wallMaterial ? (
                    <primitive object={wallMaterial.clone()} attach="material" />
                ) : (
                    <meshStandardMaterial color="#4b5563" roughness={0.6} metalness={0.12} />
                )}
            </mesh>

            {/* Cherubim statue base (raised and rotated to face forward) */}
            {!hasShard && (
                <primitive 
                    object={cherubScene} 
                    scale={[statueScale, statueScale, statueScale]} 
                    position={[0, pedestalHeight + 1.5, 0]} 
                    rotation={[0, Math.PI, 0]} 
                />
            )}

            {!hasShard && (
                <group ref={groupRef} position={[shardSideOffset, shardBaseY, shardForwardOffset]}>
                    {/* 1. The Actual GLB Model */}
                    <primitive 
                        object={shardScene} 
                        scale={[0.2, 0.2, 0.2]}
                        rotation={[0, 0, Math.PI / 6]} // Slight tilt for style
                    />

                    {/* 2. Inner Aura (Stronger, keeps core visible) */}
                    <mesh 
                        renderOrder={visibleThroughWalls ? 999 : 0} 
                    >
                        <sphereGeometry args={[0.15, 16, 16]} />
                        <meshBasicMaterial 
                            color={visibleThroughWalls ? highlightColor : "#ff0000"}
                            transparent
                            opacity={visibleThroughWalls ? 0.4 : 0.2}
                            depthTest={!visibleThroughWalls}
                            depthWrite={false}
                            side={THREE.DoubleSide}
                            fog={!visibleThroughWalls}
                        />
                    </mesh>

                    {/* 3. Outer Aura (Faint halo) */}
                    <mesh 
                        renderOrder={visibleThroughWalls ? 998 : 0} 
                    >
                        <sphereGeometry args={[0.25, 16, 16]} />
                        <meshBasicMaterial 
                            color={visibleThroughWalls ? highlightColor : "#ff2222"}
                            transparent
                            opacity={0.1}
                            depthTest={!visibleThroughWalls}
                            depthWrite={false}
                            side={THREE.DoubleSide}
                            fog={!visibleThroughWalls}
                            blending={THREE.AdditiveBlending}
                        />
                    </mesh>
                    
                    {/* 4. Light Source */}
                    <pointLight position={[0, 0.2, 0]} color="#ff0000" intensity={4} distance={6} decay={2} />
                </group>
            )}
        </group>
    )
}

const ExitGate = ({ position, isOpen }: { position: {x:number, y:number, z:number}, isOpen: boolean }) => {
    const isGodMode = useGameStore(state => state.isGodMode);
    const isScanning = useGameStore(state => state.isScanning && !state.suppressScanVisuals);
    const lastScanTime = useGameStore(state => state.lastScanTime);
    const scanActive = isGodMode || (Date.now() - lastScanTime < 10000 && isScanning);

    if (isOpen) return null;

    // Visible highlight only during scan/god mode; collider always present
    const gateVisibleMat = React.useMemo(() => (
        new THREE.MeshStandardMaterial({
            color: '#ff0000',
            transparent: true,
            opacity: 0.8,
            emissive: '#ff0000',
            emissiveIntensity: 2,
            fog: false,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
        })
    ), []);

    const gateHiddenMat = React.useMemo(() => (
        new THREE.MeshStandardMaterial({
            color: '#111826',
            transparent: true,
            opacity: 0.65,
            fog: true,
            side: THREE.FrontSide,
        })
    ), []);

    const blockerMat = React.useMemo(() => (
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6, metalness: 0.1 })
    ), []);

    return (
        <group position={[position.x, 0, position.z]}>
            {/* Glowing gate plane (always collides; visible only when scanning/god mode) */}
            <mesh position={[4.6, 2.5, 0]} userData={{ type: 'level' }} renderOrder={999}>
                <boxGeometry args={[1, 5, 7]} />
                <primitive object={scanActive ? gateVisibleMat : gateHiddenMat} attach="material" />
            </mesh>
            {/* Side blockers */}
            <mesh position={[4.6, 2.5, 2.8]} userData={{ type: 'level' }}>
                <boxGeometry args={[1.2, 5, 1.0]} />
                <primitive object={blockerMat} attach="material" />
            </mesh>
            <mesh position={[4.6, 2.5, -2.8]} userData={{ type: 'level' }}>
                <boxGeometry args={[1.2, 5, 1.0]} />
                <primitive object={blockerMat} attach="material" />
            </mesh>
            {/* Fill the gap between gate block and surrounding wall */}
            <mesh position={[4.4, 2.5, 0]} castShadow receiveShadow userData={{ type: 'level' }}>
                <boxGeometry args={[0.9, 5, 6]} />
                <primitive object={blockerMat} attach="material" />
            </mesh>
        </group>
    );
}

const ThickWall = ({ wallMaterial }: { wallMaterial?: THREE.MeshStandardMaterial }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const innerRadius = 5.0;
    const outerRadius = 6.0; 
    const gapAngle = 1.4;
    s.absarc(0, 0, outerRadius, gapAngle/2, Math.PI * 2 - gapAngle/2, false);
    s.absarc(0, 0, innerRadius, Math.PI * 2 - gapAngle/2, gapAngle/2, true);
    s.closePath();
    return s;
  }, []);

  const config = useMemo(() => ({
      depth: 5,
      bevelEnabled: false,
      curveSegments: 48
  }), []);

  return (
      <mesh rotation={[-Math.PI/2, 0, 0]} castShadow receiveShadow userData={{ type: 'level' }}>
          <extrudeGeometry args={[shape, config]} />
          {/* Lowered roughness */}
          {wallMaterial ? (
              <primitive object={wallMaterial.clone()} attach="material" />
          ) : (
              <meshStandardMaterial color={COLORS.wall} roughness={0.3} metalness={0.1} side={THREE.FrontSide} />
          )}
      </mesh>
  )
}

const ExitStairs = ({ position, hasShardEver, wallMaterial }: { position: { x: number, y: number, z: number }, hasShardEver: boolean, wallMaterial?: THREE.MeshStandardMaterial }) => {
  const steps = useMemo(() => {
    const count = 60;
    const heightPerStep = 0.5;
    const radius = 3.5;
    const rotationPerStep = 0.3; 
    return Array.from({ length: count }).map((_, i) => ({
      index: i,
      y: i * heightPerStep,
      rot: i * rotationPerStep,
      x: Math.cos(i * rotationPerStep) * radius,
      z: Math.sin(i * rotationPerStep) * radius
    }));
  }, []);

  const BEAM_HEIGHT = 2000;
  const PILLAR_TOP_Y = 30; 
  const BEAM_Y_POS = PILLAR_TOP_Y + (BEAM_HEIGHT / 2);

  return (
    <group position={[position.x, 0, position.z]}>
      {hasShardEver && (
          <>
            <mesh position={[0, BEAM_Y_POS, 0]} frustumCulled={false}>
                <cylinderGeometry args={[0.5, 0.5, BEAM_HEIGHT, 16]} />
                <meshBasicMaterial 
                    color="#ff0000" 
                    transparent 
                    opacity={0.8} 
                    depthWrite={false} 
                    side={THREE.DoubleSide} 
                    toneMapped={false}
                    fog={false} 
                />
            </mesh>
            <mesh position={[0, BEAM_Y_POS, 0]} frustumCulled={false}>
                <cylinderGeometry args={[0.1, 0.1, BEAM_HEIGHT, 16]} />
                <meshBasicMaterial 
                    color="#ffffff" 
                    transparent 
                    opacity={0.9} 
                    depthWrite={false} 
                    side={THREE.DoubleSide} 
                    toneMapped={false}
                    fog={false}
                />
            </mesh>
            <pointLight position={[0, PILLAR_TOP_Y + 2, 0]} color="#ff0000" intensity={8} distance={80} decay={1.5} />
          </>
      )}
      
      <mesh position={[0, 15, 0]} castShadow receiveShadow userData={{ type: 'level' }}>
        <cylinderGeometry args={[1.5, 1.5, 30, 16]} />
        {wallMaterial ? (
          <primitive object={wallMaterial.clone()} attach="material" />
        ) : (
          <meshStandardMaterial color={COLORS.wall} roughness={0.3} metalness={0.1} />
        )}
      </mesh>

      <ThickWall wallMaterial={wallMaterial} />

      {steps.map((s) => (
        <mesh 
          key={s.index}
          position={[s.x, s.y + 0.3, s.z]} 
          rotation={[0, -s.rot, 0]}
          castShadow 
          receiveShadow 
          userData={{ type: 'level' }}
        >
           <boxGeometry args={[2.8, 0.4, 1.2]} />
           {wallMaterial ? (
             <primitive object={wallMaterial.clone()} attach="material" />
           ) : (
             <meshStandardMaterial color={COLORS.wall} roughness={0.3} metalness={0.1} side={THREE.FrontSide} />
           )}
        </mesh>
      ))}
    </group>
  );
};

const Level = () => {
  const walls = useGameStore(state => state.walls);
  const exitPosition = useGameStore(state => state.exitPosition);
  const shardPosition = useGameStore(state => state.shardPosition);
  const hasShard = useGameStore(state => state.hasShard);
  const hasShardEver = useGameStore(state => state.hasShardEver ?? state.hasShard);
  const isGateOpen = useGameStore(state => state.isGateOpen);
  const deadBodyPosition = useGameStore(state => state.deadBodyPosition);
  const isGodMode = useGameStore(state => state.isGodMode);
  const isScanning = useGameStore(state => state.isScanning);
  const devHighlight = useGameStore(state => state.devModeEnabled && state.showDevOverlays);

  // Only scan or god mode should highlight the corpse; dev HUD toggle stays debug-only
  const highlightDeadBody = isScanning || isGodMode;
  const wallMatGltf = useGLTF('/texture/stone_wall_texture.glb');
  const groundMatGltf = useGLTF('/texture/Wet_gravel_ground_texture.glb');

  const wallMaterial = React.useMemo(() => {
    let mat: THREE.MeshStandardMaterial | null = null;
    wallMatGltf.scene.traverse(child => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material && !mat) {
        const sourceMat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat = sourceMat.clone();
      }
    });

    if (mat) {
      if (mat.map) {
        mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
        mat.map.repeat.set(2, 2);
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = 8;
      }
      if (mat.normalMap) {
        mat.normalMap.wrapS = mat.normalMap.wrapT = THREE.RepeatWrapping;
        mat.normalMap.repeat.set(2, 2);
      }
      // Darker walls for mood
      if (mat.color) {
        mat.color.multiplyScalar(0.22);
      } else {
        mat.color = new THREE.Color('#181c24');
      }
      mat.roughness = mat.roughness ?? 0.9;
      mat.metalness = mat.metalness ?? 0.008;
      mat.emissive = mat.emissive ?? new THREE.Color('#000000');
      mat.emissiveIntensity = 0;
      mat.side = THREE.FrontSide;
    }

    return mat ?? undefined;
  }, [wallMatGltf]);

  const groundMaterial = React.useMemo(() => {
    let mat: THREE.MeshStandardMaterial | null = null;
    groundMatGltf.scene.traverse(child => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material && !mat) {
        const sourceMat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat = sourceMat.clone();
      }
    });

    if (mat) {
      // Dynamic tiling based on map size to avoid stretching on the large plane
      const REPEAT = Math.max(1, Math.floor(MAP_SIZE / 12) * 5); // 5x more tiles -> much smaller texels
      if (mat.map) {
        mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
        mat.map.repeat.set(REPEAT, REPEAT);
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = 12;
      }
      if (mat.normalMap) {
        mat.normalMap.wrapS = mat.normalMap.wrapT = THREE.RepeatWrapping;
        mat.normalMap.repeat.set(REPEAT, REPEAT);
      }
      if (mat.roughnessMap) {
        mat.roughnessMap.wrapS = mat.roughnessMap.wrapT = THREE.RepeatWrapping;
        mat.roughnessMap.repeat.set(REPEAT, REPEAT);
      }
      if (mat.metalnessMap) {
        mat.metalnessMap.wrapS = mat.metalnessMap.wrapT = THREE.RepeatWrapping;
        mat.metalnessMap.repeat.set(REPEAT, REPEAT);
      }
      // Darken ground to avoid over-bright floor
      if (mat.color) {
        mat.color.multiplyScalar(0.5);
      }
      mat.roughness = mat.roughness ?? 0.7;
      mat.metalness = mat.metalness ?? 0.015;
      mat.emissive = mat.emissive ?? new THREE.Color('#000000');
      mat.emissiveIntensity = 0;
      mat.side = THREE.FrontSide;
    }

    return mat ?? undefined;
  }, [groundMatGltf]);

  // Keep pedestal even after shard is picked up
  const lastShardPosRef = React.useRef<{ x: number, y: number, z: number } | null>(null);
  React.useEffect(() => {
    if (shardPosition) {
      lastShardPosRef.current = shardPosition;
    }
  }, [shardPosition]);

  return (
    <group>
      {/* Lower ambient/hemi to keep scene darker */}
      <ambientLight intensity={0.07} color="#ffffff" />
      <hemisphereLight args={['#d9e1ff', '#1a1f29', 0.04]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow userData={{ type: 'level' }}>
          <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
          {groundMaterial ? (
            <primitive object={groundMaterial} attach="material" />
          ) : (
            <meshStandardMaterial color={COLORS.ground} roughness={0.3} metalness={0.1} side={THREE.FrontSide} />
          )}
      </mesh>
      <WallInstance walls={walls} material={wallMaterial} />
      {(shardPosition || lastShardPosRef.current) && (
        <ShardPillar
          position={shardPosition ?? (lastShardPosRef.current as { x: number; y: number; z: number })}
          hasShard={hasShard}
          wallMaterial={wallMaterial}
        />
      )}
      {exitPosition && (
          <>
      <ExitStairs position={exitPosition} hasShardEver={hasShardEver} wallMaterial={wallMaterial} />
            <ExitGate position={exitPosition} isOpen={isGateOpen} />
          </>
      )}
      {/* Dev HUD should not affect corpse visuals; disable debug overlay */}
      {deadBodyPosition && <DeadBodyProp position={deadBodyPosition} highlight={highlightDeadBody} showDebug={false} />}
    </group>
  );
};

export default Level;
