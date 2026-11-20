import {
  Account,
  AccountFormDraft,
  AccountType,
  Budget,
  BudgetFormDraft,
  Category,
  CategoryFormDraft,
  CategoryType,
  CurrencyCode,
  Goal,
  GoalFormDraft,
  GoalStatus,
  RecurrenceFrequency,
  SettingsSection,
  ThemeMode,
  Transaction,
  TransactionFormDraft,
  TransactionStatus,
  TransactionType,
  TransactionsFilterDraft,
  ViewTab,
} from '../types/finance';
import type {
  AccountInput,
  CategoryInput,
  GoalInput,
  NewTransactionInput,
} from '../contexts/FinanceContext';
import {
  exportTransactionsToCSV,
  formatCurrency,
  getTodayIso,
  shiftMonthKey,
} from './formatters';

export interface GeminiFunctionCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: GeminiFunctionCall;
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, unknown>;
  };
  thoughtSignature?: string;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface ExecutedActionRecord {
  id: string;
  toolName: string;
  label: string;
  detail: string;
}

export interface PendingConfirmation {
  id: string;
  entityType: 'transaction' | 'account' | 'category' | 'budget' | 'goal';
  title: string;
  detail: string;
  resolved?: 'confirmed' | 'cancelled';
  execute: () => Promise<string>;
}

export interface AssistantRuntimeContext {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  selectedMonth: string;
  currency: CurrencyCode;
  theme: ThemeMode;
  setSelectedMonth: (month: string) => void;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  loadSampleData: () => Promise<void>;
  onNavigate: (tab: ViewTab) => void;
  createTransaction: (input: NewTransactionInput) => Promise<void>;
  bulkCreateTransactions: (inputs: NewTransactionInput[]) => Promise<number>;
  updateTransaction: (
    tx: Transaction,
    updates: Omit<NewTransactionInput, 'installments'>
  ) => Promise<void>;
  bulkUpdateTransactions: (
    items: Array<{ tx: Transaction; updates: Omit<NewTransactionInput, 'installments'> }>
  ) => Promise<number>;
  toggleTransactionStatus: (tx: Transaction) => Promise<void>;
  deleteTransaction: (tx: Transaction) => Promise<void>;
  bulkDeleteTransactions: (txs: Transaction[]) => Promise<number>;
  createAccount: (input: AccountInput) => Promise<void>;
  updateAccount: (account: Account, updates: AccountInput) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  createCategory: (input: CategoryInput) => Promise<void>;
  updateCategory: (category: Category, updates: CategoryInput) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  upsertBudget: (categoryId: string, month: string, amount: number) => Promise<void>;
  bulkUpsertBudgets: (
    entries: Array<{ categoryId: string; month: string; amount: number }>
  ) => Promise<number>;
  deleteBudget: (budgetId: string) => Promise<void>;
  copyPreviousMonthBudgets: (targetMonth: string) => Promise<void>;
  createGoal: (input: GoalInput) => Promise<void>;
  updateGoal: (goal: Goal, updates: GoalInput & { status: GoalStatus }) => Promise<void>;
  contributeToGoal: (goal: Goal, amount: number, sourceAccountId?: string) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  // Programmatic UI & Form Controllers
  openTransactionForm?: (draft: Omit<TransactionFormDraft, 'nonce'>) => void;
  openAccountForm?: (draft: Omit<AccountFormDraft, 'nonce'>) => void;
  openBudgetForm?: (draft: Omit<BudgetFormDraft, 'nonce'>) => void;
  openGoalForm?: (draft: Omit<GoalFormDraft, 'nonce'>) => void;
  openCategoryForm?: (draft: Omit<CategoryFormDraft, 'nonce'>) => void;
  applyTransactionsFilter?: (draft: Omit<TransactionsFilterDraft, 'nonce'>) => void;
  setReportsRange?: (monthsCount: 6 | 12) => void;
  openSettings?: (section?: SettingsSection) => void;
  closeAssistantDrawer?: () => void;
}

function normalizeStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function normalizeLower(val: unknown): string {
  return normalizeStr(val).toLowerCase();
}

function resolveAccount(accounts: Account[], idOrName: unknown): Account | undefined {
  const key = normalizeStr(idOrName);
  if (!key) return undefined;
  const byId = accounts.find((a) => a.id === key);
  if (byId) return byId;
  const lower = key.toLowerCase();
  return (
    accounts.find((a) => a.name.toLowerCase() === lower) ||
    accounts.find((a) => a.name.toLowerCase().includes(lower))
  );
}

function resolveCategory(
  categories: Category[],
  idOrName: unknown,
  preferredType?: CategoryType
): Category | undefined {
  const key = normalizeStr(idOrName);
  if (!key) return undefined;
  const byId = categories.find((c) => c.id === key);
  if (byId) return byId;
  const lower = key.toLowerCase();
  const pool = preferredType ? categories.filter((c) => c.type === preferredType) : categories;
  return (
    pool.find((c) => c.name.toLowerCase() === lower) ||
    pool.find((c) => c.name.toLowerCase().includes(lower)) ||
    categories.find((c) => c.name.toLowerCase() === lower)
  );
}

function resolveGoal(goals: Goal[], idOrName: unknown): Goal | undefined {
  const key = normalizeStr(idOrName);
  if (!key) return undefined;
  const byId = goals.find((g) => g.id === key);
  if (byId) return byId;
  const lower = key.toLowerCase();
  return (
    goals.find((g) => g.name.toLowerCase() === lower) ||
    goals.find((g) => g.name.toLowerCase().includes(lower))
  );
}

function pickDefaultAccount(accounts: Account[], preferLiquid = true): Account | undefined {
  const active = accounts.filter((a) => !a.archived);
  if (preferLiquid) {
    return active.find((a) => a.type !== 'credit') || active[0] || accounts[0];
  }
  return active[0] || accounts[0];
}

function computeMonthStats(
  transactions: Transaction[],
  categories: Category[],
  month: string
) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  let income = 0;
  let incomePaid = 0;
  let expense = 0;
  let expensePaid = 0;
  let transferTotal = 0;
  let pendingCount = 0;
  const byCategory = new Map<string, { categoryId: string; name: string; total: number }>();

  for (const tx of transactions) {
    if (!tx.date.startsWith(month)) continue;
    if (tx.status === 'pending') pendingCount++;
    if (tx.type === 'income') {
      income += tx.amount;
      if (tx.status === 'paid') incomePaid += tx.amount;
    } else if (tx.type === 'expense') {
      expense += tx.amount;
      if (tx.status === 'paid') expensePaid += tx.amount;
      const cat = categoryMap.get(tx.categoryId);
      const entry = byCategory.get(tx.categoryId) || {
        categoryId: tx.categoryId,
        name: cat?.name || 'Outros',
        total: 0,
      };
      entry.total = Math.round((entry.total + tx.amount) * 100) / 100;
      byCategory.set(tx.categoryId, entry);
    } else if (tx.type === 'transfer') {
      transferTotal += tx.amount;
    }
  }

  const netResult = Math.round((income - expense) * 100) / 100;
  const savingsRate = income > 0 ? Math.round(((netResult / income) * 100) * 10) / 10 : 0;

  return {
    month,
    income: Math.round(income * 100) / 100,
    incomePaid: Math.round(incomePaid * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    expensePaid: Math.round(expensePaid * 100) / 100,
    transferTotal: Math.round(transferTotal * 100) / 100,
    netResult,
    savingsRate,
    pendingCount,
    expensesByCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
  };
}

