import React, { useEffect, useState, useRef } from 'react';
import Game from './components/Game';
import HUD from './components/HUD';
import Inventory from './components/Inventory';
import DevConsole from './components/DevConsole';
import { useGameStore } from './store';
import { generateMissionIntel } from './services/MissionGenerator';
import { MissionIntel, GameState, Language } from './types';
import { soundManager } from './components/SoundManager';
import { MENU_BGM_PATH, MENU_BGM_2_PATH } from './constants';
import { TEXT } from './localization';

// MENU SUB-STATES
type MenuCurrentView = 'MAIN' | 'LEVELS' | 'SETTINGS' | 'DONATE' | 'PAUSE';

const NoiseOverlay = () => (
    <div className="absolute inset-0 pointer-events-none z-[100] opacity-[0.08] mix-blend-overlay" 
         style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
         }}
    />
);

const Vignette = () => (
    <div className="absolute inset-0 pointer-events-none z-[90] bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0.95)_100%)]" />
);

const Scanlines = () => (
    <div className="absolute inset-0 pointer-events-none z-[95] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none" />
);

const LoadingOverlay = ({ text }: { text: string }) => (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-[200] pointer-events-none">
        <div className="flex flex-col items-center">
             <h1 className="text-3xl text-[#7f1d1d] font-mono tracking-[0.5em] animate-pulse uppercase mb-4">
                {text}
            </h1>
            <div className="w-64 h-1 bg-[#292524] overflow-hidden">
                <div className="h-full bg-[#7f1d1d] animate-loading-bar w-full origin-left" />
            </div>
        </div>
    </div>
);

const HorrorButton = ({ onClick, children, className = "" }: { onClick: () => void, children: React.ReactNode, className?: string }) => (
    <button 
        onClick={() => {
            soundManager.playUIClick();
            onClick();
        }}
        onMouseEnter={() => soundManager.playUIHover()}
        className={`
            relative w-full py-3 px-6 
            font-mono text-xl tracking-[0.2em] uppercase 
            text-[#a8a29e] hover:text-[#7f1d1d] hover:bg-[#1c1917]
            border-l-2 border-transparent hover:border-[#7f1d1d]
            transition-all duration-300 text-left group
            ${className}
        `}
    >
        <span className="group-hover:pl-4 transition-all duration-300">{children}</span>
    </button>
);

