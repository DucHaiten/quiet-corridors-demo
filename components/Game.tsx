// Resolved merge conflict
import React, { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, extend, useLoader } from '@react-three/fiber';
import Player from './Player';
import Level from './Level';
import EnemyManager from './EnemyManager';
import WeepingAngel from './weeping_angel';
import RisenClawsTrap from './risen_claws_trap';
import PaperManager from './PaperManager';
import InventoryScene from './InventoryScene';
import ImpactManager from './ImpactManager';
import Weapon, { WeaponHandle } from './Weapon';
import AssetPreloader from './AssetPreloader';
import { TheAngelRig } from './the_angel_rig';
import SanityManager from './SanityManager';
import { useGameStore } from '../store';
import { COLORS, MAP_SIZE, LEVEL_1_BGM_PATH, CULL_DIST_LARGE } from '../constants';
import * as THREE from 'three';
import { GameState } from '../types';
import { soundManager } from './SoundManager';
import { SonarScreenMaterial } from './weapon/SonarShader';

// Lighten the sky-sampled fog color slightly with white to keep visibility while preserving hue.
const mixColorWithWhite = (hex: string, factor = 0.03) => {
    const clamped = Math.min(Math.max(factor, 0), 1);
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return hex;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const mix = (c: number) => Math.round(c * (1 - clamped) + 255 * clamped);
    const nr = mix(r).toString(16).padStart(2, '0');
    const ng = mix(g).toString(16).padStart(2, '0');
    const nb = mix(b).toString(16).padStart(2, '0');
    return `#${nr}${ng}${nb}`;
};

// Precompile scenes once world is active to avoid first-frame hitches (e.g., sonar scan).
const ScenePrecompiler = ({ weaponScene, weaponCamera, isWorldActive, areAssetsLoaded }: { weaponScene: THREE.Scene, weaponCamera: THREE.Camera, isWorldActive: boolean, areAssetsLoaded: boolean }) => {
    const { gl, scene, camera } = useThree();
    const compiledRef = useRef(false);

    // If assets reload (or we switch back to menu and return), allow another compile pass.
    useEffect(() => {
        compiledRef.current = false;
    }, [areAssetsLoaded]);

    useEffect(() => {
        if (!isWorldActive) return;
        if (compiledRef.current) return;
        try {
            gl.compile(scene, camera);
            gl.compile(weaponScene, weaponCamera);
            compiledRef.current = true;
        } catch (e) {
            console.warn('Scene precompile failed', e);
        }
    }, [isWorldActive, gl, scene, camera, weaponScene, weaponCamera, areAssetsLoaded]);

    return null;
};

// Warmup sonar screen material without toggling global scanning state.
const SonarWarmup = ({ enabled }: { enabled: boolean }) => {
    const { gl } = useThree();
    const warmedRef = useRef(false);

    useEffect(() => {
        if (!enabled) {
            warmedRef.current = false;
            return;
        }
        if (warmedRef.current) return;
        try {
            const dummyScene = new THREE.Scene();
            const dummyCam = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
            dummyCam.position.set(0, 0, 2.5);

            const geo = new THREE.PlaneGeometry(0.12, 0.1);
            const mat = new (SonarScreenMaterial as any)();
            const mesh = new THREE.Mesh(geo, mat);
            dummyScene.add(mesh);

            gl.compile(dummyScene, dummyCam);
            gl.render(dummyScene, dummyCam);

            geo.dispose();
            mat.dispose();
        } catch (e) {
            console.warn('Sonar warmup failed', e);
        }
        warmedRef.current = true;
    }, [enabled, gl]);

    return null;
};

// Override sky/background with a solid color (e.g., red after shard pickup)
const SolidBackground = ({ color }: { color: string }) => {
    const { scene } = useThree();
    useEffect(() => {
        const previousBackground = scene.background;
        scene.background = new THREE.Color(color);
        return () => {
            scene.background = previousBackground;
        };
    }, [scene, color]);
    return null;
};