export function buildFinancialSnapshot(ctx: AssistantRuntimeContext): string {
  const activeAccounts = ctx.accounts.filter((a) => !a.archived);
  const consolidatedBalance = activeAccounts.reduce((acc, item) => acc + item.balance, 0);
  const liquidAssets = activeAccounts
    .filter((a) => a.type !== 'credit')
    .reduce((acc, item) => acc + item.balance, 0);
  const creditDebt = activeAccounts
    .filter((a) => a.type === 'credit')
    .reduce((acc, item) => acc + Math.max(0, -item.balance), 0);

  const monthStats = computeMonthStats(ctx.transactions, ctx.categories, ctx.selectedMonth);
  const categoryMap = new Map(ctx.categories.map((c) => [c.id, c]));
  const accountMap = new Map(ctx.accounts.map((a) => [a.id, a]));

  const monthBudgets = ctx.budgets
    .filter((b) => b.month === ctx.selectedMonth)
    .map((b) => {
      const spent = ctx.transactions
        .filter(
          (tx) =>
            tx.type === 'expense' &&
            tx.date.startsWith(ctx.selectedMonth) &&
            tx.categoryId === b.categoryId
        )
        .reduce((s, t) => s + t.amount, 0);
      return {
        id: b.id,
        categoryId: b.categoryId,
        category: categoryMap.get(b.categoryId)?.name || b.categoryId,
        limit: b.amount,
        spent: Math.round(spent * 100) / 100,
      };
    });

  const recentTxs = ctx.transactions.slice(0, 18).map((tx) => ({
    id: tx.id,
    date: tx.date,
    type: tx.type,
    amount: tx.amount,
    description: tx.description,
    category:
      tx.type === 'transfer'
        ? 'Transferência'
        : categoryMap.get(tx.categoryId)?.name || tx.categoryId,
    account: accountMap.get(tx.accountId)?.name || tx.accountId,
    status: tx.status,
    installment:
      tx.installmentTotal > 1 ? `${tx.installmentNumber}/${tx.installmentTotal}` : undefined,
  }));

  return JSON.stringify({
    today: getTodayIso(),
    selectedMonth: ctx.selectedMonth,
    currency: ctx.currency,
    theme: ctx.theme,
    totals: {
      consolidatedBalance: Math.round(consolidatedBalance * 100) / 100,
      liquidAssets: Math.round(liquidAssets * 100) / 100,
      creditDebt: Math.round(creditDebt * 100) / 100,
      totalTransactionsCount: ctx.transactions.length,
    },
    selectedMonthSummary: monthStats,
    accounts: ctx.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      balance: a.balance,
      creditLimit: a.creditLimit,
      closingDay: a.closingDay,
      dueDay: a.dueDay,
      archived: a.archived,
    })),
    categories: ctx.categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    })),
    selectedMonthBudgets: monthBudgets,
    goals: ctx.goals.map((g) => ({
      id: g.id,
      name: g.name,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      deadline: g.deadline,
      status: g.status,
    })),
    recentTransactions: recentTxs,
  });
}

