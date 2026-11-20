import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Edit2, Plus, Target, Trash2, X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency, formatIsoDate, getTodayIso } from '../lib/formatters';
import { Goal, GoalFormDraft } from '../types/finance';
import { DepthCard } from './DepthCard';

const GOAL_COLORS = ['#0F766E', '#0284C7', '#D97706', '#7C3AED', '#DC2626'];

interface GoalsViewProps {
  externalDraft?: GoalFormDraft | null;
}

export function GoalsView({ externalDraft }: GoalsViewProps) {
  const {
    goals,
    accounts,
    currency,
    createGoal,
    updateGoal,
    contributeToGoal,
    deleteGoal,
    pushToast,
  } = useFinance();

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState(getTodayIso());
  const [color, setColor] = useState('#0F766E');

  const [contribGoal, setContribGoal] = useState<Goal | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!externalDraft) return;
    if (externalDraft.mode === 'contribute') {
      const target =
        (externalDraft.goalId && goals.find((g) => g.id === externalDraft.goalId)) ||
        goals[0] ||
        null;
      if (target) {
        setContribGoal(target);
        setContribAmount(
          externalDraft.amount !== undefined && externalDraft.amount > 0
            ? String(externalDraft.amount)
            : ''
        );
        setSourceAccountId(externalDraft.sourceAccountId || '');
        setGoalModalOpen(false);
      }
      return;
    }

    const existing = externalDraft.goalId
      ? goals.find((g) => g.id === externalDraft.goalId) || null
      : null;
    setEditingGoal(existing);
    setName(externalDraft.name ?? existing?.name ?? '');
    setTargetAmount(
      externalDraft.targetAmount !== undefined
        ? String(externalDraft.targetAmount)
        : existing
        ? String(existing.targetAmount)
        : ''
    );
    setCurrentAmount(
      externalDraft.currentAmount !== undefined
        ? String(externalDraft.currentAmount)
        : existing
        ? String(existing.currentAmount)
        : '0'
    );
    setDeadline(externalDraft.deadline ?? existing?.deadline ?? getTodayIso());
    setColor(externalDraft.color ?? existing?.color ?? '#0F766E');
    setContribGoal(null);
    setGoalModalOpen(true);
  }, [externalDraft, goals]);

  const liquidAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'credit' && !a.archived),
    [accounts]
  );

  const openCreate = () => {
    setEditingGoal(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('0');
    setDeadline(getTodayIso());
    setColor('#0F766E');
    setGoalModalOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(String(goal.targetAmount));
    setCurrentAmount(String(goal.currentAmount));
    setDeadline(goal.deadline);
    setColor(goal.color);
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetAmount.replace(',', '.'));
    const current = parseFloat(currentAmount.replace(',', '.')) || 0;
    if (!name.trim() || !target || target <= 0) {
      pushToast('error', 'Informe um nome e um valor alvo maior que zero.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingGoal) {
        await updateGoal(editingGoal, {
          name: name.trim(),
          targetAmount: target,
          currentAmount: Math.max(0, current),
          deadline,
          color,
          status: current >= target ? 'completed' : 'active',
        });
      } else {
        await createGoal({
          name: name.trim(),
          targetAmount: target,
          currentAmount: Math.max(0, current),
          deadline,
          color,
        });
      }
      setGoalModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    const val = parseFloat(contribAmount.replace(',', '.'));
    if (!val || val <= 0) {
      pushToast('error', 'Informe um valor de aporte positivo.');
      return;
    }
    setSubmitting(true);
    try {
      await contributeToGoal(contribGoal, val, sourceAccountId || undefined);
      setContribGoal(null);
      setContribAmount('');
    } finally {
      setSubmitting(false);
    }
  };

  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="space-y-6">
      <div className="depth-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Acumulado em Metas
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-teal-700 dark:text-teal-400">
              {formatCurrency(totalSaved, currency)}
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Objetivo Somado
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(totalTarget, currency)}
            </p>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Meta</span>
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nenhuma meta financeira cadastrada ainda.
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
          >
            Criar Primeira Meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((g, index) => {
            const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
            const isCompleted = g.status === 'completed';

            return (
              <DepthCard
                key={g.id}
                delay={Math.min(0.24, index * 0.04)}
                tiltStrength={3.5}
                className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
              >
                <div className="flex flex-col justify-between gap-4 h-full">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: g.color }}
                        >
                          <Target className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {g.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Prazo: {formatIsoDate(g.deadline)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!isCompleted && (
                          <button
                            onClick={() => openEdit(g)}
                            aria-label="Editar meta"
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteGoal(g.id)}
                          aria-label="Excluir meta"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-mono tabular-nums">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(g.currentAmount, currency)}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {pct.toFixed(1)}% de {formatCurrency(g.targetAmount, currency)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: g.color }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Meta concluída
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          Faltam {formatCurrency(remaining, currency)}
                        </span>
                        <button
                          onClick={() => {
                            setContribGoal(g);
                            setContribAmount('');
                            setSourceAccountId('');
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          Aportar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </DepthCard>
            );
          })}
        </div>
      )}

      {/* Goal Create/Edit Modal */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editingGoal ? 'Editar Meta' : 'Nova Meta Financeira'}
              </h3>
              <button
                onClick={() => setGoalModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Nome da Meta
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Reserva de Emergência"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Valor Alvo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Valor Inicial
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Prazo Estimado
                </label>
                <input
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Cor
                </label>
                <div className="flex items-center gap-2">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 ${
                        color === c
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
                >
                  {submitting ? 'Salvando...' : 'Salvar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {contribGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Aportar em: {contribGoal.name}
              </h3>
              <button
                onClick={() => setContribGoal(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContribute} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Valor do Aporte
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              {liquidAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Debitar saldo de conta (opcional)
                  </label>
                  <select
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Apenas atualizar progresso da meta</option>
                    {liquidAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance, currency)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setContribGoal(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
                >
                  {submitting ? 'Registrando...' : 'Confirmar Aporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
