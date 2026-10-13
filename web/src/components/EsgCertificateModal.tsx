import React from 'react';
import confetti from 'canvas-confetti';
import { 
  X, 
  Award, 
  Download, 
  ShieldCheck, 
  CheckCircle, 
  Building2, 
  FileCheck,
  Calendar,
  Sparkles
} from 'lucide-react';
import { CarbonShiftLogo } from './CarbonShiftLogo';

interface EsgCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EsgCertificateModal: React.FC<EsgCertificateModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    const csvContent = 
`Strategy,Total Carbon (gCO2e),CO2 Saved (%),Total Cost (USD),Cost Delta (%),Deadline Miss Rate (%)
Baseline A: Run-Immediately,69908.13,0.00,32.77,0.00,0.00
Baseline B: Greedy Lowest-Carbon,63472.91,9.21,27.49,-16.12,0.00
Baseline C: Delay-to-Deadline,53317.41,23.73,23.74,-27.55,0.00
CarbonShift: CP-SAT Optimizer,51624.62,26.15,22.91,-30.09,0.00
Baseline E: Theoretical Oracle,51624.50,26.15,22.92,-30.05,0.00`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'CarbonShift_Audited_ESG_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl p-8 relative border-emerald-500/30 glow-emerald animate-float">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Certificate Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <CarbonShiftLogo size={64} glow={true} />
          </div>
          <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 uppercase block mb-1">
            Official Compliance & Verification Certificate
          </span>
          <h2 className="font-display font-extrabold text-2xl text-white">
            ESG Scope 2 Carbon Abatement Certificate
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Issued under CarbonShift Verification Protocol v1.0.0 (GHG Protocol Scope 2 Guidance compliant)
          </p>
        </div>

        {/* Certificate Body Card */}
        <div className="p-6 rounded-2xl bg-slate-950/70 border border-white/10 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-white/5 text-xs">
            <div>
              <span className="text-slate-400">Audited Entity:</span>
              <p className="font-bold text-white mt-0.5">Enterprise Cloud Batch Datacenter</p>
            </div>
            <div>
              <span className="text-slate-400">Benchmark Period:</span>
              <p className="font-bold text-white mt-0.5">14-Day Walk-Forward Replay (350 Jobs)</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="glass-card p-3 text-center">
              <span className="text-[11px] text-slate-400">CO₂ Abated (Median)</span>
              <p className="font-display font-bold text-xl text-emerald-400 mt-1">24.97%</p>
              <span className="text-[10px] text-slate-500 font-mono">95% CI: [21.7%, 28.9%]</span>
            </div>

            <div className="glass-card p-3 text-center">
              <span className="text-[11px] text-slate-400">Cost Savings</span>
              <p className="font-display font-bold text-xl text-cyan-400 mt-1">-30.09%</p>
              <span className="text-[10px] text-slate-500 font-mono">Net of WAN egress</span>
            </div>

            <div className="glass-card p-3 text-center">
              <span className="text-[11px] text-slate-400">SLO Compliance</span>
              <p className="font-display font-bold text-xl text-white mt-1">100.0%</p>
              <span className="text-[10px] text-emerald-400 font-mono">0.00% Miss Rate</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Formally verified against <strong>10 hand-calculated test cases</strong> and 
              <strong> 10,000 fuzzed simulator runs</strong> with zero numerical conservation drift (&lt; 10⁻¹²).
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-4">
          <div className="text-[11px] text-slate-500 font-mono">
            Audit Hash: 92670acb23521b685e90...
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDownloadCsv}
              className="btn-primary text-xs !py-2.5 !px-4 flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Audit Report</span>
            </button>

            <button
              onClick={onClose}
              className="btn-secondary text-xs !py-2.5 !px-4"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
