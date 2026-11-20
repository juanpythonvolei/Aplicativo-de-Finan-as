import { Timestamp } from 'firebase/firestore';

export type CurrencyCode = 'BRL' | 'USD' | 'EUR';
export type ThemeMode = 'light' | 'dark';

export type AccountType = 'checking' | 'savings' | 'wallet' | 'investment' | 'credit';
export type CategoryType = 'income' | 'expense';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'paid' | 'pending';
export type RecurrenceFrequency = 'none' | 'monthly' | 'weekly' | 'yearly';
export type GoalStatus = 'active' | 'completed' | 'cancelled';

export type ViewTab =
  | 'assistant'
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'goals'
  | 'reports'
  | 'categories'
  | 'downloads';

export type SettingsSection = 'preferences' | 'profile' | 'security' | 'usage' | 'ai' | 'database';

export interface UserWorkspace {
  userId: string;
  currency: CurrencyCode;
  theme: ThemeMode;
  seededSample: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPrivateProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  color: string;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  categoryId: string;
  accountId: string;
  toAccountId: string;
  date: string; // YYYY-MM-DD
  status: TransactionStatus;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  installmentGroupId: string;
  installmentNumber: number;
  installmentTotal: number;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  month: string; // YYYY-MM
  amount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
  color: string;
  status: GoalStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  preview: string;
  messageCount: number;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AIConversationMessage {
  id: string;
  userId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  text: string;
  actionsSummary: string[];
  modelProfileId: string;
  hasImage: boolean;
  createdAt: Timestamp | null;
}

export interface TransactionFormDraft {
  nonce: number;
  editingTransactionId?: string;
  type?: TransactionType;
  amount?: number;
  description?: string;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  date?: string;
  status?: TransactionStatus;
  installments?: number;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  notes?: string;
}

export interface AccountFormDraft {
  nonce: number;
  editingAccountId?: string;
  name?: string;
  type?: AccountType;
  institution?: string;
  balance?: number;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  color?: string;
}

export interface BudgetFormDraft {
  nonce: number;
  categoryId?: string;
  amount?: number;
}

export interface GoalFormDraft {
  nonce: number;
  mode: 'goal' | 'contribute';
  goalId?: string;
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: string;
  color?: string;
  amount?: number;
  sourceAccountId?: string;
}

export interface CategoryFormDraft {
  nonce: number;
  editingCategoryId?: string;
  name?: string;
  type?: CategoryType;
  color?: string;
}

export interface TransactionsFilterDraft {
  nonce: number;
  scope?: 'month' | 'all';
  search?: string;
  type?: 'all' | TransactionType;
  accountId?: string;
  categoryId?: string;
  status?: 'all' | TransactionStatus;
}
