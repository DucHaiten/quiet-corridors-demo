
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store';
import { PLAYER_MAX_STAMINA } from '../constants';
import { TEXT } from '../localization';

// CONSTANTS for visual tuning
const PIXELS_PER_DEG = 5;

// CompassStrip defined OUTSIDE the HUD component to ensure DOM stability.
const CompassStrip = React.memo(() => {
  const directions = [
    { label: 'N', deg: 0, type: 'major' },
    { label: 'NE', deg: 45, type: 'minor' },
    { label: 'E', deg: 90, type: 'major' },
    { label: 'SE', deg: 135, type: 'minor' },
    { label: 'S', deg: 180, type: 'major' },
    { label: 'SW', deg: 225, type: 'minor' },
    { label: 'W', deg: 270, type: 'major' },
    { label: 'NW', deg: 315, type: 'minor' },
  ];

  return (
    <div 
      id="compass-strip" 
      className="absolute top-0 h-full flex items-end pb-2 will-change-transform"
      style={{ 
         left: '50%',
         transform: 'translateX(0px)' 
      }}
    >
      <div className="absolute bottom-2 left-[-10000px] right-[-10000px] h-0.5 bg-white shadow-[0_0_2px_black]" />

      {[0, 1, 2].map((cycle) => (
         <React.Fragment key={cycle}>
           {directions.map((dir) => {
             const offsetDeg = dir.deg + (cycle * 360);
             const leftPos = offsetDeg * PIXELS_PER_DEG; 
             
             return (
               <div 
                  key={`${cycle}-${dir.label}`} 
                  className="absolute transform -translate-x-1/2 flex flex-col items-center justify-end gap-1"
                  style={{ left: `${leftPos}px` }}
               >
                  <span className={`font-bold text-shadow-sm ${dir.type === 'major' ? 'text-lg text-white' : 'text-xs text-gray-400'}`}>
                    {dir.label}
                  </span>
                  <div className={`bg-white shadow-[0_0_2px_black] ${dir.type === 'major' ? 'h-3 w-0.5' : 'h-1.5 w-px opacity-80'}`}></div>
               </div>
             );
           })}
           
           {Array.from({ length: 360 / 15 }).map((_, i) => {
              const deg = i * 15;
              if (deg % 45 === 0) return null; 
              
              const offsetDeg = deg + (cycle * 360);
              return (
                 <div 
                   key={`tick-${cycle}-${i}`}
                   className="absolute bottom-2 transform -translate-x-1/2 w-px h-1.5 bg-gray-400 shadow-[0_0_2px_black]"
                   style={{ left: `${offsetDeg * PIXELS_PER_DEG}px` }}
                 />
              )
           })}
         </React.Fragment>
      ))}
    </div>
  );
});

const GameTimer = () => {
  const startTime = useGameStore(state => state.startTime);
  const gameState = useGameStore(state => state.gameState);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [gameState, startTime]);

  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="text-4xl font-bold text-white font-mono drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-widest">
      {timeString}
    </div>
  );
};

const CooldownOverlay = () => {
    const lastScanTime = useGameStore(state => state.lastScanTime);
    const language = useGameStore(state => state.language);
    const [timeLeft, setTimeLeft] = useState(0);
    const [phase, setPhase] = useState<'idle' | 'scanning' | 'cooldown'>('idle');

    const T = TEXT[language].hud;

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - lastScanTime;
            
            if (elapsed < 10000) {
                setPhase('scanning');
                setTimeLeft(Math.ceil((30000 - elapsed) / 1000));
            } else if (elapsed < 30000) {
                setPhase('cooldown');
                setTimeLeft(Math.ceil((30000 - elapsed) / 1000));
            } else {
                setPhase('idle');
                setTimeLeft(0);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [lastScanTime]);

    if (phase === 'idle') return null;

    return (
        <div className="absolute inset-0 pointer-events-none">
             <div className="absolute bottom-24 right-10 flex flex-col items-end">
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">{T.scanner.label}</div>
                <div className={`text-3xl font-bold font-mono ${phase === 'scanning' ? 'text-blue-400' : 'text-gray-500'}`}>
                    {timeLeft}s
                </div>
                <div className="w-32 h-1 bg-gray-800 mt-1 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-200 ${phase === 'scanning' ? 'bg-blue-500' : 'bg-white'}`}
                        style={{ width: `${(timeLeft / 30) * 100}%` }}
                    />
                </div>
             </div>
        </div>
    );
}