// Skybox / environment map for the level
const SkyEnvironment = ({ onColorPick }: { onColorPick?: (color: string) => void }) => {
    const { scene, gl } = useThree();
    const texture = useLoader(THREE.TextureLoader, '/images/all_sky/cold_night_equirect.png');

    useEffect(() => {
        if (!texture) return;

        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;

        const pmrem = new THREE.PMREMGenerator(gl);
        pmrem.compileEquirectangularShader();
        const renderTarget = pmrem.fromEquirectangular(texture);
        const envMap = renderTarget.texture;

        const previousBackground = scene.background;
        const previousEnvironment = scene.environment;

        scene.background = envMap;
        scene.environment = envMap;

        // Pick a dark pixel from the sky to drive fog color (avoid white fog at night)
        const img = texture.image as HTMLImageElement;
        if (img && img.width && img.height && onColorPick) {
            const canvas = document.createElement('canvas');
            canvas.width = 4;
            canvas.height = 4;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Sample a point above the horizon where sky is darkest (top-center quarter)
                const sampleX = Math.floor(img.width * 0.5);
                const sampleY = Math.floor(img.height * 0.2);
                ctx.drawImage(img, sampleX, sampleY, 1, 1, 0, 0, 1, 1);
                const data = ctx.getImageData(0, 0, 1, 1).data;
                const hex = `#${data[0].toString(16).padStart(2, '0')}${data[1]
                    .toString(16)
                    .padStart(2, '0')}${data[2].toString(16).padStart(2, '0')}`;
                onColorPick(hex);
            }
        }

        return () => {
            scene.background = previousBackground;
            scene.environment = previousEnvironment;
            renderTarget.dispose();
            pmrem.dispose();
        };
    }, [texture, scene, gl]);

    return null;
};

