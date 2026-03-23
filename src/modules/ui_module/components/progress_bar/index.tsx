export const ProgressBar = ({ current, max, colorClass, label }: { current: number, max: number, colorClass: string, label: string }) => {
  const percent = Math.min(100, Math.max(0, (current / max) * 100));
  return (
    <div className="flex flex-col gap-1 w-full text-sm">
      <div className="flex justify-between text-gray-300">
        <span className="font-semibold">{label}</span>
        <span>{current.toFixed(1)} / {max.toFixed(1)}</span>
      </div>
      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-700">
        <div className={`h-full ${colorClass} transition-all duration-300 ease-in-out`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};
