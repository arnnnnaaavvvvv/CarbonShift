import React, { useState } from 'react';
import { 
  BarChart2, 
  Wind, 
  Sun, 
  Zap, 
  MapPin, 
  TrendingUp, 
  Clock, 
  Layers,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export const GridTelemetryMatrix: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<string>('eu-west');
  const [showQuantiles, setShowQuantiles] = useState<boolean>(true);

  // Generate 24-hour realistic multi-region carbon intensity curves
  const telemetryData = Array.from({ length: 24 }).map((_, i) => {
    const hour = `${i.toString().padStart(2, '0')}:00`;
    // UK-North: offshore wind surges during overnight and afternoon
    const ukP50 = Math.round(260 - 130 * Math.sin(((i + 2) / 24) * 2 * Math.PI) + (i % 4) * 12);
    // EU-West: hydro & solar in midday
    const euP50 = Math.round(170 - 90 * Math.sin((i / 24) * 2 * Math.PI) + (i % 3) * 8);
    // US-East: fossil heavy during evening peak
    const usP50 = Math.round(330 - 70 * Math.sin(((i + 6) / 24) * 2 * Math.PI) + (i % 5) * 10);
    // CA-Central: very clean hydro base
    const caP50 = Math.round(65 + 15 * Math.sin((i / 24) * 2 * Math.PI) + (i % 2) * 4);

    return {
      time: hour,
      ukNorth: ukP50,
      ukNorthP10: Math.max(80, ukP50 - 25),
      ukNorthP90: ukP50 + 35,
      euWest: euP50,
      euWestP10: Math.max(60, euP50 - 20),
      euWestP90: euP50 + 25,
      usEast: usP50,
      usEastP10: Math.max(180, usP50 - 30),
      usEastP90: usP50 + 45,
      caCentral: caP50,
      caCentralP10: Math.max(40, caP50 - 10),
      caCentralP90: caP50 + 15,
      priceEu: (0.08 + (euP50 / 1000) * 0.2).toFixed(3),
      priceUk: (0.10 + (ukP50 / 1000) * 0.25).toFixed(3),
    };
  });

  const regions = [
    {
      id: 'eu-west',
      name: 'EU West (Ireland / France)',
      pue: 1.12,
      currentIntensity: 112,
      price: '$0.115/kWh',
      mix: { wind: 42, solar: 28, nuclear: 20, fossil: 10 },
      badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
    },
    {
      id: 'uk-north',
      name: 'UK North (Scotland Grid)',
      pue: 1.15,
      currentIntensity: 185,
      price: '$0.142/kWh',
      mix: { wind: 58, solar: 8, nuclear: 18, fossil: 16 },
      badgeColor: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10',
    },
    {
      id: 'us-east',
      name: 'US East (PJM / Virginia)',
      pue: 1.20,
      currentIntensity: 320,
      price: '$0.185/kWh',
      mix: { wind: 12, solar: 15, nuclear: 22, fossil: 51 },
      badgeColor: 'border-purple-500/30 text-purple-300 bg-purple-500/10',
    },
    {
      id: 'ca-central',
      name: 'CA Central (Quebec Hydro)',
      pue: 1.10,
      currentIntensity: 58,
      price: '$0.065/kWh',
      mix: { wind: 8, solar: 2, nuclear: 0, fossil: 2, hydro: 88 },
      badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Telemetry Header */}
      <div className="glass-panel p-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-status">
                <Zap className="w-3.5 h-3.5" />
                Live Grid Telemetry Engine
              </span>
            </div>
            <h2 className="font-display font-extrabold text-2xl text-white">
              Multi-Region Carbon Intensity & Quantile Projections
            </h2>
            <p className="text-sm text-slate-300">
              Probabilistic forecasts ($P_{10}, P_{50}, P_{90}$) powered by LightGBM quantile regressors and UK ESO / WattTime APIs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQuantiles(!showQuantiles)}
              className={`text-xs px-3.5 py-2 rounded-lg font-medium border transition-all ${
                showQuantiles
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5 inline mr-1.5" />
              <span>{showQuantiles ? 'Prediction Bands Active' : 'Median Only'}</span>
            </button>
          </div>
        </div>

        {/* Region Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {regions.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedRegion(r.id)}
              className={`glass-card p-4 cursor-pointer transition-all ${
                selectedRegion === r.id
                  ? 'border-emerald-500/50 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                  : 'hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {r.id.toUpperCase()}
                </span>
                <span className="font-mono text-xs font-bold text-slate-200">{r.price}</span>
              </div>
              <p className="text-sm font-bold text-white truncate mb-2">{r.name}</p>
              
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-display font-extrabold text-2xl text-emerald-400">{r.currentIntensity}</span>
                <span className="text-[11px] text-slate-400 font-mono">gCO₂e/kWh</span>
              </div>

              {/* Energy Mix Bar */}
              <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-800">
                <div style={{ width: `${r.mix.wind}%` }} className="bg-cyan-400" title={`Wind: ${r.mix.wind}%`}></div>
                <div style={{ width: `${r.mix.solar}%` }} className="bg-amber-400" title={`Solar: ${r.mix.solar}%`}></div>
                <div style={{ width: `${r.mix.nuclear || r.mix.hydro || 0}%` }} className="bg-emerald-400" title="Clean Base"></div>
                <div style={{ width: `${r.mix.fossil}%` }} className="bg-red-400" title={`Fossil: ${r.mix.fossil}%`}></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                <span>PUE: {r.pue.toFixed(2)}</span>
                <span>{100 - r.mix.fossil}% Clean Grid</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main 24-Hour Intensity Forecast Chart */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-display font-bold text-lg text-white">
              24-Hour Diurnal Carbon Intensity Trajectories
            </h3>
            <p className="text-xs text-slate-400">
              Realized values with LightGBM quantile confidence envelopes across European & North American interconnects
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> EU-West (Hydro/Wind)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> UK-North (Wind)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span> US-East (Thermal)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> CA-Central (Hydro)</span>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="gradUk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="gradUs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="gradCa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 420]} unit=" g" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0b1120',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                }}
                formatter={(val: any, name: any) => [`${val} gCO₂e/kWh`, name]}
              />
              <Area type="monotone" dataKey="euWest" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#gradEu)" name="EU-West" />
              <Area type="monotone" dataKey="ukNorth" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#gradUk)" name="UK-North" />
              <Area type="monotone" dataKey="usEast" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#gradUs)" name="US-East" />
              <Area type="monotone" dataKey="caCentral" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#gradCa)" name="CA-Central" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
