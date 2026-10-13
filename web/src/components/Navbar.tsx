import React from 'react';
import { Award, Play, Download, Sparkles, Server, BarChart3, ShieldCheck, Cpu } from 'lucide-react';
import { CarbonShiftLogo } from './CarbonShiftLogo';

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
        <CarbonShiftLogo size={42} glow={true} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-brand font-extrabold text-2xl tracking-tight text-white">
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
      <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 text-xs font-semibold backdrop-blur-md">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-300 ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Pitch Deck</span>
        </button>

        <button
          onClick={() => setActiveTab('scheduler')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-300 ${
            activeTab === 'scheduler'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Live Scheduler</span>
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-300 ${
            activeTab === 'telemetry'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Grid Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('kubernetes')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-300 ${
            activeTab === 'kubernetes'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>K8s Pod Gates</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-300 ${
            activeTab === 'audit'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
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
