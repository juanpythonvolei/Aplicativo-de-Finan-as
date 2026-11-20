import React from 'react';
import { ArrowLeftRight, Bot, Download, LayoutDashboard, Menu } from 'lucide-react';
import { ViewTab } from '../types/finance';

interface MobileBottomNavProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  onOpenMoreMenu: () => void;
}

const MOBILE_TABS: Array<{
  id: ViewTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'assistant', label: 'IA', icon: Bot },
  { id: 'dashboard', label: 'Resumo', icon: LayoutDashboard },
  { id: 'transactions', label: 'Extrato', icon: ArrowLeftRight },
  { id: 'downloads', label: 'Apps', icon: Download },
];

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenMoreMenu,
}: MobileBottomNavProps) {
  const isSecondaryActive =
    !MOBILE_TABS.some((t) => t.id === activeTab);

  return (
    <nav
      aria-label="Navegação principal mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5"
    >
      {MOBILE_TABS.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors whitespace-nowrap ${
              active
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full px-1">{item.label}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onOpenMoreMenu}
        className={`flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors whitespace-nowrap ${
          isSecondaryActive
            ? 'text-teal-700 dark:text-teal-400'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Menu className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-full px-1">Menu</span>
      </button>
    </nav>
  );
}
