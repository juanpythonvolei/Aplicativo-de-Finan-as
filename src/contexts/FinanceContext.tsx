import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EmailAuthProvider,
  User,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { mapFirebaseAuthError } from '../lib/authErrors';
import {
  BiometricProfile,
  authenticateWithBiometric,
  clearBiometricProfile,
  enrollBiometricForUser,
  isBiometricHardwareAvailable,
  loadBiometricProfile,
  mapBiometricError,
} from '../lib/biometricAuth';
import {
  OperationType,
  getFriendlyErrorMessage,
  handleFirestoreError,
} from '../lib/firestoreError';
import {
  addMonthsToIsoDate,
  generateSafeId,
  getCurrentMonthKey,
  shiftMonthKey,
} from '../lib/formatters';
import {
  DEFAULT_CATEGORIES,
  seedBrazilianSampleWorkspace,
} from '../lib/seedSampleData';
import {
  AIConversation,
  AIConversationMessage,
  Account,
  AccountType,
  Budget,
  Category,
  CategoryType,
  CurrencyCode,
  Goal,
  GoalStatus,
  RecurrenceFrequency,
  ThemeMode,
  Transaction,
  TransactionStatus,
  TransactionType,
  UserPrivateProfile,
  UserWorkspace,
} from '../types/finance';
import {
  ADMIN_EMAIL,
  AIProfileId,
  AI_PROFILES,
  DEFAULT_AI_PROFILE_ID,
  resolveAIProfile,
} from '../../shared/aiProfiles';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface NewTransactionInput {
  type: TransactionType;
  amount: number;
  description: string;
  categoryId: string;
  accountId: string;
  toAccountId: string;
  date: string;
  status: TransactionStatus;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  installments: number; // 1 = single, >1 = parcelado
  notes: string;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  color: string;
  archived: boolean;
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

export interface GoalInput {
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  color: string;
}

interface FinanceContextValue {
  user: User | null;
  authLoading: boolean;
  needsEmailVerification: boolean;
  dataLoading: boolean;
  workspace: UserWorkspace | null;
  profile: UserPrivateProfile | null;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  theme: ThemeMode;
  toggleTheme: () => Promise<void>;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;
  signInWithGoogle: (rememberMe?: boolean) => Promise<void>;
  signInWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUpWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  checkEmailVerification: () => Promise<boolean>;
  updateUserProfileInfo: (displayName: string, photoURL: string) => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  linkPasswordToAccount: (newPassword: string) => Promise<void>;
  linkGoogleToAccount: () => Promise<void>;
  logout: () => Promise<void>;
  loadSampleData: () => Promise<void>;
  // Biometric Authentication (WebAuthn Platform Authenticator + Local Storage)
  biometricAvailable: boolean;
  biometricProfile: BiometricProfile | null;
  biometricLocked: boolean;
  enrollBiometric: () => Promise<void>;
  disableBiometric: () => void;
  unlockWithBiometric: () => Promise<boolean>;
  lockWithBiometric: () => void;
  isAdmin: boolean;
  assistantProfileId: AIProfileId;
  updateAssistantProfile: (profileId: AIProfileId) => Promise<void>;
  // Transactions
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
  // Accounts
  createAccount: (input: AccountInput) => Promise<void>;
  updateAccount: (account: Account, updates: AccountInput) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  // Categories
  createCategory: (input: CategoryInput) => Promise<void>;
  updateCategory: (category: Category, updates: CategoryInput) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  // Budgets
  upsertBudget: (categoryId: string, month: string, amount: number) => Promise<void>;
  bulkUpsertBudgets: (
    entries: Array<{ categoryId: string; month: string; amount: number }>
  ) => Promise<number>;
  deleteBudget: (budgetId: string) => Promise<void>;
  copyPreviousMonthBudgets: (targetMonth: string) => Promise<void>;
  // Goals
  createGoal: (input: GoalInput) => Promise<void>;
  updateGoal: (goal: Goal, updates: GoalInput & { status: GoalStatus }) => Promise<void>;
  contributeToGoal: (goal: Goal, amount: number, sourceAccountId?: string) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  // Persisted AI Conversations
  aiConversations: AIConversation[];
  activeConversationId: string | null;
  setActiveConversationId: (conversationId: string | null) => void;
  activeConversationMessages: AIConversationMessage[];
  messagesLoading: boolean;
  createAIConversation: (initialTitle?: string) => Promise<string>;
  appendAIMessage: (
    conversationId: string,
    msg: {
      role: 'user' | 'assistant';
      text: string;
      actionsSummary?: string[];
      modelProfileId?: string;
      hasImage?: boolean;
      autoTitle?: string;
      nextMessageCount: number;
    }
  ) => Promise<string>;
  renameAIConversation: (conversationId: string, newTitle: string) => Promise<void>;
  deleteAIConversation: (conversationId: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const [workspace, setWorkspace] = useState<UserWorkspace | null>(null);
  const [profile, setProfile] = useState<UserPrivateProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [aiConversations, setAiConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [userClearedConversation, setUserClearedConversation] = useState(false);
  const [activeConversationMessages, setActiveConversationMessages] = useState<
    AIConversationMessage[]
  >([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [assistantProfileId, setAssistantProfileId] = useState<AIProfileId>(DEFAULT_AI_PROFILE_ID);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>(false);
  const [biometricProfile, setBiometricProfile] = useState<BiometricProfile | null>(() =>
    loadBiometricProfile()
  );
  const [biometricLocked, setBiometricLocked] = useState<boolean>(false);
  const freshInteractiveSignInRef = useRef<boolean>(false);

  useEffect(() => {
    let active = true;
    isBiometricHardwareAvailable().then((ok) => {
      if (active) setBiometricAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const setActiveConversationId = useCallback((conversationId: string | null) => {
    setUserClearedConversation(conversationId === null);
    setActiveConversationIdState(conversationId);
  }, []);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = generateSafeId('toast');
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync HTML .dark class with theme state
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const ensureWorkspaceInitialized = useCallback(async (firebaseUser: User) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
    }

    if (!userSnap.exists()) {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      batch.set(userRef, {
        userId: firebaseUser.uid,
        currency: 'BRL',
        theme: 'light',
        seededSample: false,
        createdAt: now,
        updatedAt: now,
      });

      const safeDisplayName = (
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'Usuário'
      ).slice(0, 120);

      batch.set(doc(db, 'users', firebaseUser.uid, 'private', 'profile'), {
        userId: firebaseUser.uid,
        email: (firebaseUser.email || 'usuario@local').slice(0, 254),
        displayName: safeDisplayName,
        photoURL: (firebaseUser.photoURL || '').slice(0, 500),
        createdAt: now,
        updatedAt: now,
      });

      for (const cat of DEFAULT_CATEGORIES) {
        batch.set(doc(db, 'users', firebaseUser.uid, 'categories', cat.id), {
          userId: firebaseUser.uid,
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
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
      }
    }
    setWorkspaceReady(true);
  }, []);

  // Listen to Firebase Auth state & initialize user workspace if verified
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setWorkspaceReady(false);

      if (!firebaseUser) {
        setNeedsEmailVerification(false);
        setBiometricLocked(false);
        setWorkspace(null);
        setProfile(null);
        setAccounts([]);
        setCategories([]);
        setTransactions([]);
        setBudgets([]);
        setGoals([]);
        setAiConversations([]);
        setActiveConversationIdState(null);
        setActiveConversationMessages([]);
        setDataLoading(false);
        setAuthLoading(false);
        return;
      }

      if (!firebaseUser.emailVerified) {
        setNeedsEmailVerification(true);
        setBiometricLocked(false);
        setDataLoading(false);
        setAuthLoading(false);
        return;
      }

      const savedBio = loadBiometricProfile();
      setBiometricProfile(savedBio);
      const shouldLock =
        !freshInteractiveSignInRef.current &&
        Boolean(savedBio?.enabled && savedBio.uid === firebaseUser.uid);
      freshInteractiveSignInRef.current = false;
      setBiometricLocked(shouldLock);

      setNeedsEmailVerification(false);
      setDataLoading(true);
      try {
        await ensureWorkspaceInitialized(firebaseUser);
      } catch (err) {
        pushToast('error', getFriendlyErrorMessage(err));
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [pushToast, ensureWorkspaceInitialized]);

  // Attach real-time Firestore listeners once authenticated, verified, and workspace initialized
  useEffect(() => {
    if (!user || !workspaceReady || needsEmailVerification) return;
    const uid = user.uid;
    setDataLoading(true);

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserWorkspace;
            setWorkspace(data);
            setTheme(data.theme || 'light');
          }
          setDataLoading(false);
        },
        (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid, 'private', 'profile'),
        (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserPrivateProfile);
          }
        },
        (error) =>
          handleFirestoreError(error, OperationType.GET, `users/${uid}/private/profile`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'accounts'), where('userId', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Account, 'id'>) }));
          list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
          setAccounts(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/accounts`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'categories'), where('userId', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
          list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
          setCategories(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/categories`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'transactions'), where('userId', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Transaction, 'id'>),
          }));
          list.sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            return b.id.localeCompare(a.id);
          });
          setTransactions(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/transactions`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'budgets'), where('userId', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Budget, 'id'>) }));
          setBudgets(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/budgets`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'goals'), where('userId', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Goal, 'id'>) }));
          list.sort((a, b) => a.deadline.localeCompare(b.deadline));
          setGoals(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/goals`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'aiConversations'), where('userId', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AIConversation, 'id'>),
          }));
          list.sort((a, b) => {
            const ta = a.lastMessageAt?.toMillis?.() ?? a.updatedAt?.toMillis?.() ?? 0;
            const tb = b.lastMessageAt?.toMillis?.() ?? b.updatedAt?.toMillis?.() ?? 0;
            if (tb !== ta) return tb - ta;
            return b.id.localeCompare(a.id);
          });
          setAiConversations(list);
        },
        (error) =>
          handleFirestoreError(error, OperationType.LIST, `users/${uid}/aiConversations`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'appConfig', 'assistant'),
        (snap) => {
          if (snap.exists()) {
            const resolved = resolveAIProfile((snap.data() as { profileId?: string }).profileId);
            setAssistantProfileId(resolved.id);
          } else {
            setAssistantProfileId(DEFAULT_AI_PROFILE_ID);
          }
        },
        (error) => {
          console.warn('Não foi possível ler appConfig/assistant:', error);
        }
      )
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [user, workspaceReady, needsEmailVerification]);

  // Auto-select latest conversation when available unless user explicitly started a fresh blank chat
  useEffect(() => {
    if (aiConversations.length === 0) {
      if (activeConversationId !== null) {
        setActiveConversationIdState(null);
      }
      return;
    }
    if (activeConversationId) {
      const stillExists = aiConversations.some((c) => c.id === activeConversationId);
      if (!stillExists) {
        setActiveConversationIdState(aiConversations[0].id);
      }
    } else if (!userClearedConversation) {
      setActiveConversationIdState(aiConversations[0].id);
    }
  }, [aiConversations, activeConversationId, userClearedConversation]);

  // Listen to messages of active AI conversation
  useEffect(() => {
    if (!user || !workspaceReady || needsEmailVerification || !activeConversationId) {
      setActiveConversationMessages([]);
      setMessagesLoading(false);
      return;
    }
    const uid = user.uid;
    setMessagesLoading(true);
    const q = query(
      collection(db, 'users', uid, 'aiConversations', activeConversationId, 'messages'),
      where('userId', '==', uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AIConversationMessage, 'id'>),
        }));
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
          const tb = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
          if (ta !== tb) return ta - tb;
          return a.id.localeCompare(b.id);
        });
        setActiveConversationMessages(list);
        setMessagesLoading(false);
      },
      (error) => {
        setMessagesLoading(false);
        handleFirestoreError(
          error,
          OperationType.LIST,
          `users/${uid}/aiConversations/${activeConversationId}/messages`
        );
      }
    );
    return () => unsub();
  }, [user, workspaceReady, needsEmailVerification, activeConversationId]);

  const signInWithGoogle = useCallback(async (rememberMe = true) => {
    freshInteractiveSignInRef.current = true;
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
    await signInWithPopup(auth, googleProvider);
    setBiometricLocked(false);
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      freshInteractiveSignInRef.current = true;
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setBiometricLocked(false);
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (displayName: string, email: string, password: string) => {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const cleanName = displayName.trim().slice(0, 120);
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      await sendEmailVerification(cred.user);
      setUser(cred.user);
      setNeedsEmailVerification(!cred.user.emailVerified);
    },
    []
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
    pushToast('success', 'Novo link de verificação enviado para o seu e-mail.');
  }, [pushToast]);

  const checkEmailVerification = useCallback(async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    await current.reload();
    if (!current.emailVerified) {
      return false;
    }
    await current.getIdToken(true);
    setUser(auth.currentUser);
    setNeedsEmailVerification(false);
    setDataLoading(true);
    try {
      await ensureWorkspaceInitialized(current);
      pushToast('success', 'E-mail verificado com sucesso! Bem-vindo ao Vértice Finance.');
    } catch (err) {
      pushToast('error', getFriendlyErrorMessage(err));
    }
    return true;
  }, [ensureWorkspaceInitialized, pushToast]);

  const updateUserProfileInfo = useCallback(
    async (displayName: string, photoURL: string) => {
      const current = auth.currentUser;
      if (!current) return;
      const safeName = displayName.trim().slice(0, 120);
      const safePhoto = photoURL.trim().slice(0, 500);
      if (!safeName) {
        throw new Error('O nome de exibição é obrigatório.');
      }
      await updateProfile(current, {
        displayName: safeName,
        photoURL: safePhoto || null,
      });
      try {
        await updateDoc(doc(db, 'users', current.uid, 'private', 'profile'), {
          email: (current.email || profile?.email || 'usuario@local').slice(0, 254),
          displayName: safeName,
          photoURL: safePhoto,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${current.uid}/private/profile`);
      }
      setUser(auth.currentUser);
      pushToast('success', 'Perfil atualizado com sucesso.');
    },
    [profile, pushToast]
  );

  const changeUserPassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const current = auth.currentUser;
      if (!current || !current.email) {
        throw new Error('Usuário não autenticado com e-mail.');
      }
      const cred = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, cred);
      await updatePassword(current, newPassword);
      pushToast('success', 'Senha alterada com sucesso.');
    },
    [pushToast]
  );

  const linkPasswordToAccount = useCallback(
    async (newPassword: string) => {
      const current = auth.currentUser;
      if (!current || !current.email) {
        throw new Error('E-mail não disponível para vincular senha.');
      }
      const cred = EmailAuthProvider.credential(current.email, newPassword);
      await linkWithCredential(current, cred);
      setUser(auth.currentUser);
      pushToast('success', 'Senha de acesso criada e vinculada à sua conta.');
    },
    [pushToast]
  );

  const linkGoogleToAccount = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return;
    try {
      await linkWithPopup(current, googleProvider);
      setUser(auth.currentUser);
      pushToast('success', 'Conta Google vinculada com sucesso.');
    } catch (error) {
      const mapped = mapFirebaseAuthError(error);
      throw new Error(mapped.message);
    }
  }, [pushToast]);

  const logout = useCallback(async () => {
    setBiometricLocked(false);
    await signOut(auth);
  }, []);

  const enrollBiometric = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Faça login para ativar o desbloqueio biométrico.');
    }
    const isGoogle = current.providerData.some((p) => p.providerId === 'google.com');
    try {
      const enrolled = await enrollBiometricForUser({
        uid: current.uid,
        email: current.email || '',
        displayName: profile?.displayName || current.displayName || current.email || 'Usuário',
        provider: isGoogle ? 'google' : 'password',
      });
      setBiometricProfile(enrolled);
      setBiometricLocked(false);
      pushToast('success', 'Autenticação biométrica ativada neste dispositivo.');
    } catch (err) {
      throw new Error(mapBiometricError(err));
    }
  }, [profile, pushToast]);

  const disableBiometric = useCallback(() => {
    clearBiometricProfile();
    setBiometricProfile(null);
    setBiometricLocked(false);
    pushToast('info', 'Autenticação biométrica desativada neste dispositivo.');
  }, [pushToast]);

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    const saved = loadBiometricProfile();
    if (!saved) {
      throw new Error('Nenhuma credencial biométrica registrada neste dispositivo.');
    }
    try {
      const verified = await authenticateWithBiometric(saved);
      if (verified) {
        setBiometricProfile(loadBiometricProfile());
        setBiometricLocked(false);
        return true;
      }
      return false;
    } catch (err) {
      throw new Error(mapBiometricError(err));
    }
  }, []);

  const lockWithBiometric = useCallback(() => {
    const saved = loadBiometricProfile();
    if (!saved?.enabled || !auth.currentUser || saved.uid !== auth.currentUser.uid) {
      pushToast('info', 'Ative a biometria em Segurança antes de bloquear o cofre.');
      return;
    }
    setBiometricLocked(true);
  }, [pushToast]);

  const toggleTheme = useCallback(async () => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        theme: next,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  }, [theme, user]);

  const setCurrency = useCallback(
    async (currency: CurrencyCode) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          currency,
          updatedAt: serverTimestamp(),
        });
        pushToast('success', `Moeda principal alterada para ${currency}.`);
      } catch (error) {
        pushToast('error', getFriendlyErrorMessage(error));
      }
    },
    [user, pushToast]
  );

  const isAdmin = useMemo(
    () => Boolean(user?.emailVerified && user.email?.toLowerCase() === ADMIN_EMAIL),
    [user]
  );

  const updateAssistantProfile = useCallback(
    async (profileId: AIProfileId) => {
      const current = auth.currentUser;
      if (!current || !isAdmin) {
        throw new Error('Apenas o administrador pode alterar o modelo do Assistente IA.');
      }
      const cfg = AI_PROFILES[profileId] || AI_PROFILES[DEFAULT_AI_PROFILE_ID];
      try {
        await setDoc(doc(db, 'appConfig', 'assistant'), {
          profileId: cfg.id,
          modelId: cfg.modelId,
          thinkingLevel: cfg.thinkingLevel,
          updatedBy: current.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'appConfig/assistant');
      }

      setAssistantProfileId(cfg.id);

      try {
        const idToken = await current.getIdToken();
        await fetch('/api/assistant/config/invalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ profileId: cfg.id }),
        });
      } catch (err) {
        console.warn('Falha ao notificar servidor sobre novo perfil de IA:', err);
      }

      pushToast('success', `Modo de IA alterado para "${cfg.label}".`);
    },
    [isAdmin, pushToast]
  );

  const loadSampleData = useCallback(async () => {
    if (!user) return;
    try {
      await seedBrazilianSampleWorkspace(user.uid);
      pushToast('success', 'Cenário financeiro de exemplo carregado com sucesso.');
    } catch (error) {
      pushToast('error', getFriendlyErrorMessage(error));
    }
  }, [user, pushToast]);

  // Helper to compute balance deltas cleanly for paid transactions
  const accumulateBalanceDelta = useCallback(
    (
      deltas: Map<string, number>,
      tx: Pick<Transaction, 'type' | 'amount' | 'accountId' | 'toAccountId' | 'status'>,
      direction: 1 | -1
    ) => {
      if (tx.status !== 'paid') return;
      const amt = tx.amount * direction;
      if (tx.type === 'income') {
        deltas.set(tx.accountId, (deltas.get(tx.accountId) || 0) + amt);
      } else if (tx.type === 'expense') {
        deltas.set(tx.accountId, (deltas.get(tx.accountId) || 0) - amt);
      } else if (tx.type === 'transfer' && tx.toAccountId) {
        deltas.set(tx.accountId, (deltas.get(tx.accountId) || 0) - amt);
        deltas.set(tx.toAccountId, (deltas.get(tx.toAccountId) || 0) + amt);
      }
    },
    []
  );

  const applyAccountDeltasToBatch = useCallback(
    (batch: ReturnType<typeof writeBatch>, uid: string, deltas: Map<string, number>) => {
      const now = serverTimestamp();
      const accountMap = new Map(accounts.map((a) => [a.id, a]));
      for (const [accId, delta] of deltas.entries()) {
        if (Math.abs(delta) < 0.0001) continue;
        const acc = accountMap.get(accId);
        if (!acc) continue;
        const nextBalance = Math.round((acc.balance + delta) * 100) / 100;
        batch.update(doc(db, 'users', uid, 'accounts', accId), {
          balance: nextBalance,
          updatedAt: now,
        });
      }
    },
    [accounts]
  );

  const createTransaction = useCallback(
    async (input: NewTransactionInput) => {
      if (!user) return;
      const uid = user.uid;
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const deltas = new Map<string, number>();

      const totalInstallments = Math.max(1, Math.min(360, Math.round(input.installments || 1)));
      const groupId = totalInstallments > 1 ? generateSafeId('grp') : '';
      const cleanDesc = input.description.trim().slice(0, 140);
      const cleanNotes = input.notes.trim().slice(0, 500);
      const categoryId = input.type === 'transfer' ? 'transfer' : input.categoryId;
      const toAccountId = input.type === 'transfer' ? input.toAccountId : '';

      for (let i = 0; i < totalInstallments; i++) {
        const txId = generateSafeId('tx');
        const txDate = i === 0 ? input.date : addMonthsToIsoDate(input.date, i);
        const txStatus: TransactionStatus = i === 0 ? input.status : 'pending';

        const payload = {
          userId: uid,
          type: input.type,
          amount: Math.round(input.amount * 100) / 100,
          description: cleanDesc,
          categoryId,
          accountId: input.accountId,
          toAccountId,
          date: txDate,
          status: txStatus,
          isRecurring: totalInstallments === 1 ? input.isRecurring : false,
          recurrenceFrequency:
            totalInstallments === 1 && input.isRecurring ? input.recurrenceFrequency : 'none',
          installmentGroupId: groupId,
          installmentNumber: totalInstallments > 1 ? i + 1 : 0,
          installmentTotal: totalInstallments > 1 ? totalInstallments : 0,
          notes: cleanNotes,
          createdAt: now,
          updatedAt: now,
        };

        batch.set(doc(db, 'users', uid, 'transactions', txId), payload);
        accumulateBalanceDelta(deltas, payload, 1);
      }

      applyAccountDeltasToBatch(batch, uid, deltas);

      try {
        await batch.commit();
        pushToast(
          'success',
          totalInstallments > 1
            ? `${totalInstallments} parcelas registradas com sucesso.`
            : 'Lançamento registrado com sucesso.'
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}/transactions`);
      }
    },
    [user, accumulateBalanceDelta, applyAccountDeltasToBatch, pushToast]
  );

  const updateTransaction = useCallback(
    async (tx: Transaction, updates: Omit<NewTransactionInput, 'installments'>) => {
      if (!user) return;
      const uid = user.uid;
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const deltas = new Map<string, number>();

      // Reverse old paid impact, apply new paid impact
      accumulateBalanceDelta(deltas, tx, -1);

      const categoryId = updates.type === 'transfer' ? 'transfer' : updates.categoryId;
      const toAccountId = updates.type === 'transfer' ? updates.toAccountId : '';
      const roundedAmount = Math.round(updates.amount * 100) / 100;

      const updatedFields = {
        type: updates.type,
        amount: roundedAmount,
        description: updates.description.trim().slice(0, 140),
        categoryId,
        accountId: updates.accountId,
        toAccountId,
        date: updates.date,
        status: updates.status,
        isRecurring: updates.isRecurring,
        recurrenceFrequency: updates.isRecurring ? updates.recurrenceFrequency : 'none',
        notes: updates.notes.trim().slice(0, 500),
        updatedAt: now,
      };

      batch.update(doc(db, 'users', uid, 'transactions', tx.id), updatedFields);
      accumulateBalanceDelta(deltas, updatedFields, 1);
      applyAccountDeltasToBatch(batch, uid, deltas);

      try {
        await batch.commit();
        pushToast('success', 'Lançamento atualizado.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/transactions/${tx.id}`);
      }
    },
    [user, accumulateBalanceDelta, applyAccountDeltasToBatch, pushToast]
  );

  const toggleTransactionStatus = useCallback(
    async (tx: Transaction) => {
      if (!user) return;
      const uid = user.uid;
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const deltas = new Map<string, number>();

      const nextStatus: TransactionStatus = tx.status === 'paid' ? 'pending' : 'paid';
      accumulateBalanceDelta(deltas, tx, -1);
      accumulateBalanceDelta(deltas, { ...tx, status: nextStatus }, 1);

      batch.update(doc(db, 'users', uid, 'transactions', tx.id), {
        status: nextStatus,
        updatedAt: now,
      });

      applyAccountDeltasToBatch(batch, uid, deltas);

      try {
        await batch.commit();
        pushToast(
          'success',
          nextStatus === 'paid' ? 'Lançamento marcado como efetivado.' : 'Lançamento marcado como pendente.'
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/transactions/${tx.id}`);
      }
    },
    [user, accumulateBalanceDelta, applyAccountDeltasToBatch, pushToast]
  );

  const deleteTransaction = useCallback(
    async (tx: Transaction) => {
      if (!user) return;
      const uid = user.uid;
      const batch = writeBatch(db);
      const deltas = new Map<string, number>();

      accumulateBalanceDelta(deltas, tx, -1);
      batch.delete(doc(db, 'users', uid, 'transactions', tx.id));
      applyAccountDeltasToBatch(batch, uid, deltas);

      try {
        await batch.commit();
        pushToast('info', 'Lançamento excluído.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/transactions/${tx.id}`);
      }
    },
    [user, accumulateBalanceDelta, applyAccountDeltasToBatch, pushToast]
  );

  const bulkCreateTransactions = useCallback(
    async (inputs: NewTransactionInput[]): Promise<number> => {
      if (!user || inputs.length === 0) return 0;
      const uid = user.uid;
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const deltas = new Map<string, number>();
      let count = 0;

      for (const input of inputs) {
        const totalInstallments = Math.max(
          1,
          Math.min(60, Math.round(input.installments || 1))
        );
        const groupId = totalInstallments > 1 ? generateSafeId('grp') : '';
        const cleanDesc = input.description.trim().slice(0, 140);
        const cleanNotes = input.notes.trim().slice(0, 500);
        const categoryId = input.type === 'transfer' ? 'transfer' : input.categoryId;
        const toAccountId = input.type === 'transfer' ? input.toAccountId : '';

        for (let i = 0; i < totalInstallments; i++) {
          const txId = generateSafeId('tx');
          const txDate = i === 0 ? input.date : addMonthsToIsoDate(input.date, i);
          const txStatus: TransactionStatus = i === 0 ? input.status : 'pending';
          const payload = {
            userId: uid,
            type: input.type,
            amount: Math.round(input.amount * 100) / 100,
            description: cleanDesc,
            categoryId,
            accountId: input.accountId,
            toAccountId,
            date: txDate,
            status: txStatus,
            isRecurring: totalInstallments === 1 ? input.isRecurring : false,
            recurrenceFrequency:
              totalInstallments === 1 && input.isRecurring ? input.recurrenceFrequency : 'none',
            installmentGroupId: groupId,
            installmentNumber: totalInstallments > 1 ? i + 1 : 0,
            installmentTotal: totalInstallments > 1 ? totalInstallments : 0,
            notes: cleanNotes,
            createdAt: now,
            updatedAt: now,
          };
          batch.set(doc(db, 'users', uid, 'transactions', txId), payload);
          accumulateBalanceDelta(deltas, payload, 1);
          count++;
        }
      }

      applyAccountDeltasToBatch(batch, uid, deltas);
      try {
        await batch.commit();
        pushToast('success', `${count} lançamento(s) registrado(s) em lote.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}/transactions`);
      }
      return count;
    },
    [user, accumulateBalanceDelta, applyAccountDeltasToBatch, pushToast]
  );

  const bulkUpdateTransactions = useCallback(
    async (
      items: Array<{ tx: Transaction; updates: Omit<NewTransactionInput, 'installments'> }>
    ): Promise<number> => {
      if (!user || items.length === 0) return 0;
      const uid = user.uid;
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const deltas = new Map<string, number>();

      for (const { tx, updates } of items) {
        accumulateBalanceDelta(deltas, tx, -1);
        const categoryId = updates.type === 'transfer' ? 'transfer' : updates.categoryId;
        const toAccountId = updates.type === 'transfer' ? updates.toAccountId : '';
        const updatedFields = {
          type: updates.type,
          amount: Math.round(updates.amount * 100) / 100,
          description: updates.description.trim().slice(0, 140),
          categoryId,
          accountId: updates.accountId,
          toAccountId,
          date: updates.date,
          status: updates.status,
          isRecurring: updates.isRecurring,
          recurrenceFrequency: updates.isRecurring ? updates.recurrenceFrequency : 'none',
          notes: updates.notes.trim().slice(0, 500),
          updatedAt: now,
        };
        batch.update(doc(db, 'users', uid, 'transactions', tx.id), updatedFields);
        accumulateBalanceDelta(deltas, updatedFields, 1);
      }

      applyAccountDeltasToBatch(batch, uid, deltas);
      try {
        await batch.commit();
        pushToast('success', `${items.length} lançamento(s) atualizado(s).`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/transactions`);
      }
      return items.length;
    },
    [user, accumulateBalanceDelta, applyAccountDeltasToBatch, pushToast]
  );

  const bulkDeleteTransactions = useCallback(
    async (txs: Transaction[]): Promise<number> => {
      if (!user || txs.length === 0) return 0;
      const uid = user.uid;
      const batch = writeBatch(db);
      const deltas = new Map<string, number>();

      for (const tx of txs) {
        accumulateBalanceDelta(deltas, tx, -1);
        batch.delete(doc(db, 'users', uid, 'transactions', tx.id));
      }

      applyAccountDeltasToBatch(batch, uid, deltas);
      try {
        await batch.commit();
        pushToast('info', `${txs.length} lançamento(s) excluído(s).`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/transactions`);
      }
      return txs.length;
    },
    [user, accumulateBalanceDelta, applyAccountDeltasToBatch, pushToast]
  );

  const createAccount = useCallback(
    async (input: AccountInput) => {
      if (!user) return;
      const uid = user.uid;
      const id = generateSafeId('acc');
      const now = serverTimestamp();
      try {
        await setDoc(doc(db, 'users', uid, 'accounts', id), {
          userId: uid,
          name: input.name.trim().slice(0, 80),
          type: input.type,
          institution: input.institution.trim().slice(0, 80),
          balance: Math.round(input.balance * 100) / 100,
          creditLimit: input.type === 'credit' ? Math.max(0, input.creditLimit) : 0,
          closingDay: input.type === 'credit' ? Math.max(1, Math.min(31, input.closingDay)) : 0,
          dueDay: input.type === 'credit' ? Math.max(1, Math.min(31, input.dueDay)) : 0,
          color: input.color,
          archived: false,
          createdAt: now,
          updatedAt: now,
        });
        pushToast('success', 'Conta adicionada com sucesso.');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${uid}/accounts/${id}`);
      }
    },
    [user, pushToast]
  );

  const updateAccount = useCallback(
    async (account: Account, updates: AccountInput) => {
      if (!user) return;
      const uid = user.uid;
      try {
        await updateDoc(doc(db, 'users', uid, 'accounts', account.id), {
          name: updates.name.trim().slice(0, 80),
          type: updates.type,
          institution: updates.institution.trim().slice(0, 80),
          balance: Math.round(updates.balance * 100) / 100,
          creditLimit: updates.type === 'credit' ? Math.max(0, updates.creditLimit) : 0,
          closingDay: updates.type === 'credit' ? Math.max(1, Math.min(31, updates.closingDay)) : 0,
          dueDay: updates.type === 'credit' ? Math.max(1, Math.min(31, updates.dueDay)) : 0,
          color: updates.color,
          archived: updates.archived,
          updatedAt: serverTimestamp(),
        });
        pushToast('success', 'Conta atualizada.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/accounts/${account.id}`);
      }
    },
    [user, pushToast]
  );

  const deleteAccount = useCallback(
    async (accountId: string) => {
      if (!user) return;
      const uid = user.uid;
      try {
        await deleteDoc(doc(db, 'users', uid, 'accounts', accountId));
        pushToast('info', 'Conta removida.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/accounts/${accountId}`);
      }
    },
    [user, pushToast]
  );

  const createCategory = useCallback(
    async (input: CategoryInput) => {
      if (!user) return;
      const uid = user.uid;
      const id = generateSafeId('cat');
      const now = serverTimestamp();
      try {
        await setDoc(doc(db, 'users', uid, 'categories', id), {
          userId: uid,
          name: input.name.trim().slice(0, 60),
          type: input.type,
          icon: input.icon.slice(0, 40),
          color: input.color,
          createdAt: now,
          updatedAt: now,
        });
        pushToast('success', 'Categoria criada.');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${uid}/categories/${id}`);
      }
    },
    [user, pushToast]
  );

  const updateCategory = useCallback(
    async (category: Category, updates: CategoryInput) => {
      if (!user) return;
      const uid = user.uid;
      try {
        await updateDoc(doc(db, 'users', uid, 'categories', category.id), {
          name: updates.name.trim().slice(0, 60),
          type: updates.type,
          icon: updates.icon.slice(0, 40),
          color: updates.color,
          updatedAt: serverTimestamp(),
        });
        pushToast('success', 'Categoria atualizada.');
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${uid}/categories/${category.id}`
        );
      }
    },
    [user, pushToast]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      if (!user) return;
      const uid = user.uid;
      try {
        await deleteDoc(doc(db, 'users', uid, 'categories', categoryId));
        pushToast('info', 'Categoria removida.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/categories/${categoryId}`);
      }
    },
    [user, pushToast]
  );

  const upsertBudget = useCallback(
    async (categoryId: string, month: string, amount: number) => {
      if (!user) return;
      const uid = user.uid;
      const existing = budgets.find((b) => b.categoryId === categoryId && b.month === month);
      const rounded = Math.round(amount * 100) / 100;
      const now = serverTimestamp();

      try {
        if (existing) {
          await updateDoc(doc(db, 'users', uid, 'budgets', existing.id), {
            amount: rounded,
            updatedAt: now,
          });
        } else {
          const id = `bud_${month}_${categoryId}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
          await setDoc(doc(db, 'users', uid, 'budgets', id), {
            userId: uid,
            categoryId,
            month,
            amount: rounded,
            createdAt: now,
            updatedAt: now,
          });
        }
        pushToast('success', 'Orçamento salvo.');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}/budgets`);
      }
    },
    [user, budgets, pushToast]
  );

  const deleteBudget = useCallback(
    async (budgetId: string) => {
      if (!user) return;
      const uid = user.uid;
      try {
        await deleteDoc(doc(db, 'users', uid, 'budgets', budgetId));
        pushToast('info', 'Orçamento removido.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/budgets/${budgetId}`);
      }
    },
    [user, pushToast]
  );

  const copyPreviousMonthBudgets = useCallback(
    async (targetMonth: string) => {
      if (!user) return;
      const uid = user.uid;
      const prevMonth = shiftMonthKey(targetMonth, -1);
      const prevBudgets = budgets.filter((b) => b.month === prevMonth);
      if (prevBudgets.length === 0) {
        pushToast('info', 'Nenhum orçamento encontrado no mês anterior.');
        return;
      }

      const batch = writeBatch(db);
      const now = serverTimestamp();

      for (const prev of prevBudgets) {
        const existingTarget = budgets.find(
          (b) => b.categoryId === prev.categoryId && b.month === targetMonth
        );
        if (existingTarget) {
          batch.update(doc(db, 'users', uid, 'budgets', existingTarget.id), {
            amount: prev.amount,
            updatedAt: now,
          });
        } else {
          const id = `bud_${targetMonth}_${prev.categoryId}`
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 120);
          batch.set(doc(db, 'users', uid, 'budgets', id), {
            userId: uid,
            categoryId: prev.categoryId,
            month: targetMonth,
            amount: prev.amount,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      try {
        await batch.commit();
        pushToast('success', `${prevBudgets.length} orçamentos copiados do mês anterior.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}/budgets`);
      }
    },
    [user, budgets, pushToast]
  );

  const bulkUpsertBudgets = useCallback(
    async (
      entries: Array<{ categoryId: string; month: string; amount: number }>
    ): Promise<number> => {
      if (!user || entries.length === 0) return 0;
      const uid = user.uid;
      const batch = writeBatch(db);
      const now = serverTimestamp();

      for (const entry of entries) {
        const rounded = Math.round(entry.amount * 100) / 100;
        const existing = budgets.find(
          (b) => b.categoryId === entry.categoryId && b.month === entry.month
        );
        if (existing) {
          batch.update(doc(db, 'users', uid, 'budgets', existing.id), {
            amount: rounded,
            updatedAt: now,
          });
        } else {
          const id = `bud_${entry.month}_${entry.categoryId}`
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 120);
          batch.set(doc(db, 'users', uid, 'budgets', id), {
            userId: uid,
            categoryId: entry.categoryId,
            month: entry.month,
            amount: rounded,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      try {
        await batch.commit();
        pushToast('success', `${entries.length} orçamento(s) atualizado(s).`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}/budgets`);
      }
      return entries.length;
    },
    [user, budgets, pushToast]
  );

  const createGoal = useCallback(
    async (input: GoalInput) => {
      if (!user) return;
      const uid = user.uid;
      const id = generateSafeId('goal');
      const now = serverTimestamp();
      const status: GoalStatus =
        input.currentAmount >= input.targetAmount ? 'completed' : 'active';
      try {
        await setDoc(doc(db, 'users', uid, 'goals', id), {
          userId: uid,
          name: input.name.trim().slice(0, 80),
          targetAmount: Math.round(input.targetAmount * 100) / 100,
          currentAmount: Math.round(input.currentAmount * 100) / 100,
          deadline: input.deadline,
          color: input.color,
          status,
          createdAt: now,
          updatedAt: now,
        });
        pushToast('success', 'Meta financeira criada.');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${uid}/goals/${id}`);
      }
    },
    [user, pushToast]
  );

  const updateGoal = useCallback(
    async (goal: Goal, updates: GoalInput & { status: GoalStatus }) => {
      if (!user) return;
      const uid = user.uid;
      try {
        await updateDoc(doc(db, 'users', uid, 'goals', goal.id), {
          name: updates.name.trim().slice(0, 80),
          targetAmount: Math.round(updates.targetAmount * 100) / 100,
          currentAmount: Math.round(updates.currentAmount * 100) / 100,
          deadline: updates.deadline,
          color: updates.color,
          status: updates.status,
          updatedAt: serverTimestamp(),
        });
        pushToast('success', 'Meta atualizada.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/goals/${goal.id}`);
      }
    },
    [user, pushToast]
  );

  const contributeToGoal = useCallback(
    async (goal: Goal, amount: number, sourceAccountId?: string) => {
      if (!user) return;
      const uid = user.uid;
      const batch = writeBatch(db);
      const now = serverTimestamp();

      const nextAmount = Math.round((goal.currentAmount + amount) * 100) / 100;
      const nextStatus: GoalStatus = nextAmount >= goal.targetAmount ? 'completed' : 'active';

      batch.update(doc(db, 'users', uid, 'goals', goal.id), {
        currentAmount: nextAmount,
        status: nextStatus,
        updatedAt: now,
      });

      if (sourceAccountId) {
        const acc = accounts.find((a) => a.id === sourceAccountId);
        if (acc) {
          batch.update(doc(db, 'users', uid, 'accounts', acc.id), {
            balance: Math.round((acc.balance - amount) * 100) / 100,
            updatedAt: now,
          });
        }
      }

      try {
        await batch.commit();
        pushToast(
          'success',
          nextStatus === 'completed'
            ? `Meta "${goal.name}" concluída!`
            : 'Aporte registrado na meta.'
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/goals/${goal.id}`);
      }
    },
    [user, accounts, pushToast]
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      if (!user) return;
      const uid = user.uid;
      try {
        await deleteDoc(doc(db, 'users', uid, 'goals', goalId));
        pushToast('info', 'Meta removida.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/goals/${goalId}`);
      }
    },
    [user, pushToast]
  );

  const createAIConversation = useCallback(
    async (initialTitle?: string): Promise<string> => {
      if (!user) throw new Error('Usuário não autenticado.');
      const uid = user.uid;
      const convId = generateSafeId('conv');
      const now = serverTimestamp();
      const safeTitle = (initialTitle || 'Nova conversa').trim().replace(/\s+/g, ' ').slice(0, 120) || 'Nova conversa';
      try {
        await setDoc(doc(db, 'users', uid, 'aiConversations', convId), {
          userId: uid,
          title: safeTitle,
          preview: '',
          messageCount: 0,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        });
        setUserClearedConversation(false);
        setActiveConversationIdState(convId);
        return convId;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${uid}/aiConversations/${convId}`);
      }
    },
    [user]
  );

  const appendAIMessage = useCallback(
    async (
      conversationId: string,
      msg: {
        role: 'user' | 'assistant';
        text: string;
        actionsSummary?: string[];
        modelProfileId?: string;
        hasImage?: boolean;
        autoTitle?: string;
        nextMessageCount: number;
      }
    ): Promise<string> => {
      if (!user) throw new Error('Usuário não autenticado.');
      const uid = user.uid;
      const msgId = generateSafeId('msg');
      const now = serverTimestamp();
      const safeText = msg.text.trim().slice(0, 12000) || '...';
      const safePreview = safeText.replace(/\s+/g, ' ').slice(0, 210);
      const safeActions = (msg.actionsSummary || [])
        .slice(0, 25)
        .map((item) => item.trim().slice(0, 240))
        .filter(Boolean);
      const safeProfile = (msg.modelProfileId || '').slice(0, 40);

      const batch = writeBatch(db);
      const convRef = doc(db, 'users', uid, 'aiConversations', conversationId);
      const msgRef = doc(db, 'users', uid, 'aiConversations', conversationId, 'messages', msgId);

      batch.set(msgRef, {
        userId: uid,
        conversationId,
        role: msg.role,
        text: safeText,
        actionsSummary: safeActions,
        modelProfileId: safeProfile,
        hasImage: Boolean(msg.hasImage),
        createdAt: now,
      });

      const convUpdate: Record<string, unknown> = {
        preview: safePreview,
        messageCount: Math.max(0, Math.min(10000, Math.round(msg.nextMessageCount))),
        lastMessageAt: now,
        updatedAt: now,
      };
      if (msg.autoTitle && msg.autoTitle.trim()) {
        convUpdate.title = msg.autoTitle.trim().replace(/\s+/g, ' ').slice(0, 120);
      }

      batch.update(convRef, convUpdate);

      try {
        await batch.commit();
        return msgId;
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `users/${uid}/aiConversations/${conversationId}/messages/${msgId}`
        );
      }
    },
    [user]
  );

  const renameAIConversation = useCallback(
    async (conversationId: string, newTitle: string) => {
      if (!user) return;
      const uid = user.uid;
      const safeTitle = newTitle.trim().replace(/\s+/g, ' ').slice(0, 120);
      if (!safeTitle) return;
      try {
        await updateDoc(doc(db, 'users', uid, 'aiConversations', conversationId), {
          title: safeTitle,
          updatedAt: serverTimestamp(),
        });
        pushToast('success', 'Conversa renomeada.');
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${uid}/aiConversations/${conversationId}`
        );
      }
    },
    [user, pushToast]
  );

  const deleteAIConversation = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      const uid = user.uid;
      try {
        const msgsSnap = await getDocs(
          query(
            collection(db, 'users', uid, 'aiConversations', conversationId, 'messages'),
            where('userId', '==', uid)
          )
        );
        const docsToDelete = msgsSnap.docs;
        // Commit in chunks of 400 to stay well below Firestore 500-op batch limit
        for (let i = 0; i < docsToDelete.length; i += 400) {
          const chunk = docsToDelete.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const d of chunk) {
            batch.delete(d.ref);
          }
          if (i + 400 >= docsToDelete.length) {
            batch.delete(doc(db, 'users', uid, 'aiConversations', conversationId));
          }
          await batch.commit();
        }
        if (docsToDelete.length === 0) {
          await deleteDoc(doc(db, 'users', uid, 'aiConversations', conversationId));
        }

        if (activeConversationId === conversationId) {
          setActiveConversationIdState(null);
          setActiveConversationMessages([]);
        }
        pushToast('info', 'Conversa excluída do histórico.');
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `users/${uid}/aiConversations/${conversationId}`
        );
      }
    },
    [user, activeConversationId, pushToast]
  );

  const currency: CurrencyCode = workspace?.currency || 'BRL';

  const value = useMemo<FinanceContextValue>(
    () => ({
      user,
      authLoading,
      needsEmailVerification,
      dataLoading,
      workspace,
      profile,
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      selectedMonth,
      setSelectedMonth,
      theme,
      toggleTheme,
      currency,
      setCurrency,
      toasts,
      pushToast,
      dismissToast,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      resendVerificationEmail,
      checkEmailVerification,
      updateUserProfileInfo,
      changeUserPassword,
      linkPasswordToAccount,
      linkGoogleToAccount,
      logout,
      loadSampleData,
      biometricAvailable,
      biometricProfile,
      biometricLocked,
      enrollBiometric,
      disableBiometric,
      unlockWithBiometric,
      lockWithBiometric,
      isAdmin,
      assistantProfileId,
      updateAssistantProfile,
      createTransaction,
      bulkCreateTransactions,
      updateTransaction,
      bulkUpdateTransactions,
      toggleTransactionStatus,
      deleteTransaction,
      bulkDeleteTransactions,
      createAccount,
      updateAccount,
      deleteAccount,
      createCategory,
      updateCategory,
      deleteCategory,
      upsertBudget,
      bulkUpsertBudgets,
      deleteBudget,
      copyPreviousMonthBudgets,
      createGoal,
      updateGoal,
      contributeToGoal,
      deleteGoal,
      aiConversations,
      activeConversationId,
      setActiveConversationId,
      activeConversationMessages,
      messagesLoading,
      createAIConversation,
      appendAIMessage,
      renameAIConversation,
      deleteAIConversation,
    }),
    [
      user,
      authLoading,
      needsEmailVerification,
      dataLoading,
      workspace,
      profile,
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      selectedMonth,
      theme,
      toggleTheme,
      currency,
      setCurrency,
      toasts,
      pushToast,
      dismissToast,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      resendVerificationEmail,
      checkEmailVerification,
      updateUserProfileInfo,
      changeUserPassword,
      linkPasswordToAccount,
      linkGoogleToAccount,
      logout,
      loadSampleData,
      biometricAvailable,
      biometricProfile,
      biometricLocked,
      enrollBiometric,
      disableBiometric,
      unlockWithBiometric,
      lockWithBiometric,
      isAdmin,
      assistantProfileId,
      updateAssistantProfile,
      createTransaction,
      bulkCreateTransactions,
      updateTransaction,
      bulkUpdateTransactions,
      toggleTransactionStatus,
      deleteTransaction,
      bulkDeleteTransactions,
      createAccount,
      updateAccount,
      deleteAccount,
      createCategory,
      updateCategory,
      deleteCategory,
      upsertBudget,
      bulkUpsertBudgets,
      deleteBudget,
      copyPreviousMonthBudgets,
      createGoal,
      updateGoal,
      contributeToGoal,
      deleteGoal,
      aiConversations,
      activeConversationId,
      setActiveConversationId,
      activeConversationMessages,
      messagesLoading,
      createAIConversation,
      appendAIMessage,
      renameAIConversation,
      deleteAIConversation,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance deve ser usado dentro de FinanceProvider');
  return ctx;
}
