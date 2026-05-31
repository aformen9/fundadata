import React from 'react';

// 1. Bar Chart — Active people by device
interface BarChartProps {
  data: { label: string; value: number }[];
}

export const BarChart: React.FC<BarChartProps> = ({ data }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const colors = [
    'from-emerald-500 to-teal-400',
    'from-violet-500 to-purple-400',
    'from-amber-500 to-orange-400',
    'from-sky-500 to-blue-400',
    'from-rose-500 to-pink-400',
  ];

  return (
    <div className="space-y-3">
      {/* Grid lines */}
      <div className="relative h-52 flex items-end gap-2 sm:gap-3 pb-1 pt-6 pl-8">
        {/* Background grid */}
        <div className="absolute inset-0 flex flex-col justify-between pb-1 pt-5 pointer-events-none">
          {[100, 75, 50, 25, 0].map((pct) => (
            <div key={pct} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-600 font-mono w-4 shrink-0 text-right">
                {pct === 0 ? '0' : Math.round((pct / 100) * maxValue)}
              </span>
              <div className="flex-1 border-t border-dashed border-slate-800/60" />
            </div>
          ))}
        </div>

        {data.map((item, i) => {
          const heightPercent = (item.value / maxValue) * 100;
          const color = colors[i % colors.length];
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              {/* Custom Tooltip on Hover */}
              <div className="absolute -top-8 bg-slate-950 text-slate-200 text-xs px-2.5 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none border border-slate-700/50">
                {item.label}
              </div>

              {/* Value label */}
              <div className={`absolute text-[11px] font-black transition-all duration-300 ${
                heightPercent > 15
                  ? 'text-slate-950 bottom-1'
                  : 'text-slate-300 bottom-[calc(var(--h)+4px)]'
              }`}
                style={{ '--h': `${heightPercent}%` } as any}
              >
                {item.value > 0 && (
                  <span className="bg-slate-800/90 px-1.5 py-0.5 rounded text-[10px] text-slate-200 font-bold shadow">
                    {item.value}
                  </span>
                )}
              </div>
              {/* Bar */}
              <div
                style={{ height: `${heightPercent}%`, minHeight: item.value > 0 ? '4px' : '0' }}
                className={`w-full max-w-[36px] rounded-t-xl bg-gradient-to-t ${color} transition-all duration-700 ease-out shadow-lg group-hover:opacity-80`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. Progress Circle KPI
interface ProgressCircleProps {
  percentage: number;
  label: string;
  colorClass?: string;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  percentage,
  label,
  colorClass = 'emerald',
}) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorMap: Record<string, { stroke: string; glow: string; text: string; bg: string }> = {
    emerald: { stroke: '#10b981', glow: 'rgba(16,185,129,0.3)', text: 'text-emerald-400', bg: 'from-emerald-500/10 to-teal-400/5' },
    amber:   { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.3)',  text: 'text-amber-400',   bg: 'from-amber-500/10 to-orange-400/5' },
    red:     { stroke: '#ef4444', glow: 'rgba(239,68,68,0.3)',   text: 'text-red-400',     bg: 'from-red-500/10 to-rose-400/5' },
    indigo:  { stroke: '#6366f1', glow: 'rgba(99,102,241,0.3)',  text: 'text-indigo-400',  bg: 'from-indigo-500/10 to-violet-400/5' },
  };

  const c = colorMap[colorClass] || colorMap.emerald;

  return (
    <div className={`bg-gradient-to-br ${c.bg} border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between gap-3 card-hover`}>
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight mb-1">{label}</p>
        <p className={`text-2xl font-black ${c.text}`}>{percentage.toFixed(1)}%</p>
      </div>
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
          <circle
            cx="44" cy="44" r={radius}
            stroke={c.stroke}
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1s ease-out',
              filter: `drop-shadow(0 0 6px ${c.glow})`,
            }}
          />
        </svg>
      </div>
    </div>
  );
};

// 3. Age & Sex Distribution
interface AgeDistProps {
  data: { range: string; masculino: number; femenino: number; otro: number }[];
}

export const AgeSexDistribution: React.FC<AgeDistProps> = ({ data }) => {
  const maxVal = Math.max(...data.map((d) => Math.max(d.masculino, d.femenino, d.otro)), 1);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sky-500 inline-block" /> Masc.</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> Fem.</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-400 inline-block" /> Otro</div>
      </div>

      <div className="space-y-2.5">
        {data.map((row, i) => {
          const mascWidth = (row.masculino / maxVal) * 100;
          const femWidth  = (row.femenino  / maxVal) * 100;
          const otroWidth = (row.otro      / maxVal) * 100;
          const total     = row.masculino + row.femenino + row.otro;

          return (
            <div key={i} className="grid grid-cols-[40px_1fr_36px] items-center gap-3 group">
              {/* Age range */}
              <span className="text-xs font-bold text-slate-400">{row.range}</span>

              {/* Bars */}
              <div className="flex items-center gap-0.5 h-5 rounded-lg overflow-hidden bg-slate-800/40">
                {mascWidth > 0 && (
                  <div
                    style={{ width: `${(row.masculino / (row.masculino + row.femenino + row.otro || 1)) * 100}%` }}
                    className="h-full bg-sky-500/80 transition-all duration-700 ease-out"
                    title={`Masculino: ${row.masculino}`}
                  />
                )}
                {femWidth > 0 && (
                  <div
                    style={{ width: `${(row.femenino / (row.masculino + row.femenino + row.otro || 1)) * 100}%` }}
                    className="h-full bg-rose-500/80 transition-all duration-700 ease-out"
                    title={`Femenino: ${row.femenino}`}
                  />
                )}
                {otroWidth > 0 && (
                  <div
                    style={{ width: `${(row.otro / (row.masculino + row.femenino + row.otro || 1)) * 100}%` }}
                    className="h-full bg-violet-400/80 transition-all duration-700 ease-out"
                    title={`Otro: ${row.otro}`}
                  />
                )}
                {total === 0 && <div className="w-full h-full" />}
              </div>

              {/* Total */}
              <span className="text-xs font-black text-slate-300 text-right">{total}</span>
            </div>
          );
        })}
      </div>

      {/* Counts breakdown */}
      <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-3 text-center gap-2">
        {['masculino', 'femenino', 'otro'].map((key) => {
          const total = data.reduce((sum, row) => sum + (row as any)[key], 0);
          const colors = { masculino: 'text-sky-400', femenino: 'text-rose-400', otro: 'text-violet-400' };
          const labels = { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' };
          return (
            <div key={key}>
              <p className={`text-lg font-black ${(colors as any)[key]}`}>{total}</p>
              <p className="text-[10px] text-slate-600 uppercase font-bold">{(labels as any)[key]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
