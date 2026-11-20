import React, { useMemo, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import {
  formatCompactCurrency,
  formatCurrency,
  formatShortMonthLabel,
  getRecentMonthKeys,
} from '../lib/formatters';

export function CashFlowChart() {
  const { transactions, selectedMonth, currency } = useFinance();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const monthsData = useMemo(() => {
    const keys = getRecentMonthKeys(selectedMonth, 6);
    return keys.map((monthKey) => {
      let income = 0;
      let expense = 0;
      for (const tx of transactions) {
        if (!tx.date.startsWith(monthKey)) continue;
        if (tx.type === 'income') income += tx.amount;
        if (tx.type === 'expense') expense += tx.amount;
      }
      return {
        monthKey,
        label: formatShortMonthLabel(monthKey),
        income,
        expense,
        net: income - expense,
      };
    });
  }, [transactions, selectedMonth]);

  const maxVal = useMemo(() => {
    const peak = Math.max(
      100,
      ...monthsData.flatMap((d) => [d.income, d.expense])
    );
    return peak * 1.15;
  }, [monthsData]);

  const chartHeight = 220;
  const chartWidth = 600;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 32;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;
  const slotWidth = plotWidth / monthsData.length;
  const barWidth = Math.min(22, slotWidth * 0.28);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const hovered = hoveredIdx !== null ? monthsData[hoveredIdx] : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Fluxo de Caixa (6 meses)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Receitas vs. despesas totais até {formatShortMonthLabel(selectedMonth)}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 inline-block" />
            Receitas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 dark:bg-slate-600 inline-block" />
            Despesas
          </span>
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label="Gráfico de fluxo de caixa dos últimos 6 meses"
        >
          {yTicks.map((ratio) => {
            const y = padTop + plotHeight * (1 - ratio);
            const val = maxVal * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={chartWidth - padRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
                >
                  {formatCompactCurrency(val, currency)}
                </text>
              </g>
            );
          })}

          {monthsData.map((d, idx) => {
            const centerX = padLeft + slotWidth * idx + slotWidth / 2;
            const incHeight = (d.income / maxVal) * plotHeight;
            const expHeight = (d.expense / maxVal) * plotHeight;
            const incY = padTop + plotHeight - incHeight;
            const expY = padTop + plotHeight - expHeight;
            const isHovered = hoveredIdx === idx;
            const isSelected = d.monthKey === selectedMonth;

            return (
              <g
                key={d.monthKey}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={padLeft + slotWidth * idx + 4}
                  y={padTop}
                  width={slotWidth - 8}
                  height={plotHeight}
                  rx={6}
                  className={
                    isHovered
                      ? 'fill-slate-100/80 dark:fill-slate-800/50'
                      : 'fill-transparent'
                  }
                />
                <rect
                  x={centerX - barWidth - 2}
                  y={incY}
                  width={barWidth}
                  height={Math.max(2, incHeight)}
                  rx={3}
                  className="fill-teal-600 dark:fill-teal-500 transition-opacity"
                  opacity={hoveredIdx !== null && !isHovered ? 0.55 : 1}
                />
                <rect
                  x={centerX + 2}
                  y={expY}
                  width={barWidth}
                  height={Math.max(2, expHeight)}
                  rx={3}
                  className="fill-slate-400 dark:fill-slate-600 transition-opacity"
                  opacity={hoveredIdx !== null && !isHovered ? 0.55 : 1}
                />
                <text
                  x={centerX}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className={`text-[11px] font-mono ${
                    isSelected
                      ? 'fill-teal-700 dark:fill-teal-400 font-semibold'
                      : 'fill-slate-500 dark:fill-slate-400'
                  }`}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {hovered ? (
            <>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {hovered.label}
              </span>
              <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400">
                  + {formatCurrency(hovered.income, currency)}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  - {formatCurrency(hovered.expense, currency)}
                </span>
                <span
                  className={
                    hovered.net >= 0
                      ? 'text-teal-700 dark:text-teal-400 font-semibold'
                      : 'text-red-600 dark:text-red-400 font-semibold'
                  }
                >
                  Saldo: {formatCurrency(hovered.net, currency)}
                </span>
              </div>
            </>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              Passe o cursor sobre um mês para inspecionar receitas, despesas e resultado líquido.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
