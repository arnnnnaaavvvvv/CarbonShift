import React, { useState } from 'react';
import { 
  Server, 
  ShieldCheck, 
  Terminal, 
  Play, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Sparkles,
  Lock,
  Unlock,
  Cpu
} from 'lucide-react';

export const KubernetesGateEngine: React.FC = () => {
  const [podState, setPodState] = useState<'idle' | 'gated' | 'optimizing' | 'admitted'>('idle');
  const [activeStep, setActiveStep] = useState<number>(0);

  const simulatePodLifecycle = () => {
    setPodState('gated');
    setActiveStep(1);

    setTimeout(() => {
      setPodState('optimizing');
      setActiveStep(2);
    }, 1200);

    setTimeout(() => {
      setPodState('admitted');
      setActiveStep(3);
    }, 2800);
  };

  const resetSimulation = () => {
    setPodState('idle');
    setActiveStep(0);
  };

  const sampleYaml = `apiVersion: v1
kind: Pod
metadata:
  name: ml-batch-training-job-042
  namespace: batch-workloads
  annotations:
    carbonshift.io/duration-seconds: "7200"
    carbonshift.io/cpu-cores: "8"
    carbonshift.io/mem-gb: "32"
    carbonshift.io/source-region: "us-east"
  labels:
    carbonshift/flexible: "true"
spec:
  # Injected by CarbonShift Mutating Webhook:
  schedulingGates:
    - name: carbonshift.io/gate
  containers:
    - name: pytorch-training
      image: registry.internal/ai/model:v2
      resources:
        requests:
          cpu: "8"
          memory: "32Gi"`;

  return (
    <div className="flex flex-col gap-8">
      {/* K8s Architecture Header */}
      <div className="glass-panel p-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-status">
                <Server className="w-3.5 h-3.5" />
                Kubernetes 1.30+ Native Scheduling Gate
              </span>
            </div>
            <h2 className="font-display font-extrabold text-2xl text-white">
              Non-Invasive Cloud Orchestration Engine
            </h2>
            <p className="text-sm text-slate-300">
              Zero replacement of <code>kube-scheduler</code>. Uses native scheduling gates and nodeAffinity injection for zero-downtime admission control.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={podState === 'idle' ? simulatePodLifecycle : resetSimulation}
              className="btn-primary text-xs !py-2.5 !px-4 flex items-center gap-2"
            >
              {podState === 'idle' ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Simulate Pod Gate Lifecycle</span>
                </>
              ) : (
                <>
                  <span>Reset Pod Simulator</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Visual Interactive Pod State Flow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Step 1 */}
        <div className={`glass-panel p-5 transition-all ${activeStep >= 0 ? 'border-emerald-500/40' : 'opacity-60'}`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-mono text-emerald-400 font-bold">STAGE 01</span>
            <div className="p-1 rounded bg-slate-800 text-slate-300">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <h4 className="font-display font-bold text-base text-white mb-1">Pod Submission</h4>
          <p className="text-xs text-slate-400">
            Developer deploys pod labeled <code>carbonshift/flexible: "true"</code>. Mutating webhook injects gate.
          </p>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-slate-300">
            Status: <span className="text-emerald-400 font-bold">READY</span>
          </div>
        </div>

        {/* Step 2 */}
        <div className={`glass-panel p-5 transition-all ${activeStep >= 1 ? 'border-amber-500/40 glow-amber' : 'opacity-60'}`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-mono text-amber-400 font-bold">STAGE 02</span>
            <div className="p-1 rounded bg-amber-500/10 text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <h4 className="font-display font-bold text-base text-white mb-1">Gate Locked</h4>
          <p className="text-xs text-slate-400">
            <code>carbonshift.io/gate</code> holds pod in admission. <code>kube-scheduler</code> completely skips node binding.
          </p>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-slate-300">
            Gate: {activeStep >= 1 ? <span className="text-amber-400 font-bold">LOCKED</span> : 'Pending'}
          </div>
        </div>

        {/* Step 3 */}
        <div className={`glass-panel p-5 transition-all ${activeStep >= 2 ? 'border-purple-500/40 glow-purple' : 'opacity-60'}`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-mono text-purple-400 font-bold">STAGE 03</span>
            <div className="p-1 rounded bg-purple-500/10 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <h4 className="font-display font-bold text-base text-white mb-1">CP-SAT Optimizing</h4>
          <p className="text-xs text-slate-400">
            Controller queries solver. Identifies green window at 14:00 UTC in region <code>eu-west</code> (wind surplus).
          </p>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-slate-300">
            Window: {activeStep >= 2 ? <span className="text-purple-400 font-bold">RESERVED (Slot 14)</span> : 'Pending'}
          </div>
        </div>

        {/* Step 4 */}
        <div className={`glass-panel p-5 transition-all ${activeStep >= 3 ? 'border-emerald-500/50 glow-emerald' : 'opacity-60'}`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-mono text-emerald-400 font-bold">STAGE 04</span>
            <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
              <Unlock className="w-4 h-4" />
            </div>
          </div>
          <h4 className="font-display font-bold text-base text-white mb-1">Admitted & Running</h4>
          <p className="text-xs text-slate-400">
            Gate removed! Node affinity injected for target region. Default scheduler assigns pod immediately.
          </p>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-slate-300">
            Result: {activeStep >= 3 ? <span className="text-emerald-400 font-bold">RUNNING (Zero Miss)</span> : 'Pending'}
          </div>
        </div>
      </div>

      {/* Technical YAML Specification & RBAC Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kubernetes Pod Manifest Viewer */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Kubernetes Workload Manifest (Declarative SLO)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">pod-spec.yaml</span>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-white/5 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            <code>{sampleYaml}</code>
          </pre>
        </div>

        {/* Security & RBAC Least-Privilege Card */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Enterprise Security & RBAC Least-Privilege</span>
              </h3>
              <span className="badge-status">
                <span>Audit Verified</span>
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              CarbonShift was audited against Kubernetes CIS benchmarks. Unlike aggressive orchestrators, 
              the controller requires <strong>zero cluster-admin privileges</strong> and contains <strong>no wildcard permissions</strong>:
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Pods:</strong> <code>get, list, watch, update, patch</code> only for managing gates and affinity.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Nodes:</strong> <code>get, list, watch</code> read-only capacity inspection.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>API Keys:</strong> SHA-256 Bearer tokens with optional mTLS for external telemetry synchronization.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Docker Image:</strong> Multi-stage build running under unprivileged system user (UID 10001).</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-xs font-mono text-slate-400">
            <span>Kind Cluster Tested: v1.30.0</span>
            <span className="text-emerald-400">Status: PASS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
