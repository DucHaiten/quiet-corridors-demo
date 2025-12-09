
import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store';
import { InventoryItem, ItemCategory } from '../types';
import { soundManager } from './SoundManager';
import { TEXT } from '../localization';

const Inventory = () => {
    const isInventoryOpen = useGameStore(state => state.isInventoryOpen);
    const inventory = useGameStore(state => state.inventory);
    const selectedItemState = useGameStore(state => state.previewItem);
    const setPreviewItem = useGameStore(state => state.setPreviewItem);
    const dropItem = useGameStore(state => state.dropItem);
    const useItem = useGameStore(state => state.useItem);
    const unequipItem = useGameStore(state => state.unequipItem);
    const language = useGameStore(state => state.language);
    const sanity = useGameStore(state => state.sanity);
    
    // Dual Wield
    const leftHandItem = useGameStore(state => state.leftHandItem);
    const rightHandItem = useGameStore(state => state.rightHandItem);
    
    // Derive the live preview item from the inventory list to ensure fresh data (Durability)
    const previewItem = useMemo(() => {
        if (!selectedItemState) return null;
        return inventory.find(i => i.id === selectedItemState.id) || selectedItemState;
    }, [inventory, selectedItemState]);
    
    const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'ALL'>('ALL');

    // Initial select
    React.useEffect(() => {
        if (isInventoryOpen && !selectedItemState && inventory.length > 0) {
            setPreviewItem(inventory[0]);
        }
    }, [isInventoryOpen, inventory]);

    // Reset category to ALL when opening inventory to avoid confusion
    React.useEffect(() => {
        if (isInventoryOpen) {
            setSelectedCategory('ALL');
        }
    }, [isInventoryOpen]);

    const T = TEXT[language].inventory;

    const categories: { id: ItemCategory | 'ALL', label: string }[] = [
        { id: 'ALL', label: T.all },
        { id: 'WEAPON', label: T.weapons },
        { id: 'CONSUMABLE', label: T.consumables },
        { id: 'MISC', label: T.misc },
        { id: 'KEY_ITEM', label: T.key }
    ];

    // Filter Logic: Explicitly handle filtering
    const filteredItems = useMemo(() => {
        if (selectedCategory === 'ALL') {
            return inventory;
        }
        return inventory.filter(i => i.category === selectedCategory);
    }, [inventory, selectedCategory]);
    
    // Hard limit visual for immersion
    const MAX_CAPACITY = 7; 

    const handleDrop = (itemId: string) => {
        soundManager.playUIClick();
        dropItem(itemId);
    };

    const handleUse = (itemId: string) => {
        soundManager.playUIClick();
        useItem(itemId);
    };

    const handleUnequip = (itemId: string) => {
        soundManager.playUIClick();
        unequipItem(itemId);
    };

    if (!isInventoryOpen) return null;

    // Determine if the currently previewed item is equipped in any hand
    const isEquipped = previewItem && ((leftHandItem?.id === previewItem.id) || (rightHandItem?.id === previewItem.id));

    // Calculate sanity status (1-6, where 1 is highest sanity, 6 is broken)
    const getSanityStatus = () => {
        if (sanity <= 0) return 6;
        if (sanity > 80) return 1;
        if (sanity > 60) return 2;
        if (sanity > 40) return 3;
        if (sanity > 20) return 4;
        return 5;
    };

    return (
        <div className="absolute inset-0 z-[300] flex font-serif bg-transparent pointer-events-none animate-in fade-in duration-300">
            {/* LEFT COLUMN: NAVIGATION & LIST - Pointer Events Auto to interact */}
            <div className="w-1/3 h-full flex flex-col p-12 bg-gradient-to-r from-black/95 to-black/80 border-r border-white/10 pointer-events-auto backdrop-blur-md">
                <h1 className="text-4xl text-[#d6d3d1] mb-8 tracking-[0.2em] uppercase border-b border-[#7f1d1d] pb-4">
                    {T.title}
                </h1>

                {/* Categories */}
                <div className="flex gap-4 mb-8 overflow-x-auto text-xs scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => {
                                soundManager.playUIHover();
                                setSelectedCategory(cat.id);
                            }}
                            className={`
                                uppercase tracking-widest pb-1 transition-all whitespace-nowrap
                                ${selectedCategory === cat.id 
                                    ? 'text-white border-b-2 border-white' 
                                    : 'text-[#78716c] hover:text-[#d6d3d1]'}
                            `}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Item List */}
                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="text-[#57534e] italic mt-12 tracking-wider">{T.empty}</div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {filteredItems.map(item => {
                                const isLeft = leftHandItem?.id === item.id;
                                const isRight = rightHandItem?.id === item.id;
                                const isEquippedInList = isLeft || isRight;

                                return (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => {
                                                soundManager.playUIHover();
                                                setPreviewItem(item);
                                            }}
                                            className={`
                                                w-full text-left py-3 px-4 transition-all duration-200 uppercase tracking-widest text-sm flex justify-between items-center
                                                ${previewItem?.id === item.id 
                                                    ? 'bg-gradient-to-r from-[#7f1d1d]/40 to-transparent text-white border-l-2 border-[#7f1d1d]' 
                                                    : 'text-[#a8a29e] hover:bg-white/5'}
                                            `}
                                        >
                                            <span>{item.name}</span>
                                            {isEquippedInList && (
                                                <span className={`text-[10px] ml-2 font-bold ${isLeft ? 'text-blue-400' : 'text-red-500'}`}>
                                                    {T.equipped} {isLeft && isRight && '(2H)'}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                
                {/* Updated Footer: Capacity logic */}
                <div className="mt-8 pt-4 border-t border-white/10 flex justify-between text-[#78716c] text-xs font-mono">
                    <span>{T.capacity}: {inventory.length} / {MAX_CAPACITY}</span>
                </div>
                
                <div className="mt-2 text-center text-[#57534e] text-[10px] uppercase tracking-[0.3em]">
                    {T.close}
                </div>
            </div>

            {/* RIGHT COLUMN: PREVIEW & DETAILS - Pointer events None to allow 3D OrbitControls */}
            <div className="flex-1 h-full relative pointer-events-none">
                
                {/* Sanity Status Icon - Top Right */}
                <div className="absolute top-8 right-24 pointer-events-none flex flex-col items-center">
                    <img 
                        src={`/images/sanity_status_${getSanityStatus()}.png`} 
                        alt="Sanity Status"
                        className="w-64 h-auto object-contain drop-shadow-[0_0_12px_rgba(255,0,0,0.5)]"
                        style={{ imageRendering: 'auto' }}
                    />
                    <div className="text-center text-white text-xl font-mono mt-3 tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {Math.floor(sanity)}/100
                    </div>
                </div>

                {/* 3D Preview is handled by InventoryScene in Game.tsx */}

                {/* Item Details Overlay - Pointer events auto if needed for selection, but usually passive */}
                {previewItem && (
                    <div className="absolute bottom-24 right-12 w-96 p-6 bg-black/60 backdrop-blur-sm border-t border-[#7f1d1d] pointer-events-auto">
                        <h2 className="text-3xl text-white mb-2 font-serif tracking-wider uppercase">
                            {previewItem.name}
                        </h2>
                        <div className="w-12 h-1 bg-[#7f1d1d] mb-4"></div>
                        
                        <p className="text-[#d6d3d1] font-serif leading-relaxed text-sm mb-6">
                            {previewItem.description}
                        </p>

                        <div className="grid grid-cols-2 gap-4 text-xs font-mono text-[#a8a29e] border-t border-white/10 pt-4 mb-6">
                            <div>
                                <span className="block text-[#57534e] mb-1">{T.type}</span>
                                {previewItem.category}
                            </div>
                            <div>
                                <span className="block text-[#57534e] mb-1">{T.durability}</span>
                                {previewItem.maxDurability ? (
                                    <span className={previewItem.durability !== undefined && previewItem.durability < 5 ? "text-red-500 animate-pulse" : "text-[#d6d3d1]"}>
                                        {previewItem.durability} / {previewItem.maxDurability}
                                    </span>
                                ) : (
                                    <span className="text-[#a8a29e]">{T.permanent}</span>
                                )}
                            </div>
                            {previewItem.effect && (
                                <div className="col-span-2 text-[#fbbf24]">
                                    <span className="block text-[#57534e] mb-1">{T.effect}</span>
                                    {previewItem.effect}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <button 
                                onClick={() => isEquipped ? handleUnequip(previewItem.id) : handleUse(previewItem.id)}
                                className={`flex-1 py-3 text-[#a8a29e] hover:text-white uppercase tracking-widest border border-transparent hover:border-[#7f1d1d] transition-all
                                    ${isEquipped ? 'bg-[#7f1d1d]/20 hover:bg-[#7f1d1d]/40' : 'bg-[#1c1917] hover:bg-[#292524]'}
                                `}
                            >
                                {isEquipped ? T.unequip : T.use}
                            </button>
                            <button 
                                onClick={() => handleDrop(previewItem.id)}
                                className="flex-1 py-3 bg-transparent hover:bg-[#1c1917] text-[#57534e] hover:text-[#7f1d1d] uppercase tracking-widest border border-[#292524] hover:border-[#7f1d1d] transition-all"
                            >
                                {T.drop}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inventory;
