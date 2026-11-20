import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { OperationType, handleFirestoreError } from './firestoreError';
import { addMonthsToIsoDate, getCurrentMonthKey, shiftMonthKey } from './formatters';

export interface DefaultCategoryDef {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategoryDef[] = [
  { id: 'cat_salario', name: 'Salário', type: 'income', icon: 'Briefcase', color: '#16A34A' },
  { id: 'cat_freelance', name: 'Freelance & Extras', type: 'income', icon: 'Laptop', color: '#0D9488' },
  { id: 'cat_rendimentos', name: 'Rendimentos', type: 'income', icon: 'TrendingUp', color: '#0284C7' },
  { id: 'cat_moradia', name: 'Moradia & Contas', type: 'expense', icon: 'Home', color: '#475569' },
  { id: 'cat_alimentacao', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#EA580C' },
  { id: 'cat_transporte', name: 'Transporte', type: 'expense', icon: 'Car', color: '#2563EB' },
  { id: 'cat_saude', name: 'Saúde', type: 'expense', icon: 'HeartPulse', color: '#DC2626' },
  { id: 'cat_educacao', name: 'Educação', type: 'expense', icon: 'GraduationCap', color: '#7C3AED' },
  { id: 'cat_lazer', name: 'Lazer & Viagens', type: 'expense', icon: 'Plane', color: '#D97706' },
  { id: 'cat_assinaturas', name: 'Assinaturas', type: 'expense', icon: 'Repeat', color: '#0891B2' },
  { id: 'cat_compras', name: 'Compras & Vestuário', type: 'expense', icon: 'ShoppingBag', color: '#DB2777' },
  { id: 'cat_impostos', name: 'Impostos & Taxas', type: 'expense', icon: 'Landmark', color: '#64748B' },
];

export async function ensureDefaultCategories(userId: string): Promise<void> {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  for (const cat of DEFAULT_CATEGORIES) {
    const ref = doc(db, 'users', userId, 'categories', cat.id);
    batch.set(ref, {
      userId,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/categories`);
  }
}

export async function seedBrazilianSampleWorkspace(userId: string): Promise<void> {
  const batch = writeBatch(db);
  const now = serverTimestamp();
  const currentMonth = getCurrentMonthKey();

  // 1. Categories
  for (const cat of DEFAULT_CATEGORIES) {
    batch.set(doc(db, 'users', userId, 'categories', cat.id), {
      userId,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 2. Accounts & Credit Card
  const accountsData = [
    {
      id: 'acc_itau',
      name: 'Conta Principal',
      type: 'checking',
      institution: 'Itaú Uniclass',
      balance: 8420.5,
      creditLimit: 0,
      closingDay: 0,
      dueDay: 0,
      color: '#0F766E',
      archived: false,
    },
    {
      id: 'acc_selic',
      name: 'Reserva Tesouro Selic',
      type: 'investment',
      institution: 'BTG Pactual',
      balance: 28500.0,
      creditLimit: 0,
      closingDay: 0,
      dueDay: 0,
      color: '#0284C7',
      archived: false,
    },
    {
      id: 'acc_carteira',
      name: 'Carteira Física',
      type: 'wallet',
      institution: 'Espécie',
      balance: 380.0,
      creditLimit: 0,
      closingDay: 0,
      dueDay: 0,
      color: '#475569',
      archived: false,
    },
    {
      id: 'acc_cartao_black',
      name: 'Cartão Black',
      type: 'credit',
      institution: 'Nubank Ultravioleta',
      balance: -2140.8,
      creditLimit: 12000.0,
      closingDay: 3,
      dueDay: 10,
      color: '#1E293B',
      archived: false,
    },
  ];

  for (const acc of accountsData) {
    const { id, ...rest } = acc;
    batch.set(doc(db, 'users', userId, 'accounts', id), {
      userId,
      ...rest,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 3. Monthly Budgets for current month
  const budgetsData = [
    { categoryId: 'cat_moradia', amount: 2800 },
    { categoryId: 'cat_alimentacao', amount: 1600 },
    { categoryId: 'cat_transporte', amount: 750 },
    { categoryId: 'cat_saude', amount: 550 },
    { categoryId: 'cat_lazer', amount: 800 },
    { categoryId: 'cat_assinaturas', amount: 250 },
    { categoryId: 'cat_compras', amount: 600 },
  ];

  for (const b of budgetsData) {
    const id = `bud_${currentMonth}_${b.categoryId}`;
    batch.set(doc(db, 'users', userId, 'budgets', id), {
      userId,
      categoryId: b.categoryId,
      month: currentMonth,
      amount: b.amount,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 4. Financial Goals
  const goalsData = [
    {
      id: 'goal_reserva',
      name: 'Reserva de Emergência (6 meses)',
      targetAmount: 36000,
      currentAmount: 28500,
      deadline: addMonthsToIsoDate(`${currentMonth}-01`, 6),
      color: '#0F766E',
      status: 'active',
    },
    {
      id: 'goal_viagem',
      name: 'Viagem Férias Julho',
      targetAmount: 9500,
      currentAmount: 4200,
      deadline: addMonthsToIsoDate(`${currentMonth}-01`, 8),
      color: '#0284C7',
      status: 'active',
    },
    {
      id: 'goal_equipamento',
      name: 'Upgrade Notebook Trabalho',
      targetAmount: 7200,
      currentAmount: 3100,
      deadline: addMonthsToIsoDate(`${currentMonth}-01`, 4),
      color: '#D97706',
      status: 'active',
    },
  ];

  for (const g of goalsData) {
    const { id, ...rest } = g;
    batch.set(doc(db, 'users', userId, 'goals', id), {
      userId,
      ...rest,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 5. Realistic Transactions across the past 5 months + current month
  const txEntries: Array<{
    id: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    description: string;
    categoryId: string;
    accountId: string;
    toAccountId: string;
    date: string;
    status: 'paid' | 'pending';
    isRecurring: boolean;
    recurrenceFrequency: 'none' | 'monthly';
    installmentGroupId?: string;
    installmentNumber?: number;
    installmentTotal?: number;
    notes: string;
  }> = [];

  for (let mOffset = -4; mOffset <= 0; mOffset++) {
    const mKey = shiftMonthKey(currentMonth, mOffset);
    const isCurrent = mOffset === 0;

    txEntries.push({
      id: `tx_sal_${mKey}`,
      type: 'income',
      amount: 8200,
      description: 'Salário Mensal',
      categoryId: 'cat_salario',
      accountId: 'acc_itau',
      toAccountId: '',
      date: `${mKey}-05`,
      status: 'paid',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      notes: 'Pagamento mensal em conta corrente',
    });

    if (mOffset % 2 === 0) {
      txEntries.push({
        id: `tx_freela_${mKey}`,
        type: 'income',
        amount: isCurrent ? 1450 : 1200,
        description: 'Consultoria de Projeto',
        categoryId: 'cat_freelance',
        accountId: 'acc_itau',
        toAccountId: '',
        date: `${mKey}-12`,
        status: 'paid',
        isRecurring: false,
        recurrenceFrequency: 'none',
        notes: 'Nota fiscal emitida',
      });
    }

    txEntries.push({
      id: `tx_rend_${mKey}`,
      type: 'income',
      amount: 245.3 + (mOffset + 4) * 14,
      description: 'Rendimento Tesouro Selic',
      categoryId: 'cat_rendimentos',
      accountId: 'acc_selic',
      toAccountId: '',
      date: `${mKey}-01`,
      status: 'paid',
      isRecurring: false,
      recurrenceFrequency: 'none',
      notes: 'Rendimento líquido mensal',
    });

    txEntries.push({
      id: `tx_aluguel_${mKey}`,
      type: 'expense',
      amount: 2250,
      description: 'Aluguel + Condomínio',
      categoryId: 'cat_moradia',
      accountId: 'acc_itau',
      toAccountId: '',
      date: `${mKey}-10`,
      status: 'paid',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      notes: 'Boleto mensal residência',
    });

    txEntries.push({
      id: `tx_energia_${mKey}`,
      type: 'expense',
      amount: 215 + Math.abs(mOffset) * 18,
      description: 'Energia Elétrica & Internet',
      categoryId: 'cat_moradia',
      accountId: 'acc_itau',
      toAccountId: '',
      date: `${mKey}-18`,
      status: isCurrent ? 'pending' : 'paid',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      notes: 'Débito programado',
    });

    txEntries.push({
      id: `tx_mercado_${mKey}`,
      type: 'expense',
      amount: 940 + (mOffset + 4) * 35,
      description: 'Supermercado Mensal',
      categoryId: 'cat_alimentacao',
      accountId: 'acc_cartao_black',
      toAccountId: '',
      date: `${mKey}-08`,
      status: 'paid',
      isRecurring: false,
      recurrenceFrequency: 'none',
      notes: 'Compras da casa',
    });

    txEntries.push({
      id: `tx_rest_${mKey}`,
      type: 'expense',
      amount: 340 + (mOffset === 0 ? 110 : 0),
      description: 'Restaurantes e Cafés',
      categoryId: 'cat_alimentacao',
      accountId: 'acc_cartao_black',
      toAccountId: '',
      date: `${mKey}-14`,
      status: 'paid',
      isRecurring: false,
      recurrenceFrequency: 'none',
      notes: '',
    });

    txEntries.push({
      id: `tx_transp_${mKey}`,
      type: 'expense',
      amount: 460,
      description: 'Combustível e Mobilidade',
      categoryId: 'cat_transporte',
      accountId: 'acc_cartao_black',
      toAccountId: '',
      date: `${mKey}-11`,
      status: 'paid',
      isRecurring: false,
      recurrenceFrequency: 'none',
      notes: '',
    });

    txEntries.push({
      id: `tx_assin_${mKey}`,
      type: 'expense',
      amount: 189.9,
      description: 'Streaming, Nuvem e Academia',
      categoryId: 'cat_assinaturas',
      accountId: 'acc_cartao_black',
      toAccountId: '',
      date: `${mKey}-06`,
      status: 'paid',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      notes: 'Assinaturas recorrentes no cartão',
    });

    txEntries.push({
      id: `tx_saude_${mKey}`,
      type: 'expense',
      amount: 410,
      description: 'Plano de Saúde',
      categoryId: 'cat_saude',
      accountId: 'acc_itau',
      toAccountId: '',
      date: `${mKey}-20`,
      status: isCurrent ? 'pending' : 'paid',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      notes: 'Vencimento dia 20',
    });

    txEntries.push({
      id: `tx_aporte_${mKey}`,
      type: 'transfer',
      amount: 1500,
      description: 'Aporte Mensal Reserva Selic',
      categoryId: 'transfer',
      accountId: 'acc_itau',
      toAccountId: 'acc_selic',
      date: `${mKey}-07`,
      status: 'paid',
      isRecurring: true,
      recurrenceFrequency: 'monthly',
      notes: 'Disciplina de poupança mensal',
    });
  }

  // Installment example in current + next 2 months
  for (let i = 0; i < 3; i++) {
    const mKey = shiftMonthKey(currentMonth, i);
    txEntries.push({
      id: `tx_parcela_${i + 1}`,
      type: 'expense',
      amount: 320,
      description: 'Monitor Ergônomico Home Office',
      categoryId: 'cat_compras',
      accountId: 'acc_cartao_black',
      toAccountId: '',
      date: `${mKey}-13`,
      status: i === 0 ? 'paid' : 'pending',
      isRecurring: false,
      recurrenceFrequency: 'none',
      installmentGroupId: 'grp_monitor_demo',
      installmentNumber: i + 1,
      installmentTotal: 3,
      notes: 'Compra parcelada sem juros',
    });
  }

  for (const tx of txEntries) {
    const { id, ...rest } = tx;
    batch.set(doc(db, 'users', userId, 'transactions', id), {
      userId,
      ...rest,
      installmentGroupId: rest.installmentGroupId || '',
      installmentNumber: rest.installmentNumber || 0,
      installmentTotal: rest.installmentTotal || 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Update workspace flag
  batch.update(doc(db, 'users', userId), {
    seededSample: true,
    updatedAt: now,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}
