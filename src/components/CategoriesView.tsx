import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { Category, CategoryFormDraft, CategoryType } from '../types/finance';

const COLOR_PALETTE = [
  '#0F766E',
  '#16A34A',
  '#0284C7',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#D97706',
  '#DC2626',
  '#475569',
];

interface CategoriesViewProps {
  externalDraft?: CategoryFormDraft | null;
}

export function CategoriesView({ externalDraft }: CategoriesViewProps) {
  const {
    categories,
    transactions,
    createCategory,
    updateCategory,
    deleteCategory,
    pushToast,
  } = useFinance();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('expense');
  const [color, setColor] = useState('#0F766E');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!externalDraft) return;
    const existing = externalDraft.editingCategoryId
      ? categories.find((c) => c.id === externalDraft.editingCategoryId) || null
      : null;
    setEditing(existing);
    const nextType = externalDraft.type ?? existing?.type ?? 'expense';
    setName(externalDraft.name ?? existing?.name ?? '');
    setType(nextType);
    setColor(externalDraft.color ?? existing?.color ?? (nextType === 'income' ? '#16A34A' : '#0F766E'));
    setModalOpen(true);
  }, [externalDraft, categories]);

  const usageCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + 1);
    }
    return map;
  }, [transactions]);

  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const openCreate = (defaultType: CategoryType) => {
    setEditing(null);
    setName('');
    setType(defaultType);
    setColor(defaultType === 'income' ? '#16A34A' : '#0F766E');
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      pushToast('error', 'Informe o nome da categoria.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing, {
          name: name.trim(),
          type,
          icon: editing.icon || 'Tag',
          color,
        });
      } else {
        await createCategory({
          name: name.trim(),
          type,
          icon: 'Tag',
          color,
        });
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const renderGroup = (title: string, list: Category[], defaultType: CategoryType) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <button
          onClick={() => openCreate(defaultType)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar</span>
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {list.map((cat) => {
          const used = usageCounts.get(cat.id) || 0;
          return (
            <div
              key={cat.id}
              className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-xs shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {cat.name}
                </span>
                <span className="text-xs font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                  · {used} {used === 1 ? 'lançamento' : 'lançamentos'}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(cat)}
                  aria-label="Editar categoria"
                  className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (used > 0) {
                      pushToast(
                        'info',
                        'Esta categoria possui lançamentos vinculados. Reclassifique-os antes de excluir.'
                      );
                      return;
                    }
                    deleteCategory(cat.id);
                  }}
                  aria-label="Excluir categoria"
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {renderGroup('Categorias de Despesa', expenseCategories, 'expense')}
      {renderGroup('Categorias de Receita', incomeCategories, 'income')}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editing ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Natureza
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-1.5 text-xs font-medium rounded-md ${
                      type === 'expense'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-1.5 text-xs font-medium rounded-md ${
                      type === 'income'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Cor
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 ${
                        color === c
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
