import React from 'react';

export interface DecisionCardProps {
  jobId: string;
  jobName: string;
  sourceRegion: string;
  selectedRegion: string;
  scheduledSlotTime: string;
  delayHours: number;
  carbonSavedGrams: number;
  costDeltaUsd: number;
  factors: string[];
}

export const WhyThisSlot: React.FC<DecisionCardProps> = ({
  jobId,
  jobName,
  sourceRegion,
  selectedRegion,
  scheduledSlotTime,
  delayHours,
  carbonSavedGrams,
  costDeltaUsd,
  factors,
}) => {
  return (
    <div className="glass-panel p-5 glow-emerald">
      <div className="flex justify-between items-start mb-3 border-b border-slate-700/50 pb-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">Decision Explainability</span>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            {jobName} <span className="text-xs text-slate-400 font-mono">({jobId.slice(0, 8)})</span>
          </h3>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400">Scheduled Dispatch</span>
          <p className="font-mono text-sm text-emerald-300 font-medium">{scheduledSlotTime}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="glass-card p-3">
          <span className="text-xs text-slate-400">CO₂ Abated</span>
          <p className="text-lg font-bold text-emerald-400">+{carbonSavedGrams.toFixed(1)} g</p>
        </div>
        <div className="glass-card p-3">
          <span className="text-xs text-slate-400">Temporal Deferral</span>
          <p className="text-lg font-bold text-blue-400">+{delayHours.toFixed(1)} hrs</p>
        </div>
        <div className="glass-card p-3">
          <span className="text-xs text-slate-400">Spatial Shift</span>
          <p className="text-lg font-bold text-purple-400">
            {sourceRegion} → {selectedRegion}
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Optimizer Rationale:</h4>
        <ul className="space-y-1.5 text-sm text-slate-300">
          {factors.map((factor, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              {factor}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
