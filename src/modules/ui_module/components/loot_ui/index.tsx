import { useEffect, useState } from 'react';
import { gameState } from '../../../game_module/game_state';
import { InventoryView } from '../inventory_view';
import { ProgressBar } from '../progress_bar';
import { keyboardService } from '../../../../services/keyboard.service';

export const LootUI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chestInv, setChestInv] = useState<any[]>([]);
  const [playerInv, setPlayerInv] = useState<any[]>([]);
  
  const [hoveredIndex, setHoveredIndex] = useState<{ index: number, isPlayer: boolean } | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setIsOpen(!!gameState.lootingTargetId);
      setChestInv([...(gameState.chestInventory || [])]);
      setPlayerInv([...(gameState.playerInventory || [])]);
    };
    
    window.addEventListener('gameStateUpdate', handleUpdate);
    
    const sub = keyboardService.subscribeToKey(['r', 'R'], () => {
      if (gameState.lootingTargetId && hoveredIndex !== null && gameState.socketWorker) {
          gameState.socketWorker.postMessage({
             type: 'transfer_item',
             targetId: gameState.lootingTargetId,
             fromContainer: hoveredIndex.isPlayer ? 0 : 1,
             toContainer: hoveredIndex.isPlayer ? 1 : 0,
             itemIndex: hoveredIndex.index
          });
      }
    }, () => {});

    return () => {
      window.removeEventListener('gameStateUpdate', handleUpdate);
      sub.forEach(e => e.dispose());
    };
  }, [hoveredIndex]);

  if (!isOpen) return null;

  let pVol = 0, pWeight = 0;
  playerInv.forEach(item => { 
      pVol += (item.volume || 1) * item.quantity; 
      pWeight += (item.weight || 1) * item.quantity; 
  });
  
  return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm pointer-events-auto">
         <div className="flex w-full max-w-6xl h-[80vh] gap-6">
            <div className="w-1/3 h-full">
               <InventoryView 
                  title="Player Backpack" 
                  items={playerInv} 
                  onHover={(idx) => setHoveredIndex(idx !== null ? { index: idx, isPlayer: true } : null)} 
               />
            </div>
            <div className="w-1/3 flex flex-col justify-center gap-4 bg-[#111827E6] p-6 rounded-xl border border-slate-600 shadow-2xl backdrop-blur-md">
               <h2 className="text-3xl font-bold text-center text-white mb-6 uppercase tracking-wider">Transfer Stats</h2>
               <ProgressBar label="Backpack Volume" current={pVol} max={100} colorClass="bg-green-500" />
               <ProgressBar label="Backpack Weight" current={pWeight} max={50} colorClass="bg-blue-500" />
            </div>
            <div className="w-1/3 h-full">
               <InventoryView 
                  title="Chest Loot" 
                  items={chestInv} 
                  onHover={(idx) => setHoveredIndex(idx !== null ? { index: idx, isPlayer: false } : null)} 
               />
            </div>
         </div>
         <button 
           className="absolute top-8 right-8 text-white text-4xl font-bold hover:text-red-400 transition-colors"
           onClick={() => { gameState.lootingTargetId = null; window.dispatchEvent(new Event('gameStateUpdate')); }}
         >
           ✕
         </button>
      </div>
  );
};
