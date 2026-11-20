import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { formatMonthLabel, getCurrentMonthKey, shiftMonthKey } from '../lib/formatters';

interface MonthYearPickerProps {
  selectedMonth: string; // YYYY-MM
  onChange: (month: string) => void;
}

const MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function MonthYearPicker({ selectedMonth, onChange }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const currentMonthKey = getCurrentMonthKey();
  const [selectedYearStr, selectedMonthStr] = selectedMonth.split('-');
  const selectedYear = Number(selectedYearStr) || new Date().getFullYear();
  const selectedMonthNum = Number(selectedMonthStr) || new Date().getMonth() + 1;

  const [panelYear, setPanelYear] = useState<number>(selectedYear);
  const [yearInput, setYearInput] = useState<string>(String(selectedYear));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPanelYear(selectedYear);
    setYearInput(String(selectedYear));
  }, [selectedYear, open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const commitYearChange = (nextYear: number) => {
    const clamped = Math.max(1970, Math.min(2099, Math.round(nextYear)));
    setPanelYear(clamped);
    setYearInput(String(clamped));
  };

  const handleSelectMonth = (monthIndex: number) => {
    const mStr = String(monthIndex + 1).padStart(2, '0');
    onChange(`${panelYear}-${mStr}`);
    setOpen(false);
  };

  const handleJumpToday = () => {
    onChange(currentMonthKey);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/70">
        <button
          type="button"
          onClick={() => onChange(shiftMonthKey(selectedMonth, -1))}
          aria-label="Mês anterior"
          title="Mês anterior"
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Selecionar mês e ano"
          className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-md transition-colors whitespace-nowrap min-w-fit"
        >
          <Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0 hidden sm:inline" />
          <span className="tabular-nums">{formatMonthLabel(selectedMonth)}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => onChange(shiftMonthKey(selectedMonth, 1))}
          aria-label="Próximo mês"
          title="Próximo mês"
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Seletor de mês e ano"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3.5 z-50 space-y-3"
          >
          {/* Year navigation + direct year input */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => commitYearChange(panelYear - 1)}
              aria-label="Ano anterior"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1970}
                max={2099}
                aria-label="Ano"
                value={yearInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setYearInput(val);
                  const parsed = Number(val);
                  if (val.length === 4 && parsed >= 1970 && parsed <= 2099) {
                    setPanelYear(parsed);
                  }
                }}
                onBlur={() => {
                  const parsed = Number(yearInput);
                  if (!parsed || parsed < 1970 || parsed > 2099) {
                    setYearInput(String(panelYear));
                  } else {
                    setPanelYear(parsed);
                  }
                }}
                className="w-20 text-center font-mono text-sm font-semibold tabular-nums px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="button"
              onClick={() => commitYearChange(panelYear + 1)}
              aria-label="Próximo ano"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 12-Month Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_NAMES.map((label, idx) => {
              const mStr = String(idx + 1).padStart(2, '0');
              const key = `${panelYear}-${mStr}`;
              const isSelected = panelYear === selectedYear && idx + 1 === selectedMonthNum;
              const isCurrentRealMonth = key === currentMonthKey;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-teal-700 text-white font-semibold'
                      : isCurrentRealMonth
                      ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 ring-1 ring-teal-600/40'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Quick Jump Footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleJumpToday}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mês atual ({formatMonthLabel(currentMonthKey)})</span>
            </button>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
