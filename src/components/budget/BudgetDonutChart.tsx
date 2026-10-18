import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { PieChart as PieChartIcon, DollarSign, Wallet } from 'lucide-react';
import type { BudgetCategoryItem } from '../../types/smart-ride';

interface BudgetDonutChartProps {
  budgets: BudgetCategoryItem[];
  exchangeRate: number;
}

const PALETTE = [
  { fill: '#10B981', ring: 'border-emerald-500', text: 'text-emerald-400' }, // Emerald
  { fill: '#3B82F6', ring: 'border-blue-500', text: 'text-blue-400' },       // Blue
  { fill: '#8B5CF6', ring: 'border-purple-500', text: 'text-purple-400' },   // Purple
  { fill: '#F59E0B', ring: 'border-amber-500', text: 'text-amber-400' },     // Amber
  { fill: '#EC4899', ring: 'border-pink-500', text: 'text-pink-400' },       // Pink
  { fill: '#14B8A6', ring: 'border-teal-500', text: 'text-teal-400' },       // Teal
  { fill: '#6366F1', ring: 'border-indigo-500', text: 'text-indigo-400' },   // Indigo
];

export const BudgetDonutChart: React.FC<BudgetDonutChartProps> = ({
  budgets,
  exchangeRate,
}) => {
  const [displayCurrency, setDisplayCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Normalize spending across NGN and USD to compute accurate proportions
  const chartData = useMemo(() => {
    const totalSpentInNgn = budgets.reduce((acc, cat) => {
      const spentNgn =
        cat.currency === 'NGN'
          ? cat.spentAmount
          : cat.spentAmount * exchangeRate;
      return acc + spentNgn;
    }, 0);

    return budgets
      .filter((b) => b.spentAmount > 0)
      .map((cat, idx) => {
        const spentNgn =
          cat.currency === 'NGN'
            ? cat.spentAmount
            : cat.spentAmount * exchangeRate;
        const spentUsd =
          cat.currency === 'USD'
            ? cat.spentAmount
            : Math.round(cat.spentAmount / exchangeRate);

        const sharePct = totalSpentInNgn > 0 ? (spentNgn / totalSpentInNgn) * 100 : 0;
        const color = PALETTE[idx % PALETTE.length];

        return {
          id: cat.id,
          name: cat.name,
          rawCurrency: cat.currency,
          rawAmount: cat.spentAmount,
          spentNgn,
          spentUsd,
          sharePct: Number(sharePct.toFixed(1)),
          value: displayCurrency === 'NGN' ? spentNgn : spentUsd,
          color: color.fill,
          colorObj: color,
        };
      });
  }, [budgets, exchangeRate, displayCurrency]);

  const totalDisplayedSpend = useMemo(() => {
    return chartData.reduce((acc, item) => acc + item.value, 0);
  }, [chartData]);

  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Beacon Revenue Category Spending Breakdown
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual donut distribution of all real-time synchronized spending across active budget envelopes.
          </p>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setDisplayCurrency('NGN')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              displayCurrency === 'NGN'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            NGN Breakdown
          </button>
          <button
            type="button"
            onClick={() => setDisplayCurrency('USD')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              displayCurrency === 'USD'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            USD ($) Breakdown
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          No spending recorded across active categories yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Donut Chart Viewport with Center Metric */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="w-full h-64 max-w-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950/95 border border-slate-700 rounded-lg p-3 shadow-xl text-xs space-y-1">
                            <p className="font-semibold text-white">{data.name}</p>
                            <p className="text-emerald-400 font-mono font-bold">
                              {displayCurrency === 'NGN'
                                ? `NGN ${data.spentNgn.toLocaleString()}`
                                : `$${data.spentUsd.toLocaleString()}`}
                            </p>
                            <p className="text-slate-400">
                              {data.sharePct}% of total spending
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Original: {data.rawCurrency === 'NGN' ? 'NGN ' : '$'}
                              {data.rawAmount.toLocaleString()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={96}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#020617"
                    strokeWidth={2}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={entry.color}
                        opacity={
                          activeIndex === null || activeIndex === index ? 1 : 0.4
                        }
                        style={{ cursor: 'pointer', outline: 'none' }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Center Hole Information Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                {activeItem ? 'Category Share' : 'Total Spent'}
              </span>
              <p className="text-base sm:text-lg font-mono tabular-nums font-extrabold text-white">
                {activeItem
                  ? `${activeItem.sharePct}%`
                  : displayCurrency === 'NGN'
                  ? `NGN ${(totalDisplayedSpend / 1000000).toFixed(1)}M`
                  : `$${(totalDisplayedSpend / 1000).toFixed(0)}k`}
              </p>
              <span className="text-[10px] text-slate-500 max-w-[100px] truncate">
                {activeItem ? activeItem.name : `${chartData.length} active`}
              </span>
            </div>
          </div>

          {/* Category Share Legend Cards */}
          <div className="lg:col-span-7 space-y-2.5">
            {chartData.map((item, idx) => {
              const isHovered = activeIndex === idx;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                    isHovered
                      ? 'bg-slate-950 border-slate-600 shadow-md scale-[1.01]'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400">
                        Recorded currency: {item.rawCurrency} · Original:{' '}
                        {item.rawCurrency === 'NGN' ? 'NGN ' : '$'}
                        {item.rawAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums shrink-0">
                    <p className="font-bold text-white">
                      {displayCurrency === 'NGN'
                        ? `NGN ${item.spentNgn.toLocaleString()}`
                        : `$${item.spentUsd.toLocaleString()}`}
                    </p>
                    <p className={`text-[11px] font-semibold ${item.colorObj.text}`}>
                      {item.sharePct}% share
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
