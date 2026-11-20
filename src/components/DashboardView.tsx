import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency, formatShortDate } from '../lib/formatters';
import { Transaction, ViewTab } from '../types/finance';
import { CashFlowChart } from './CashFlowChart';
import { CategoryDonut } from './CategoryDonut';

interface DashboardViewProps {
  onNavigate: (tab: ViewTab) => void;
  onEditTransaction: (tx: Transaction) => void;
}

export function DashboardView({ onNavigate, onEditTransaction }: DashboardViewProps) {
  const {
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    selectedMonth,
    currency,
    dataLoading,
    loadSampleData,
    toggleTransactionStatus,
  } = useFinance();

  const [seeding, setSeeding] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const kpis = useMemo(() => {
    const activeAccounts = accounts.filter((a) => !a.archived);
    const consolidatedBalance = activeAccounts.reduce((acc, item) => acc + item.balance, 0);
    const liquidAssets = activeAccounts
      .filter((a) => a.type !== 'credit')
      .reduce((acc, item) => acc + item.balance, 0);
    const creditDebt = activeAccounts
      .filter((a) => a.type === 'credit')
      .reduce((acc, item) => acc + Math.max(0, -item.balance), 0);

    let monthIncome = 0;
    let monthIncomePaid = 0;
    let monthExpense = 0;
    let monthExpensePaid = 0;

    for (const tx of transactions) {
      if (!tx.date.startsWith(selectedMonth)) continue;
      if (tx.type === 'income') {
        monthIncome += tx.amount;
        if (tx.status === 'paid') monthIncomePaid += tx.amount;
      } else if (tx.type === 'expense') {
        monthExpense += tx.amount;
        if (tx.status === 'paid') monthExpensePaid += tx.amount;
      }
    }

    const netResult = monthIncome - monthExpense;
    const savingsRate = monthIncome > 0 ? (netResult / monthIncome) * 100 : 0;

    return {
      consolidatedBalance,
      liquidAssets,
      creditDebt,
      monthIncome,
      monthIncomePaid,
      monthExpense,
      monthExpensePaid,
      netResult,
      savingsRate,
    };
  }, [accounts, transactions, selectedMonth]);

  const pendingTransactions = useMemo(
    () =>
      transactions
        .filter((tx) => tx.status === 'pending')
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [transactions]
  );

  const recentTransactions = useMemo(
    () =>
      transactions
        .filter((tx) => tx.date.startsWith(selectedMonth))
        .slice(0, 7),
    [transactions, selectedMonth]
  );

  const monthBudgetProgress = useMemo(() => {
    const monthBudgets = budgets.filter((b) => b.month === selectedMonth);
    return monthBudgets
      .map((b) => {
        const spent = transactions
          .filter(
            (tx) =>
              tx.type === 'expense' &&
              tx.date.startsWith(selectedMonth) &&
              tx.categoryId === b.categoryId
          )
          .reduce((sum, tx) => sum + tx.amount, 0);
        const cat = categoryMap.get(b.categoryId);
        const ratio = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        return {
          id: b.id,
          categoryName: cat?.name || 'Categoria',
          limit: b.amount,
          spent,
          ratio,
        };
      })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 4);
  }, [budgets, transactions, selectedMonth, categoryMap]);

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === 'active').slice(0, 3),
    [goals]
  );

  const handleLoadSample = async () => {
    setSeeding(true);
    try {
      await loadSampleData();
    } finally {
      setSeeding(false);
    }
  };

  if (dataLoading && accounts.length === 0 && transactions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="lg:col-span-5 h-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accounts.length === 0 && transactions.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Bem-vindo ao seu painel financeiro
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Você pode começar cadastrando sua primeira conta bancária ou cartão de crédito, ou
              carregar um cenário brasileiro de demonstração com 5 meses de histórico para explorar
              todos os recursos imediatamente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('accounts')}
              className="px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Criar Primeira Conta
            </button>
            <button
              onClick={handleLoadSample}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>{seeding ? 'Carregando...' : 'Carregar Cenário de Exemplo'}</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Patrimônio Líquido Consolidado
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(kpis.consolidatedBalance, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Ativos {formatCurrency(kpis.liquidAssets, currency)} · Faturas{' '}
            {formatCurrency(kpis.creditDebt, currency)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Receitas do Mês
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Entrada
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(kpis.monthIncome, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Efetivado: {formatCurrency(kpis.monthIncomePaid, currency)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Despesas do Mês
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <ArrowDownRight className="w-3.5 h-3.5" />
              Saída
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(kpis.monthExpense, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Pago: {formatCurrency(kpis.monthExpensePaid, currency)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Balanço & Poupança
            </p>
            <span
              className={`text-xs font-mono font-medium tabular-nums ${
                kpis.netResult >= 0
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {kpis.savingsRate.toFixed(1)}%
            </span>
          </div>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              kpis.netResult >= 0
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatCurrency(kpis.netResult, currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {kpis.netResult >= 0 ? 'Superávit no período' : 'Déficit no período'}
          </p>
        </div>
      </div>

      {/* Main Analytics Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col [&>*]:flex-1">
          <CashFlowChart />
        </div>
        <div className="lg:col-span-5 flex flex-col [&>*]:flex-1">
          <CategoryDonut />
        </div>
      </div>

      {/* Secondary Operational Split: Pending Bills + Budgets & Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Pendentes e Próximos Vencimentos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lançamentos aguardando efetivação
              </p>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              Ver todos
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhum lançamento pendente no momento.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingTransactions.map((tx) => {
                const cat = categoryMap.get(tx.categoryId);
                const acc = accountMap.get(tx.accountId);
                return (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {tx.description}
                        {tx.installmentTotal > 1 && (
                          <span className="ml-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                            ({tx.installmentNumber}/{tx.installmentTotal})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {formatShortDate(tx.date)} · {cat?.name || 'Transferência'} ·{' '}
                        {acc?.name || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`font-mono text-sm font-medium tabular-nums ${
                          tx.type === 'income'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount, currency)}
                      </span>
                      <button
                        onClick={() => toggleTransactionStatus(tx)}
                        className="px-2.5 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400 rounded-md transition-colors whitespace-nowrap"
                      >
                        Efetivar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Orçamentos em Destaque
              </h2>
              <button
                onClick={() => onNavigate('budgets')}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
              >
                Gerenciar
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {monthBudgetProgress.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                Sem metas de orçamento configuradas para este mês.
              </p>
            ) : (
              <div className="space-y-3">
                {monthBudgetProgress.map((b) => {
                  const barPct = Math.min(100, b.ratio);
                  const isOver = b.ratio > 100;
                  const isWarn = b.ratio >= 80 && !isOver;
                  return (
                    <div key={b.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {b.categoryName}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {formatCurrency(b.spent, currency)} / {formatCurrency(b.limit, currency)}{' '}
                          <span
                            className={
                              isOver
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : isWarn
                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-slate-500'
                            }
                          >
                            ({b.ratio.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isOver
                              ? 'bg-red-600'
                              : isWarn
                              ? 'bg-amber-500'
                              : 'bg-teal-600'
                          }`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Metas Ativas
              </h2>
              <button
                onClick={() => onNavigate('goals')}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
              >
                Ver metas
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeGoals.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                Nenhuma meta financeira ativa.
              </p>
            ) : (
              <div className="space-y-3">
                {activeGoals.map((g) => {
                  const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
                  return (
                    <div key={g.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                          {g.name}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
                          {formatCurrency(g.currentAmount, currency)} /{' '}
                          {formatCurrency(g.targetAmount, currency)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: g.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Lançamentos do Mês
          </h2>
          <button
            onClick={() => onNavigate('transactions')}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
          >
            Extrato completo
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum lançamento registrado neste mês.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                  <th className="py-2.5 px-6">Data</th>
                  <th className="py-2.5 px-4">Descrição</th>
                  <th className="py-2.5 px-4">Categoria · Conta</th>
                  <th className="py-2.5 px-4">Situação</th>
                  <th className="py-2.5 px-6 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {recentTransactions.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  const acc = accountMap.get(tx.accountId);
                  const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : null;
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onEditTransaction(tx)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-6 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatShortDate(tx.date)}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {tx.description}
                        {tx.installmentTotal > 1 && (
                          <span className="ml-1.5 font-mono text-xs text-slate-500">
                            {tx.installmentNumber}/{tx.installmentTotal}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {tx.type === 'transfer'
                          ? `Transferência · ${acc?.name || '-'} → ${toAcc?.name || '-'}`
                          : `${cat?.name || 'Outros'} · ${acc?.name || '-'}`}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {tx.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Efetivado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-6 text-right font-mono font-medium tabular-nums whitespace-nowrap ${
                          tx.type === 'income'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : tx.type === 'transfer'
                            ? 'text-sky-700 dark:text-sky-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatCurrency(tx.amount, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
