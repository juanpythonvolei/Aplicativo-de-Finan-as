import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import {
  exportTransactionsToCSV,
  formatCompactCurrency,
  formatCurrency,
  formatShortMonthLabel,
  getRecentMonthKeys,
} from '../lib/formatters';

interface ReportsViewProps {
  externalMonthsCount?: { nonce: number; count: 6 | 12 } | null;
}

export function ReportsView({ externalMonthsCount }: ReportsViewProps) {
  const { transactions, categories, accounts, selectedMonth, currency } = useFinance();
  const [monthsCount, setMonthsCount] = useState<6 | 12>(6);

  useEffect(() => {
    if (!externalMonthsCount) return;
    setMonthsCount(externalMonthsCount.count);
  }, [externalMonthsCount]);

  const monthKeys = useMemo(
    () => getRecentMonthKeys(selectedMonth, monthsCount),
    [selectedMonth, monthsCount]
  );

  const reportData = useMemo(() => {
    const incomeCats = categories.filter((c) => c.type === 'income');
    const expenseCats = categories.filter((c) => c.type === 'expense');

    const cell = new Map<string, number>();
    const monthIncomeTotal = new Map<string, number>();
    const monthExpenseTotal = new Map<string, number>();

    for (const tx of transactions) {
      if (tx.type === 'transfer') continue;
      const mKey = tx.date.slice(0, 7);
      if (!monthKeys.includes(mKey)) continue;
      const key = `${tx.categoryId}__${mKey}`;
      cell.set(key, (cell.get(key) || 0) + tx.amount);
      if (tx.type === 'income') {
        monthIncomeTotal.set(mKey, (monthIncomeTotal.get(mKey) || 0) + tx.amount);
      } else {
        monthExpenseTotal.set(mKey, (monthExpenseTotal.get(mKey) || 0) + tx.amount);
      }
    }

    const totalIncome = monthKeys.reduce((s, m) => s + (monthIncomeTotal.get(m) || 0), 0);
    const totalExpense = monthKeys.reduce((s, m) => s + (monthExpenseTotal.get(m) || 0), 0);
    const totalNet = totalIncome - totalExpense;
    const avgSavingsRate = totalIncome > 0 ? (totalNet / totalIncome) * 100 : 0;

    return {
      incomeCats,
      expenseCats,
      cell,
      monthIncomeTotal,
      monthExpenseTotal,
      totalIncome,
      totalExpense,
      totalNet,
      avgSavingsRate,
    };
  }, [transactions, categories, monthKeys]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Receitas ({monthsCount} meses)
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatCurrency(reportData.totalIncome, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Despesas ({monthsCount} meses)
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(reportData.totalExpense, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Resultado Líquido
            </p>
            <p
              className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                reportData.totalNet >= 0
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(reportData.totalNet, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Taxa Média de Poupança
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {reportData.avgSavingsRate.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setMonthsCount(6)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                monthsCount === 6
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              6 meses
            </button>
            <button
              onClick={() => setMonthsCount(12)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                monthsCount === 12
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              12 meses
            </button>
          </div>

          <button
            onClick={() =>
              exportTransactionsToCSV(
                transactions.filter((tx) => monthKeys.includes(tx.date.slice(0, 7))),
                accounts,
                categories,
                `relatorio-dre-${monthsCount}m-${selectedMonth}.csv`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* DRE Pessoal Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Demonstrativo de Resultado Pessoal (DRE)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visão matricial por categoria e competência mensal
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-5 font-medium min-w-[180px]">Categoria</th>
                {monthKeys.map((m) => (
                  <th key={m} className="py-3 px-3 text-right font-mono font-medium whitespace-nowrap">
                    {formatShortMonthLabel(m)}
                  </th>
                ))}
                <th className="py-3 px-5 text-right font-mono font-semibold whitespace-nowrap">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Income Section */}
              <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 font-semibold text-emerald-800 dark:text-emerald-300">
                <td className="py-2.5 px-5">Receitas Operacionais</td>
                {monthKeys.map((m) => (
                  <td key={m} className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {formatCompactCurrency(reportData.monthIncomeTotal.get(m) || 0, currency)}
                  </td>
                ))}
                <td className="py-2.5 px-5 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatCurrency(reportData.totalIncome, currency)}
                </td>
              </tr>
              {reportData.incomeCats.map((cat) => {
                const rowTotal = monthKeys.reduce(
                  (s, m) => s + (reportData.cell.get(`${cat.id}__${m}`) || 0),
                  0
                );
                if (rowTotal === 0) return null;
                return (
                  <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-5 pl-8 text-slate-700 dark:text-slate-300">
                      {cat.name}
                    </td>
                    {monthKeys.map((m) => {
                      const val = reportData.cell.get(`${cat.id}__${m}`) || 0;
                      return (
                        <td
                          key={m}
                          className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap"
                        >
                          {val > 0 ? formatCompactCurrency(val, currency) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatCurrency(rowTotal, currency)}
                    </td>
                  </tr>
                );
              })}

              {/* Expense Section */}
              <tr className="bg-slate-100/70 dark:bg-slate-800/40 font-semibold text-slate-800 dark:text-slate-200">
                <td className="py-2.5 px-5">Despesas e Custos</td>
                {monthKeys.map((m) => (
                  <td key={m} className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {formatCompactCurrency(reportData.monthExpenseTotal.get(m) || 0, currency)}
                  </td>
                ))}
                <td className="py-2.5 px-5 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatCurrency(reportData.totalExpense, currency)}
                </td>
              </tr>
              {reportData.expenseCats.map((cat) => {
                const rowTotal = monthKeys.reduce(
                  (s, m) => s + (reportData.cell.get(`${cat.id}__${m}`) || 0),
                  0
                );
                if (rowTotal === 0) return null;
                return (
                  <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-5 pl-8 text-slate-700 dark:text-slate-300">
                      {cat.name}
                    </td>
                    {monthKeys.map((m) => {
                      const val = reportData.cell.get(`${cat.id}__${m}`) || 0;
                      return (
                        <td
                          key={m}
                          className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap"
                        >
                          {val > 0 ? formatCompactCurrency(val, currency) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatCurrency(rowTotal, currency)}
                    </td>
                  </tr>
                );
              })}

              {/* Net Result Row */}
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-semibold bg-slate-50 dark:bg-slate-950/60">
                <td className="py-3 px-5 text-slate-900 dark:text-white">Resultado Líquido</td>
                {monthKeys.map((m) => {
                  const net =
                    (reportData.monthIncomeTotal.get(m) || 0) -
                    (reportData.monthExpenseTotal.get(m) || 0);
                  return (
                    <td
                      key={m}
                      className={`py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        net >= 0
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCompactCurrency(net, currency)}
                    </td>
                  );
                })}
                <td
                  className={`py-3 px-5 text-right font-mono tabular-nums whitespace-nowrap ${
                    reportData.totalNet >= 0
                      ? 'text-teal-700 dark:text-teal-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(reportData.totalNet, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
