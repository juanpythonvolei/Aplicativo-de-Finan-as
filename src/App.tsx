import React, { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { AIChatDrawer } from './components/AIChatDrawer';
import { AccountSecurityModal } from './components/AccountSecurityModal';
import { AccountsView } from './components/AccountsView';
import { AndroidAuthBridge } from './components/AndroidAuthBridge';
import { AssistantMainView } from './components/AssistantMainView';
import { AuthScreen } from './components/AuthScreen';
import { BudgetsView } from './components/BudgetsView';
import { CategoriesView } from './components/CategoriesView';
import { DashboardView } from './components/DashboardView';
import { DownloadsView } from './components/DownloadsView';
import { EmailVerificationScreen } from './components/EmailVerificationScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GoalsView } from './components/GoalsView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ReportsView } from './components/ReportsView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TransactionModal } from './components/TransactionModal';
import { TransactionsView } from './components/TransactionsView';
import { FinanceProvider, useFinance } from './contexts/FinanceContext';
import {
  Account,
  AccountFormDraft,
  BudgetFormDraft,
  CategoryFormDraft,
  GoalFormDraft,
  SettingsSection,
  Transaction,
  TransactionFormDraft,
  TransactionType,
  TransactionsFilterDraft,
  ViewTab,
} from './types/finance';

