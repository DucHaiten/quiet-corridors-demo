
import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store';
import { GameState } from '../../types';
import { DASH_SPEED, DASH_DURATION, STAMINA_COST_DASH, PILL_USE_DURATION_MS } from '../../constants';
import { soundManager } from '../SoundManager';
import { WeaponHandle } from '../Weapon';

export const usePlayerControls = (weaponRef: React.RefObject<WeaponHandle>) => {
    const { camera } = useThree();
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    const moveLeft = useRef(false);
    const moveRight = useRef(false);
    const isSprinting = useRef(false);
    const crouch = useRef(false); // New Crouch Ref
    const jump = useRef(false);
    const interactPressed = useRef(false);
    const isFHeld = useRef(false);
    
    // This ref is updated by the main loop in Player.tsx based on Stamina logic
    const isSprintingEffective = useRef(false);

    const lastTapTime = useRef<number>(0);
    const lastTapKey = useRef<string>('');
    const isDashing = useRef(false);
    const dashStartTime = useRef(0);
    const dashVelocity = useRef(new THREE.Vector3());

    const { 
        gameState, isInventoryOpen, toggleInventory, readingPaperContent, 
        setReadingPaper, setGameState, syncPlayerTransform, 
        toggleWeaponActive, setWeaponActive, isDevConsoleOpen
    } = useGameStore();

    const performDash = (keyCode: string) => {
        // Cannot dash if trapped or inventory open or reading paper
        if (useGameStore.getState().isTrapped || useGameStore.getState().isInventoryOpen || useGameStore.getState().readingPaperContent !== null || useGameStore.getState().isDevConsoleOpen) return;
        
        isDashing.current = true;
        dashStartTime.current = Date.now();
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
  
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();
  
        const direction = new THREE.Vector3();
  
        if (keyCode === 'KeyW' || keyCode === 'ArrowUp') direction.copy(forward);
        if (keyCode === 'KeyS' || keyCode === 'ArrowDown') direction.copy(forward).negate();
        if (keyCode === 'KeyA' || keyCode === 'ArrowLeft') direction.copy(right).negate();
        if (keyCode === 'KeyD' || keyCode === 'ArrowRight') direction.copy(right);
  
        dashVelocity.current.copy(direction).multiplyScalar(DASH_SPEED);
        soundManager.playShoot(); 
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
          if (useGameStore.getState().gameState !== GameState.PLAYING) return; 
          if (event.repeat) return;
    
          const store = useGameStore.getState();
    
          // Handle closing paper
          if (store.readingPaperContent !== null) {
              // Explicitly handle Escape to ensure we Pause immediately
              if (event.code === 'Escape') {
                  store.setReadingPaper(null);
                  store.setGameState(GameState.PAUSED);
                  return;
              }
              if (event.code === 'KeyE') {
                  store.setReadingPaper(null);
                  return;
              }
              return; 
          }
    
          // Handle TAB for Inventory
          if (event.code === 'Tab') {
              event.preventDefault();
              soundManager.playUIHover(); // Simple SFX for open
              
              // SYNC POSITION BEFORE OPENING
              syncPlayerTransform(
                new THREE.Vector3(camera.position.x, 0, camera.position.z), 
                camera.rotation.y
              );
    
              toggleInventory();
              // Reset movement keys when opening inventory to prevent "stuck running"
              moveForward.current = false;
              moveBackward.current = false;
              moveLeft.current = false;
              moveRight.current = false;
              isSprinting.current = false;
              crouch.current = false;
              return;
          }
    
          // Block other inputs if Inventory is open OR Dev Console is open
          if (store.isInventoryOpen || store.isDevConsoleOpen) return;
    
          const now = Date.now();
          const isShiftHeld = event.shiftKey;
          const validKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
          
          if (isShiftHeld && validKeys.includes(event.code)) {
              if (lastTapKey.current === event.code && (now - lastTapTime.current) < 300) {
                 if (store.consumeStamina(STAMINA_COST_DASH)) {
                    performDash(event.code);
                 }
              }
              lastTapTime.current = now;
              lastTapKey.current = event.code;
          }
    
          switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': moveForward.current = true; break;
            case 'ArrowLeft':
            case 'KeyA': moveLeft.current = true; break;
            case 'ArrowDown':
            case 'KeyS': moveBackward.current = true; break;
            case 'ArrowRight':
            case 'KeyD': moveRight.current = true; break;
            case 'ShiftLeft':
            case 'ShiftRight': isSprinting.current = true; break;
            case 'ControlLeft':
            case 'ControlRight': crouch.current = true; break;
            case 'Space': if (!jump.current) jump.current = true; break;
            case 'KeyE': interactPressed.current = true; break;
            case 'KeyF': 
                 {
                    const currentStore = useGameStore.getState();
                    const leftHand = currentStore.leftHandItem;
                    
                    if (leftHand && (leftHand.typeId === 'pill_bottle' || leftHand.id === 'pill_bottle' || leftHand.typeId === 'health_solution' || leftHand.id === 'health_solution')) {
                        isFHeld.current = true;
                        const type = leftHand.typeId || leftHand.id || 'pill_bottle';
                        currentStore.startItemConsumption(leftHand.id, type, PILL_USE_DURATION_MS);
                    } else if (currentStore.triggerScan()) {
                        soundManager.playScan();
                    }
                 }
                 break;
            case 'KeyQ':
                if (store.leftHandItem || store.rightHandItem) {
                    toggleWeaponActive();
                }
                break;
          }
        };
    
        const handleKeyUp = (event: KeyboardEvent) => {
          // Always allow key ups to prevent stuck keys
          switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': moveForward.current = false; break;
            case 'ArrowLeft':
            case 'KeyA': moveLeft.current = false; break;
            case 'ArrowDown':
            case 'KeyS': moveBackward.current = false; break;
            case 'ArrowRight':
            case 'KeyD': moveRight.current = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': isSprinting.current = false; break;
            case 'ControlLeft':
            case 'ControlRight': crouch.current = false; break;
            case 'Space': jump.current = false; break;
            case 'KeyE': interactPressed.current = false; break;
            case 'KeyF':
                isFHeld.current = false;
                if (useGameStore.getState().isConsumingItem) {
                    useGameStore.getState().cancelItemConsumption();
                }
                break;
          }
        };
    
        const handleMouseDown = (event: MouseEvent) => {
          if (useGameStore.getState().gameState !== GameState.PLAYING) return;
          
          const store = useGameStore.getState();
          // Safety: ensure lock if lost. Allow re-locking even if reading paper (to hide cursor)
          // DO NOT Lock if Dev Console is open
          if (!store.isInventoryOpen && !store.isDevConsoleOpen && !document.pointerLockElement) {
             const req = document.body.requestPointerLock() as any;
             if (req?.catch) req.catch(() => {});
          }
    
          if (store.isInventoryOpen || store.readingPaperContent !== null || store.isDevConsoleOpen) return;
          
          const anyEquipped = store.leftHandItem || store.rightHandItem;

          // LEFT CLICK: Attack
          if (event.button === 0) {
              // Auto-draw weapon if hidden
              if (!store.isWeaponActive && anyEquipped) {
                  setWeaponActive(true);
              }
    
              if (weaponRef.current) {
                  weaponRef.current.attack();
              }
          }
          
          // RIGHT CLICK: Block
          if (event.button === 2) {
              // Auto-draw weapon if hidden
              if (!store.isWeaponActive && anyEquipped) {
                  setWeaponActive(true);
              }
    
              if (weaponRef.current) {
                  weaponRef.current.setBlocking(true);
              }
          }
        };
    
        const handleMouseUp = (event: MouseEvent) => {
            if (event.button === 2) {
                if (weaponRef.current) {
                    weaponRef.current.setBlocking(false);
                }
            }
        };
    
        const handleContextMenu = (e: Event) => e.preventDefault();
    
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('contextmenu', handleContextMenu);
        
        return () => {
          document.removeEventListener('keydown', handleKeyDown);
          document.removeEventListener('keyup', handleKeyUp);
          document.removeEventListener('mousedown', handleMouseDown);
          document.removeEventListener('mouseup', handleMouseUp);
          document.removeEventListener('contextmenu', handleContextMenu);
        };
      }, []);

    useEffect(() => {
        let rafId: number;

        const tick = () => {
            const store = useGameStore.getState();
            if (store.gameState !== GameState.PLAYING) {
                rafId = requestAnimationFrame(tick);
                return;
            }

            const { isConsumingItem, consumingItemType, consumeStartTime, consumeDuration, leftHandItem } = store;

            const hasPillEquipped = leftHandItem && (leftHandItem.typeId === 'pill_bottle' || leftHandItem.id === 'pill_bottle');
            const hasHealthEquipped = leftHandItem && (leftHandItem.typeId === 'health_solution' || leftHandItem.id === 'health_solution');

            const isPill = consumingItemType === 'pill_bottle';
            const isHealth = consumingItemType === 'health_solution';

            if (isConsumingItem && (isPill || isHealth)) {
                const hasItemEquipped = isPill ? hasPillEquipped : hasHealthEquipped;
                if (!isFHeld.current || !hasItemEquipped) {
                    store.cancelItemConsumption();
                } else if (consumeStartTime > 0 && Date.now() - consumeStartTime >= consumeDuration) {
                    store.completeItemConsumption();
                    isFHeld.current = false;
                }
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, []);

    return {
        moveForward,
        moveBackward,
        moveLeft,
        moveRight,
        isSprinting,
        crouch,
        jump,
        interactPressed,
        isSprintingEffective,
        isDashing,
        dashStartTime,
        dashVelocity
    };
};