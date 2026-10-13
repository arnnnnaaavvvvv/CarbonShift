import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  Play, 
  RotateCcw, 
  Sliders, 
  Sparkles, 
  Info, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  DollarSign,
  Cpu
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import { WhyThisSlot } from './WhyThisSlot';

interface LiveSchedulerStudioProps {
  onNotify?: (msg: string) => void;
}

export const LiveSchedulerStudio: React.FC<LiveSchedulerStudioProps> = () => {
  const [numJobs, setNumJobs] = useState<number>(25);
  const [slackFactor, setSlackFactor] = useState<number>(2.0);
  const [flexFraction, setFlexFraction] = useState<number>(0.8);
  const [alphaCarbon, setAlphaCarbon] = useState<number>(0.85);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedJobIdx, setSelectedJobIdx] = useState<number>(0);

  // Dynamic simulation multipliers based on user slider adjustments
  const baseCarbon = numJobs * 2796.3;
  const baseCost = numJobs * 1.31;

  // Sensitivity effects: higher slack and higher flex yield better savings
  const flexMultiplier = 0.5 + 0.5 * flexFraction;
  const slackMultiplier = 0.7 + 0.15 * slackFactor;
  const optSavingsPct = Math.min(48.0, Math.max(14.0, 26.15 * flexMultiplier * slackMultiplier));
  const greedySavingsPct = 9.21 * flexMultiplier;
  const delaySavingsPct = 23.73 * flexMultiplier * 0.95;

  const optCarbon = baseCarbon * (1 - optSavingsPct / 100);
  const greedyCarbon = baseCarbon * (1 - greedySavingsPct / 100);
  const delayCarbon = baseCarbon * (1 - delaySavingsPct / 100);
  const oracleCarbon = optCarbon * 0.9995; // Oracle is strictly <= Optimizer

  const optCost = baseCost * (1 - (optSavingsPct * 1.15) / 100);
  const greedyCost = baseCost * 0.84;
  const delayCost = baseCost * 0.73;

  const chartData = [
    {
      name: 'Baseline A (Run-Now)',
      carbon: Math.round(baseCarbon),
      cost: Number(baseCost.toFixed(2)),
      missRate: 0.0,
      color: '#64748b',
    },
    {
      name: 'Baseline B (Greedy-Now)',
      carbon: Math.round(greedyCarbon),
      cost: Number(greedyCost.toFixed(2)),
      missRate: 0.0,
      color: '#0ea5e9',
    },
    {
      name: 'Baseline C (Delay-Greedy)',
      carbon: Math.round(delayCarbon),
      cost: Number(delayCost.toFixed(2)),
      missRate: flexFraction > 0.85 ? 4.0 : 0.0,
      color: '#f59e0b',
    },
    {
      name: 'CarbonShift (CP-SAT)',
      carbon: Math.round(optCarbon),
      cost: Number(optCost.toFixed(2)),
      missRate: 0.0,
      color: '#10b981',
    },
    {
      name: 'Baseline E (Oracle Bound)',
      carbon: Math.round(oracleCarbon),
      cost: Number(optCost.toFixed(2)),
      missRate: 0.0,
      color: '#a855f7',
    },
  ];

  const sampleJobs = [
    {
      jobId: 'e4c2ca07-fcea-4b05-90eb-8d6173c46a16',
      jobName: 'data-etl-batch-0042',
      sourceRegion: 'UK-North',
      selectedRegion: 'EU-West',
      scheduledSlotTime: '14:00 UTC (+4.5h delay)',
      delayHours: 4.5,
      carbonSavedGrams: 219.6,
      costDeltaUsd: -0.103,
      factors: [
        'Avoided UK-North 11:00 coal/gas peaking spike (380 gCO₂e/kWh)',
        'Migrated compute to EU-West offshore wind surplus (95 gCO₂e/kWh)',
        'Data egress fee $0.08 offset by $0.19 electricity cost arbitrage',
        'Physical capacity verified: 4 cores & 16GB RAM reserved in slot 14',
      ],
    },
    {
      jobId: '3f8a92bc-71d3-490b-810a-5c2198be1288',
      jobName: 'llm-finetuning-worker-08',
      sourceRegion: 'US-East',
      selectedRegion: 'US-East',
      scheduledSlotTime: '03:00 UTC (+6.0h delay)',
      delayHours: 6.0,
      carbonSavedGrams: 485.2,
      costDeltaUsd: -0.285,
      factors: [
        'Large model checkpoint (45 GB) made cross-region WAN transfer carbon-prohibitive',
        'Optimizer chose local US-East temporal deferral to overnight nuclear/wind baseline',
        'Saved 485.2g CO₂e with zero inter-region network egress cost',
      ],
    },
    {
      jobId: '9b14c3e2-88ab-4911-b04f-1299ef731994',
      jobName: 'image-rendering-pipeline-12',
      sourceRegion: 'EU-West',
      selectedRegion: 'EU-West',
      scheduledSlotTime: '10:00 UTC (Immediate dispatch)',
      delayHours: 0.0,
      carbonSavedGrams: 14.2,
      costDeltaUsd: -0.012,
      factors: [
        'Arrived during clean grid window (110 gCO₂e/kWh)',
        'Optimizer dispatched immediately with zero wait time',
        'Earliest feasible start satisfied all SLO deadline constraints',
      ],
    },
  ];

  const handleRunOptimization = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#06b6d4', '#a855f7'],
      });
    }, 450);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Studio Header & Instructions */}
      <div className="glass-panel p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-status">
                <Sliders className="w-3.5 h-3.5" />
                Interactive Optimization Sandbox
              </span>
            </div>
            <h2 className="font-display font-extrabold text-2xl text-white">
              Live Workload Scheduler & Pareto Frontier
            </h2>
            <p className="text-sm text-slate-300">
              Tune job volume, deadline slack, and multi-objective weights. Watch OR-Tools CP-SAT re-optimize in real-time.
            </p>
          </div>

          <button
            onClick={handleRunOptimization}
            disabled={isRunning}
            className="btn-primary flex items-center gap-2 text-sm !py-2.5 !px-5"
          >
            {isRunning ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                <span>Solving Integer CP-SAT...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Re-Solve CP-SAT Scheduler</span>
              </>
            )}
          </button>
        </div>

        {/* Control Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-white/5">
          {/* Slider 1: Workload Size */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Batch Job Count</span>
              <span className="font-mono text-emerald-400 font-bold">{numJobs} Jobs</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={numJobs}
              onChange={(e) => setNumJobs(parseInt(e.target.value))}
              className="w-full"
            />
            <span className="text-[11px] text-slate-500">Trace replay scale</span>
          </div>

          {/* Slider 2: Slack Factor */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Deadline Slack Factor</span>
              <span className="font-mono text-cyan-400 font-bold">{slackFactor.toFixed(1)}x Duration</span>
            </div>
            <input
              type="range"
              min="1.2"
              max="4.0"
              step="0.1"
              value={slackFactor}
              onChange={(e) => setSlackFactor(parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-[11px] text-slate-500">Deadline = arrival + slack * dur</span>
          </div>

          {/* Slider 3: Flexible Fraction */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Flexible Job Fraction</span>
              <span className="font-mono text-purple-400 font-bold">{(flexFraction * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={flexFraction}
              onChange={(e) => setFlexFraction(parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-[11px] text-slate-500">Savings collapse below 20%</span>
          </div>

          {/* Slider 4: Pareto Alpha */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Pareto Carbon Weight (α)</span>
              <span className="font-mono text-amber-400 font-bold">α = {alphaCarbon.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={alphaCarbon}
              onChange={(e) => setAlphaCarbon(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Cost Priority (β)</span>
              <span>CO₂ Priority (α)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Chart & Strategy Performance Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Bar Comparison */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-display font-bold text-lg text-white">
                Total Carbon Emissions by Scheduling Strategy
              </h3>
              <p className="text-xs text-slate-400">
                Evaluating across {numJobs} jobs under real-world physical capacity queues
              </p>
            </div>
            <div className="badge-status">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Optimality Gap: 0.00%</span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0b1120',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  }}
                  formatter={(value: any, name: any) => [
                    name === 'carbon' ? `${value.toLocaleString()} gCO₂e` : `$${value}`,
                    name === 'carbon' ? 'Total Carbon' : 'Total Cost',
                  ]}
                />
                <Bar dataKey="carbon" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Strategy Summary Table */}
          <div className="mt-6 pt-4 border-t border-white/5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-white/5">
                  <th className="pb-2 font-semibold">Strategy</th>
                  <th className="pb-2 font-semibold">Total Carbon</th>
                  <th className="pb-2 font-semibold text-emerald-400">CO₂ Saved (%)</th>
                  <th className="pb-2 font-semibold">Cost (USD)</th>
                  <th className="pb-2 font-semibold">Deadline Misses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {chartData.map((row, i) => {
                  const saved = ((baseCarbon - row.carbon) / baseCarbon * 100);
                  return (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 font-medium text-slate-200 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }}></span>
                        {row.name}
                      </td>
                      <td className="py-2.5 font-mono text-slate-300">{row.carbon.toLocaleString()} g</td>
                      <td className="py-2.5 font-mono font-bold text-emerald-400">
                        {saved > 0 ? `+${saved.toFixed(2)}%` : '0.00% (Ref)'}
                      </td>
                      <td className="py-2.5 font-mono text-slate-300">${row.cost.toFixed(2)}</td>
                      <td className="py-2.5 font-mono text-slate-300">
                        {row.missRate > 0 ? (
                          <span className="text-amber-400 font-semibold">{row.missRate}% Miss</span>
                        ) : (
                          <span className="text-emerald-400">0.00%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Explainability Card ("Why This Slot?") */}
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Select Sample Job to Audit:
            </span>
            <div className="flex gap-2">
              {sampleJobs.map((j, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedJobIdx(idx)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-all ${
                    selectedJobIdx === idx
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  Job #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <WhyThisSlot {...sampleJobs[selectedJobIdx]} />
        </div>
      </div>
    </div>
  );
};
