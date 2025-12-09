
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store';
import { soundManager } from '../SoundManager';
import { GameState } from '../../types';
import { INTERACTION_DISTANCE } from '../../constants';

interface InteractionCandidate {
    distance: number;
    label: string;
    action: () => void;
}

export const useInteraction = (interactPressed: React.MutableRefObject<boolean>) => {
    const { camera } = useThree();
    const camDir = new THREE.Vector3();
    
    useFrame(() => {
        const store = useGameStore.getState();
        if (store.gameState !== GameState.PLAYING || store.readingPaperContent !== null) return;

        camera.getWorldDirection(camDir);
        const candidates: InteractionCandidate[] = [];
        const playerPos = camera.position;

        const papers = store.papers;
        const sticks = store.sticks;
        const droppedItems = store.droppedItems;

        // 1. Check Paper Interaction
        if (papers.length > 0) {
            for (const paper of papers) {
                // Use horizontal radius only; don't punish vertical offset
                const paperFlat = new THREE.Vector2(paper.position.x, paper.position.z);
                const playerFlat = new THREE.Vector2(playerPos.x, playerPos.z);
                const dist = playerFlat.distanceTo(paperFlat);
                if (dist < 1.2) { // tighter range for paper (flat)
                    const paperLoc = new THREE.Vector3(paper.position.x, 0.05, paper.position.z);
                    const toPaper = new THREE.Vector3().subVectors(paperLoc, playerPos).normalize();
                    if (camDir.dot(toPaper) > 0.9) {
                        candidates.push({
                            distance: dist,
                            label: "Crumpled Paper",
                            action: () => store.setReadingPaper(paper.content)
                        });
                    }
                }
            }
        }

        // 2. Check Stick Interaction
        if (sticks.length > 0) {
            for (const stick of sticks) {
                const stickLoc = new THREE.Vector3(stick.position.x, 0.1, stick.position.z);
                const dist = playerPos.distanceTo(stickLoc);
                if (dist < 1.75) {
                     const toStick = new THREE.Vector3().subVectors(stickLoc, playerPos).normalize();
                     if (camDir.dot(toStick) > 0.9) {
                         candidates.push({
                            distance: dist,
                            label: "Pick up Stick",
                            action: () => {
                                store.collectStick(stick.id);
                                soundManager.playHit(); 
                            }
                         });
                     }
                }
            }
        }

        // 3. Check Dropped Items Interaction
        if (droppedItems.length > 0) {
            for (const drop of droppedItems) {
                const dropLoc = new THREE.Vector3(drop.position.x, 0.1, drop.position.z);
                const isSmallBottle = drop.item.typeId === 'pill_bottle' || drop.item.id === 'pill_bottle' || drop.item.typeId === 'health_solution' || drop.item.id === 'health_solution';
                const maxDistFlat = isSmallBottle ? 0.45 : 1.75; // slightly more forgiving for small bottles
                const minDot = isSmallBottle ? 0.95 : 0.9;   // keep aimed fairly direct for small bottles

                // Use horizontal (XZ) radius for pills; keep 3D for others
                const flatDist = new THREE.Vector2(playerPos.x, playerPos.z).distanceTo(new THREE.Vector2(drop.position.x, drop.position.z));
                const distForCheck = isSmallBottle ? flatDist : playerPos.distanceTo(dropLoc);

                if (distForCheck < maxDistFlat) {
                     const toDrop = new THREE.Vector3().subVectors(dropLoc, playerPos).normalize();
                     if (camDir.dot(toDrop) > minDot) {
                         candidates.push({
                            distance: distForCheck,
                            label: `Pick up ${drop.item.name}`,
                            action: () => {
                                store.collectDroppedItem(drop.id);
                                soundManager.playHit();
                            }
                         });
                     }
                }
            }
        }

        // 4. Check Shard Interaction
        if (!store.hasShard && store.shardPosition) {
            const shardLoc = new THREE.Vector3(store.shardPosition.x, 0, store.shardPosition.z);
            const flatDist = new THREE.Vector3(playerPos.x, 0, playerPos.z).distanceTo(shardLoc);
            
            if (flatDist < INTERACTION_DISTANCE) {
                // Use 3D distance for fair sorting against floor items
                const dist3D = playerPos.distanceTo(new THREE.Vector3(store.shardPosition.x, 1.0, store.shardPosition.z));
                candidates.push({
                    distance: dist3D,
                    label: "Pickup Red Shard",
                    action: () => store.collectShard()
                });
            }
        }

        // 5. Check Exit Interaction
        if (store.exitPosition && !store.isGateOpen) {
            const gateWorldPos = new THREE.Vector3(store.exitPosition.x + 5.5, 0, store.exitPosition.z);
            const flatDist = new THREE.Vector3(playerPos.x, 0, playerPos.z).distanceTo(gateWorldPos);

            if (flatDist < 5.0) {
                const label = store.hasShard ? "Insert Shard" : "Locked (Requires Red Shard)";
                candidates.push({
                    distance: flatDist,
                    label: label,
                    action: () => {
                        if (store.hasShard) {
                            store.consumeShard();
                            store.openGate();
                            soundManager.playHit();
                        }
                    }
                });
            }
        }

        // Resolve Best Candidate
        let promptText: string | null = null;
        
        if (candidates.length > 0) {
            // Sort by distance ascending (Closest first)
            candidates.sort((a, b) => a.distance - b.distance);
            
            const best = candidates[0];
            promptText = best.label;
            
            if (interactPressed.current) {
                best.action();
                interactPressed.current = false;
            }
        }

        if (store.interactionText !== promptText) {
            store.setInteractionText(promptText);
        }
    });
};