const ConsumableProgress = () => {
    const isConsuming = useGameStore(state => state.isConsumingItem && (state.consumingItemType === 'pill_bottle' || state.consumingItemType === 'health_solution'));
    const startTime = useGameStore(state => state.consumeStartTime);
    const duration = useGameStore(state => state.consumeDuration);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!isConsuming || !startTime) {
            setProgress(0);
            return;
        }

        const update = () => {
            const elapsed = Date.now() - startTime;
            setProgress(Math.min(1, Math.max(0, elapsed / duration)));
        };

        update();
        const id = setInterval(update, 50);
        return () => clearInterval(id);
    }, [isConsuming, startTime, duration]);

    if (!isConsuming) return null;

    return (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 h-3 bg-black/60 border border-white/40 rounded-full overflow-hidden pointer-events-none z-[120] shadow-[0_0_10px_rgba(0,0,0,0.65)]">
            <div 
                className="h-full bg-lime-400 transition-[width] duration-75" 
                style={{ width: `${progress * 100}%` }} 
            />
        </div>
    );
};

const ReadingOverlay = () => {
    const readingPaperContent = useGameStore(state => state.readingPaperContent);
    const language = useGameStore(state => state.language);
    
    if (readingPaperContent === null) return null;

    return (
        <div className="absolute inset-0 bg-black z-[500] flex items-center justify-center animate-in fade-in duration-500 pointer-events-none">
            <div className="text-center max-w-2xl p-12 select-none">
                <p className="font-mono text-xl md:text-2xl text-white tracking-widest leading-loose drop-shadow-md whitespace-pre-line">
                    {readingPaperContent}
                </p>
                <div className="mt-16 text-gray-500 text-xs font-mono uppercase tracking-[0.3em]">
                    {TEXT[language].hud.interaction.close}
                </div>
            </div>
        </div>
    );
}

