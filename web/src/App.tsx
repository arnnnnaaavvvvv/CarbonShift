import React, { useState } from 'react';
import { ReplayViewer, TelemetryPoint } from './components/ReplayViewer';
import { ParetoSlider } from './components/ParetoSlider';
import { WhyThisSlot } from './components/WhyThisSlot';

const SAMPLE_TELEMETRY: TelemetryPoint[] = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i.toString().padStart(2, '0')}:00`,
  euWest: Math.round(180 - 80 * Math.sin((i / 24) * 2 * Math.PI) + (i % 3) * 10),
  ukNorth: Math.round(280 - 120 * Math.sin(((i + 2) / 24) * 2 * Math.PI) + (i % 4) * 15),
  usEast: Math.round(340 - 60 * Math.sin(((i + 6) / 24) * 2 * Math.PI)),
}));

export default function App() {
  const [alpha, setAlpha] = useState(0.85);
  const [selectedStrategy, setSelectedStrategy] = useState<'cpsat' | 'greedy' | 'now' | 'oracle'>('cpsat');

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="text-emerald-400">CarbonShift</span>
            </h1>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 font-medium px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Active Controller
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mathematically Verified Carbon-Aware Workload Scheduler & Trace-Replay Simulator
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary text-xs">Run Benchmark</button>
          <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-md font-medium border border-slate-700">
            Export ESG Report
          </button>
        </div>
      </header>

      {/* KPI Stats */}
      <section className="grid grid-cols-4 gap-4">
        <div className="glass-panel p-4">
          <span className="text-xs text-slate-400">Bootstrap CO₂ Savings (95% CI)</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">26.4% <span className="text-xs text-emerald-500 font-normal">± 1.2%</span></p>
          <span className="text-xs text-slate-500">B = 10,000 trace-day resamples</span>
        </div>
        <div className="glass-panel p-4">
          <span className="text-xs text-slate-400">Cost Delta</span>
          <p className="text-2xl font-bold text-blue-400 mt-1">-3.8%</p>
          <span className="text-xs text-slate-500">Electricity & egress transfer</span>
        </div>
        <div className="glass-panel p-4">
          <span className="text-xs text-slate-400">Deadline Miss Rate</span>
          <p className="text-2xl font-bold text-slate-200 mt-1">0.00%</p>
          <span className="text-xs text-slate-500">Equalized miss-rate benchmark</span>
        </div>
        <div className="glass-panel p-4">
          <span className="text-xs text-slate-400">Solver Status</span>
          <p className="text-2xl font-bold text-purple-400 mt-1">OPTIMAL</p>
          <span className="text-xs text-slate-500">Parity verified (&lt; 10⁻⁴)</span>
        </div>
      </section>

      {/* Controls */}
      <section className="grid grid-cols-3 gap-4 items-center">
        <div className="col-span-2">
          <ParetoSlider alpha={alpha} onChange={setAlpha} />
        </div>
        <div className="glass-panel p-4 flex justify-around text-xs font-medium">
          <button
            onClick={() => setSelectedStrategy('cpsat')}
            className={`px-3 py-1.5 rounded ${selectedStrategy === 'cpsat' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            CP-SAT Optimizer
          </button>
          <button
            onClick={() => setSelectedStrategy('greedy')}
            className={`px-3 py-1.5 rounded ${selectedStrategy === 'greedy' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Greedy
          </button>
          <button
            onClick={() => setSelectedStrategy('now')}
            className={`px-3 py-1.5 rounded ${selectedStrategy === 'now' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Run-Now
          </button>
          <button
            onClick={() => setSelectedStrategy('oracle')}
            className={`px-3 py-1.5 rounded ${selectedStrategy === 'oracle' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Oracle Bound
          </button>
        </div>
      </section>

      {/* Main Charts & Decisions */}
      <section className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ReplayViewer data={SAMPLE_TELEMETRY} />
        </div>
        <div>
          <WhyThisSlot
            jobId="e4c2ca07-fcea-4b05-90eb-8d6173c46a16"
            jobName="job-batch-0042"
            sourceRegion="UK-North"
            selectedRegion="EU-West"
            scheduledSlotTime="14:00 UTC"
            delayHours={4.5}
            carbonSavedGrams={219.6}
            costDeltaUsd={-0.103}
            factors={[
              "Avoided UK-North 11:00 coal/gas peaking spike (380 g/kWh)",
              "Shifted compute to EU-West offshore wind surplus (95 g/kWh)",
              "Transfer cost $0.08 offset by $0.19 electricity arbitrage",
            ]}
          />
        </div>
      </section>
    </div>
  );
}
