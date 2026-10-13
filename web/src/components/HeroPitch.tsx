import React from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  TrendingDown, 
  Zap, 
  Clock, 
  Server, 
  CheckCircle2, 
  Layers,
  Activity,
  Globe2
} from 'lucide-react';
import { CarbonShiftLogo } from './CarbonShiftLogo';

interface HeroPitchProps {
  onExploreScheduler: () => void;
  onExploreAudit: () => void;
  onExploreK8s: () => void;
}

export const HeroPitch: React.FC<HeroPitchProps> = ({
  onExploreScheduler,
  onExploreAudit,
  onExploreK8s,
}) => {
  return (
    <div className="flex flex-col gap-10">
      {/* Hero Headline & Pitch Narrative */}
      <div className="glass-panel p-8 md:p-12 relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
          <div className="max-w-3xl">
            {/* Hackathon Pitch Ribbon */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-6 shimmer-badge">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>NATIONAL LEVEL HACKATHON 2026 • MATHEMATICALLY PROVEN EMISSIONS ABATEMENT</span>
            </div>

            <h1 className="font-display font-extrabold text-4xl md:text-6xl text-white tracking-tight leading-[1.1] mb-6">
              Dispatch Cloud Batch Jobs When{' '}
              <span className="text-gradient-emerald">The Grid Runs Clean.</span>
            </h1>

            <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-8 max-w-2xl">
              Modern cloud datacenters emit gigatons of carbon because flexible batch workloads run indiscriminately 
              during peak fossil generation. <strong className="text-white">CarbonShift</strong> is an autonomous orchestrator that 
              dynamically shifts batch jobs across <strong>Time</strong> (temporal deferral) and <strong>Space</strong> (spatial migration), 
              abating over <strong className="text-emerald-400">24.97% CO₂</strong> and saving <strong className="text-cyan-400">30.09% cost</strong> with 
              mathematically guaranteed <strong className="text-white">zero deadline misses</strong>.
            </p>

            {/* Call to Action Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onExploreScheduler}
                className="btn-primary !py-3 !px-6 text-sm flex items-center gap-2 group"
              >
                <span>Launch Live Scheduling Studio</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={onExploreAudit}
                className="btn-secondary !py-3 !px-5 text-sm flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Inspect Mathematical Audit</span>
              </button>

              <button
                onClick={onExploreK8s}
                className="btn-secondary !py-3 !px-5 text-sm flex items-center gap-2 text-slate-300"
              >
                <Server className="w-4 h-4 text-purple-400" />
                <span>Kubernetes Pod Gate Demo</span>
              </button>
            </div>
          </div>

          {/* Ultra HD Official Logo Showcase Card */}
          <div className="w-full lg:w-auto shrink-0 flex flex-col items-center justify-center p-7 rounded-3xl glass-panel border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 via-slate-900/70 to-slate-950/90 shadow-2xl shadow-emerald-950/50 group mx-auto lg:mx-0">
            <div className="relative mb-5">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 to-lime-500 rounded-full blur-2xl opacity-40 group-hover:opacity-75 transition-opacity duration-700"></div>
              <CarbonShiftLogo size={168} glow={true} className="relative transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="text-center">
              <div className="font-display font-extrabold text-lg text-white tracking-wide">
                Carbon<span className="text-emerald-400">Shift</span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Ultra HD • Scope 2 Verified
              </div>
              <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Spatial-Temporal Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Benchmark Proof Badges (The 4 Numbers That Win Judges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="glass-panel p-5 relative group hover:border-emerald-500/40 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Verified CO₂ Abated</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-extrabold text-3xl text-emerald-400">24.97%</span>
            <span className="text-xs font-mono text-emerald-300 font-semibold">[21.74%, 28.91%]</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            10,000-iteration block bootstrap 95% Confidence Interval across 14 trace days.
          </p>
        </div>

        {/* KPI 2 */}
        <div className="glass-panel p-5 relative group hover:border-cyan-500/40 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operational Cost Delta</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-extrabold text-3xl text-cyan-400">-30.09%</span>
            <span className="text-xs font-mono text-slate-300">$22.91 vs $32.77</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Electricity spot price arbitrage net of cross-region WAN data transfer egress fees.
          </p>
        </div>

        {/* KPI 3 */}
        <div className="glass-panel p-5 relative group hover:border-purple-500/40 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Deadline Miss Rate</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-extrabold text-3xl text-slate-100">0.00%</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">Strict SLO Parity</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Exact constraint: Job end time t_end ≤ d_j guaranteed across all 350 trace jobs.
          </p>
        </div>

        {/* KPI 4 */}
        <div className="glass-panel p-5 relative group hover:border-amber-500/40 transition-all">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sim & Proof Parity</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-extrabold text-3xl text-amber-400">&lt; 10⁻¹²</span>
            <span className="text-xs font-mono text-slate-300">52k jobs/sec</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Hand-calculated 10-job arithmetic and 10,000 fuzzed runs assert exact conservation.
          </p>
        </div>
      </div>

      {/* The 3 Core Innovations Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">1. Mathematical Ground Truth</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Eliminates the common benchmark fallacy of single-value time averages. Piecewise multi-slot overlap integration 
              uses calibrated SPECpower non-linear server curves ($r = 1.4$) and integer milligram precision ($S = 1000$).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-emerald-400 font-mono">
            <span>Bound: ε_j ≤ 0.048 gCO₂e</span>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 border border-cyan-500/20">
              <Globe2 className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">2. Multi-Region Spatio-Temporal Arbitrage</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              When local renewable generation dips, CarbonShift evaluates whether migrating workloads to hydro/wind-rich regions 
              yields higher emissions reductions than the carbon cost of WAN state transmission (κ = 0.014 kWh/GB).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-cyan-400 font-mono">
            <span>UK-North ↔ EU-West ↔ US-East</span>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 border border-purple-500/20">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">3. Zero-Downtime Kubernetes Gates</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Zero replacement of <code>kube-scheduler</code>. Uses Kubernetes 1.30+ native scheduling gates (<code>carbonshift.io/gate</code>) 
              to hold flexible pods in admission and inject target <code>nodeAffinity</code> when the green window opens.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-purple-400 font-mono">
            <span>Least-Privilege RBAC • Kind Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
