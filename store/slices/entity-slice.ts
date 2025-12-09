
import { StateCreator } from 'zustand';
import { Enemy, Statue, Trap, Stick, DroppedItem, Paper, Vector3, Language, TheAngel, SoundType } from '../../types';
import { MAX_ENEMIES, ENEMY_MAX_HP, TRAP_MAX_HP, TRAP_COOLDOWN_MS, STATUE_SAFE_ZONE_RADIUS, STATUE_MIN_SPACING, TRAP_COUNT, TRAP_SAFE_ZONE_RADIUS, TRAP_MIN_SPACING } from '../../constants';
import { v4 as uuidv4 } from 'uuid';
import { soundManager } from '../../components/SoundManager';
import type { GameStore } from '../../store';
import { TEXT } from '../../localization';

// --- HELPER FOR LEVEL GENERATION (Used by GameSlice) ---
export const generateLevelEntities = (
    level: number, 
    floors: Vector3[], 
    startPos: Vector3, 
    exitPos: Vector3, 
    shardPos: Vector3, 
    startRotation: number,
    language: Language
) => {
    // 1. INTRO PAPER
    const dirX = -Math.sin(startRotation);
    const dirZ = -Math.cos(startRotation);
    const INTRO_DIST = 10;
    
    const introPaper: Paper = {
        id: uuidv4(),
        position: {
            x: startPos.x + (dirX * INTRO_DIST),
            y: 0.1, 
            z: startPos.z + (dirZ * INTRO_DIST)
        },
        content: TEXT[language].story.intro
    };

    // 2. STATUES
    const statues: Statue[] = [];
    const findFloorNear = (target: Vector3, maxRadius: number, minRadius: number = 8) => {
        const candidates = floors.filter(f => {
            const d = Math.hypot(f.x - target.x, f.z - target.z);
            return d < maxRadius && d > minRadius; 
        });
        if (candidates.length === 0) {
             const fallback = floors.filter(f => Math.hypot(f.x - target.x, f.z - target.z) < maxRadius);
             if (fallback.length === 0) return target;
             return fallback[Math.floor(Math.random() * fallback.length)];
        }
        return candidates[Math.floor(Math.random() * candidates.length)];
    };

    const pos1 = findFloorNear(exitPos, 25);
    statues.push({ id: uuidv4(), position: { x: pos1.x, y: 0, z: pos1.z }, isMoving: false });

    const pos2 = findFloorNear(shardPos, 25);
    statues.push({ id: uuidv4(), position: { x: pos2.x, y: 0, z: pos2.z }, isMoving: false });

    const shuffledFloors = [...floors].sort(() => Math.random() - 0.5);
    const MAX_ROAMERS = 6; // Spawn 3 additional roaming angels to increase pressure
    let roamerCount = 0;
    
    for (const f of shuffledFloors) {
        if (roamerCount >= MAX_ROAMERS) break;
        const dPlayer = Math.hypot(f.x - startPos.x, f.z - startPos.z);
        const dExit = Math.hypot(f.x - exitPos.x, f.z - exitPos.z);
        const dShard = Math.hypot(f.x - shardPos.x, f.z - shardPos.z);
        
        if (dPlayer < STATUE_SAFE_ZONE_RADIUS) continue;
        if (dExit < 80 || dShard < 80) continue;

        let tooClose = false;
        for (const s of statues) {
            const ds = Math.hypot(f.x - s.position.x, f.z - s.position.z);
            if (ds < STATUE_MIN_SPACING) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;

        statues.push({ id: uuidv4(), position: { x: f.x, y: 0, z: f.z }, isMoving: false });
        roamerCount++;
    }

    // 3. SHARD-PATH PAPER (mid-route, not too close/far from spawn)
    const pathDir = { x: shardPos.x - startPos.x, z: shardPos.z - startPos.z };
    const pathLen = Math.hypot(pathDir.x, pathDir.z) || 1;
    const dirNorm = { x: pathDir.x / pathLen, z: pathDir.z / pathLen };
    // Bring mid-route note much closer to spawn while keeping on shard path
    const targetProj = pathLen * 0.22;
    const minProj = pathLen * 0.12;
    const maxProj = pathLen * 0.38;
    const MAX_LATERAL = 8;
    const MIN_START_DIST = 10;

    const pathPaperCandidates = floors
        .map((f) => {
            const toTile = { x: f.x - startPos.x, z: f.z - startPos.z };
            const proj = toTile.x * dirNorm.x + toTile.z * dirNorm.z;
            const lateral = Math.hypot(toTile.x - dirNorm.x * proj, toTile.z - dirNorm.z * proj);
            const dStart = Math.hypot(toTile.x, toTile.z);
            const dStatue = Math.min(
                ...statues.map(s => Math.hypot(f.x - s.position.x, f.z - s.position.z)),
                Infinity
            );
            return { pos: f, proj, lateral, dStart, dStatue };
        })
        .filter(c => c.proj >= minProj && c.proj <= maxProj)
        .filter(c => c.lateral <= MAX_LATERAL)
        .filter(c => c.dStart >= MIN_START_DIST)
        .filter(c => c.dStatue === Infinity || c.dStatue >= 12)
        .map(c => ({
            ...c,
            score: Math.abs(c.proj - targetProj) + (c.lateral * 0.4)
        }));

    const papers = [introPaper];

    if (pathPaperCandidates.length > 0) {
        pathPaperCandidates.sort((a, b) => a.score - b.score);
        const best = pathPaperCandidates[0];
        papers.push({
            id: uuidv4(),
            position: { x: best.pos.x, y: 0.1, z: best.pos.z },
            content: TEXT[language].story.shardPath
        });
    }

    // 4. EXTRA PAPER NEAR SHARD
    const paperCandidates = floors.filter(f => {
        const dToShard = Math.hypot(f.x - shardPos.x, f.z - shardPos.z);
        if (dToShard < 15 || dToShard > 45) return false;
        for (const s of statues) {
            const dToStatue = Math.hypot(f.x - s.position.x, f.z - s.position.z);
            if (dToStatue < 15) return false; 
        }
        return true;
    });

    if (paperCandidates.length > 0) {
        const p2Pos = paperCandidates[Math.floor(Math.random() * paperCandidates.length)];
        papers.push({
            id: uuidv4(),
            position: { x: p2Pos.x, y: 0.1, z: p2Pos.z },
            content: TEXT[language].story.paper2
        });
    }

    // 5. STICKS
    const sticks: Stick[] = [];
    
    // FIX: Only spawn ONE stick near the first paper (Intro/Start area)
    if (papers.length > 0) {
        const startPaper = papers[0]; // The intro paper near player spawn
        const angle = Math.random() * Math.PI * 2;
        const dist = 1.2 + Math.random() * 0.4; 
        
        sticks.push({
            id: uuidv4(),
            position: {
                x: startPaper.position.x + Math.cos(angle) * dist,
                y: 0,
                z: startPaper.position.z + Math.sin(angle) * dist
            },
            rotationY: Math.random() * Math.PI * 2,
            durability: 20
        });
    }

    // EXTRA: Scatter 3 more sticks across the map for pickup
    const EXTRA_STICKS = 3;
    const shuffledForSticks = [...floors].sort(() => Math.random() - 0.5);
    const MIN_DIST_FROM_START = 25; // avoid spawn area
    const MIN_DIST_FROM_STATUE = 12;

    for (const f of shuffledForSticks) {
        if (sticks.length >= EXTRA_STICKS + 1) break; // +1 accounts for intro stick

        const dStart = Math.hypot(f.x - startPos.x, f.z - startPos.z);
        if (dStart < MIN_DIST_FROM_START) continue;

        const tooCloseToStatue = statues.some(s => Math.hypot(f.x - s.position.x, f.z - s.position.z) < MIN_DIST_FROM_STATUE);
        if (tooCloseToStatue) continue;

        sticks.push({
            id: uuidv4(),
            position: { x: f.x, y: 0, z: f.z },
            rotationY: Math.random() * Math.PI * 2,
            durability: 20
        });
    }

    // 5. TRAPS
    const traps: Trap[] = [];
    const floorsForTraps = [...floors].sort(() => Math.random() - 0.5);
    
    for (const f of floorsForTraps) {
        if (traps.length >= TRAP_COUNT) break;

        const dPlayer = Math.hypot(f.x - startPos.x, f.z - startPos.z);
        if (dPlayer < TRAP_SAFE_ZONE_RADIUS) continue;

        let tooClose = false;
        for (const t of traps) {
            const dist = Math.hypot(f.x - t.position.x, f.z - t.position.z);
            if (dist < TRAP_MIN_SPACING) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;

        traps.push({
            id: uuidv4(),
            position: { x: f.x, y: 0, z: f.z },
            triggered: false,
            triggerTime: 0,
            hp: TRAP_MAX_HP,
            isLocked: false,
            lockedUntil: 0
        });
    }

    return { entities: { statues }, papers, sticks, traps };
};

export interface EntitySlice {
    enemies: Enemy[];
    statues: Statue[];
    traps: Trap[];
    sticks: Stick[];
    droppedItems: DroppedItem[];
    papers: Paper[];
    theAngel: TheAngel | null;

    updateEnemies: (enemies: Enemy[]) => void;
    spawnEnemy: (pos: Vector3) => void;
    killEnemy: (id: string) => void;

    updateTheAngel: (data: Partial<TheAngel>) => void;
    spawnTheAngel: (pos: Vector3) => void;
    emitSound: (type: SoundType, position: Vector3) => void;
    
    triggerTrap: (id: string) => void;
    hitTrap: (id: string, damage: number) => void;
}

export const createEntitySlice: StateCreator<GameStore, [], [], EntitySlice> = (set, get) => ({
    enemies: [],
    statues: [],
    traps: [],
    sticks: [],
    droppedItems: [],
    papers: [],
    theAngel: null,

    updateEnemies: (enemies) => set({ enemies }),

    updateTheAngel: (data) => {
        const { theAngel } = get();
        if (theAngel) {
            set({ theAngel: { ...theAngel, ...data } });
        }
    },

    spawnTheAngel: (pos) => {
        set({
            theAngel: {
                position: pos,
                rotationY: 0,
                state: 'IDLE',
                targetPosition: null,
                lastHeardSoundTime: 0,
                lastHeardSoundPos: null,
                isActive: false,
                sanity19Triggered: false,
                sanity9Triggered: false,
                sanity0Active: false,
                appearanceTime: 0
            }
        });
    },

    emitSound: (type, position) => {
        const { theAngel } = get();
        if (!theAngel || !theAngel.isActive) return;

        const dist = Math.hypot(theAngel.position.x - position.x, theAngel.position.z - position.z);
        let range = 0;

        switch (type) {
            case 'WALK': range = 30; break;
            case 'RUN': range = 50; break;
            case 'MELEE': range = 70; break;
            case 'GUN': range = 100; break;
        }

        if (dist <= range) {
            set({
                theAngel: {
                    ...theAngel,
                    lastHeardSoundTime: Date.now(),
                    lastHeardSoundPos: { ...position },
                    targetPosition: { ...position },
                    state: 'CHASING' 
                }
            });
        }
    },

    spawnEnemy: (pos) => {
        const { enemies } = get();
        if (enemies.length >= MAX_ENEMIES) return;
        
        const newEnemy: Enemy = {
            id: uuidv4(),
            position: pos,
            hp: ENEMY_MAX_HP,
            speed: 2 + Math.random() * 2,
            lastHit: 0
        };
        set({ enemies: [...enemies, newEnemy] });
    },
  
    killEnemy: (id) => {
        const { enemies, score } = get();
        set({ 
            enemies: enemies.filter(e => e.id !== id),
            score: score + 100
        });
    },

    triggerTrap: (id) => {
        const { traps } = get();
        const triggeredTrap = traps.find(t => t.id === id);
        
        if (triggeredTrap && (!triggeredTrap.isLocked || Date.now() > triggeredTrap.lockedUntil)) {
            set({
                traps: traps.map(t => t.id === id ? { 
                    ...t, 
                    triggered: true, 
                    triggerTime: Date.now(),
                    isLocked: false 
                } : t),
                isTrapped: true,
                trappedPosition: triggeredTrap.position
            });
        }
    },
  
    hitTrap: (id, damage) => {
        const { traps, isTrapped, trappedPosition } = get();
        const trap = traps.find(t => t.id === id);
        
        if (trap && trap.triggered) {
            const newHp = trap.hp - damage;
            
            if (newHp <= 0) {
                set({
                    traps: traps.map(t => t.id === id ? {
                        ...t,
                        triggered: false,
                        hp: TRAP_MAX_HP,
                        isLocked: true,
                        lockedUntil: Date.now() + TRAP_COOLDOWN_MS
                    } : t),
                    isTrapped: isTrapped && trappedPosition === trap.position ? false : isTrapped,
                    trappedPosition: isTrapped && trappedPosition === trap.position ? null : trappedPosition
                });
                if (isTrapped && trappedPosition === trap.position) {
                    soundManager.stopTrapScream();
                }
            } else {
                set({
                    traps: traps.map(t => t.id === id ? { ...t, hp: newHp } : t)
                });
            }
        }
    },
});

export const createEntitySliceInitialState = () => ({
    enemies: [],
    statues: [],
    traps: [],
    sticks: [],
    droppedItems: [],
    papers: [],
    theAngel: null,
});