export async function executeAssistantToolCall(
  call: GeminiFunctionCall,
  ctx: AssistantRuntimeContext
): Promise<{
  response: Record<string, unknown>;
  executedAction?: ExecutedActionRecord;
  pendingConfirmation?: PendingConfirmation;
}> {
  const args = call.args ?? {};
  const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  switch (call.name) {
    case 'get_period_analysis': {
      const month = normalizeStr(args.month) || ctx.selectedMonth;
      const compareMonths = Math.max(0, Math.min(12, Number(args.compareMonths || 0)));
      const main = computeMonthStats(ctx.transactions, ctx.categories, month);
      const history = [];
      for (let i = 1; i <= compareMonths; i++) {
        history.push(
          computeMonthStats(ctx.transactions, ctx.categories, shiftMonthKey(month, -i))
        );
      }
      return {
        response: {
          currency: ctx.currency,
          targetMonth: main,
          previousMonths: history,
        },
      };
    }

    case 'search_transactions': {
      const q = normalizeLower(args.query);
      const month = normalizeStr(args.month);
      const type = normalizeStr(args.type) as TransactionType | '';
      const status = normalizeStr(args.status) as TransactionStatus | '';
      const cat = args.categoryId ? resolveCategory(ctx.categories, args.categoryId) : undefined;
      const acc = args.accountId ? resolveAccount(ctx.accounts, args.accountId) : undefined;
      const minAmount = typeof args.minAmount === 'number' ? args.minAmount : undefined;
      const maxAmount = typeof args.maxAmount === 'number' ? args.maxAmount : undefined;
      const limit = Math.max(1, Math.min(80, Number(args.limit || 35)));

      const categoryMap = new Map(ctx.categories.map((c) => [c.id, c.name]));
      const accountMap = new Map(ctx.accounts.map((a) => [a.id, a.name]));

      const matches = ctx.transactions.filter((tx) => {
        if (month && !tx.date.startsWith(month)) return false;
        if (type && tx.type !== type) return false;
        if (status && tx.status !== status) return false;
        if (cat && tx.categoryId !== cat.id) return false;
        if (args.categoryId && !cat && tx.categoryId !== normalizeStr(args.categoryId)) return false;
        if (acc && tx.accountId !== acc.id && tx.toAccountId !== acc.id) return false;
        if (minAmount !== undefined && tx.amount < minAmount) return false;
        if (maxAmount !== undefined && tx.amount > maxAmount) return false;
        if (
          q &&
          !tx.description.toLowerCase().includes(q) &&
          !tx.notes.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      });

      const totalAmount = matches.reduce((s, t) => s + t.amount, 0);

      return {
        response: {
          totalMatches: matches.length,
          sumAmount: Math.round(totalAmount * 100) / 100,
          items: matches.slice(0, limit).map((tx) => ({
            id: tx.id,
            date: tx.date,
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            category: categoryMap.get(tx.categoryId) || tx.categoryId,
            account: accountMap.get(tx.accountId) || tx.accountId,
            toAccount: tx.toAccountId ? accountMap.get(tx.toAccountId) || tx.toAccountId : '',
            status: tx.status,
            installment:
              tx.installmentTotal > 1 ? `${tx.installmentNumber}/${tx.installmentTotal}` : '',
            notes: tx.notes,
          })),
        },
      };
    }

    case 'get_accounts_and_cards_status': {
      const includeArchived = Boolean(args.includeArchived);
      const list = ctx.accounts
        .filter((a) => includeArchived || !a.archived)
        .map((a) => {
          const used = a.type === 'credit' ? Math.max(0, -a.balance) : 0;
          const available =
            a.type === 'credit' ? Math.max(0, a.creditLimit - used) : a.balance;
          return {
            id: a.id,
            name: a.name,
            type: a.type,
            institution: a.institution,
            balance: a.balance,
            creditLimit: a.creditLimit,
            creditUsed: Math.round(used * 100) / 100,
            creditAvailable: Math.round(available * 100) / 100,
            closingDay: a.closingDay,
            dueDay: a.dueDay,
            archived: a.archived,
          };
        });
      return { response: { currency: ctx.currency, accounts: list } };
    }

    case 'get_budgets_and_goals_status': {
      const month = normalizeStr(args.month) || ctx.selectedMonth;
      const categoryMap = new Map(ctx.categories.map((c) => [c.id, c.name]));
      const monthBudgets = ctx.budgets
        .filter((b) => b.month === month)
        .map((b) => {
          const spent = ctx.transactions
            .filter(
              (tx) =>
                tx.type === 'expense' &&
                tx.date.startsWith(month) &&
                tx.categoryId === b.categoryId
            )
            .reduce((s, t) => s + t.amount, 0);
          const ratio = b.amount > 0 ? Math.round(((spent / b.amount) * 100) * 10) / 10 : 0;
          return {
            id: b.id,
            categoryId: b.categoryId,
            categoryName: categoryMap.get(b.categoryId) || b.categoryId,
            limit: b.amount,
            spent: Math.round(spent * 100) / 100,
            remaining: Math.round((b.amount - spent) * 100) / 100,
            usagePercent: ratio,
          };
        });

      const today = new Date();
      const goals = ctx.goals.map((g) => {
        const remaining = Math.max(0, Math.round((g.targetAmount - g.currentAmount) * 100) / 100);
        const deadlineDate = new Date(`${g.deadline}T00:00:00`);
        const diffDays = Math.max(
          0,
          Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        );
        const monthsLeft = Math.max(1, Math.ceil(diffDays / 30));
        return {
          id: g.id,
          name: g.name,
          status: g.status,
          currentAmount: g.currentAmount,
          targetAmount: g.targetAmount,
          remainingAmount: remaining,
          progressPercent:
            g.targetAmount > 0
              ? Math.round(((g.currentAmount / g.targetAmount) * 100) * 10) / 10
              : 0,
          deadline: g.deadline,
          estimatedMonthlyContributionNeeded:
            remaining > 0 ? Math.round((remaining / monthsLeft) * 100) / 100 : 0,
        };
      });

      return { response: { month, currency: ctx.currency, budgets: monthBudgets, goals } };
    }

    case 'create_transaction': {
      const txType = (normalizeStr(args.type) || 'expense') as TransactionType;
      const amount = Number(args.amount || 0);
      const description = normalizeStr(args.description);
      if (!description || !(amount > 0)) {
        return {
          response: { ok: false, error: 'Descrição e valor positivo são obrigatórios.' },
        };
      }

      const account =
        resolveAccount(ctx.accounts, args.accountId) || pickDefaultAccount(ctx.accounts, true);
      if (!account) {
        return {
          response: {
            ok: false,
            error: 'Nenhuma conta cadastrada. Crie uma conta primeiro.',
          },
        };
      }

      let toAccountId = '';
      if (txType === 'transfer') {
        const dest = resolveAccount(ctx.accounts, args.toAccountId);
        if (!dest || dest.id === account.id) {
          return {
            response: {
              ok: false,
              error:
                'Para transferência, informe uma conta de destino válida e diferente da origem.',
            },
          };
        }
        toAccountId = dest.id;
      }

      const preferredCatType: CategoryType = txType === 'income' ? 'income' : 'expense';
      const resolvedCat =
        txType === 'transfer'
          ? undefined
          : resolveCategory(ctx.categories, args.categoryId, preferredCatType) ||
            ctx.categories.find((c) => c.type === preferredCatType) ||
            ctx.categories[0];

      const categoryId = txType === 'transfer' ? 'transfer' : resolvedCat?.id || 'cat_outros';
      const date = normalizeStr(args.date) || getTodayIso();
      const status = (
        normalizeStr(args.status) === 'pending' ? 'pending' : 'paid'
      ) as TransactionStatus;
      const installments = Math.max(1, Math.min(360, Math.round(Number(args.installments || 1))));
      const isRecurring = Boolean(args.isRecurring) && installments === 1;
      const recurrenceFrequency = (
        isRecurring && ['monthly', 'weekly', 'yearly'].includes(normalizeStr(args.recurrenceFrequency))
          ? normalizeStr(args.recurrenceFrequency)
          : 'none'
      ) as RecurrenceFrequency;

      await ctx.createTransaction({
        type: txType,
        amount,
        description,
        categoryId,
        accountId: account.id,
        toAccountId,
        date,
        status,
        installments,
        isRecurring,
        recurrenceFrequency,
        notes: normalizeStr(args.notes),
      });

      const formatted = formatCurrency(amount, ctx.currency);
      return {
        response: {
          ok: true,
          created: {
            type: txType,
            amount,
            description,
            accountName: account.name,
            categoryName: resolvedCat?.name || 'Transferência',
            date,
            status,
            installments,
          },
        },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: installments > 1 ? `Lançamento parcelado (${installments}x)` : 'Lançamento criado',
          detail: `${description} · ${formatted} (${account.name})`,
        },
      };
    }

    case 'bulk_create_transactions': {
      const rawItems = Array.isArray(args.items) ? (args.items as Array<Record<string, unknown>>) : [];
      if (rawItems.length === 0) {
        return { response: { ok: false, error: 'Informe ao menos um item em items.' } };
      }

      const fallbackAcc = pickDefaultAccount(ctx.accounts, true);
      if (!fallbackAcc) {
        return { response: { ok: false, error: 'Nenhuma conta cadastrada no sistema.' } };
      }

      const validInputs: NewTransactionInput[] = [];
      const skipped: string[] = [];

      for (const item of rawItems) {
        const txType = (normalizeStr(item.type) || 'expense') as TransactionType;
        const amount = Number(item.amount || 0);
        const description = normalizeStr(item.description);
        if (!description || !(amount > 0)) {
          skipped.push(description || '(item sem descrição/valor)');
          continue;
        }
        const account = resolveAccount(ctx.accounts, item.accountId) || fallbackAcc;
        let toAccountId = '';
        if (txType === 'transfer') {
          const dest = resolveAccount(ctx.accounts, item.toAccountId);
          if (!dest || dest.id === account.id) {
            skipped.push(`${description} (destino inválido)`);
            continue;
          }
          toAccountId = dest.id;
        }
        const preferredCatType: CategoryType = txType === 'income' ? 'income' : 'expense';
        const resolvedCat =
          txType === 'transfer'
            ? undefined
            : resolveCategory(ctx.categories, item.categoryId, preferredCatType) ||
              ctx.categories.find((c) => c.type === preferredCatType) ||
              ctx.categories[0];

        const installments = Math.max(1, Math.min(60, Math.round(Number(item.installments || 1))));
        const isRecurring = Boolean(item.isRecurring) && installments === 1;
        const recurrenceFrequency = (
          isRecurring &&
          ['monthly', 'weekly', 'yearly'].includes(normalizeStr(item.recurrenceFrequency))
            ? normalizeStr(item.recurrenceFrequency)
            : 'none'
        ) as RecurrenceFrequency;

        validInputs.push({
          type: txType,
          amount,
          description,
          categoryId: txType === 'transfer' ? 'transfer' : resolvedCat?.id || 'cat_outros',
          accountId: account.id,
          toAccountId,
          date: normalizeStr(item.date) || getTodayIso(),
          status: (normalizeStr(item.status) === 'pending' ? 'pending' : 'paid') as TransactionStatus,
          installments,
          isRecurring,
          recurrenceFrequency,
          notes: normalizeStr(item.notes),
        });
      }

      if (validInputs.length === 0) {
        return { response: { ok: false, error: 'Nenhum lançamento válido encontrado.', skipped } };
      }

      const createdCount = await ctx.bulkCreateTransactions(validInputs);
      const totalAmt = validInputs.reduce((s, x) => s + x.amount * x.installments, 0);

      return {
        response: { ok: true, createdCount, skipped },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: `${createdCount} lançamento(s) criados em lote`,
          detail: `Total acumulado: ${formatCurrency(totalAmt, ctx.currency)}`,
        },
      };
    }

    case 'update_transaction': {
      const txId = normalizeStr(args.transactionId);
      const tx = ctx.transactions.find((t) => t.id === txId);
      if (!tx) {
        return { response: { ok: false, error: `Lançamento "${txId}" não encontrado.` } };
      }
      const nextType = (normalizeStr(args.type) || tx.type) as TransactionType;
      const nextAccount = args.accountId
        ? resolveAccount(ctx.accounts, args.accountId) || ctx.accounts.find((a) => a.id === tx.accountId)
        : ctx.accounts.find((a) => a.id === tx.accountId);
      const nextToAccount =
        nextType === 'transfer'
          ? resolveAccount(ctx.accounts, args.toAccountId || tx.toAccountId)
          : undefined;
      const preferredCatType: CategoryType = nextType === 'income' ? 'income' : 'expense';
      const nextCat = args.categoryId
        ? resolveCategory(ctx.categories, args.categoryId, preferredCatType)
        : undefined;

      const updates: Omit<NewTransactionInput, 'installments'> = {
        type: nextType,
        amount: typeof args.amount === 'number' && args.amount > 0 ? args.amount : tx.amount,
        description: normalizeStr(args.description) || tx.description,
        categoryId:
          nextType === 'transfer' ? 'transfer' : nextCat?.id || tx.categoryId,
        accountId: nextAccount?.id || tx.accountId,
        toAccountId: nextType === 'transfer' ? nextToAccount?.id || tx.toAccountId : '',
        date: normalizeStr(args.date) || tx.date,
        status: (normalizeStr(args.status) || tx.status) as TransactionStatus,
        isRecurring: typeof args.isRecurring === 'boolean' ? args.isRecurring : tx.isRecurring,
        recurrenceFrequency: (
          normalizeStr(args.recurrenceFrequency) || tx.recurrenceFrequency
        ) as RecurrenceFrequency,
        notes: args.notes !== undefined ? normalizeStr(args.notes) : tx.notes,
      };

      await ctx.updateTransaction(tx, updates);
      return {
        response: { ok: true, updatedTransactionId: tx.id, updates },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Lançamento atualizado',
          detail: `${updates.description} · ${formatCurrency(updates.amount, ctx.currency)}`,
        },
      };
    }

    case 'bulk_update_transactions': {
      const rawUpdates = Array.isArray(args.updates)
        ? (args.updates as Array<Record<string, unknown>>)
        : [];
      if (rawUpdates.length === 0) {
        return { response: { ok: false, error: 'Informe ao menos uma atualização em updates.' } };
      }

      const payload: Array<{
        tx: Transaction;
        updates: Omit<NewTransactionInput, 'installments'>;
      }> = [];
      const notFound: string[] = [];

      for (const item of rawUpdates) {
        const txId = normalizeStr(item.transactionId);
        const tx = ctx.transactions.find((t) => t.id === txId);
        if (!tx) {
          notFound.push(txId);
          continue;
        }
        const nextType = (normalizeStr(item.type) || tx.type) as TransactionType;
        const nextAccount = item.accountId
          ? resolveAccount(ctx.accounts, item.accountId) ||
            ctx.accounts.find((a) => a.id === tx.accountId)
          : ctx.accounts.find((a) => a.id === tx.accountId);
        const nextToAccount =
          nextType === 'transfer'
            ? resolveAccount(ctx.accounts, item.toAccountId || tx.toAccountId)
            : undefined;
        const preferredCatType: CategoryType = nextType === 'income' ? 'income' : 'expense';
        const nextCat = item.categoryId
          ? resolveCategory(ctx.categories, item.categoryId, preferredCatType)
          : undefined;

        payload.push({
          tx,
          updates: {
            type: nextType,
            amount:
              typeof item.amount === 'number' && item.amount > 0 ? item.amount : tx.amount,
            description: normalizeStr(item.description) || tx.description,
            categoryId:
              nextType === 'transfer' ? 'transfer' : nextCat?.id || tx.categoryId,
            accountId: nextAccount?.id || tx.accountId,
            toAccountId: nextType === 'transfer' ? nextToAccount?.id || tx.toAccountId : '',
            date: normalizeStr(item.date) || tx.date,
            status: (normalizeStr(item.status) || tx.status) as TransactionStatus,
            isRecurring:
              typeof item.isRecurring === 'boolean' ? item.isRecurring : tx.isRecurring,
            recurrenceFrequency: (
              normalizeStr(item.recurrenceFrequency) || tx.recurrenceFrequency
            ) as RecurrenceFrequency,
            notes: item.notes !== undefined ? normalizeStr(item.notes) : tx.notes,
          },
        });
      }

      if (payload.length === 0) {
        return {
          response: { ok: false, error: 'Nenhum dos IDs informados foi encontrado.', notFound },
        };
      }

      const updatedCount = await ctx.bulkUpdateTransactions(payload);
      return {
        response: { ok: true, updatedCount, notFound },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: `${updatedCount} lançamento(s) atualizados em lote`,
          detail: payload
            .slice(0, 3)
            .map((p) => p.updates.description)
            .join(', ') + (payload.length > 3 ? ` e +${payload.length - 3}` : ''),
        },
      };
    }

    case 'toggle_transaction_status': {
      const txId = normalizeStr(args.transactionId);
      const tx = ctx.transactions.find((t) => t.id === txId);
      if (!tx) {
        return { response: { ok: false, error: `Lançamento "${txId}" não encontrado.` } };
      }
      await ctx.toggleTransactionStatus(tx);
      const nextStatus = tx.status === 'paid' ? 'pending' : 'paid';
      return {
        response: { ok: true, transactionId: tx.id, newStatus: nextStatus },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: nextStatus === 'paid' ? 'Lançamento efetivado' : 'Marcado como pendente',
          detail: `${tx.description} · ${formatCurrency(tx.amount, ctx.currency)}`,
        },
      };
    }

    case 'delete_transaction': {
      const txId = normalizeStr(args.transactionId);
      const tx = ctx.transactions.find((t) => t.id === txId);
      if (!tx) {
        return { response: { ok: false, error: `Lançamento "${txId}" não encontrado.` } };
      }
      await ctx.deleteTransaction(tx);
      return {
        response: {
          ok: true,
          deletedTransactionId: tx.id,
          description: tx.description,
          amount: tx.amount,
        },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Lançamento excluído',
          detail: `${tx.description} · ${formatCurrency(tx.amount, ctx.currency)}`,
        },
      };
    }

    case 'bulk_delete_transactions': {
      const rawIds = Array.isArray(args.transactionIds)
        ? (args.transactionIds as unknown[]).map((v) => normalizeStr(v)).filter(Boolean)
        : [];
      if (rawIds.length === 0) {
        return { response: { ok: false, error: 'Informe transactionIds para exclusão.' } };
      }
      const idSet = new Set(rawIds);
      const targets = ctx.transactions.filter((t) => idSet.has(t.id));
      if (targets.length === 0) {
        return { response: { ok: false, error: 'Nenhum lançamento correspondente encontrado.' } };
      }
      const deletedCount = await ctx.bulkDeleteTransactions(targets);
      const sumDeleted = targets.reduce((s, t) => s + t.amount, 0);
      return {
        response: {
          ok: true,
          deletedCount,
          deletedIds: targets.map((t) => t.id),
        },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: `${deletedCount} lançamento(s) excluídos`,
          detail: `Estorno total nos saldos: ${formatCurrency(sumDeleted, ctx.currency)}`,
        },
      };
    }

    case 'create_account': {
      const name = normalizeStr(args.name);
      const type = (normalizeStr(args.type) || 'checking') as AccountType;
      if (!name) {
        return { response: { ok: false, error: 'Nome da conta é obrigatório.' } };
      }
      const balance = Number(args.balance || 0);
      const creditLimit = Number(args.creditLimit || 0);
      await ctx.createAccount({
        name,
        type,
        institution: normalizeStr(args.institution) || 'Banco',
        balance,
        creditLimit: type === 'credit' ? creditLimit : 0,
        closingDay: type === 'credit' ? Number(args.closingDay || 3) : 0,
        dueDay: type === 'credit' ? Number(args.dueDay || 10) : 0,
        color: normalizeStr(args.color) || (type === 'credit' ? '#1E293B' : '#0F766E'),
        archived: false,
      });
      return {
        response: { ok: true, name, type, balance },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Conta criada',
          detail: `${name} · ${formatCurrency(balance, ctx.currency)}`,
        },
      };
    }

    case 'update_account': {
      const acc = resolveAccount(ctx.accounts, args.accountId);
      if (!acc) {
        return { response: { ok: false, error: 'Conta não encontrada.' } };
      }
      const updates: AccountInput = {
        name: normalizeStr(args.name) || acc.name,
        type: (normalizeStr(args.type) || acc.type) as AccountType,
        institution:
          args.institution !== undefined ? normalizeStr(args.institution) : acc.institution,
        balance: typeof args.balance === 'number' ? args.balance : acc.balance,
        creditLimit: typeof args.creditLimit === 'number' ? args.creditLimit : acc.creditLimit,
        closingDay: typeof args.closingDay === 'number' ? args.closingDay : acc.closingDay,
        dueDay: typeof args.dueDay === 'number' ? args.dueDay : acc.dueDay,
        color: normalizeStr(args.color) || acc.color,
        archived: typeof args.archived === 'boolean' ? args.archived : acc.archived,
      };
      await ctx.updateAccount(acc, updates);
      return {
        response: { ok: true, accountId: acc.id, updates },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Conta atualizada',
          detail: `${updates.name} · ${formatCurrency(updates.balance, ctx.currency)}`,
        },
      };
    }

    case 'reconcile_account_balance': {
      const acc = resolveAccount(ctx.accounts, args.accountId);
      if (!acc) {
        return { response: { ok: false, error: 'Conta não encontrada para conciliação.' } };
      }
      const targetBalance = Number(args.targetBalance);
      if (Number.isNaN(targetBalance)) {
        return { response: { ok: false, error: 'Informe um saldo alvo numérico válido.' } };
      }
      const diff = Math.round((targetBalance - acc.balance) * 100) / 100;
      if (Math.abs(diff) < 0.01) {
        return {
          response: {
            ok: true,
            accountName: acc.name,
            balance: acc.balance,
            message: 'O saldo já está exatamente no valor informado.',
          },
        };
      }

      const createAdjustment = args.createAdjustmentTransaction !== false;
      if (createAdjustment) {
        const txType: TransactionType = diff > 0 ? 'income' : 'expense';
        const fallbackCat =
          ctx.categories.find((c) => c.type === txType) || ctx.categories[0];
        await ctx.createTransaction({
          type: txType,
          amount: Math.abs(diff),
          description: `Ajuste de conciliação (${acc.name})`,
          categoryId: fallbackCat?.id || 'cat_outros',
          accountId: acc.id,
          toAccountId: '',
          date: getTodayIso(),
          status: 'paid',
          installments: 1,
          isRecurring: false,
          recurrenceFrequency: 'none',
          notes:
            normalizeStr(args.notes) ||
            `Conciliação automática de ${formatCurrency(acc.balance, ctx.currency)} para ${formatCurrency(targetBalance, ctx.currency)}`,
        });
      } else {
        await ctx.updateAccount(acc, {
          name: acc.name,
          type: acc.type,
          institution: acc.institution,
          balance: targetBalance,
          creditLimit: acc.creditLimit,
          closingDay: acc.closingDay,
          dueDay: acc.dueDay,
          color: acc.color,
          archived: acc.archived,
        });
      }

      return {
        response: {
          ok: true,
          accountName: acc.name,
          previousBalance: acc.balance,
          targetBalance,
          adjustmentDiff: diff,
          method: createAdjustment ? 'adjustment_transaction' : 'direct_update',
        },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Saldo conciliado',
          detail: `${acc.name}: ${formatCurrency(acc.balance, ctx.currency)} → ${formatCurrency(targetBalance, ctx.currency)}`,
        },
      };
    }

    case 'pay_credit_card_invoice': {
      const card =
        resolveAccount(ctx.accounts, args.cardAccountId) ||
        ctx.accounts.find((a) => a.type === 'credit' && !a.archived);
      if (!card || card.type !== 'credit') {
        return { response: { ok: false, error: 'Cartão de crédito não encontrado.' } };
      }

      const openInvoice = Math.max(0, -card.balance);
      const payAmount =
        typeof args.amount === 'number' && args.amount > 0 ? args.amount : openInvoice;
      if (!(payAmount > 0)) {
        return {
          response: {
            ok: false,
            error: `A fatura de "${card.name}" está zerada. Informe um valor específico se desejar antecipar pagamento.`,
          },
        };
      }

      const fromAcc =
        resolveAccount(ctx.accounts, args.fromAccountId) ||
        pickDefaultAccount(ctx.accounts, true);
      if (!fromAcc || fromAcc.id === card.id) {
        return {
          response: {
            ok: false,
            error: 'Não há conta bancária/carteira válida disponível para efetuar o pagamento.',
          },
        };
      }

      const date = normalizeStr(args.date) || getTodayIso();
      await ctx.createTransaction({
        type: 'transfer',
        amount: payAmount,
        description: `Pagamento fatura ${card.name}`,
        categoryId: 'transfer',
        accountId: fromAcc.id,
        toAccountId: card.id,
        date,
        status: 'paid',
        installments: 1,
        isRecurring: false,
        recurrenceFrequency: 'none',
        notes: 'Pagamento de fatura registrado pelo Assistente IA',
      });

      return {
        response: {
          ok: true,
          cardName: card.name,
          fromAccountName: fromAcc.name,
          amountPaid: payAmount,
          remainingInvoice: Math.max(0, Math.round((openInvoice - payAmount) * 100) / 100),
          date,
        },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Fatura do cartão paga',
          detail: `${card.name} · ${formatCurrency(payAmount, ctx.currency)} via ${fromAcc.name}`,
        },
      };
    }

    case 'delete_account': {
      const acc = resolveAccount(ctx.accounts, args.accountId);
      if (!acc) {
        return { response: { ok: false, error: 'Conta não encontrada.' } };
      }
      await ctx.deleteAccount(acc.id);
      return {
        response: { ok: true, deletedAccountId: acc.id, name: acc.name },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Conta excluída',
          detail: `${acc.name} (${formatCurrency(acc.balance, ctx.currency)})`,
        },
      };
    }

    case 'create_category': {
      const name = normalizeStr(args.name);
      const type = (normalizeStr(args.type) === 'income' ? 'income' : 'expense') as CategoryType;
      if (!name) {
        return { response: { ok: false, error: 'Nome da categoria é obrigatório.' } };
      }
      await ctx.createCategory({
        name,
        type,
        icon: normalizeStr(args.icon) || 'Tag',
        color: normalizeStr(args.color) || (type === 'income' ? '#16A34A' : '#0F766E'),
      });
      return {
        response: { ok: true, name, type },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Categoria criada',
          detail: `${name} (${type === 'income' ? 'Receita' : 'Despesa'})`,
        },
      };
    }

    case 'update_category': {
      const cat = resolveCategory(ctx.categories, args.categoryId);
      if (!cat) {
        return { response: { ok: false, error: 'Categoria não encontrada.' } };
      }
      const updates: CategoryInput = {
        name: normalizeStr(args.name) || cat.name,
        type: (normalizeStr(args.type) || cat.type) as CategoryType,
        icon: normalizeStr(args.icon) || cat.icon,
        color: normalizeStr(args.color) || cat.color,
      };
      await ctx.updateCategory(cat, updates);
      return {
        response: { ok: true, categoryId: cat.id, updates },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Categoria atualizada',
          detail: updates.name,
        },
      };
    }

    case 'delete_category': {
      const cat = resolveCategory(ctx.categories, args.categoryId);
      if (!cat) {
        return { response: { ok: false, error: 'Categoria não encontrada.' } };
      }
      await ctx.deleteCategory(cat.id);
      return {
        response: { ok: true, deletedCategoryId: cat.id, name: cat.name },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Categoria excluída',
          detail: cat.name,
        },
      };
    }

    case 'upsert_budget': {
      const cat = resolveCategory(ctx.categories, args.categoryId, 'expense');
      const month = normalizeStr(args.month) || ctx.selectedMonth;
      const amount = Number(args.amount || 0);
      if (!cat || !(amount > 0)) {
        return {
          response: {
            ok: false,
            error: 'Informe uma categoria de despesa válida e valor positivo.',
          },
        };
      }
      await ctx.upsertBudget(cat.id, month, amount);
      return {
        response: { ok: true, categoryName: cat.name, month, amount },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Orçamento salvo',
          detail: `${cat.name} (${month}) · ${formatCurrency(amount, ctx.currency)}`,
        },
      };
    }

    case 'bulk_upsert_budgets': {
      const defaultMonth = normalizeStr(args.month) || ctx.selectedMonth;
      const rawEntries = Array.isArray(args.entries)
        ? (args.entries as Array<Record<string, unknown>>)
        : [];
      if (rawEntries.length === 0) {
        return { response: { ok: false, error: 'Informe ao menos um orçamento em entries.' } };
      }

      const validEntries: Array<{ categoryId: string; month: string; amount: number }> = [];
      const skipped: string[] = [];

      for (const entry of rawEntries) {
        const cat = resolveCategory(ctx.categories, entry.categoryId, 'expense');
        const amount = Number(entry.amount || 0);
        const month = normalizeStr(entry.month) || defaultMonth;
        if (!cat || !(amount > 0)) {
          skipped.push(normalizeStr(entry.categoryId) || '(inválido)');
          continue;
        }
        validEntries.push({ categoryId: cat.id, month, amount });
      }

      if (validEntries.length === 0) {
        return { response: { ok: false, error: 'Nenhum orçamento válido encontrado.', skipped } };
      }

      const count = await ctx.bulkUpsertBudgets(validEntries);
      const totalBudgeted = validEntries.reduce((s, e) => s + e.amount, 0);
      return {
        response: { ok: true, count, skipped },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: `${count} orçamento(s) definidos em lote`,
          detail: `Teto total: ${formatCurrency(totalBudgeted, ctx.currency)}`,
        },
      };
    }

    case 'delete_budget': {
      const budgetId = normalizeStr(args.budgetId);
      const budget = ctx.budgets.find((b) => b.id === budgetId);
      if (!budget) {
        return { response: { ok: false, error: 'Orçamento não encontrado.' } };
      }
      const cat = ctx.categories.find((c) => c.id === budget.categoryId);
      await ctx.deleteBudget(budget.id);
      return {
        response: { ok: true, deletedBudgetId: budget.id },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Orçamento excluído',
          detail: `${cat?.name || budget.categoryId} (${budget.month})`,
        },
      };
    }

    case 'copy_previous_month_budgets': {
      const targetMonth = normalizeStr(args.targetMonth) || ctx.selectedMonth;
      await ctx.copyPreviousMonthBudgets(targetMonth);
      return {
        response: { ok: true, targetMonth },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Orçamentos copiados',
          detail: `Orçamentos do mês anterior aplicados em ${targetMonth}`,
        },
      };
    }

    case 'create_goal': {
      const name = normalizeStr(args.name);
      const targetAmount = Number(args.targetAmount || 0);
      const currentAmount = Math.max(0, Number(args.currentAmount || 0));
      const deadline = normalizeStr(args.deadline) || `${ctx.selectedMonth}-28`;
      if (!name || !(targetAmount > 0)) {
        return {
          response: {
            ok: false,
            error: 'Nome da meta e valor objetivo positivo são obrigatórios.',
          },
        };
      }
      await ctx.createGoal({
        name,
        targetAmount,
        currentAmount,
        deadline,
        color: normalizeStr(args.color) || '#0F766E',
      });
      return {
        response: { ok: true, name, targetAmount, currentAmount, deadline },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Meta criada',
          detail: `${name} · Alvo ${formatCurrency(targetAmount, ctx.currency)}`,
        },
      };
    }

    case 'update_goal': {
      const goal = resolveGoal(ctx.goals, args.goalId);
      if (!goal) {
        return { response: { ok: false, error: 'Meta não encontrada.' } };
      }
      const updates: GoalInput & { status: GoalStatus } = {
        name: normalizeStr(args.name) || goal.name,
        targetAmount:
          typeof args.targetAmount === 'number' && args.targetAmount > 0
            ? args.targetAmount
            : goal.targetAmount,
        currentAmount:
          typeof args.currentAmount === 'number' && args.currentAmount >= 0
            ? args.currentAmount
            : goal.currentAmount,
        deadline: normalizeStr(args.deadline) || goal.deadline,
        color: normalizeStr(args.color) || goal.color,
        status: (normalizeStr(args.status) || goal.status) as GoalStatus,
      };
      await ctx.updateGoal(goal, updates);
      return {
        response: { ok: true, goalId: goal.id, updates },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Meta atualizada',
          detail: `${updates.name} · ${formatCurrency(updates.targetAmount, ctx.currency)}`,
        },
      };
    }

    case 'contribute_to_goal': {
      const goal = resolveGoal(ctx.goals, args.goalId);
      const amount = Number(args.amount || 0);
      if (!goal || !(amount > 0)) {
        return {
          response: { ok: false, error: 'Meta válida e valor positivo são obrigatórios.' },
        };
      }
      const sourceAcc = args.sourceAccountId
        ? resolveAccount(ctx.accounts, args.sourceAccountId)
        : undefined;
      await ctx.contributeToGoal(goal, amount, sourceAcc?.id);
      return {
        response: {
          ok: true,
          goalName: goal.name,
          amount,
          sourceAccount: sourceAcc?.name || null,
        },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Aporte na meta registrado',
          detail: `${goal.name} · +${formatCurrency(amount, ctx.currency)}`,
        },
      };
    }

    case 'delete_goal': {
      const goal = resolveGoal(ctx.goals, args.goalId);
      if (!goal) {
        return { response: { ok: false, error: 'Meta não encontrada.' } };
      }
      await ctx.deleteGoal(goal.id);
      return {
        response: { ok: true, deletedGoalId: goal.id, name: goal.name },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Meta excluída',
          detail: goal.name,
        },
      };
    }

    case 'open_app_form': {
      const formType = normalizeStr(args.formType);
      const editingId = normalizeStr(args.editingId);

      if (formType === 'transaction') {
        const txType = normalizeStr(args.type) as TransactionType | '';
        const preferredCatType: CategoryType = txType === 'income' ? 'income' : 'expense';
        const resolvedCat = args.categoryId
          ? resolveCategory(ctx.categories, args.categoryId, preferredCatType)
          : undefined;
        const resolvedAcc = args.accountId
          ? resolveAccount(ctx.accounts, args.accountId)
          : undefined;
        const resolvedToAcc = args.toAccountId
          ? resolveAccount(ctx.accounts, args.toAccountId)
          : undefined;

        ctx.openTransactionForm?.({
          editingTransactionId: editingId || undefined,
          type: txType || undefined,
          amount: typeof args.amount === 'number' ? args.amount : undefined,
          description: normalizeStr(args.description) || undefined,
          categoryId: resolvedCat?.id,
          accountId: resolvedAcc?.id,
          toAccountId: resolvedToAcc?.id,
          date: normalizeStr(args.date) || undefined,
          status:
            args.status === 'paid' || args.status === 'pending'
              ? (args.status as TransactionStatus)
              : undefined,
          installments:
            typeof args.installments === 'number' ? args.installments : undefined,
          isRecurring:
            typeof args.isRecurring === 'boolean' ? args.isRecurring : undefined,
          recurrenceFrequency: normalizeStr(args.recurrenceFrequency)
            ? (normalizeStr(args.recurrenceFrequency) as RecurrenceFrequency)
            : undefined,
          notes: args.notes !== undefined ? normalizeStr(args.notes) : undefined,
        });
        ctx.closeAssistantDrawer?.();

        return {
          response: { ok: true, openedForm: 'transaction', editingId: editingId || null },
          executedAction: {
            id: actionId,
            toolName: call.name,
            label: 'Formulário de lançamento preenchido',
            detail: normalizeStr(args.description) || 'Pronto na tela para revisão',
          },
        };
      }

      if (formType === 'account') {
        const targetAcc = editingId ? resolveAccount(ctx.accounts, editingId) : undefined;
        ctx.openAccountForm?.({
          editingAccountId: targetAcc?.id,
          name: normalizeStr(args.name) || undefined,
          type: normalizeStr(args.type) ? (normalizeStr(args.type) as AccountType) : undefined,
          institution: normalizeStr(args.institution) || undefined,
          balance: typeof args.balance === 'number' ? args.balance : undefined,
          creditLimit: typeof args.creditLimit === 'number' ? args.creditLimit : undefined,
          closingDay: typeof args.closingDay === 'number' ? args.closingDay : undefined,
          dueDay: typeof args.dueDay === 'number' ? args.dueDay : undefined,
          color: normalizeStr(args.color) || undefined,
        });
        ctx.closeAssistantDrawer?.();

        return {
          response: { ok: true, openedForm: 'account' },
          executedAction: {
            id: actionId,
            toolName: call.name,
            label: 'Formulário de conta preenchido',
            detail: normalizeStr(args.name) || targetAcc?.name || 'Aberto na aba Contas',
          },
        };
      }

      if (formType === 'budget') {
        const cat = args.categoryId
          ? resolveCategory(ctx.categories, args.categoryId, 'expense')
          : undefined;
        ctx.openBudgetForm?.({
          categoryId: cat?.id,
          amount: typeof args.amount === 'number' ? args.amount : undefined,
        });
        ctx.closeAssistantDrawer?.();

        return {
          response: { ok: true, openedForm: 'budget' },
          executedAction: {
            id: actionId,
            toolName: call.name,
            label: 'Formulário de orçamento preenchido',
            detail: cat?.name || 'Aberto na aba Orçamentos',
          },
        };
      }

      if (formType === 'goal' || formType === 'goal_contribution') {
        const targetGoal = resolveGoal(ctx.goals, args.goalId || editingId);
        const sourceAcc = args.sourceAccountId
          ? resolveAccount(ctx.accounts, args.sourceAccountId)
          : undefined;
        ctx.openGoalForm?.({
          mode: formType === 'goal_contribution' ? 'contribute' : 'goal',
          goalId: targetGoal?.id,
          name: normalizeStr(args.name) || undefined,
          targetAmount: typeof args.targetAmount === 'number' ? args.targetAmount : undefined,
          currentAmount: typeof args.currentAmount === 'number' ? args.currentAmount : undefined,
          deadline: normalizeStr(args.deadline) || undefined,
          color: normalizeStr(args.color) || undefined,
          amount: typeof args.amount === 'number' ? args.amount : undefined,
          sourceAccountId: sourceAcc?.id,
        });
        ctx.closeAssistantDrawer?.();

        return {
          response: { ok: true, openedForm: formType },
          executedAction: {
            id: actionId,
            toolName: call.name,
            label:
              formType === 'goal_contribution'
                ? 'Formulário de aporte preenchido'
                : 'Formulário de meta preenchido',
            detail: targetGoal?.name || normalizeStr(args.name) || 'Aberto na aba Metas',
          },
        };
      }

      if (formType === 'category') {
        const targetCat = editingId ? resolveCategory(ctx.categories, editingId) : undefined;
        ctx.openCategoryForm?.({
          editingCategoryId: targetCat?.id,
          name: normalizeStr(args.name) || undefined,
          type:
            args.type === 'income' || args.type === 'expense'
              ? (args.type as CategoryType)
              : undefined,
          color: normalizeStr(args.color) || undefined,
        });
        ctx.closeAssistantDrawer?.();

        return {
          response: { ok: true, openedForm: 'category' },
          executedAction: {
            id: actionId,
            toolName: call.name,
            label: 'Formulário de categoria preenchido',
            detail: normalizeStr(args.name) || targetCat?.name || 'Aberto na aba Categorias',
          },
        };
      }

      return {
        response: { ok: false, error: `Tipo de formulário "${formType}" não suportado.` },
      };
    }

    case 'filter_transactions_view': {
      const scope = args.scope === 'all' ? 'all' : 'month';
      const search = normalizeStr(args.search);
      const rawType = normalizeStr(args.type);
      const type = (
        ['all', 'income', 'expense', 'transfer'].includes(rawType) ? rawType : 'all'
      ) as 'all' | TransactionType;

      const resolvedAcc =
        args.accountId && normalizeLower(args.accountId) !== 'all'
          ? resolveAccount(ctx.accounts, args.accountId)
          : undefined;
      const resolvedCat =
        args.categoryId && normalizeLower(args.categoryId) !== 'all'
          ? resolveCategory(ctx.categories, args.categoryId)
          : undefined;

      const rawStatus = normalizeStr(args.status);
      const status = (
        ['all', 'paid', 'pending'].includes(rawStatus) ? rawStatus : 'all'
      ) as 'all' | TransactionStatus;

      ctx.applyTransactionsFilter?.({
        scope,
        search,
        type,
        accountId: resolvedAcc?.id || 'all',
        categoryId: resolvedCat?.id || 'all',
        status,
      });

      return {
        response: {
          ok: true,
          appliedFilter: {
            scope,
            search,
            type,
            account: resolvedAcc?.name || 'all',
            category: resolvedCat?.name || 'all',
            status,
          },
        },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Filtros aplicados em Lançamentos',
          detail: search
            ? `Busca: "${search}"`
            : `${scope === 'all' ? 'Todo período' : ctx.selectedMonth} · ${type}`,
        },
      };
    }

    case 'export_transactions_csv': {
      const scope = args.scope === 'all' ? 'all' : 'month';
      const month = normalizeStr(args.month) || ctx.selectedMonth;
      const type = normalizeStr(args.type) as TransactionType | '';
      const cat = args.categoryId ? resolveCategory(ctx.categories, args.categoryId) : undefined;
      const acc = args.accountId ? resolveAccount(ctx.accounts, args.accountId) : undefined;

      const list = ctx.transactions.filter((tx) => {
        if (scope === 'month' && !tx.date.startsWith(month)) return false;
        if (type && tx.type !== type) return false;
        if (cat && tx.categoryId !== cat.id) return false;
        if (acc && tx.accountId !== acc.id && tx.toAccountId !== acc.id) return false;
        return true;
      });

      const filename =
        scope === 'month'
          ? `extrato-vertice-${month}.csv`
          : 'extrato-vertice-completo.csv';
      exportTransactionsToCSV(list, ctx.accounts, ctx.categories, filename);

      return {
        response: { ok: true, exportedCount: list.length, filename },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Extrato CSV exportado',
          detail: `${list.length} lançamento(s) em ${filename}`,
        },
      };
    }

    case 'set_reports_range': {
      const count: 6 | 12 = Number(args.monthsCount) === 12 ? 12 : 6;
      ctx.setReportsRange?.(count);
      return {
        response: { ok: true, monthsCount: count },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Relatório DRE atualizado',
          detail: `Exibindo janela de ${count} meses`,
        },
      };
    }

    case 'navigate_to_tab': {
      const tab = normalizeStr(args.tab) as ViewTab;
      const validTabs: ViewTab[] = [
        'assistant',
        'dashboard',
        'transactions',
        'accounts',
        'budgets',
        'goals',
        'reports',
        'categories',
        'downloads',
      ];
      if (!validTabs.includes(tab)) {
        return { response: { ok: false, error: `Aba "${tab}" inválida.` } };
      }
      ctx.onNavigate(tab);
      return {
        response: { ok: true, navigatedTo: tab },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Navegação executada',
          detail: `Tela alterada para ${tab}`,
        },
      };
    }

    case 'open_settings': {
      const rawSec = normalizeStr(args.section) as SettingsSection | '';
      const validSections: SettingsSection[] = [
        'preferences',
        'profile',
        'security',
        'usage',
        'ai',
        'database',
      ];
      const section: SettingsSection = validSections.includes(rawSec as SettingsSection)
        ? (rawSec as SettingsSection)
        : 'preferences';
      ctx.openSettings?.(section);
      return {
        response: { ok: true, openedSection: section },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Configurações abertas',
          detail: `Seção: ${section}`,
        },
      };
    }

    case 'set_selected_month': {
      const month = normalizeStr(args.month);
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return { response: { ok: false, error: 'Mês deve estar no formato YYYY-MM.' } };
      }
      ctx.setSelectedMonth(month);
      return {
        response: { ok: true, selectedMonth: month },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Período alterado',
          detail: `Mês ativo: ${month}`,
        },
      };
    }

    case 'set_currency': {
      const currency = normalizeStr(args.currency).toUpperCase() as CurrencyCode;
      if (!['BRL', 'USD', 'EUR'].includes(currency)) {
        return { response: { ok: false, error: 'Moeda deve ser BRL, USD ou EUR.' } };
      }
      await ctx.setCurrency(currency);
      return {
        response: { ok: true, currency },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Moeda alterada',
          detail: `Moeda principal: ${currency}`,
        },
      };
    }

    case 'toggle_theme': {
      const target = normalizeStr(args.targetTheme) as ThemeMode | '';
      if (!target || target !== ctx.theme) {
        await ctx.toggleTheme();
      }
      const nextTheme = target || (ctx.theme === 'light' ? 'dark' : 'light');
      return {
        response: { ok: true, theme: nextTheme },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Tema visual atualizado',
          detail: nextTheme === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado',
        },
      };
    }

    case 'load_sample_data': {
      await ctx.loadSampleData();
      return {
        response: { ok: true, message: 'Cenário de demonstração carregado.' },
        executedAction: {
          id: actionId,
          toolName: call.name,
          label: 'Cenário de exemplo carregado',
          detail: 'Contas, cartões, metas e 5 meses de transações criados',
        },
      };
    }

    default:
      return {
        response: { ok: false, error: `Ferramenta desconhecida: ${call.name}` },
      };
  }
}
