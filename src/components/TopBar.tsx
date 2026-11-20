import React from 'react';
import { Bot, Menu, Plus } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { ViewTab } from '../types/finance';
import { MonthYearPicker } from './MonthYearPicker';

interface TopBarProps {
  activeTab: ViewTab;
  onOpenMobileMenu: () => void;
  onNewTransaction: () => void;
  onOpenAssistant: () => void;
}

const TAB_TITLES: Record<ViewTab, string> = {
  assistant: 'Assistente IA',
  dashboard: 'Visão Geral',
  transactions: 'Lançamentos',
  accounts: 'Contas e Cartões',
  budgets: 'Orçamentos Mensais',
  goals: 'Metas Financeiras',
  reports: 'Relatórios e DRE',
  categories: 'Categorias',
  downloads: 'Aplicativos e Downloads',
};

export function TopBar({
  activeTab,
  onOpenMobileMenu,
  onNewTransaction,
  onOpenAssistant,
}: TopBarProps) {
  const { selectedMonth, setSelectedMonth } = useFinance();

  return (
    <header className="h-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir navegação"
          className="lg:hidden p-2 -ml-2 min-h-[40px] min-w-[40px] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 flex items-center justify-center"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500 whitespace-nowrap">
            Vértice Finance
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 dark:text-white truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <MonthYearPicker selectedMonth={selectedMonth} onChange={setSelectedMonth} />

        {activeTab !== 'assistant' && (
          <button
            type="button"
            onClick={onOpenAssistant}
            aria-label="Abrir Assistente IA"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-600 dark:hover:border-teal-500 text-slate-700 dark:text-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Bot className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <span className="hidden md:inline">Assistente IA</span>
            <span className="md:hidden">IA</span>
          </button>
        )}

        <button
          type="button"
          onClick={onNewTransaction}
          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Nova Transação</span>
          <span className="sm:hidden">Lançar</span>
        </button>
      </div>
    </header>
  );
}
