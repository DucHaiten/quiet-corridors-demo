
import React from 'react';
import { useGameStore } from '../store';

const DevConsole = () => {
    const devModeEnabled = useGameStore(state => state.devModeEnabled);
    const isGodMode = useGameStore(state => state.isGodMode);
    const isGhostMode = useGameStore(state => state.isGhostMode);

    // Legacy console removed; we only surface a small status banner while dev mode is on.
    if (!devModeEnabled) return null;

    return (
        <div className="absolute top-0 left-0 w-full p-3 bg-black/70 z-[9999] pointer-events-none">
            <div className="max-w-4xl mx-auto flex gap-3 font-mono text-xs text-green-300">
                <span>Developer mode đang bật (tùy chỉnh trong Cài đặt).</span>
                {isGodMode && <span className="text-[#00ff00]">[Thiên nhãn]</span>}
                {isGhostMode && <span className="text-[#ffff00]">[Bay / xuyên tường]</span>}
                {!isGodMode && !isGhostMode && <span className="text-[#00ff00]">Không có cheat nào đang bật</span>}
            </div>
        </div>
    );
};

export default DevConsole;