const App = () => {
  const { 
      gameState, setGameState, startGame, resetGame, resumeGame, 
      score, startTime, endTime, 
      language, setLanguage, volume, setVolume, mouseSensitivity, setMouseSensitivity,
      maxUnlockedLevel, currentLevel, levelRecords, completeLevel,
      isLoading, setIsLoading, isInventoryOpen,
      setAssetLoading, areAssetsLoaded, setAssetsLoaded, // New
      devModeEnabled, setDevModeEnabled, showDevOverlays, setShowDevOverlays,
      isGodMode, setGodMode, isGhostMode, setGhostMode
  } = useGameStore();

  const [menuView, setMenuView] = useState<MenuCurrentView>('MAIN');
  const [missionIntel, setMissionIntel] = useState<MissionIntel | null>(null);
  
  // NEW: State to track if the user has performed the first interaction to unlock AudioContext
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // New: Ref to hold pending game start data while assets load
  const pendingStartRef = useRef<{intel: MissionIntel, level: number} | null>(null);

  const T = TEXT[language].menu;

  // Global Error Suppression for Pointer Lock race conditions
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
        // Suppress harmless race condition errors
        if (typeof e.reason === 'string' && e.reason.includes('exited the lock')) {
            e.preventDefault();
        } else if (e.reason && e.reason.message && e.reason.message.includes('exited the lock')) {
            e.preventDefault();
        }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  useEffect(() => {
    if (gameState === GameState.MENU) {
      setMissionIntel(null);
      // FIX: Ensure we are viewing the MAIN menu, not stuck on PAUSE or other views
      setMenuView('MAIN');
      
      // Reset asset loaded state if coming back to menu? 
      // Actually no, once loaded, we keep them cached.
      // But we can reset the flag if we want to force re-check, 
      // but 'modelCache' is in memory so we don't need to re-run unless we want to clear GPU memory.
      // For now, keep them loaded.
    }
    // Automatically switch to PAUSE view logic when entering pause
    if (gameState === GameState.PAUSED) {
        setMenuView('PAUSE');
        // PAUSE ALL AMBIENT SOUNDS IMMEDIATELY
        soundManager.pauseAllAmbient();
    }
  }, [gameState]);

  // Background Music Logic for Menu
  // Plays when in MENU state AND user has clicked Initialize
  useEffect(() => {
      if (gameState === GameState.MENU && hasInteracted) {
          // Layer 1: Main Menu BGM
          soundManager.playBGM(MENU_BGM_PATH, 0.1);
          // Layer 2: Secondary Ambience (as requested)
          soundManager.playSecondaryBGM(MENU_BGM_2_PATH, 0.2);
      }
  }, [gameState, hasInteracted]);

  useEffect(() => {
    if (gameState === GameState.MENU || gameState === GameState.GAME_OVER || gameState === GameState.GAME_WON || gameState === GameState.PAUSED) {
      document.exitPointerLock();
    }
  }, [gameState]);

  // Force pause when tab loses visibility or window loses focus (e.g., alt-tab)
  useEffect(() => {
    const forcePause = () => {
        const store = useGameStore.getState();
        // Do nothing if already in end/menu screens
        if (store.gameState === GameState.MENU || store.gameState === GameState.GAME_OVER || store.gameState === GameState.GAME_WON) return;

        // Force PAUSE state and UI when losing focus
        store.setGameState(GameState.PAUSED);
        setMenuView('PAUSE');
        // Close inventory to avoid overlay conflicts
        useGameStore.setState({ isInventoryOpen: false, previewItem: null });
        
        soundManager.pauseAllAmbient();
        soundManager.pauseBGM();
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    };

    const handleVisibility = () => {
        if (document.hidden) {
            forcePause();
        }
    };

    const handleBlur = () => {
        forcePause();
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
        window.removeEventListener('blur', handleBlur);
        document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // ASSET LOADING ORCHESTRATION
  useEffect(() => {
      if (areAssetsLoaded && isLoading && pendingStartRef.current) {
          // Assets are done, we are loading, and we have pending data
          const { intel, level } = pendingStartRef.current;
          
          // Clear pending
          pendingStartRef.current = null;
          
          // Start Game
          startGame(intel, level);
          setIsLoading(false);
          setAssetLoading(false); // Stop the preloader loop
      }
  }, [areAssetsLoaded, isLoading, startGame, setIsLoading, setAssetLoading]);


  const requestLockSafely = () => {
      try {
          const promise = document.body.requestPointerLock();
          // @ts-ignore
          if (promise && typeof promise.catch === 'function') {
              // @ts-ignore
              promise.catch(() => { /* suppress */ });
          }
      } catch (e) {
          // suppress sync errors
      }
  };

  const handleLevelStart = async (level: number) => {
    try {
      // 1. Force Browser Lock IMMEDIATELY (Requires User Gesture)
      requestLockSafely();

      // 2. Enable Loading State (Visual Only, Logic Frozen)
      setIsLoading(true);

      // 3. Stop Menu BGM immediately to avoid overlap
      soundManager.stopBGM();

      // 4. Generate Intel (Fast)
      const intel = await generateMissionIntel();
      setMissionIntel(intel);
      
      // Store pending data
      pendingStartRef.current = { intel, level };

      // 5. Trigger Asset Loading if not already loaded (or even if loaded, to be safe/warmup again)
      // If assets are already loaded in memory (areAssetsLoaded true), we might want to skip?
      // But maybe we want to re-upload textures if context was lost? 
      // R3F handles context loss mostly, but let's run it to be safe or check if loaded.
      
      if (!areAssetsLoaded) {
          setAssetLoading(true);
      } else {
          // If already loaded, just fake a small delay for consistency or jump straight
           setTimeout(() => {
               if (pendingStartRef.current) {
                   startGame(intel, level);
                   setIsLoading(false);
                   pendingStartRef.current = null;
               }
           }, 500);
      }

    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleNewGame = () => {
      // Always start from Level 1
      handleLevelStart(1);
  };

  const handleResume = () => {
      // 1. Force Browser Lock IMMEDIATELY
      requestLockSafely();

      // 2. Enable Loading State
      setIsLoading(true);

      // 3. Wait 1 second for browser/react to stabilize
      setTimeout(() => {
          resumeGame();
          setIsLoading(false);
      }, 1000);
  };

  const handleNextLevel = () => {
      completeLevel(); 
      resetGame(); 
      handleLevelStart(currentLevel + 1);
  };

  const handleQuit = () => {
      if (window.confirm("Wake up?")) {
          window.close();
          setGameState(GameState.MENU);
      }
  };

  const formatTime = (ms: number) => {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const initAudio = () => {
      soundManager.resumeContext();
      soundManager.playUIClick();
      setHasInteracted(true);
      // Play BGM logic is handled by useEffect when hasInteracted becomes true
  }

  // --- MENU RENDERERS ---

  const renderMainMenu = () => (
      <div className="flex flex-col gap-6 w-full max-w-sm animate-in fade-in duration-1000 pointer-events-auto">
         {/* New Game - Starts at Level 1 */}
         <HorrorButton onClick={handleNewGame}>
            {T.buttons.newGame}
         </HorrorButton>

         {/* Level Select */}
         <HorrorButton onClick={() => setMenuView('LEVELS')}>
            {T.buttons.levels}
         </HorrorButton>

         {/* Settings */}
         <HorrorButton onClick={() => setMenuView('SETTINGS')}>
            {T.buttons.settings}
         </HorrorButton>

         {/* Donate */}
         <HorrorButton onClick={() => setMenuView('DONATE')}>
            {T.buttons.donate}
         </HorrorButton>

         {/* Quit */}
         <HorrorButton onClick={handleQuit} className="mt-8 opacity-60 hover:opacity-100">
            {T.buttons.quit}
         </HorrorButton>
      </div>
  );

  const renderLevelSelect = () => (
      <div className="w-full max-w-4xl animate-in fade-in duration-500 font-mono pointer-events-auto">
         <h2 className="text-4xl text-[#7f1d1d] mb-12 uppercase tracking-[0.5em] text-center border-b border-[#7f1d1d] pb-4">
            {T.levels.title}
         </h2>
         <div className="grid grid-cols-5 gap-6 mb-12">
            {Array.from({length: 10}).map((_, i) => {
                const levelNum = i + 1;
                const isLocked = levelNum > maxUnlockedLevel;
                const record = levelRecords[levelNum];

                return (
                    <button
                        key={levelNum}
                        disabled={isLocked}
                        onMouseEnter={() => !isLocked && soundManager.playUIHover()}
                        onClick={() => {
                            if (!isLocked) {
                                soundManager.playUIClick();
                                handleLevelStart(levelNum);
                            }
                        }}
                        className={`
                            relative h-32 border flex flex-col items-center justify-center transition-all duration-300
                            ${isLocked 
                                ? 'bg-black border-[#292524] text-[#292524] cursor-not-allowed' 
                                : 'bg-black border-[#57534e] hover:border-[#7f1d1d] hover:bg-[#1c1917] text-[#a8a29e] hover:text-[#d6d3d1] cursor-pointer group'
                            }
                        `}
                    >
                        <span className="text-4xl font-serif">{levelNum}</span>
                        {!isLocked && record && (
                            <span className="text-xs text-[#b45309] mt-2 tracking-widest">
                                {formatTime(record)}
                            </span>
                        )}
                        {isLocked && <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-20">✖</div>}
                        {!isLocked && <div className="absolute inset-0 bg-[#7f1d1d] opacity-0 group-hover:opacity-1 transition-opacity" />}
                    </button>
                )
            })}
         </div>
         <div className="flex justify-center">
            <button 
                onMouseEnter={() => soundManager.playUIHover()}
                onClick={() => {
                    soundManager.playUIClick();
                    setMenuView('MAIN');
                }}
                className="text-[#57534e] hover:text-[#a8a29e] uppercase tracking-[0.2em] py-2 px-8 border-b border-transparent hover:border-[#57534e] transition-all"
            >
                {T.buttons.back}
            </button>
         </div>
      </div>
  );

  const renderSettings = () => (
    <div className="w-full max-w-md p-8 border border-[#292524] bg-black/95 text-[#a8a29e] animate-in fade-in font-mono pointer-events-auto z-50">
        <h2 className="text-2xl mb-12 text-[#7f1d1d] uppercase tracking-[0.3em] text-center">{T.settings.title}</h2>
        
        <div className="mb-8">
            <label className="block text-xs text-[#57534e] mb-4 uppercase tracking-widest">{T.settings.volume}</label>
            <div className="flex items-center gap-4">
                <span className="text-xs">0</span>
                <input 
                    type="range" 
                    min="0" max="4" step="0.1" 
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-[#292524] rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#7f1d1d]"
                />
                <span className="text-xs">4</span>
            </div>
            <div className="text-center text-[10px] text-[#57534e] mt-2 tracking-widest">{volume.toFixed(1)}</div>
        </div>

        <div className="mb-12">
            <label className="block text-xs text-[#57534e] mb-4 uppercase tracking-widest">{T.settings.sensitivity}</label>
            <div className="flex items-center gap-4">
                <span className="text-xs">0.05</span>
                <input 
                    type="range" 
                    min="0.05" max="1.0" step="0.01" 
                    value={mouseSensitivity}
                    onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-[#292524] rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#7f1d1d]"
                />
                <span className="text-xs">1.0</span>
            </div>
            <div className="text-center text-[10px] text-[#57534e] mt-2 tracking-widest">{mouseSensitivity.toFixed(2)}</div>
        </div>

        <div className="mb-12">
            <label className="block text-xs text-[#57534e] mb-4 uppercase tracking-widest">{T.settings.language}</label>
            <div className="flex gap-4">
                <button 
                    onMouseEnter={() => soundManager.playUIHover()}
                    onClick={() => {
                        soundManager.playUIClick();
                        setLanguage('en');
                    }}
                    className={`flex-1 py-3 border ${language === 'en' ? 'border-[#7f1d1d] text-[#d6d3d1]' : 'border-[#292524] text-[#44403c]'} uppercase tracking-widest transition-colors`}
                >
                    English
                </button>
                <button 
                    onMouseEnter={() => soundManager.playUIHover()}
                    onClick={() => {
                        soundManager.playUIClick();
                        setLanguage('vi');
                    }}
                    className={`flex-1 py-3 border ${language === 'vi' ? 'border-[#7f1d1d] text-[#d6d3d1]' : 'border-[#292524] text-[#44403c]'} uppercase tracking-widest transition-colors`}
                >
                    Tiếng Việt
                </button>
            </div>
        </div>

        <div className="mb-12 border border-red-900/60 bg-[#1a0909] p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="text-xs text-red-400 uppercase tracking-widest">Developer Mode</div>
                    <div className="text-[11px] text-red-300/80 mt-1 leading-relaxed">
                        Không nên bật nếu không muốn phá hỏng trải nghiệm. Chỉ dùng để debug.
                    </div>
                </div>
                <button
                    onMouseEnter={() => soundManager.playUIHover()}
                    onClick={() => {
                        const next = !devModeEnabled;
                        if (next) {
                            const ok = window.confirm("Chế độ nhà phát triển có thể phá hỏng trò chơi. Bật?");
                            if (!ok) return;
                        }
                        soundManager.playUIClick();
                        setDevModeEnabled(next);
                        if (!next) {
                            setGodMode(false);
                            setGhostMode(false);
                            setShowDevOverlays(false);
                        }
                    }}
                    className={`px-4 py-2 text-sm uppercase tracking-widest border ${
                        devModeEnabled ? 'border-red-400 text-red-200' : 'border-red-900 text-red-500'
                    } hover:border-red-400 hover:text-red-200 transition-colors`}
                >
                    {devModeEnabled ? 'Tắt' : 'Bật'}
                </button>
            </div>

            {devModeEnabled && (
                <div className="mt-4 space-y-3 text-sm text-[#e5e5e5]">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showDevOverlays} 
                            onChange={(e) => setShowDevOverlays(e.target.checked)} 
                        />
                        <span>Hiển thị HUD ẩn (health/stamina/sanity, cooldown scanner)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isGodMode} 
                            onChange={(e) => setGodMode(e.target.checked)} 
                        />
                        <span>Chế độ nhìn xuyên / highlight (God mode)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isGhostMode} 
                            onChange={(e) => setGhostMode(e.target.checked)} 
                        />
                        <span>Chế độ bay / xuyên tường (Ghost mode)</span>
                    </label>
                </div>
            )}
        </div>

        <button 
            onMouseEnter={() => soundManager.playUIHover()}
            onClick={() => {
                soundManager.playUIClick();
                setMenuView(gameState === GameState.PAUSED ? 'PAUSE' : 'MAIN');
            }}
            className="w-full py-4 bg-[#1c1917] hover:bg-[#292524] text-[#a8a29e] uppercase tracking-[0.2em] transition-all"
        >
            {T.buttons.back}
        </button>
    </div>
  );

  const renderDonate = () => (
      <div className="w-full max-w-md p-8 border border-[#292524] bg-black/90 text-center animate-in fade-in font-mono pointer-events-auto">
          <h2 className="text-2xl text-[#b45309] mb-4 uppercase tracking-[0.3em]">{T.donate.title}</h2>
          <p className="text-[#57534e] mb-8 text-sm italic">{T.donate.desc}</p>
          
          <div className="w-48 h-48 bg-[#a8a29e] mx-auto mb-8 p-1">
              <div className="w-full h-full bg-black flex items-center justify-center text-[#57534e] text-xs border border-[#57534e]">
                  {T.donate.scan}
              </div>
          </div>

          <a href="#" className="block mb-8 text-[#78350f] hover:text-[#b45309] text-xs tracking-widest uppercase hover:underline">
             paypal.me/mazerunnerdev
          </a>

          <button 
              onMouseEnter={() => soundManager.playUIHover()}
              onClick={() => {
                  soundManager.playUIClick();
                  setMenuView('MAIN');
              }}
              className="w-full py-3 border border-[#292524] hover:border-[#57534e] text-[#57534e] uppercase tracking-[0.2em] transition-all"
          >
              {T.buttons.back}
          </button>
      </div>
  );

  const renderPauseMenu = () => (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 backdrop-blur-sm text-white pointer-events-auto">
           {menuView === 'SETTINGS' ? (
               renderSettings()
           ) : (
               <>
                   <h1 className="text-6xl font-serif text-[#a8a29e] mb-12 tracking-[0.5em] uppercase blur-[0.5px]">PAUSED</h1>
                   <div className="flex flex-col gap-6 w-64 pointer-events-auto">
                      <button 
                          onMouseEnter={() => soundManager.playUIHover()}
                          onClick={() => {
                              soundManager.playUIClick();
                              handleResume();
                          }}
                          disabled={isLoading}
                          className="py-2 text-[#d6d3d1] hover:text-white font-mono text-xl border-b border-transparent hover:border-[#7f1d1d] transition-all uppercase tracking-widest text-center disabled:opacity-50 disabled:cursor-wait"
                      >
                          {T.buttons.resume}
                      </button>
                      
                      <button 
                          onMouseEnter={() => soundManager.playUIHover()}
                          onClick={() => {
                              soundManager.playUIClick();
                              setMenuView('SETTINGS');
                          }}
                          disabled={isLoading}
                          className="py-2 text-[#a8a29e] hover:text-[#d6d3d1] font-mono text-lg uppercase tracking-widest text-center hover:bg-[#7f1d1d]/20 transition-all disabled:opacity-50"
                      >
                          {T.buttons.settings}
                      </button>

                      <button 
                          onMouseEnter={() => soundManager.playUIHover()}
                          onClick={() => {
                              soundManager.playUIClick();
                              resetGame();
                          }}
                          disabled={isLoading}
                          className="py-2 text-[#57534e] hover:text-[#a8a29e] font-mono text-sm uppercase tracking-widest text-center mt-4 disabled:opacity-50"
                      >
                          {T.buttons.mainMenu}
                      </button>
                   </div>
               </>
           )}
      </div>
  );

  // Determine if we should show Menu Effects (Noise, Scanlines, Vignette)
  const isMenuOrEnd = gameState === GameState.MENU || gameState === GameState.GAME_OVER || gameState === GameState.GAME_WON || gameState === GameState.PAUSED;

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black select-none cursor-default">
      <Game /> 
      <HUD />
      <Inventory />
      <DevConsole />
      
      {isLoading && <LoadingOverlay text={T.buttons.loading} />}

      {/* GLOBAL OVERLAYS: Only active in Menus/End Screens or Pause. Disabled during Gameplay. */}
      {isMenuOrEnd && (
        <>
            <NoiseOverlay />
            <Vignette />
            <Scanlines />
        </>
      )}

      {/* --- INITIAL INTERACTION SCREEN --- */}
      {/* This ensures audio context is resumed before showing main menu */}
      {gameState === GameState.MENU && !hasInteracted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-[100]">
              <h1 className="text-4xl font-serif text-[#7f1d1d] tracking-[0.3em] uppercase animate-pulse mb-8">
                {T.warningHeader}
              </h1>
              {/* Poem box. Non-clickable, preserves border styling. */}
              <div className="text-[#a8a29e] font-mono tracking-widest text-sm border px-8 py-8 border-[#292524] bg-black text-center whitespace-pre-line leading-loose max-w-2xl select-none">
                  {T.buttons.init}
              </div>
              
              {/* New Enter Button */}
              <button 
                  onClick={initAudio}
                  className="mt-12 text-white font-mono text-xl tracking-[0.5em] hover:text-[#7f1d1d] transition-colors cursor-pointer opacity-80 hover:opacity-100"
              >
                  [ENTER]
              </button>
          </div>
      )}

      {/* --- MAIN MENU SYSTEM --- */}
      {gameState === GameState.MENU && hasInteracted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50">
           {menuView === 'SETTINGS' ? (
                renderSettings()
           ) : (
             <>
                {menuView === 'MAIN' && (
                    <div className="mb-20 text-center animate-in fade-in">
                        <h1 className="text-8xl font-serif text-[#7f1d1d] tracking-[0.2em] leading-none opacity-90 drop-shadow-[0_0_10px_rgba(127,29,29,0.5)]">
                            {T.title}
                        </h1>
                        <h1 className="text-5xl font-serif text-[#a8a29e] tracking-[0.5em] mt-6 opacity-70 blur-[2px]">
                            {T.subtitle}
                        </h1>
                        <p className="text-[#44403c] tracking-[0.8em] uppercase mt-6 text-xs font-mono animate-pulse">
                            {T.tagline}
                        </p>
                    </div>
                )}

                {menuView === 'MAIN' && renderMainMenu()}
                {menuView === 'LEVELS' && renderLevelSelect()}
                {menuView === 'DONATE' && renderDonate()}

                {menuView === 'MAIN' && (
                    <div className="absolute bottom-6 right-8 text-[10px] text-[#292524] font-mono tracking-widest">
                        BUILD_V0.1.0_STABLE
                    </div>
                )}
             </>
           )}
        </div>
      )}

      {/* --- PAUSE MENU --- */}
      {gameState === GameState.PAUSED && renderPauseMenu()}

      {/* --- GAME OVER --- */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1c0202]/95 z-50 animate-in fade-in duration-[2000ms] pointer-events-auto">
          <h1 className="text-9xl font-serif text-[#7f1d1d] mb-4 tracking-widest uppercase opacity-80 blur-[2px]">{T.result.defeat}</h1>
          <p className="text-xl mb-16 text-[#991b1b] font-mono tracking-[0.2em]">{T.result.reasonLost}</p>
          
          <div className="flex flex-col gap-6">
            <button
                onMouseEnter={() => soundManager.playUIHover()}
                onClick={() => {
                    soundManager.playUIClick();
                    handleLevelStart(currentLevel);
                }}
                className="px-12 py-4 bg-transparent border border-[#7f1d1d] text-[#d6d3d1] font-mono text-lg hover:bg-[#7f1d1d]/20 uppercase tracking-[0.3em] transition-all"
            >
                {T.buttons.tryAgain}
            </button>
            <button
                onMouseEnter={() => soundManager.playUIHover()}
                onClick={() => {
                    soundManager.playUIClick();
                    resetGame();
                }}
                className="text-[#57534e] hover:text-[#a8a29e] font-mono text-sm uppercase tracking-widest"
            >
                {T.buttons.mainMenu}
            </button>
          </div>
        </div>
      )}

      {/* --- VICTORY --- */}
      {gameState === GameState.GAME_WON && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-50 pointer-events-auto">
          <h1 className="text-8xl font-serif text-[#d6d3d1] mb-6 tracking-[0.2em] uppercase blur-[1px]">{T.result.escaped}</h1>
          <p className="text-xl mb-12 text-[#57534e] font-mono tracking-widest">{T.result.reasonWin}</p>
          
          <div className="p-8 border-y border-[#292524] text-center mb-16">
             <div className="text-xs text-[#57534e] uppercase tracking-[0.4em] mb-4">{T.result.time}</div>
             <div className="text-7xl font-mono text-[#b45309] font-light">
                {formatTime(endTime - startTime)}
             </div>
          </div>

          <div className="flex gap-8">
             <button
                onMouseEnter={() => soundManager.playUIHover()}
                onClick={() => {
                    soundManager.playUIClick();
                    resetGame();
                }}
                className="px-8 py-3 text-[#57534e] hover:text-[#a8a29e] font-mono uppercase tracking-widest border border-transparent hover:border-[#57534e] transition-all"
            >
                {T.buttons.mainMenu}
            </button>
            <button
                onMouseEnter={() => soundManager.playUIHover()}
                onClick={() => {
                    soundManager.playUIClick();
                    handleNextLevel();
                }}
                className="px-12 py-3 bg-[#1c1917] text-[#d6d3d1] hover:bg-[#292524] hover:text-white font-mono text-xl border border-[#44403c] uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            >
                {T.buttons.nextFloor}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
