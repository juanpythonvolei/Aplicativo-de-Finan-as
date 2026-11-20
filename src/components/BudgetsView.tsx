import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Edit2, Plus, Trash2, X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency, formatMonthLabel } from '../lib/formatters';
import { BudgetFormDraft } from '../types/finance';

interface BudgetsViewProps {
  externalDraft?: BudgetFormDraft | null;
}

export function BudgetsView({ externalDraft }: BudgetsViewProps) {
  const {
    categories,
    budgets,
    transactions,
    selectedMonth,
    currency,
    upsertBudget,
    deleteBudget,
    copyPreviousMonthBudgets,
    pushToast,
  } = useFinance();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!externalDraft) return;
    const expenseCats = categories.filter((c) => c.type === 'expense');
    setSelectedCatId(externalDraft.categoryId || expenseCats[0]?.id || '');
    setAmountInput(
      externalDraft.amount !== undefined && externalDraft.amount > 0
        ? String(externalDraft.amount)
        : ''
    );
    setModalOpen(true);
  }, [externalDraft, categories]);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  const monthBudgets = useMemo(
    () => budgets.filter((b) => b.month === selectedMonth),
    [budgets, selectedMonth]
  );

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== 'expense' || !tx.date.startsWith(selectedMonth)) continue;
      map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
    }
    return map;
  }, [transactions, selectedMonth]);

  const budgetRows = useMemo(() => {
    const catMap = new Map(expenseCategories.map((c) => [c.id, c]));
    return monthBudgets
      .map((b) => {
        const cat = catMap.get(b.categoryId);
        const spent = spentByCategory.get(b.categoryId) || 0;
        const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        return {
          ...b,
          categoryName: cat?.name || 'Categoria removida',
          categoryColor: cat?.color || '#64748B',
          spent,
          remaining: b.amount - spent,
          pct,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [monthBudgets, expenseCategories, spentByCategory]);

  const totals = useMemo(() => {
    const totalLimit = budgetRows.reduce((s, r) => s + r.amount, 0);
    const totalSpent = budgetRows.reduce((s, r) => s + r.spent, 0);
    return {
      totalLimit,
      totalSpent,
      remaining: totalLimit - totalSpent,
    };
  }, [budgetRows]);

  const openModal = (categoryId?: string, currentAmount?: number) => {
    const fallbackCat = expenseCategories[0]?.id || '';
    setSelectedCatId(categoryId || fallbackCat);
    setAmountInput(currentAmount ? String(currentAmount) : '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(amountInput.replace(',', '.'));
    if (!selectedCatId || !numeric || numeric <= 0) {
      pushToast('error', 'Selecione uma categoria e informe um limite maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await upsertBudget(selectedCatId, selectedMonth, numeric);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Orçado ({formatMonthLabel(selectedMonth)})
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(totals.totalLimit, currency)}
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Realizado nas Categorias Orçadas
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(totals.totalSpent, currency)}
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Saldo Disponível
            </p>
            <p
              className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                totals.remaining >= 0
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(totals.remaining, currency)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => copyPreviousMonthBudgets(selectedMonth)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar mês anterior</span>
          </button>
          <button
            onClick={() => openModal()}
            disabled={expenseCategories.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Definir Orçamento</span>
          </button>
        </div>
      </div>

      {budgetRows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nenhum teto de orçamento definido para {formatMonthLabel(selectedMonth)}.
          </p>
          <button
            onClick={() => openModal()}
            className="px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
          >
            Criar Primeiro Orçamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetRows.map((row) => {
            const isOver = row.pct > 100;
            const isWarn = row.pct >= 80 && !isOver;
            return (
              <div
                key={row.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: row.categoryColor }}
                    />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {row.categoryName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openModal(row.categoryId, row.amount)}
                      aria-label="Editar orçamento"
                      className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBudget(row.id)}
                      aria-label="Excluir orçamento"
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isOver ? 'bg-red-600' : isWarn ? 'bg-amber-500' : 'bg-teal-600'
                    }`}
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(row.spent, currency)} de {formatCurrency(row.amount, currency)}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      isOver
                        ? 'text-red-600 dark:text-red-400'
                        : isWarn
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {isOver ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Excedido em {formatCurrency(Math.abs(row.remaining), currency)}</span>
                      </>
                    ) : isWarn ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Atenção ({row.pct.toFixed(0)}%)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Dentro da meta ({row.pct.toFixed(0)}%)</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Definir Orçamento Mensal
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Categoria de Despesa
                </label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Limite para {formatMonthLabel(selectedMonth)}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
                >
                  {saving ? 'Salvando...' : 'Salvar Orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
