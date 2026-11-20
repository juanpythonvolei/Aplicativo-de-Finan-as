import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import {
  exportTransactionsToCSV,
  formatCurrency,
  formatIsoDate,
} from '../lib/formatters';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  TransactionsFilterDraft,
} from '../types/finance';

interface TransactionsViewProps {
  onNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  filterDraft?: TransactionsFilterDraft | null;
}

export function TransactionsView({
  onNewTransaction,
  onEditTransaction,
  filterDraft,
}: TransactionsViewProps) {
  const {
    transactions,
    accounts,
    categories,
    selectedMonth,
    currency,
    toggleTransactionStatus,
    deleteTransaction,
  } = useFinance();

  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!filterDraft) return;
    setScope(filterDraft.scope ?? 'month');
    setSearch(filterDraft.search ?? '');
    setTypeFilter(filterDraft.type ?? 'all');
    setAccountFilter(filterDraft.accountId ?? 'all');
    setCategoryFilter(filterDraft.categoryId ?? 'all');
    setStatusFilter(filterDraft.status ?? 'all');
  }, [filterDraft]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (scope === 'month' && !tx.date.startsWith(selectedMonth)) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (
        accountFilter !== 'all' &&
        tx.accountId !== accountFilter &&
        tx.toAccountId !== accountFilter
      )
        return false;
      if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (q) {
        const catName = categoryMap.get(tx.categoryId)?.name.toLowerCase() || '';
        const accName = accountMap.get(tx.accountId)?.name.toLowerCase() || '';
        const match =
          tx.description.toLowerCase().includes(q) ||
          tx.notes.toLowerCase().includes(q) ||
          catName.includes(q) ||
          accName.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    transactions,
    scope,
    selectedMonth,
    typeFilter,
    accountFilter,
    categoryFilter,
    statusFilter,
    search,
    categoryMap,
    accountMap,
  ]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                onClick={() => setScope('month')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  scope === 'month'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Mês selecionado
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  scope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Todo período
              </button>
            </div>

            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'income', label: 'Receitas' },
                  { id: 'expense', label: 'Despesas' },
                  { id: 'transfer', label: 'Transferências' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTypeFilter(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    typeFilter === item.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                exportTransactionsToCSV(
                  filtered,
                  accounts,
                  categories,
                  `extrato-${scope === 'month' ? selectedMonth : 'completo'}.csv`
                )
              }
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={onNewTransaction}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Lançamento</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição, nota ou categoria..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">Todas as contas</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | TransactionStatus)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">Todas as situações</option>
            <option value="paid">Efetivado</option>
            <option value="pending">Pendente</option>
          </select>
        </div>

        {/* Summary strip */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'} encontrados
          </span>
          <div className="flex flex-wrap items-center gap-6 font-mono tabular-nums">
            <span className="text-emerald-700 dark:text-emerald-400">
              Receitas: {formatCurrency(summary.income, currency)}
            </span>
            <span className="text-slate-700 dark:text-slate-300">
              Despesas: {formatCurrency(summary.expense, currency)}
            </span>
            <span
              className={`font-semibold ${
                summary.net >= 0
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              Saldo: {formatCurrency(summary.net, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhum lançamento corresponde aos filtros aplicados.
            </p>
            <button
              onClick={onNewTransaction}
              className="px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors"
            >
              Registrar Lançamento
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                  <th className="py-3 px-5">Data</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Conta</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filtered.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  const acc = accountMap.get(tx.accountId);
                  const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : null;
                  const isConfirming = confirmDeleteId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-5 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatIsoDate(tx.date)}
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {tx.description}
                          {tx.installmentTotal > 1 && (
                            <span className="ml-1.5 font-mono text-xs text-slate-500">
                              ({tx.installmentNumber}/{tx.installmentTotal})
                            </span>
                          )}
                          {tx.isRecurring && (
                            <span className="ml-1.5 text-xs text-slate-400">· Recorrente</span>
                          )}
                        </p>
                        {tx.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {tx.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {tx.type === 'transfer' ? 'Transferência' : cat?.name || 'Outros'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {tx.type === 'transfer'
                          ? `${acc?.name || '-'} → ${toAcc?.name || '-'}`
                          : acc?.name || '-'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleTransactionStatus(tx)}
                          className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${
                            tx.status === 'paid'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {tx.status === 'paid' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Efetivado</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pendente</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono font-medium tabular-nums whitespace-nowrap ${
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
                      <td className="py-2.5 px-5 text-right whitespace-nowrap">
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-2 text-xs">
                            <button
                              onClick={() => {
                                deleteTransaction(tx);
                                setConfirmDeleteId(null);
                              }}
                              className="text-red-600 dark:text-red-400 font-semibold hover:underline"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-slate-500 hover:underline"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => onEditTransaction(tx)}
                              aria-label="Editar lançamento"
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(tx.id)}
                              aria-label="Excluir lançamento"
                              className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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
