import React, { useMemo } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency } from '../lib/formatters';

export function CategoryDonut() {
  const { transactions, categories, selectedMonth, currency } = useFinance();

  const { items, totalExpense } = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const totals = new Map<string, number>();
    let total = 0;

    for (const tx of transactions) {
      if (tx.type !== 'expense' || !tx.date.startsWith(selectedMonth)) continue;
      totals.set(tx.categoryId, (totals.get(tx.categoryId) || 0) + tx.amount);
      total += tx.amount;
    }

    const list = Array.from(totals.entries())
      .map(([catId, amount]) => {
        const cat = catMap.get(catId);
        return {
          id: catId,
          name: cat?.name || 'Outros',
          color: cat?.color || '#64748B',
          amount,
          pct: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { items: list, totalExpense: total };
  }, [transactions, categories, selectedMonth]);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="depth-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col">
      <div>
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Despesas por Categoria
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Concentração dos gastos no mês selecionado
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma despesa registrada neste mês.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6 flex-1">
          <div className="relative w-36 h-36 shrink-0">
            <svg viewBox="0 0 144 144" className="w-full h-full -rotate-90">
              <circle
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                strokeWidth="16"
                className="stroke-slate-100 dark:stroke-slate-800"
              />
              {items.map((item) => {
                const dash = (item.pct / 100) * circumference;
                const strokeDasharray = `${Math.max(2, dash - 1.5)} ${circumference}`;
                const strokeDashoffset = -cumulativeOffset;
                cumulativeOffset += dash;
                return (
                  <circle
                    key={item.id}
                    cx="72"
                    cy="72"
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="16"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
              <span className="text-xs font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(totalExpense, currency)}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2.5 max-h-52 overflow-y-auto pr-1">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2.5 font-mono tabular-nums shrink-0">
                  <span className="text-slate-500 dark:text-slate-400 w-10 text-right">
                    {item.pct.toFixed(0)}%
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
