import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CreditCard,
  Edit2,
  Landmark,
  Plus,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { AccountInput, useFinance } from '../contexts/FinanceContext';
import { formatCurrency } from '../lib/formatters';
import { Account, AccountFormDraft, AccountType } from '../types/finance';
import { DepthCard } from './DepthCard';

interface AccountsViewProps {
  onPayCreditCard: (creditCard: Account, invoiceAmount: number) => void;
  onQuickTransfer: (fromAccount: Account) => void;
  externalDraft?: AccountFormDraft | null;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  wallet: 'Carteira',
  investment: 'Investimentos',
  credit: 'Cartão de Crédito',
};

const COLOR_OPTIONS = ['#0F766E', '#0284C7', '#1E293B', '#475569', '#D97706', '#7C3AED', '#DC2626'];

export function AccountsView({
  onPayCreditCard,
  onQuickTransfer,
  externalDraft,
}: AccountsViewProps) {
  const {
    accounts,
    currency,
    createAccount,
    updateAccount,
    deleteAccount,
    pushToast,
  } = useFinance();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('5000');
  const [closingDay, setClosingDay] = useState('3');
  const [dueDay, setDueDay] = useState('10');
  const [color, setColor] = useState('#0F766E');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!externalDraft) return;
    const targetAcc = externalDraft.editingAccountId
      ? accounts.find((a) => a.id === externalDraft.editingAccountId) || null
      : null;
    setEditing(targetAcc);
    const nextType = externalDraft.type ?? targetAcc?.type ?? 'checking';
    setType(nextType);
    setName(externalDraft.name ?? targetAcc?.name ?? '');
    setInstitution(externalDraft.institution ?? targetAcc?.institution ?? '');
    const bal =
      externalDraft.balance !== undefined
        ? externalDraft.balance
        : targetAcc
        ? targetAcc.type === 'credit'
          ? Math.abs(targetAcc.balance)
          : targetAcc.balance
        : 0;
    setBalance(String(bal));
    setCreditLimit(String(externalDraft.creditLimit ?? targetAcc?.creditLimit ?? 5000));
    setClosingDay(String(externalDraft.closingDay ?? targetAcc?.closingDay ?? 3));
    setDueDay(String(externalDraft.dueDay ?? targetAcc?.dueDay ?? 10));
    setColor(
      externalDraft.color ?? targetAcc?.color ?? (nextType === 'credit' ? '#1E293B' : '#0F766E')
    );
    setModalOpen(true);
  }, [externalDraft, accounts]);

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'credit' && !a.archived),
    [accounts]
  );
  const creditCards = useMemo(
    () => accounts.filter((a) => a.type === 'credit' && !a.archived),
    [accounts]
  );

  const totalAssets = useMemo(
    () => bankAccounts.reduce((sum, a) => sum + a.balance, 0),
    [bankAccounts]
  );
  const totalInvoices = useMemo(
    () => creditCards.reduce((sum, c) => sum + Math.max(0, -c.balance), 0),
    [creditCards]
  );

  const openCreateModal = (defaultType: AccountType = 'checking') => {
    setEditing(null);
    setName('');
    setType(defaultType);
    setInstitution('');
    setBalance('0');
    setCreditLimit('5000');
    setClosingDay('3');
    setDueDay('10');
    setColor(defaultType === 'credit' ? '#1E293B' : '#0F766E');
    setModalOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditing(acc);
    setName(acc.name);
    setType(acc.type);
    setInstitution(acc.institution);
    setBalance(acc.type === 'credit' ? String(Math.abs(acc.balance)) : String(acc.balance));
    setCreditLimit(String(acc.creditLimit || 0));
    setClosingDay(String(acc.closingDay || 1));
    setDueDay(String(acc.dueDay || 10));
    setColor(acc.color || '#0F766E');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      pushToast('error', 'Informe o nome da conta ou cartão.');
      return;
    }

    const parsedBalance = parseFloat(balance.replace(',', '.')) || 0;
    const normalizedBalance =
      type === 'credit' ? -Math.abs(parsedBalance) : parsedBalance;

    const payload: AccountInput = {
      name: name.trim(),
      type,
      institution: institution.trim(),
      balance: normalizedBalance,
      creditLimit: type === 'credit' ? Math.max(0, parseFloat(creditLimit.replace(',', '.')) || 0) : 0,
      closingDay: type === 'credit' ? Math.max(1, Math.min(31, Number(closingDay) || 1)) : 0,
      dueDay: type === 'credit' ? Math.max(1, Math.min(31, Number(dueDay) || 10)) : 0,
      color,
      archived: false,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateAccount(editing, payload);
      } else {
        await createAccount(payload);
      }
      setModalOpen(false);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Erro ao salvar conta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Summary Header */}
      <div className="depth-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Saldo em Contas e Investimentos
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(totalAssets, currency)}
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Faturas em Aberto
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(totalInvoices, currency)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => openCreateModal('credit')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <CreditCard className="w-4 h-4" />
            <span>Novo Cartão</span>
          </button>
          <button
            onClick={() => openCreateModal('checking')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Conta</span>
          </button>
        </div>
      </div>

      {/* Bank Accounts & Wallets */}
      <section className="space-y-4">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Contas Bancárias, Carteiras e Investimentos
        </h2>

        {bankAccounts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhuma conta bancária cadastrada ainda.
            </p>
            <button
              onClick={() => openCreateModal('checking')}
              className="px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
            >
              Cadastrar Primeira Conta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {bankAccounts.map((acc, index) => {
              const isConfirming = confirmDeleteId === acc.id;
              return (
                <DepthCard
                  key={acc.id}
                  delay={Math.min(0.24, index * 0.04)}
                  tiltStrength={3.5}
                  className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
                >
                  <div className="flex flex-col justify-between gap-4 h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: acc.color }}
                        >
                          {acc.type === 'wallet' ? (
                            <Wallet className="w-5 h-5" />
                          ) : (
                            <Landmark className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {acc.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {ACCOUNT_TYPE_LABELS[acc.type]}
                            {acc.institution ? ` · ${acc.institution}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditModal(acc)}
                          aria-label="Editar conta"
                          className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(acc.id)}
                          aria-label="Excluir conta"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Saldo atual</p>
                        <p
                          className={`font-mono text-lg font-semibold tabular-nums break-words ${
                            acc.balance >= 0
                              ? 'text-slate-900 dark:text-white'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {formatCurrency(acc.balance, currency)}
                        </p>
                      </div>

                      {isConfirming ? (
                        <div className="flex items-center gap-2 text-xs shrink-0">
                          <button
                            onClick={() => {
                              deleteAccount(acc.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-red-600 font-semibold hover:underline"
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-slate-500 hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        accounts.length > 1 && (
                          <button
                            onClick={() => onQuickTransfer(acc)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap shrink-0"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            Transferir
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </DepthCard>
              );
            })}
          </div>
        )}
      </section>

      {/* Credit Cards */}
      <section className="space-y-4">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Cartões de Crédito
        </h2>

        {creditCards.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhum cartão de crédito cadastrado.
            </p>
            <button
              onClick={() => openCreateModal('credit')}
              className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
            >
              Adicionar Cartão de Crédito
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creditCards.map((card, index) => {
              const openInvoice = Math.max(0, -card.balance);
              const availableLimit = Math.max(0, card.creditLimit - openInvoice);
              const usagePct =
                card.creditLimit > 0 ? Math.min(100, (openInvoice / card.creditLimit) * 100) : 0;
              const isConfirming = confirmDeleteId === card.id;

              return (
                <DepthCard
                  key={card.id}
                  delay={Math.min(0.24, index * 0.05)}
                  tiltStrength={3.5}
                  className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: card.color }}
                        >
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {card.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {card.institution || 'Cartão de Crédito'} · Fecha dia {card.closingDay} ·
                            Vence dia {card.dueDay}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditModal(card)}
                          aria-label="Editar cartão"
                          className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(card.id)}
                          aria-label="Excluir cartão"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          Utilização do limite ({usagePct.toFixed(0)}%)
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          Disponível: {formatCurrency(availableLimit, currency)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            usagePct >= 85
                              ? 'bg-red-600'
                              : usagePct >= 60
                              ? 'bg-amber-500'
                              : 'bg-teal-600'
                          }`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Fatura em aberto
                        </p>
                        <p className="font-mono text-lg font-semibold tabular-nums break-words text-slate-900 dark:text-white">
                          {formatCurrency(openInvoice, currency)}
                        </p>
                      </div>

                      {isConfirming ? (
                        <div className="flex items-center gap-2 text-xs shrink-0">
                          <button
                            onClick={() => {
                              deleteAccount(card.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-red-600 font-semibold hover:underline"
                          >
                            Confirmar Exclusão
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-slate-500 hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        openInvoice > 0 &&
                        bankAccounts.length > 0 && (
                          <button
                            onClick={() => onPayCreditCard(card, openInvoice)}
                            className="px-3.5 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Pagar Fatura
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </DepthCard>
              );
            })}
          </div>
        )}
      </section>

      {/* Account / Card Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editing ? 'Editar Conta' : 'Nova Conta ou Cartão'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Conta Corrente Itaú ou Cartão Black"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="checking">Conta Corrente</option>
                    <option value="savings">Poupança</option>
                    <option value="investment">Investimentos</option>
                    <option value="wallet">Carteira</option>
                    <option value="credit">Cartão de Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Instituição
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Ex.: Nubank, XP..."
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {type === 'credit' ? 'Fatura em Aberto Atual' : 'Saldo Atual'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              {type === 'credit' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Limite Total
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Dia Fecham.
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={closingDay}
                      onChange={(e) => setClosingDay(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Dia Vencim.
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Cor de identificação
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
