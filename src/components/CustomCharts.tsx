import React from 'react';

// 1. Bar Chart for Active People by Device
interface BarChartProps {
  data: { label: string; value: number }[];
}

export const BarChart: React.FC<BarChartProps> = ({ data }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-4">
      <div className="h-64 flex items-end gap-3 sm:gap-6 pt-4 pb-2 px-2 border-b border-slate-800">
        {data.map((item, i) => {
          const heightPercent = (item.value / maxValue) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip */}
              <div className="absolute -top-6 scale-0 group-hover:scale-100 transition-all duration-150 bg-slate-800 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow border border-slate-700 pointer-events-none">
                {item.value} activos
              </div>
              
              {/* Bar */}
              <div
                style={{ height: `${heightPercent}%` }}
                className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300 transition-all duration-500 shadow-lg shadow-emerald-500/10"
              ></div>
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex gap-3 sm:gap-6 px-2">
        {data.map((item, i) => (
          <div key={i} className="flex-1 text-center">
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 truncate" title={item.label}>
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// 2. Circular KPI Progress Gauge
interface ProgressCircleProps {
  percentage: number;
  label: string;
  colorClass?: string; // 'emerald', 'amber', 'red', 'indigo'
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  percentage,
  label,
  colorClass = 'emerald',
}) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let colorStroke = 'stroke-emerald-500';
  if (colorClass === 'amber') {
    colorStroke = 'stroke-amber-500';
  } else if (colorClass === 'red') {
    colorStroke = 'stroke-red-500';
  } else if (colorClass === 'indigo') {
    colorStroke = 'stroke-indigo-500';
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
      <div className="space-y-1 pr-3">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
        <div className="text-2xl font-black text-white">{percentage.toFixed(1)}%</div>
      </div>
      <div className="relative w-20 h-20 shrink-0">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="6"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            className={`${colorStroke} transition-all duration-700 ease-out`}
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};

// 3. Sex and Age Distribution Chart (Pyramid / Horizontal Bars)
interface AgeDistProps {
  data: {
    range: string;
    masculino: number;
    femenino: number;
    otro: number;
  }[];
}

export const AgeSexDistribution: React.FC<AgeDistProps> = ({ data }) => {
  const maxVal = Math.max(...data.map((d) => Math.max(d.masculino, d.femenino, d.otro)), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2">
        <span className="col-span-1 text-left">Edad</span>
        <span className="col-span-1 text-blue-400">Masc</span>
        <span className="col-span-2">Distribución Visual</span>
        <span className="col-span-1 text-rose-400 text-right">Fem / Otro</span>
      </div>

      <div className="space-y-3">
        {data.map((row, i) => {
          const mascWidth = (row.masculino / maxVal) * 100;
          const femWidth = (row.femenino / maxVal) * 100;
          const otroWidth = (row.otro / maxVal) * 100;

          return (
            <div key={i} className="grid grid-cols-5 items-center gap-2">
              {/* Range */}
              <div className="col-span-1 text-left text-xs font-semibold text-slate-300">
                {row.range}
              </div>

              {/* Male Count */}
              <div className="col-span-1 text-center text-xs font-bold text-blue-400">
                {row.masculino}
              </div>

              {/* Graphic bars centered */}
              <div className="col-span-2 flex items-center justify-center gap-1">
                {/* Male side (left) */}
                <div className="flex-1 flex justify-end">
                  <div
                    style={{ width: `${mascWidth}%` }}
                    className="h-3 bg-blue-500 rounded-l transition-all duration-500 max-w-[80%]"
                  ></div>
                </div>
                {/* Center separator line */}
                <div className="w-[2px] h-4 bg-slate-800"></div>
                {/* Female & Other side (right) */}
                <div className="flex-1 flex gap-0.5">
                  <div
                    style={{ width: `${femWidth}%` }}
                    className="h-3 bg-rose-500 rounded-r transition-all duration-500 max-w-[70%]"
                  ></div>
                  {row.otro > 0 && (
                    <div
                      style={{ width: `${otroWidth}%` }}
                      className="h-3 bg-violet-400 rounded-r transition-all duration-500 max-w-[30%]"
                    ></div>
                  )}
                </div>
              </div>

              {/* Female & Other Count */}
              <div className="col-span-1 text-right text-xs font-bold text-rose-400">
                {row.femenino + row.otro} <span className="text-[10px] text-violet-400">({row.otro})</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
