import React from 'react';

import { Loader2 } from 'lucide-react';

interface StatusData {
  success: number;
  running: number;
  error: number;
  total: number;
}

interface StatusChartProps {
  title: string;
  data: StatusData;
  loading?: boolean;
}

export const StatusChart: React.FC<StatusChartProps> = ({
  data,
  loading = false,
}) => {
  const waiting = data.total - data.success - data.running - data.error;

  const calculatePercentages = () => {
    if (data.total === 0)
      return { success: 0, running: 0, error: 0, waiting: 0 };
    return {
      success: (data.success / data.total) * 100,
      running: (data.running / data.total) * 100,
      error: (data.error / data.total) * 100,
      waiting: (waiting / data.total) * 100,
    };
  };

  const percentages = calculatePercentages();

  const createConicGradient = () => {
    if (data.total === 0) return 'conic-gradient(#f1f5f9 100%)';

    let gradientString = 'conic-gradient(from 0deg, ';
    let currentAngle = 0;

    if (data.success > 0) {
      const endAngle = currentAngle + percentages.success * 3.6;
      gradientString += `#0ea5e9 ${currentAngle}deg ${endAngle}deg, `; // Sky Blue
      currentAngle = endAngle;
    }

    if (data.running > 0) {
      const endAngle = currentAngle + percentages.running * 3.6;
      gradientString += `#6366f1 ${currentAngle}deg ${endAngle}deg, `; // Indigo
      currentAngle = endAngle;
    }

    if (data.error > 0) {
      const endAngle = currentAngle + percentages.error * 3.6;
      gradientString += `#f43f5e ${currentAngle}deg ${endAngle}deg, `; // Rose Red
      currentAngle = endAngle;
    }

    if (waiting > 0) {
      gradientString += `#e2e8f0 ${currentAngle}deg 360deg`;
    } else {
      gradientString = gradientString.slice(0, -2);
    }

    return gradientString + ')';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[280px]">
        <Loader2 className="animate-spin text-slate-200" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div
        className="relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 shadow-inner"
        style={{ background: createConicGradient() }}
      >
        <div className="w-32 h-32 rounded-full bg-white shadow-xl flex flex-col items-center justify-center border border-slate-50">
          <div className="text-4xl font-black text-slate-800 tracking-tighter leading-none">
            {data.total}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Total
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 max-w-sm">
        {data.success > 0 && (
          <LegendItem label="Success" count={data.success} color="bg-sky-500" />
        )}
        {data.running > 0 && (
          <LegendItem
            label="Running"
            count={data.running}
            color="bg-indigo-500"
          />
        )}
        {data.error > 0 && (
          <LegendItem label="Error" count={data.error} color="bg-rose-500" />
        )}
        {waiting > 0 && (
          <LegendItem label="Waiting" count={waiting} color="bg-slate-300" />
        )}
      </div>
    </div>
  );
};

const LegendItem = ({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) => (
  <div className="flex items-center gap-2">
    <div className={`w-2.5 h-2.5 ${color} rounded-full`} />
    <span className="text-xs font-bold text-slate-600">
      {label}: <span className="text-slate-400 font-medium">{count}</span>
    </span>
  </div>
);
