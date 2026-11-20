import React from 'react';
import {
  ArrowLeftRight,
  BarChart2,
  Bot,
  CreditCard,
  Download,
  LayoutDashboard,
  LogOut,
  PieChart,
  Settings2,
  Tag,
  Target,
  X,
} from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { ViewTab } from '../types/finance';

interface SidebarProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenAccountSecurity: () => void;
}

const SECONDARY_MODULES: Array<{
  id: ViewTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'transactions', label: 'Lançamentos', icon: ArrowLeftRight },
  { id: 'accounts', label: 'Contas e Cartões', icon: CreditCard },
  { id: 'budgets', label: 'Orçamentos', icon: PieChart },
  { id: 'goals', label: 'Metas', icon: Target },
  { id: 'reports', label: 'Relatórios', icon: BarChart2 },
  { id: 'categories', label: 'Categorias', icon: Tag },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  onOpenAccountSecurity,
}: SidebarProps) {
  const { profile, user, currency, theme, logout } = useFinance();

  const displayName = profile?.displayName || user?.displayName || 'Minha Conta';
  const photoURL = profile?.photoURL || user?.photoURL || '';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const handleSelect = (tab: ViewTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const content = (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-[260px]">
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
          Vértice Finance
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {/* Primary AI Center */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => handleSelect('assistant')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'assistant'
                ? 'bg-teal-700 text-white'
                : 'bg-teal-50/80 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100/80 dark:hover:bg-teal-950/80'
            }`}
          >
            <Bot className="w-4 h-4 shrink-0" />
            <span>Assistente IA</span>
          </button>
        </div>

        {/* Secondary System Modules */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Módulos do Sistema
          </p>
          {SECONDARY_MODULES.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Distributions / Downloads */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Distribuições
          </p>
          <button
            type="button"
            onClick={() => handleSelect('downloads')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'downloads'
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Aplicativos e Downloads</span>
          </button>
        </div>
      </nav>

      {/* Clean Account & Settings Footer (Currency & Theme moved into Settings modal) */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onOpenAccountSecurity();
              onCloseMobile();
            }}
            title="Configurações, moeda, tema e segurança"
            aria-label="Abrir configurações e conta"
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group"
          >
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-teal-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {initials || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Configurações · {currency} · {theme === 'dark' ? 'Escuro' : 'Claro'}
              </p>
            </div>
            <Settings2 className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0" />
          </button>

          <button
            type="button"
            onClick={logout}
            title="Sair da conta"
            aria-label="Sair da conta"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
