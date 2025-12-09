
import { Vector3 } from '../types';
import { MAP_SIZE, CELL_SIZE } from '../constants';

export const generateMazeData = (level: number) => {
    // Basic difficulty scaling: Map gets slightly denser or logic changes could go here
    const rows = Math.floor(MAP_SIZE / CELL_SIZE);
    const cols = Math.floor(MAP_SIZE / CELL_SIZE);
    const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(1)); // 1 = Wall, 0 = Path

    const dirs = [
        { r: -2, c: 0 }, { r: 2, c: 0 }, { r: 0, c: -2 }, { r: 0, c: 2 }
    ];

    const stack: {r: number, c: number}[] = [];
    const startR = 1, startC = 1;
    grid[startR][startC] = 0;
    stack.push({ r: startR, c: startC });

    // 1. Generate Perfect Maze
    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const validNeighbors = [];

        for (const d of dirs) {
            const nr = current.r + d.r;
            const nc = current.c + d.c;
            if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === 1) {
                validNeighbors.push({ r: nr, c: nc, dr: d.r / 2, dc: d.c / 2 });
            }
        }

        if (validNeighbors.length > 0) {
            const next = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
            grid[current.r + next.dr][current.c + next.dc] = 0; 
            grid[next.r][next.c] = 0; 
            stack.push({ r: next.r, c: next.c });
        } else {
            stack.pop();
        }
    }

    const offset = MAP_SIZE / 2;
    const carvePlaza = (r: number, c: number, radius: number) => {
        for(let i = r - radius; i <= r + radius; i++) {
            for(let j = c - radius; j <= c + radius; j++) {
                if(i > 1 && i < rows - 2 && j > 1 && j < cols - 2) {
                    grid[i][j] = 0; 
                }
            }
        }
    };

    const p1r = Math.floor(rows * 0.7) + Math.floor(Math.random() * (rows * 0.2));
    const p1c = Math.floor(cols * 0.7) + Math.floor(Math.random() * (cols * 0.2));
    const p2r = Math.floor(rows * 0.2) + Math.floor(Math.random() * (rows * 0.2));
    const p2c = Math.floor(cols * 0.6) + Math.floor(Math.random() * (cols * 0.3));

    carvePlaza(p1r, p1c, 2);
    carvePlaza(p2r, p2c, 2);

    const plaza1Pos = { x: (p1c * CELL_SIZE) - offset + (CELL_SIZE/2), y: 0, z: (p1r * CELL_SIZE) - offset + (CELL_SIZE/2) };
    const plaza2Pos = { x: (p2c * CELL_SIZE) - offset + (CELL_SIZE/2), y: 0, z: (p2r * CELL_SIZE) - offset + (CELL_SIZE/2) };

    for (let r = 2; r < rows - 2; r++) {
        for (let c = 2; c < cols - 2; c++) {
            if (grid[r][c] === 1) {
                if (Math.random() < 0.12) {
                    grid[r][c] = 0;
                }
            }
        }
    }

    const walls: Vector3[] = [];
    const floors: Vector3[] = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = (c * CELL_SIZE) - offset + (CELL_SIZE / 2);
            const z = (r * CELL_SIZE) - offset + (CELL_SIZE / 2);
            if (grid[r][c] === 1) {
                walls.push({ x, y: 0, z });
            } else {
                floors.push({ x, y: 0, z });
            }
        }
    }

    let startRotation = 0;
    if (grid[1][2] === 0) startRotation = -Math.PI / 2; 
    else if (grid[2][1] === 0) startRotation = -Math.PI;
    else if (grid[1][0] === 0) startRotation = Math.PI / 2;
    
    return { 
        walls, 
        floors, 
        startPos: { x: (1 * CELL_SIZE) - offset + (CELL_SIZE/2), y:0, z: (1 * CELL_SIZE) - offset + (CELL_SIZE/2) },
        startRotation,
        plaza1Pos,
        plaza2Pos
    };
};