function AppShell() {
  const {
    user,
    authLoading,
    needsEmailVerification,
    biometricLocked,
    accounts,
    transactions,
    toasts,
    dismissToast,
  } = useFinance();
  // AI Assistant is the primary landing panel across Web, Linux, Windows, and Android
  const [activeTab, setActiveTab] = useState<ViewTab>('assistant');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsSection>('preferences');

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [presetType, setPresetType] = useState<TransactionType>('expense');
  const [presetAccountId, setPresetAccountId] = useState<string | undefined>(undefined);
  const [presetToAccountId, setPresetToAccountId] = useState<string | undefined>(undefined);
  const [presetAmount, setPresetAmount] = useState<number | undefined>(undefined);
  const [presetDescription, setPresetDescription] = useState<string | undefined>(undefined);

  const [txFormDraft, setTxFormDraft] = useState<TransactionFormDraft | null>(null);
  const [accountFormDraft, setAccountFormDraft] = useState<AccountFormDraft | null>(null);
  const [budgetFormDraft, setBudgetFormDraft] = useState<BudgetFormDraft | null>(null);
  const [goalFormDraft, setGoalFormDraft] = useState<GoalFormDraft | null>(null);
  const [categoryFormDraft, setCategoryFormDraft] = useState<CategoryFormDraft | null>(null);
  const [txFilterDraft, setTxFilterDraft] = useState<TransactionsFilterDraft | null>(null);
  const [reportsRangeDraft, setReportsRangeDraft] = useState<{
    nonce: number;
    count: 6 | 12;
  } | null>(null);

  const openNewTx = () => {
    setTxFormDraft(null);
    setEditingTx(null);
    setPresetType('expense');
    setPresetAccountId(undefined);
    setPresetToAccountId(undefined);
    setPresetAmount(undefined);
    setPresetDescription(undefined);
    setTxModalOpen(true);
  };

  const openEditTx = (tx: Transaction) => {
    setTxFormDraft(null);
    setEditingTx(tx);
    setPresetType(tx.type);
    setPresetAccountId(undefined);
    setPresetToAccountId(undefined);
    setPresetAmount(undefined);
    setPresetDescription(undefined);
    setTxModalOpen(true);
  };

  const openPayCreditCard = (card: Account, invoiceAmount: number) => {
    const sourceBank = accounts.find((a) => a.type !== 'credit' && !a.archived);
    setTxFormDraft(null);
    setEditingTx(null);
    setPresetType('transfer');
    setPresetAccountId(sourceBank?.id);
    setPresetToAccountId(card.id);
    setPresetAmount(invoiceAmount);
    setPresetDescription(`Pagamento fatura ${card.name}`);
    setTxModalOpen(true);
  };

  const openQuickTransfer = (fromAccount: Account) => {
    setTxFormDraft(null);
    setEditingTx(null);
    setPresetType('transfer');
    setPresetAccountId(fromAccount.id);
    setPresetToAccountId(undefined);
    setPresetAmount(undefined);
    setPresetDescription('Transferência entre contas');
    setTxModalOpen(true);
  };

  const handleOpenSettings = useCallback((section: SettingsSection = 'preferences') => {
    setSettingsInitialTab(section);
    setAccountModalOpen(true);
  }, []);

  const handleOpenTransactionFormFromAI = useCallback(
    (draft: Omit<TransactionFormDraft, 'nonce'>) => {
      const targetTx = draft.editingTransactionId
        ? transactions.find((t) => t.id === draft.editingTransactionId) || null
        : null;
      setEditingTx(targetTx);
      setPresetType(draft.type || targetTx?.type || 'expense');
      setPresetAccountId(undefined);
      setPresetToAccountId(undefined);
      setPresetAmount(undefined);
      setPresetDescription(undefined);
      setTxFormDraft({ ...draft, nonce: Date.now() });
      setTxModalOpen(true);
    },
    [transactions]
  );

  const handleOpenAccountFormFromAI = useCallback(
    (draft: Omit<AccountFormDraft, 'nonce'>) => {
      setActiveTab('accounts');
      setAccountFormDraft({ ...draft, nonce: Date.now() });
    },
    []
  );

  const handleOpenBudgetFormFromAI = useCallback(
    (draft: Omit<BudgetFormDraft, 'nonce'>) => {
      setActiveTab('budgets');
      setBudgetFormDraft({ ...draft, nonce: Date.now() });
    },
    []
  );

  const handleOpenGoalFormFromAI = useCallback(
    (draft: Omit<GoalFormDraft, 'nonce'>) => {
      setActiveTab('goals');
      setGoalFormDraft({ ...draft, nonce: Date.now() });
    },
    []
  );

  const handleOpenCategoryFormFromAI = useCallback(
    (draft: Omit<CategoryFormDraft, 'nonce'>) => {
      setActiveTab('categories');
      setCategoryFormDraft({ ...draft, nonce: Date.now() });
    },
    []
  );

  const handleApplyTransactionsFilterFromAI = useCallback(
    (draft: Omit<TransactionsFilterDraft, 'nonce'>) => {
      setActiveTab('transactions');
      setTxFilterDraft({ ...draft, nonce: Date.now() });
    },
    []
  );

  const handleSetReportsRangeFromAI = useCallback((count: 6 | 12) => {
    setActiveTab('reports');
    setReportsRangeDraft({ count, nonce: Date.now() });
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Vértice Finance
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Carregando ambiente financeiro...
          </p>
        </div>
      </div>
    );
  }

  if (!user || biometricLocked) {
    return <AuthScreen />;
  }

  if (needsEmailVerification) {
    return <EmailVerificationScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenAccountSecurity={() => handleOpenSettings('preferences')}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNewTransaction={openNewTx}
          onOpenAssistant={() => setChatOpen(true)}
        />

        <AnimatePresence mode="wait">
          {activeTab === 'assistant' ? (
            <motion.main
              key="view-assistant"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 min-h-0"
            >
              <AssistantMainView
                onNavigate={setActiveTab}
                onOpenSettings={handleOpenSettings}
                onOpenTransactionForm={handleOpenTransactionFormFromAI}
                onOpenAccountForm={handleOpenAccountFormFromAI}
                onOpenBudgetForm={handleOpenBudgetFormFromAI}
                onOpenGoalForm={handleOpenGoalFormFromAI}
                onOpenCategoryForm={handleOpenCategoryFormFromAI}
                onApplyTransactionsFilter={handleApplyTransactionsFilterFromAI}
                onSetReportsRange={handleSetReportsRangeFromAI}
              />
            </motion.main>
          ) : (
            <motion.main
              key={`view-${activeTab}`}
              initial={{ opacity: 0, y: 10, scale: 0.992 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.995 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-[1380px] w-full mx-auto"
            >
              {activeTab === 'dashboard' && (
                <DashboardView onNavigate={setActiveTab} onEditTransaction={openEditTx} />
              )}
              {activeTab === 'transactions' && (
                <TransactionsView
                  onNewTransaction={openNewTx}
                  onEditTransaction={openEditTx}
                  filterDraft={txFilterDraft}
                />
              )}
              {activeTab === 'accounts' && (
                <AccountsView
                  onPayCreditCard={openPayCreditCard}
                  onQuickTransfer={openQuickTransfer}
                  externalDraft={accountFormDraft}
                />
              )}
              {activeTab === 'budgets' && <BudgetsView externalDraft={budgetFormDraft} />}
              {activeTab === 'goals' && <GoalsView externalDraft={goalFormDraft} />}
              {activeTab === 'reports' && <ReportsView externalMonthsCount={reportsRangeDraft} />}
              {activeTab === 'categories' && <CategoriesView externalDraft={categoryFormDraft} />}
              {activeTab === 'downloads' && <DownloadsView />}
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenMoreMenu={() => setMobileMenuOpen(true)}
      />
      <OfflineIndicator />

      <AIChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onNavigate={setActiveTab}
        onOpenSettings={handleOpenSettings}
        onOpenTransactionForm={handleOpenTransactionFormFromAI}
        onOpenAccountForm={handleOpenAccountFormFromAI}
        onOpenBudgetForm={handleOpenBudgetFormFromAI}
        onOpenGoalForm={handleOpenGoalFormFromAI}
        onOpenCategoryForm={handleOpenCategoryFormFromAI}
        onApplyTransactionsFilter={handleApplyTransactionsFilterFromAI}
        onSetReportsRange={handleSetReportsRangeFromAI}
      />

      <TransactionModal
        open={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setTxFormDraft(null);
        }}
        editingTransaction={editingTx}
        presetType={presetType}
        presetAccountId={presetAccountId}
        presetToAccountId={presetToAccountId}
        presetAmount={presetAmount}
        presetDescription={presetDescription}
        draft={txFormDraft}
      />

      <AccountSecurityModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        initialTab={settingsInitialTab}
      />

      {/* Toast Stack */}
      <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 shadow-md ${
                toast.type === 'error'
                  ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
                  : toast.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'
              }`}
            >
              <span className="leading-snug">{toast.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Fechar aviso"
                className="opacity-70 hover:opacity-100 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  const isAndroidAuthBridge =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('androidAuth') === '1';

  if (isAndroidAuthBridge) {
    return (
      <ErrorBoundary>
        <AndroidAuthBridge />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <FinanceProvider>
        <AppShell />
      </FinanceProvider>
    </ErrorBoundary>
  );
}
