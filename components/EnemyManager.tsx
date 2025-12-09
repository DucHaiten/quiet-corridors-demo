// Resolved merge conflict
import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../store';
import { COLORS, MAP_SIZE, ENEMY_SPAWN_RATE, PLAYER_HEIGHT } from '../constants';
import * as THREE from 'three';

const EnemyMesh: React.FC<{ enemy: any }> = ({ enemy }) => {
    const isGodMode = useGameStore(state => state.isGodMode);

    const visibleThroughWalls = isGodMode;
    // God mode color is White (#ffffff)
    const highlightColor = "#ffffff";

    // Create a simple visual for the enemy
    return (
        <group position={[enemy.position.x, enemy.position.y, enemy.position.z]}>
            {/* Body - Darker Red for high contrast against white walls/dark floor */}
            <mesh 
                userData={{ type: 'enemy', id: enemy.id }} 
                castShadow 
                renderOrder={visibleThroughWalls ? 999 : 0}
            >
                <capsuleGeometry args={[0.4, 1, 4, 8]} />
                <meshStandardMaterial 
                    color={visibleThroughWalls ? highlightColor : (enemy.lastHit && Date.now() - enemy.lastHit < 100 ? 'white' : COLORS.enemy)} 
                    roughness={0.4}
                    emissive={visibleThroughWalls ? highlightColor : "#000000"}
                    emissiveIntensity={visibleThroughWalls ? 5 : 0}
                    toneMapped={!visibleThroughWalls}
                    depthTest={!visibleThroughWalls}
                    depthWrite={!visibleThroughWalls}
                    fog={!visibleThroughWalls}
                    transparent={visibleThroughWalls}
                    opacity={visibleThroughWalls ? 0.8 : 1.0}
                />
            </mesh>
            {/* Head - Black visor/helmet look */}
            <mesh position={[0, 0.6, 0]} renderOrder={visibleThroughWalls ? 999 : 0}>
                <boxGeometry args={[0.4, 0.4, 0.4]}/>
                <meshStandardMaterial 
                    color={visibleThroughWalls ? highlightColor : "#111"} 
                    depthTest={!visibleThroughWalls}
                    depthWrite={!visibleThroughWalls}
                    fog={!visibleThroughWalls}
                    transparent={visibleThroughWalls}
                    opacity={visibleThroughWalls ? 0.8 : 1.0}
                />
            </mesh>
            {/* Visor Eye */}
             <mesh position={[0, 0.6, 0.15]} renderOrder={visibleThroughWalls ? 999 : 0}>
                 <planeGeometry args={[0.3, 0.1]} />
                 <meshBasicMaterial 
                    color="red" 
                    depthTest={!visibleThroughWalls}
                    depthWrite={!visibleThroughWalls}
                    fog={!visibleThroughWalls}
                    transparent={visibleThroughWalls}
                    opacity={visibleThroughWalls ? 0.8 : 1.0}
                 />
            </mesh>
            {/* HP Bar */}
            {!visibleThroughWalls && (
                <mesh position={[0, 1.2, 0]}>
                    <planeGeometry args={[1 * (enemy.hp / 100), 0.1]} />
                    <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

const EnemyManager = () => {
  const { enemies, spawnEnemy, updateEnemies, damagePlayer, gameState } = useGameStore();
  const { camera } = useThree();
  const lastSpawnTime = useRef(0);

  // Spawning Logic
  useFrame((state) => {
    if (gameState !== 'PLAYING') return;

    const now = Date.now();
    if (now - lastSpawnTime.current > ENEMY_SPAWN_RATE) {
      // Spawn away from player
      const angle = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 10;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      
      // Clamp to map
      const clampedX = Math.max(-MAP_SIZE/2 + 2, Math.min(MAP_SIZE/2 - 2, x));
      const clampedZ = Math.max(-MAP_SIZE/2 + 2, Math.min(MAP_SIZE/2 - 2, z));

      spawnEnemy({ x: clampedX, y: 1, z: clampedZ });
      lastSpawnTime.current = now;
    }
  });

  // AI & Movement Logic
  useFrame((state, delta) => {
     if (gameState !== 'PLAYING') return;
     
     const playerPos = camera.position;
     const nextEnemies = enemies.map(enemy => {
         const ePos = new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
         const direction = new THREE.Vector3().subVectors(playerPos, ePos);
         const distance = direction.length();
         
         // Attack logic
         if (distance < 1.5) {
             damagePlayer(0.5); // Rapid damage if close
             return enemy; // Stop moving if attacking
         }

         direction.normalize();
         
         // Move towards player
         ePos.addScaledVector(direction, enemy.speed * delta);
         
         return {
             ...enemy,
             position: { x: ePos.x, y: ePos.y, z: ePos.z }
         };
     });
     
     updateEnemies(nextEnemies);
  });

  return (
    <group>
      {enemies.map(enemy => (
        <EnemyMesh key={enemy.id} enemy={enemy} />
      ))}
    </group>
  );
};

export default EnemyManager;