// Scan Wave Effect
const ScanWave = () => {
    const ref = useRef<THREE.Mesh>(null);
    const { camera } = useThree();
    const lastScanTime = useGameStore(state => state.lastScanTime);
    const pos = useRef(new THREE.Vector3());

    React.useEffect(() => {
        if (Date.now() - lastScanTime < 500) {
            pos.current.copy(camera.position);
        }
    }, [lastScanTime, camera]);

    useFrame(() => {
        if (!ref.current) return;
        
        // PAUSE CHECK
        const { gameState } = useGameStore.getState();
        if (gameState !== GameState.PLAYING) return;

        const elapsed = Date.now() - lastScanTime;
        // Slightly slower than previous (0.4s total)
        const duration = 400; 

        if (elapsed < duration) {
            ref.current.visible = true;
            ref.current.position.copy(pos.current);
            const progress = elapsed / duration;
            // Cap propagation to ~20m to further reduce overdraw
            const scale = progress * 20; 
            ref.current.scale.setScalar(scale);
            
            const opacity = Math.max(0, 1 - progress);
            (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5;
        } else {
            ref.current.visible = false;
        }
    });

    return (
        <mesh ref={ref} visible={false}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial 
                color="white" 
                transparent 
                depthWrite={false} 
                side={THREE.DoubleSide} 
                toneMapped={false}
            />
        </mesh>
    )
}

// --- MAIN GAME LOOP (MANUAL RENDER MANAGER) ---
// This component takes FULL control of the render pipeline.
// It disables the default R3F render and manually sequences:
// 1. Clear Screen -> 2. Render Map -> 3. Clear Depth -> 4. Render Weapon
const MainGameLoop = ({ weaponScene, weaponCamera }: { weaponScene: THREE.Scene, weaponCamera: THREE.Camera }) => {
    const { gl, scene, camera, size } = useThree();
    const isInventoryOpen = useGameStore(state => state.isInventoryOpen);

    // Sync weapon camera aspect ratio
    useEffect(() => {
        if (weaponCamera instanceof THREE.PerspectiveCamera) {
            weaponCamera.aspect = size.width / size.height;
            weaponCamera.updateProjectionMatrix();
        }
    }, [size, weaponCamera]);

    // Disable auto-clear so we can handle it manually
    useEffect(() => {
        gl.autoClear = false;
        return () => {
            // We do NOT reset autoClear to true here anymore, 
            // because we want strict manual control always.
            // Resetting it can cause frames to be wiped by R3F before we draw.
            gl.autoClear = false;
        };
    }, [gl]);

    // RENDER PRIORITY 1: This runs INSTEAD of the default R3F render (usually priority 0 or 1).
    // By clearing manually and rendering both scenes, we solve the "map disappearing" and "weapon clipping" issues.
    useFrame(() => {
        // FORCE autoClear to false every frame. 
        // This is critical because InventoryScene or other components might have 
        // inadvertently reset it to true on unmount, causing the map to be wiped.
        gl.autoClear = false;

        // --- LIGHTING SYNC SCRIPT ---
        // Calculate the total light intensity affecting the player's current position.
        let totalEnvironmentIntensity = 0;
        const playerPos = camera.position;

        // Traverse visible objects to find lights
        // OPTIMIZATION: In a larger game, we would use a spatial index or tag system.
        // For this scene size, iterating top-level children or using traverseVisible is acceptable.
        scene.traverseVisible((obj) => {
            if ((obj as any).isLight) {
                // SKIP lights marked to be ignored (e.g. muzzle flashes)
                if (obj.userData.ignoreGlobalSync) return;

                const light = obj as THREE.Light;
                
                // Global Lights (Ambient, Hemisphere)
                if (light instanceof THREE.AmbientLight) {
                    totalEnvironmentIntensity += light.intensity;
                } else if (light instanceof THREE.HemisphereLight) {
                     // Hemisphere contributes partially
                    totalEnvironmentIntensity += light.intensity * 0.5;
                } 
                // Directional Lights (Simulated Sun/Moon)
                else if (light instanceof THREE.DirectionalLight) {
                    totalEnvironmentIntensity += light.intensity * 0.5;
                }
                // Local Lights (Point, Spot) - Calculate falloff based on distance
                else if (light instanceof THREE.PointLight) {
                    const dist = light.position.distanceTo(playerPos);
                    if (dist < light.distance) {
                        // Linear falloff approximation
                        const falloff = Math.max(0, 1 - (dist / light.distance));
                        totalEnvironmentIntensity += light.intensity * falloff;
                    }
                }
            }
        });

        // Apply calculated intensity to Weapon Scene Lights
        // UPDATED LOGIC:
        // Multiplier: 0.6
        // Floor: 0.5 (Increased from 0.01 to ensure visibility in dark)
        const adjustedIntensity = totalEnvironmentIntensity * 0.6;
        const targetIntensity = Math.max(0.5, Math.min(3.0, adjustedIntensity));

        // Smoothly interpolate (Lerp) to avoid flickering when crossing light boundaries
        // Factor 0.1 gives a nice "eye adaptation" lag effect.
        
        // 1. Apply to Weapon Lights
        weaponScene.traverse((obj) => {
             if ((obj as any).isLight) {
                 // SKIP lights marked to be ignored (e.g. muzzle flashes)
                 if (obj.userData.ignoreGlobalSync) return;

                 const light = obj as THREE.Light;
                 light.intensity = THREE.MathUtils.lerp(light.intensity, targetIntensity, 0.1);
             }
        });

        // 2. Apply to Scene Environment Intensity (For PBR Reflections)
        // This makes the metal look dull in dark, and shiny in light.
        if ('environmentIntensity' in weaponScene) {
             const currentEnvIntensity = (weaponScene as any).environmentIntensity ?? 1;
             (weaponScene as any).environmentIntensity = THREE.MathUtils.lerp(currentEnvIntensity, targetIntensity, 0.1);
        }

        // --- RENDER PIPELINE ---

        // 1. Clear Color & Depth (Fresh Frame)
        gl.clear();

        // 2. Render Main Scene (Map, Enemies, Particles)
        gl.render(scene, camera);

        // 3. Clear Depth Buffer ONLY (To allow Weapon to be drawn "on top")
        gl.clearDepth();

        // 4. Render Weapon Scene (if inventory closed)
        if (!isInventoryOpen) {
            gl.render(weaponScene, weaponCamera);
        }
        
    }, 1); 

    return null;
};

const Game = () => {
  const gameState = useGameStore(state => state.gameState);
  const currentLevel = useGameStore(state => state.currentLevel);
  const volume = useGameStore(state => state.volume);
  const isInventoryOpen = useGameStore(state => state.isInventoryOpen);
  const areAssetsLoaded = useGameStore(state => state.areAssetsLoaded);
  const isAssetLoading = useGameStore(state => state.isAssetLoading);
  const isLoading = useGameStore(state => state.isLoading);
  const hasShardEver = useGameStore(state => state.hasShardEver ?? state.hasShard);
  const isWorldActive = gameState === GameState.PLAYING || gameState === GameState.PAUSED;
  const shouldRenderWorld = isWorldActive || isLoading || isAssetLoading;
  const [fogColor, setFogColor] = useState(() => mixColorWithWhite('#0b1120')); // updated from sky sample when available
  const effectiveFogColor = hasShardEver ? '#3b0000' : fogColor;
  
  // Background Music Control
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        // Ensure clean slate (stops any lingering death sounds or previous BGM)
        soundManager.stopBGM();
        
        if (currentLevel === 1) {
            soundManager.playBGM(LEVEL_1_BGM_PATH, 0.5);
        }
    } else if (gameState === GameState.PAUSED) {
        soundManager.pauseBGM();
    } else {
        if (gameState === GameState.GAME_OVER) {
            soundManager.stopOnGameOver();
        } else if (gameState === GameState.GAME_WON || gameState === GameState.MENU) {
            soundManager.stopBGM();
        }
    }
  }, [gameState, currentLevel]);

  useEffect(() => {
      soundManager.setBGMVolume(volume);
  }, [volume]);
  
  // --- WEAPON SCENE SETUP ---
  // We create these here so they persist and can be passed to both Weapon.tsx and MainGameLoop
  const weaponScene = useMemo(() => {
      const s = new THREE.Scene();
      // WEAPON LIGHTING:
      // Initial values are placeholders. They will be overridden immediately by the 
      // Lighting Sync Script in MainGameLoop based on the environment.
      const ambient = new THREE.AmbientLight(0xffffff, 0.5); 
      const directional = new THREE.DirectionalLight(0xffffff, 0.5);
      
      // Position light from slightly above/left to create form shadows on the weapon
      directional.position.set(-2, 5, 2);
      s.add(ambient);
      s.add(directional);

      // Initialize environmentIntensity if supported (for PBR)
      if ('environmentIntensity' in s) {
          (s as any).environmentIntensity = 1.0; 
      }

      return s;
  }, []);
  
  const weaponCamera = useMemo(() => new THREE.PerspectiveCamera(50, 1, 0.1, 10), []);

  return (
    <div className="w-full h-full absolute top-0 left-0 bg-black">
      <Canvas 
        shadows 
        dpr={1} // Pixelated/Retro feel optimization
        gl={{ 
            antialias: false, 
            powerPreference: "high-performance",
            stencil: false,
            depth: true 
        }}
        // FIX: Increased far plane to 600 (Map size is 500)
        // FIX: Decreased near plane to 0.01 to allow impacts close to walls to render
        camera={{ fov: 70, position: [0, 1.6, 0], far: 600, near: 0.01 }} 
      >
        {/* Fog uses sampled sky color so horizon blends into night sky; keep density gentle for visibility */}
        <fogExp2 attach="fog" args={[effectiveFogColor, 0.085]} />

        {/* 
            CRITICAL FIX: Move MainGameLoop OUTSIDE of Suspense. 
            This ensures the GL Clear/Render loop runs immediately, even if assets (Levels, Statues) 
            are still loading. This prevents the "Black Screen" where the buffer is never cleared.
        */}
        {isWorldActive && (
            <MainGameLoop weaponScene={weaponScene} weaponCamera={weaponCamera} />
        )}
        
        <Suspense fallback={null}>
          {shouldRenderWorld && !hasShardEver && <SkyEnvironment onColorPick={(hex) => setFogColor(mixColorWithWhite(hex))} />}
          {shouldRenderWorld && hasShardEver && <SolidBackground color="#1f0000" />}
          {/* Precompile only when the world is being prepared or active */}
          {shouldRenderWorld && (
            <ScenePrecompiler 
              weaponScene={weaponScene} 
              weaponCamera={weaponCamera} 
              isWorldActive={isWorldActive} 
              areAssetsLoaded={areAssetsLoaded} 
            />
          )}
          {/* Warm sonar shader without toggling scanning flags; runs only while loading */}
          {isLoading && (
            <SonarWarmup enabled={isLoading} />
          )}
          {/* Only run heavy preload/warmup when explicitly loading, not on menu */}
          {isAssetLoading && <AssetPreloader />}
          <ambientLight userData={{ isMainLight: true }} intensity={0.2} />  
          <hemisphereLight 
            userData={{ isMainLight: true }} 
            intensity={0.28} 
            groundColor="#0a0f18" 
            color="#3f5975" 
          />
          
          <pointLight userData={{ isMainLight: true }} position={[0, 2, 0]} intensity={0.55} distance={10} decay={2} castShadow={false} />
          <pointLight userData={{ isMainLight: true }} position={[0, 5, -15]} color={COLORS.teamA} intensity={1.1} distance={15} castShadow={false} />
          <pointLight userData={{ isMainLight: true }} position={[0, 5, 15]} color={COLORS.teamB} intensity={1.1} distance={15} castShadow={false} />

          {/* LIGHTING OPTIMIZATION (Technique #2 & #3) */}
          <directionalLight 
            userData={{ isMainLight: true }}
            position={[-15, 40, 15]} 
            intensity={0.55} 
            castShadow 
            color="#334155"
            shadow-bias={-0.0001} // Reduced gap to mitigate light leakage near walls
            shadow-normalBias={0.02} // Add minimal offset to prevent acne without opening leaks
            shadow-radius={4} // Soften edges
            shadow-mapSize={[1024, 1024]} // Reasonable resolution
          >
             {/* Optimize shadow camera to not waste pixels on the huge map when fog is close */}
             <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40]} /> 
          </directionalLight>
          
          {shouldRenderWorld && <Level />}
          
          {isWorldActive && (
            <>
              <Player weaponScene={weaponScene} />
              <TheAngelRig />
              <EnemyManager />
              <WeepingAngel />
              <RisenClawsTrap />
              <PaperManager />
              <ImpactManager />
              <ScanWave />
              <InventoryScene />
              <SanityManager />
            </>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Game;
