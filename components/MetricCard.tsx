
import React from 'react';
import { MetricData } from '../types';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
  data: MetricData;
}

const MetricCard: React.FC<MetricCardProps> = ({ data }) => {
  const isPositive = data.trend === 'up';
  const isNegative = data.trend === 'down';

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">{data.label}</span>
        <div className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${
          isPositive ? 'bg-emerald-50 text-emerald-600' : 
          isNegative ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'
        }`}>
          {isPositive && <ArrowUpRight className="w-3 h-3 mr-1" />}
          {isNegative && <ArrowDownRight className="w-3 h-3 mr-1" />}
          {!isPositive && !isNegative && <Minus className="w-3 h-3 mr-1" />}
          {Math.abs(data.change)}%
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-900 tracking-tight">
        {data.value}
      </div>
      <div className="mt-2 text-xs text-slate-400">
        vs. previous 30 days
      </div>
    </div>
  );
};

export default MetricCard;
