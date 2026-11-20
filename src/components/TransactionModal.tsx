import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { getTodayIso } from '../lib/formatters';
import {
  RecurrenceFrequency,
  Transaction,
  TransactionFormDraft,
  TransactionStatus,
  TransactionType,
} from '../types/finance';

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  presetType?: TransactionType;
  presetAccountId?: string;
  presetToAccountId?: string;
  presetAmount?: number;
  presetDescription?: string;
  draft?: TransactionFormDraft | null;
}

export function TransactionModal({
  open,
  onClose,
  editingTransaction,
  presetType = 'expense',
  presetAccountId,
  presetToAccountId,
  presetAmount,
  presetDescription,
  draft,
}: TransactionModalProps) {
  const { accounts, categories, createTransaction, updateTransaction, pushToast } = useFinance();

  const activeAccounts = accounts.filter((a) => !a.archived);

  const [type, setType] = useState<TransactionType>(presetType);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayIso());
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [installments, setInstallments] = useState<number>(1);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('monthly');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editingTransaction) {
      setType(draft?.type ?? editingTransaction.type);
      setAmount(
        draft?.amount !== undefined ? String(draft.amount) : String(editingTransaction.amount)
      );
      setDescription(draft?.description ?? editingTransaction.description);
      setCategoryId(draft?.categoryId ?? editingTransaction.categoryId);
      setAccountId(draft?.accountId ?? editingTransaction.accountId);
      setToAccountId(draft?.toAccountId ?? (editingTransaction.toAccountId || ''));
      setDate(draft?.date ?? editingTransaction.date);
      setStatus(draft?.status ?? editingTransaction.status);
      setInstallments(1);
      setIsRecurring(draft?.isRecurring ?? editingTransaction.isRecurring);
      const nextFreq = draft?.recurrenceFrequency ?? editingTransaction.recurrenceFrequency;
      setRecurrenceFrequency(nextFreq === 'none' ? 'monthly' : nextFreq);
      setNotes(draft?.notes ?? (editingTransaction.notes || ''));
    } else {
      const initialType = draft?.type || presetType || 'expense';
      setType(initialType);
      const amt = draft?.amount ?? presetAmount;
      setAmount(amt && amt > 0 ? String(amt) : '');
      setDescription(draft?.description ?? presetDescription ?? '');
      const matchingCats = categories.filter(
        (c) => c.type === (initialType === 'income' ? 'income' : 'expense')
      );
      setCategoryId(
        draft?.categoryId || matchingCats[0]?.id || categories[0]?.id || 'cat_outros'
      );
      const defaultSource =
        draft?.accountId ||
        presetAccountId ||
        activeAccounts.find((a) => a.type !== 'credit')?.id ||
        activeAccounts[0]?.id ||
        '';
      setAccountId(defaultSource);
      const defaultDest =
        draft?.toAccountId ||
        presetToAccountId ||
        activeAccounts.find((a) => a.id !== defaultSource)?.id ||
        '';
      setToAccountId(defaultDest);
      setDate(draft?.date || getTodayIso());
      setStatus(draft?.status || 'paid');
      setInstallments(
        draft?.installments ? Math.max(1, Math.min(48, draft.installments)) : 1
      );
      setIsRecurring(Boolean(draft?.isRecurring));
      setRecurrenceFrequency(
        draft?.recurrenceFrequency && draft.recurrenceFrequency !== 'none'
          ? draft.recurrenceFrequency
          : 'monthly'
      );
      setNotes(draft?.notes || '');
    }
  }, [
    open,
    editingTransaction,
    presetType,
    presetAccountId,
    presetToAccountId,
    presetAmount,
    presetDescription,
    draft,
  ]);

  // Keep category aligned when switching between income and expense
  useEffect(() => {
    if (!open || type === 'transfer') return;
    const desiredType = type === 'income' ? 'income' : 'expense';
    const currentCat = categories.find((c) => c.id === categoryId);
    if (!currentCat || currentCat.type !== desiredType) {
      const firstMatch = categories.find((c) => c.type === desiredType);
      if (firstMatch) setCategoryId(firstMatch.id);
    }
  }, [type, categories, categoryId, open]);

  if (!open) return null;

  const filteredCategories = categories.filter(
    (c) => c.type === (type === 'income' ? 'income' : 'expense')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      pushToast('error', 'Informe um valor maior que zero.');
      return;
    }
    if (!description.trim()) {
      pushToast('error', 'Informe uma descrição para o lançamento.');
      return;
    }
    if (!accountId) {
      pushToast('error', 'Selecione uma conta ou cartão.');
      return;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      pushToast('error', 'Selecione uma conta de destino diferente da conta de origem.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction, {
          type,
          amount: numericAmount,
          description,
          categoryId: type === 'transfer' ? 'transfer' : categoryId,
          accountId,
          toAccountId: type === 'transfer' ? toAccountId : '',
          date,
          status,
          isRecurring,
          recurrenceFrequency: isRecurring ? recurrenceFrequency : 'none',
          notes,
        });
      } else {
        await createTransaction({
          type,
          amount: numericAmount,
          description,
          categoryId: type === 'transfer' ? 'transfer' : categoryId,
          accountId,
          toAccountId: type === 'transfer' ? toAccountId : '',
          date,
          status,
          isRecurring: installments > 1 ? false : isRecurring,
          recurrenceFrequency:
            installments > 1 || !isRecurring ? 'none' : recurrenceFrequency,
          installments,
          notes,
        });
      }
      onClose();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Erro ao salvar lançamento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {activeAccounts.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-300">
              Você ainda não possui contas cadastradas. Crie uma conta na aba{' '}
              <strong>Contas e Cartões</strong> antes de registrar transações.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    { id: 'expense', label: 'Despesa' },
                    { id: 'income', label: 'Receita' },
                    { id: 'transfer', label: 'Transferência' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id)}
                    className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      type === item.id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Valor
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Descrição
                </label>
                <input
                  type="text"
                  maxLength={140}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Supermercado, Salário, Pagamento fatura"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    {type === 'transfer' ? 'Conta de Origem' : 'Conta / Cartão'}
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution || acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                {type === 'transfer' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Conta de Destino
                    </label>
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {activeAccounts
                        .filter((acc) => acc.id !== accountId)
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.institution || acc.type})
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Categoria
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {filteredCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Situação
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setStatus('paid')}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                        status === 'paid'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Efetivado
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('pending')}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                        status === 'pending'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Pendente
                    </button>
                  </div>
                </div>

                {!editingTransaction && type !== 'transfer' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Parcelamento (meses)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={installments}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(48, Number(e.target.value) || 1));
                        setInstallments(val);
                        if (val > 1) setIsRecurring(false);
                      }}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                )}
              </div>

              {installments === 1 && (
                <div className="flex items-center justify-between gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <span>Lançamento recorrente</span>
                  </label>

                  {isRecurring && (
                    <select
                      value={recurrenceFrequency}
                      onChange={(e) => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    >
                      <option value="monthly">Mensal</option>
                      <option value="weekly">Semanal</option>
                      <option value="yearly">Anual</option>
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Observações (opcional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalhes adicionais, número do documento ou centro de custo"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            {activeAccounts.length > 0 && (
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                {submitting
                  ? 'Salvando...'
                  : editingTransaction
                  ? 'Salvar Alterações'
                  : 'Registrar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