const HUD = () => {
  const { 
    hp, gameState, missionIntel, stamina, hasShard, interactionText, 
    isExhausted, readingPaperContent, language, isInventoryOpen, sanity 
  } = useGameStore();
  const devModeEnabled = useGameStore(state => state.devModeEnabled);
  const showDevOverlays = useGameStore(state => state.showDevOverlays);
  
  const T = TEXT[language].hud;

  if (gameState === 'MENU' || gameState === 'GAME_OVER' || gameState === 'GAME_WON') return null;

  let damageOpacity = 0;
  if (hp <= 20) {
      // Stronger tint near death
      damageOpacity = 0.40; 
  }

  // Mild pink tint when HP is low but above critical
  let softInjuryOpacity = 0;
  if (hp <= 50 && hp > 20) {
      const t = (50 - hp) / 30; // 0..1 from 50 -> 20
      softInjuryOpacity = 0.08 + t * 0.08; // 0.08 -> 0.16 (much softer)
  }

  // Darken view as sanity drops (49 -> 19 -> 0)
  let sanityDarkness = 0;
  if (sanity <= 0) {
      sanityDarkness = 0.30; // softer maximum darkening
  } else if (sanity <= 19) {
      const t = (19 - sanity) / 19; // 0..1
      sanityDarkness = 0.16 + t * 0.14; // 0.16 -> 0.30
  } else if (sanity <= 49) {
      const t = (49 - sanity) / 30; // 0..1
      sanityDarkness = 0.06 + t * 0.10; // 0.06 -> 0.16
  }

  const isReading = readingPaperContent !== null;

  // Map internal interaction keys to localized strings
  let displayedInteraction = interactionText;
  if (interactionText === "Crumpled Paper") displayedInteraction = T.interaction.crumpledPaper;
  else if (interactionText === "Pick up Stick") displayedInteraction = T.interaction.pickupStick;
  else if (interactionText && interactionText.startsWith("Pick up")) displayedInteraction = interactionText.replace("Pick up", T.interaction.pickupItem);
  else if (interactionText === "Pickup Red Shard") displayedInteraction = T.interaction.pickupShard;
  else if (interactionText === "Insert Shard") displayedInteraction = T.interaction.insertShard;
  else if (interactionText === "Locked (Requires Red Shard)") displayedInteraction = T.interaction.locked;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 text-white font-mono tracking-wider">
      
      <ReadingOverlay />

      {!isReading && (
          <>
            {devModeEnabled && showDevOverlays && <CooldownOverlay />}
            <ConsumableProgress />

            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-[400px] h-12 overflow-hidden">
                <div 
                    className="absolute inset-0 z-10"
                    style={{
                        maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)'
                    }}
                >
                    <CompassStrip />
                </div>
            </div>

            {!isInventoryOpen && (
                <div className="flex justify-end items-start mt-16">
                    <GameTimer />
                </div>
            )}

            {/* FIX: Only show interaction prompt if inventory is CLOSED */}
            {displayedInteraction && !isInventoryOpen && (
                <div className="absolute top-[60%] left-1/2 transform -translate-x-1/2 text-center">
                    <div className="flex flex-col items-center animate-bounce">
                        <div className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold mb-1 border-2 border-yellow-500">E</div>
                        <div className="bg-black/70 px-3 py-1 rounded text-yellow-400 font-bold text-sm uppercase tracking-widest">
                            {displayedInteraction}
                        </div>
                    </div>
                </div>
            )}

            <div 
                id="shard-distance" 
                className="absolute bottom-32 left-1/2 transform -translate-x-1/2 text-red-400 font-bold text-lg tracking-widest bg-black/60 px-4 py-1 rounded border border-red-500/50 backdrop-blur opacity-0 transition-opacity"
            >
                {T.scanner.signal}: 0m
            </div>

            {devModeEnabled && showDevOverlays && (
                <div className="flex justify-between items-end w-full">
                    <div className="flex items-center gap-4">
                        <div className="bg-black/60 p-4 rounded-tr-lg border-l-4 border-red-500 backdrop-blur-md min-w-[150px]">
                            <div className="text-xs text-gray-400 uppercase">{T.stats.health}</div>
                            <div className={`text-4xl font-bold ${hp < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                {Math.ceil(hp)}
                            </div>
                        </div>
                        <div className={`bg-black/60 p-4 rounded-tr-lg border-l-4 backdrop-blur-md min-w-[150px] transition-colors ${isExhausted ? 'border-gray-500' : 'border-blue-500'}`}>
                            <div className="text-xs text-gray-400 uppercase">{T.stats.stamina}</div>
                            <div className="relative w-full h-4 bg-gray-700 rounded mt-1 overflow-hidden">
                            <div 
                                className={`absolute top-0 left-0 h-full transition-all duration-200 ${isExhausted ? 'bg-gray-500' : 'bg-blue-500'}`}
                                style={{ width: `${(stamina / PLAYER_MAX_STAMINA) * 100}%` }}
                            />
                            </div>
                            <div className={`text-right text-xs mt-1 ${isExhausted ? 'text-gray-400 animate-pulse' : ''}`}>
                                {Math.floor(stamina)}/{PLAYER_MAX_STAMINA} {isExhausted && T.stats.exhausted}
                            </div>
                        </div>
                        <div className="bg-black/60 p-4 rounded-tr-lg border-l-4 border-purple-500 backdrop-blur-md min-w-[150px]">
                            <div className="text-xs text-gray-400 uppercase">SANITY (DEV)</div>
                            <div className="relative w-full h-4 bg-gray-700 rounded mt-1 overflow-hidden">
                            <div 
                                className={`absolute top-0 left-0 h-full transition-all duration-200 ${
                                    sanity > 60 ? 'bg-purple-500' : sanity > 30 ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'
                                }`}
                                style={{ width: `${sanity}%` }}
                            />
                            </div>
                            <div className="text-right text-xs mt-1">
                                {Math.floor(sanity)}/100
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/30 p-2 rounded text-[10px] text-gray-400 flex flex-col items-end gap-1">
                        <span>{T.controls.dodge}</span>
                        <span>{T.controls.scan}</span>
                    </div>
                </div>
            )}
            
            <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-multiply"
                style={{ 
                    opacity: damageOpacity,
                    backgroundColor: 'rgba(255, 0, 0, 0.6)' // Full-screen red tint for blood loss
                }}
            />
            {softInjuryOpacity > 0 && (
                <div 
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-screen"
                    style={{ 
                        opacity: softInjuryOpacity,
                        backgroundColor: 'rgba(255, 120, 120, 0.45)' // Even lighter red tint for moderate low HP
                    }}
                />
            )}

            {/* Heartbeat pulse overlay when critically low HP */}
            {hp <= 20 && (
                <div 
                    className="absolute inset-0 pointer-events-none z-[56] mix-blend-multiply lowhp-pulse"
                    style={{ backgroundColor: 'rgba(255, 0, 0, 0.45)' }} // Full-screen pulse, stronger tint
                />
            )}

            {/* Double-vision / ghost trail driven by sanity */}
            <div className="absolute inset-0 pointer-events-none z-[57] ghost-trail-container" style={{ opacity: 'var(--ghost-strength, 0)' }}>
                <div className="ghost-trail-layer ghost-trail-left" />
                <div className="ghost-trail-layer ghost-trail-right" />
            </div>

            {/* Sanity darkening overlay */}
            <div 
                className="absolute inset-0 pointer-events-none z-[54] mix-blend-multiply transition-opacity duration-300"
                style={{ backgroundColor: 'black', opacity: sanityDarkness }}
            />
            
            {/* Soft vignette to mimic camera edges and add creepiness */}
            <div 
                className="absolute inset-0 pointer-events-none z-[55] mix-blend-multiply"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 78%, rgba(0,0,0,0.38) 100%)',
                    filter: 'blur(0.5px)'
                }}
            />
            
             {/* Dynamic Noise CSS Animation */}
            <div 
                className="absolute inset-0 pointer-events-none z-[60] mix-blend-hard-light transition-opacity duration-200"
                style={{ 
                    opacity: 'var(--interference-opacity, 0)',
                    backgroundImage: `url('data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="1"/%3E%3C/svg%3E')`,
                    filter: 'contrast(150%) brightness(100%)',
                    animation: 'noiseShift 0.2s steps(4) infinite'
                }}
            />
          </>
      )}
      
      <style>{`
        @keyframes noiseShift {
            0% { background-position: 0 0; transform: scale(1.0); }
            25% { background-position: -5% -5%; transform: scale(1.1); }
            50% { background-position: 5% 5%; transform: scale(0.9); }
            75% { background-position: -5% 5%; transform: scale(1.05); }
            100% { background-position: 0 0; transform: scale(1.0); }
        }

        .lowhp-pulse {
            animation: lowHpPulse 1.2s ease-in-out infinite;
        }
        @keyframes lowHpPulse {
            0% { opacity: 0; }
            45% { opacity: 0.55; }
            100% { opacity: 0; }
        }

        .ghost-trail-container {
            mix-blend-mode: normal;
        }
        .ghost-trail-layer {
            position: absolute;
            inset: 0;
            background: rgba(230,230,255,0.22);
            backdrop-filter: blur(1.2px);
            filter: saturate(120%);
            opacity: 1;
        }
        .ghost-trail-left {
            animation: ghostSplitLeft 1.5s ease-in-out infinite;
        }
        .ghost-trail-right {
            animation: ghostSplitRight 1.5s ease-in-out infinite;
        }
        @keyframes ghostSplitLeft {
            0%   { transform: translateX(calc(var(--ghost-offset, 0px) * -0.3)); }
            50%  { transform: translateX(calc(var(--ghost-offset, 0px) * -1.4)); }
            100% { transform: translateX(calc(var(--ghost-offset, 0px) * -0.3)); }
        }
        @keyframes ghostSplitRight {
            0%   { transform: translateX(calc(var(--ghost-offset, 0px) * 0.3)); }
            50%  { transform: translateX(calc(var(--ghost-offset, 0px) * 1.4)); }
            100% { transform: translateX(calc(var(--ghost-offset, 0px) * 0.3)); }
        }
      `}</style>
    </div>
  );
};

export default HUD;
