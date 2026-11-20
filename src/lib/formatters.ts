import { Account, Category, CurrencyCode, Transaction } from '../types/finance';

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  BRL: 'pt-BR',
  USD: 'en-US',
  EUR: 'de-DE',
};

export function formatCurrency(value: number, currency: CurrencyCode = 'BRL'): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactCurrency(value: number, currency: CurrencyCode = 'BRL'): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${value < 0 ? '-' : ''}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 1_000) {
    return `${value < 0 ? '-' : ''}${(abs / 1_000).toFixed(1).replace('.', ',')}k`;
  }
  return formatCurrency(value, currency);
}

export function formatIsoDate(isoDate: string): string {
  if (!isoDate || isoDate.length !== 10) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate || isoDate.length !== 10) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(dt);
}

export function formatMonthLabel(monthKey: string): string {
  if (!monthKey || monthKey.length !== 7) return monthKey;
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(dt);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatShortMonthLabel(monthKey: string): string {
  if (!monthKey || monthKey.length !== 7) return monthKey;
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(dt).replace('.', '');
  return `${month.charAt(0).toUpperCase() + month.slice(1)}/${String(y).slice(2)}`;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey(): string {
  return getTodayIso().slice(0, 7);
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(y, m - 1 + deltaMonths, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonthsToIsoDate(isoDate: string, deltaMonths: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const targetMonthDate = new Date(y, m - 1 + deltaMonths, 1);
  const maxDay = new Date(
    targetMonthDate.getFullYear(),
    targetMonthDate.getMonth() + 1,
    0
  ).getDate();
  const clampedDay = Math.min(d, maxDay);
  return `${targetMonthDate.getFullYear()}-${String(targetMonthDate.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(clampedDay).padStart(2, '0')}`;
}

export function getRecentMonthKeys(anchorMonth: string, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(shiftMonthKey(anchorMonth, -i));
  }
  return keys;
}

export function generateSafeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${random}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export function exportTransactionsToCSV(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  filename = 'extrato-vertice-finance.csv'
) {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const typeLabel: Record<Transaction['type'], string> = {
    income: 'Receita',
    expense: 'Despesa',
    transfer: 'Transferência',
  };

  const statusLabel: Record<Transaction['status'], string> = {
    paid: 'Efetivado',
    pending: 'Pendente',
  };

  const headers = [
    'Data',
    'Tipo',
    'Descrição',
    'Categoria',
    'Conta',
    'Conta Destino',
    'Valor',
    'Status',
    'Parcela',
    'Observações',
  ];

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = transactions.map((tx) => {
    const parcela =
      tx.installmentTotal > 1 ? `${tx.installmentNumber}/${tx.installmentTotal}` : '';
    const categoryName =
      tx.type === 'transfer' ? 'Transferência' : categoryMap.get(tx.categoryId) || 'Outros';
    const accountName = accountMap.get(tx.accountId) || '-';
    const toAccountName = tx.toAccountId ? accountMap.get(tx.toAccountId) || '-' : '';
    const amountFormatted = tx.amount.toFixed(2).replace('.', ',');

    return [
      tx.date,
      typeLabel[tx.type],
      tx.description,
      categoryName,
      accountName,
      toAccountName,
      amountFormatted,
      statusLabel[tx.status],
      parcela,
      tx.notes,
    ]
      .map(escapeCsv)
      .join(';');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
