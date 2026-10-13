import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface TelemetryPoint {
  time: string;
  ukNorth: number;
  euWest: number;
  usEast: number;
}

interface ReplayViewerProps {
  data: TelemetryPoint[];
}

export const ReplayViewer: React.FC<ReplayViewerProps> = ({ data }) => {
  return (
    <div className="glass-panel p-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100">Grid Carbon Intensity Forecast (24h Window)</h3>
          <p className="text-xs text-slate-400">Values in canonical gCO₂e/kWh</p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-400"></span> EU-West</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-cyan-400"></span> UK-North</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-purple-400"></span> US-East</span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorEu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="colorUk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
            <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} domain={[0, 450]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Area type="monotone" dataKey="euWest" stroke="#10b981" fillOpacity={1} fill="url(#colorEu)" name="EU-West" />
            <Area type="monotone" dataKey="ukNorth" stroke="#06b6d4" fillOpacity={1} fill="url(#colorUk)" name="UK-North" />
            <Area type="monotone" dataKey="usEast" stroke="#a855f7" fillOpacity={0} name="US-East" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
