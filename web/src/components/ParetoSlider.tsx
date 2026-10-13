import React from 'react';

interface ParetoSliderProps {
  alpha: number;
  onChange: (alpha: number) => void;
}

export const ParetoSlider: React.FC<ParetoSliderProps> = ({ alpha, onChange }) => {
  return (
    <div className="glass-panel p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-semibold text-emerald-400">Green Priority (CO₂)</span>
        <span className="font-mono text-xs text-slate-400">α = {alpha.toFixed(2)} | β = {(1 - alpha).toFixed(2)}</span>
        <span className="font-semibold text-amber-400">Cost Priority ($)</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={alpha}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-500 cursor-pointer"
      />
    </div>
  );
};
