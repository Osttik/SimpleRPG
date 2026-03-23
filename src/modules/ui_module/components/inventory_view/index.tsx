export interface InventoryItem {
  name: string;
  spriteKey: string;
  quantity: number;
  stackable: boolean;
}

interface InventoryViewProps {
  title: string;
  items: InventoryItem[];
  onHover: (index: number | null) => void;
}

export const InventoryView = ({ title, items, onHover }: InventoryViewProps) => {
  return (
    <div className="flex flex-col h-full bg-[#111827E6] backdrop-blur-md border border-slate-600 rounded-xl p-3 shadow-2xl">
      <h3 className="text-xl font-bold text-white mb-3 tracking-wide">{title}</h3>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {items.length === 0 && <div className="text-gray-400 italic text-center py-4">Empty</div>}
        {items.map((item, i) => (
          <div 
            key={i} 
            className="group flex flex-row items-center justify-between bg-slate-800/80 hover:bg-slate-700/80 p-2 rounded-lg cursor-pointer border-2 border-transparent hover:border-slate-400 transition-all duration-150"
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-black/60 rounded border border-slate-600 flex items-center justify-center shadow-inner overflow-hidden">
                 <div style={{
                     backgroundImage: `url('src/assets/chestsAll.png')`,
                     backgroundPosition: `0px 0px`,
                     width: '16px',
                     height: '16px',
                     transform: 'scale(1.8)',
                     imageRendering: 'pixelated'
                 }} />
               </div>
               <div className="flex flex-col">
                  <span className="text-gray-100 font-medium">{item.name}</span>
                  {item.quantity > 1 && <span className="text-xs text-yellow-500 font-bold tracking-wider">x{item.quantity}</span>}
               </div>
            </div>
            <div className="text-xs text-slate-500 group-hover:text-blue-400 font-bold transition-colors">
               Hover + R to Transfer
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
