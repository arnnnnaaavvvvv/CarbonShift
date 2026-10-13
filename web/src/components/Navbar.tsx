import React from 'react';
import { Leaf, Award, Play, Download, Sparkles, Server, BarChart3, ShieldCheck, Cpu } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRunBenchmark: () => void;
  onOpenCertificate: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onRunBenchmark,
  onOpenCertificate,
}) => {
  return (
    <nav className="glass-panel sticky top-4 z-50 px-6 py-3.5 mb-8 flex flex-wrap justify-between items-center gap-4">
      {/* Brand Identity */}
      <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveTab('overview')}>
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 border border-emerald-300/40">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-extrabold text-xl tracking-tight text-white">
              Carbon<span className="text-emerald-400">Shift</span>
            </span>
            <span className="badge-status">
              <span className="badge-pulse-dot"></span>
              Verified 24.97% CO₂ Saved
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Autonomous Cloud Workload Decarbonizer
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-white/5 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === 'overview'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Pitch Deck</span>
        </button>

        <button
          onClick={() => setActiveTab('scheduler')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === 'scheduler'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Live Scheduler</span>
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === 'telemetry'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Grid Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('kubernetes')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === 'kubernetes'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>K8s Pod Gates</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === 'audit'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Math Audit</span>
        </button>
      </div>

      {/* Quick Action CTAs */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onRunBenchmark}
          className="btn-primary text-xs !py-2 !px-3.5"
          title="Run 14-day deterministic trace replay"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Run Benchmark</span>
        </button>

        <button
          onClick={onOpenCertificate}
          className="btn-secondary text-xs !py-2 !px-3.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>ESG Certificate</span>
        </button>
      </div>
    </nav>
  );
};
