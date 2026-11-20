import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { auth } from '../firebase';
import { evaluatePasswordStrength, mapFirebaseAuthError } from '../lib/authErrors';
import { CurrencyCode, SettingsSection } from '../types/finance';
import {
  AIProfileId,
  AIUsageSummaryResponse,
  AI_PROFILE_LIST,
} from '../../shared/aiProfiles';
import type { DatabaseStatsResponse } from '../../shared/databaseStats';
import { DepthCard } from './DepthCard';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes.toLocaleString('pt-BR')} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
  const gb = mb / 1024;
  return `${gb.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} GB`;
}

function formatDateTimePt(iso: string | null): string {
  if (!iso) return 'Sem registros';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AccountSecurityModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsSection;
}

export function AccountSecurityModal({
  open,
  onClose,
  initialTab = 'preferences',
}: AccountSecurityModalProps) {
  const {
    user,
    profile,
    isAdmin,
    currency,
    setCurrency,
    theme,
    toggleTheme,
    assistantProfileId,
    updateAssistantProfile,
    updateUserProfileInfo,
    changeUserPassword,
    linkPasswordToAccount,
    linkGoogleToAccount,
    logout,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<SettingsSection>(initialTab);

  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState<AIProfileId>(assistantProfileId);
  const [savingAI, setSavingAI] = useState(false);

  const [dbStats, setDbStats] = useState<DatabaseStatsResponse | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [usageData, setUsageData] = useState<AIUsageSummaryResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageScope, setUsageScope] = useState<'user' | 'global'>('user');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  const loadDatabaseStats = useCallback(async () => {
    if (!isAdmin || !auth.currentUser) return;
    setDbLoading(true);
    setDbError(null);
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const resp = await fetch('/api/admin/database-stats', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'Não foi possível consultar o banco de dados.');
      }
      setDbStats(data as DatabaseStatsResponse);
    } catch (err) {
      setDbError(
        err instanceof Error ? err.message : 'Erro ao carregar diagnóstico do banco de dados.'
      );
    } finally {
      setDbLoading(false);
    }
  }, [isAdmin]);

  const loadApiUsage = useCallback(
    async (scopeOverride?: 'user' | 'global') => {
      if (!auth.currentUser) return;
      const targetScope = scopeOverride ?? usageScope;
      const effectiveScope = isAdmin && targetScope === 'global' ? 'global' : 'user';
      setUsageLoading(true);
      setUsageError(null);
      try {
        const idToken = await auth.currentUser.getIdToken();
        const url =
          effectiveScope === 'global'
            ? '/api/assistant/usage?scope=global'
            : '/api/assistant/usage';
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data?.error || 'Não foi possível consultar o uso de API.');
        }
        setUsageData(data as AIUsageSummaryResponse);
      } catch (err) {
        setUsageError(
          err instanceof Error ? err.message : 'Erro ao carregar o uso de API dos modelos.'
        );
      } finally {
        setUsageLoading(false);
      }
    },
    [isAdmin, usageScope]
  );

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile?.displayName || user?.displayName || '');
    setPhotoURL(profile?.photoURL || user?.photoURL || '');
    setSelectedProfile(assistantProfileId);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setFeedback(null);
    const safeInitial =
      !isAdmin && (initialTab === 'ai' || initialTab === 'database') ? 'preferences' : initialTab;
    setActiveTab(safeInitial);
  }, [open, initialTab, profile, user, assistantProfileId, isAdmin]);

  useEffect(() => {
    if (open && isAdmin && activeTab === 'database' && !dbStats && !dbLoading) {
      loadDatabaseStats();
    }
  }, [open, isAdmin, activeTab, dbStats, dbLoading, loadDatabaseStats]);

  useEffect(() => {
    if (open && activeTab === 'usage') {
      loadApiUsage(usageScope);
    }
  }, [open, activeTab, usageScope, loadApiUsage]);

  if (!user) return null;

  const providerIds = user.providerData.map((p) => p.providerId);
  const hasPasswordProvider = providerIds.includes('password');
  const hasGoogleProvider = providerIds.includes('google.com');
  const strength = evaluatePasswordStrength(newPassword);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!displayName.trim()) {
      setFeedback({ type: 'error', text: 'Informe um nome de exibição válido.' });
      return;
    }
    setSavingProfile(true);
    try {
      await updateUserProfileInfo(displayName, photoURL);
      setFeedback({ type: 'success', text: 'Dados do perfil atualizados.' });
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err).message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword.length < 8) {
      setFeedback({ type: 'error', text: 'A nova senha deve ter pelo menos 8 caracteres.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFeedback({ type: 'error', text: 'A confirmação da senha não confere.' });
      return;
    }

    setSavingSecurity(true);
    try {
      if (hasPasswordProvider) {
        if (!currentPassword) {
          setFeedback({ type: 'error', text: 'Informe sua senha atual para confirmar.' });
          setSavingSecurity(false);
          return;
        }
        await changeUserPassword(currentPassword, newPassword);
      } else {
        await linkPasswordToAccount(newPassword);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setFeedback({
        type: 'success',
        text: hasPasswordProvider
          ? 'Sua senha de acesso foi alterada.'
          : 'Senha cadastrada! Agora você também pode entrar usando e-mail e senha.',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err).message });
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleLinkGoogle = async () => {
    setFeedback(null);
    setLinkingGoogle(true);
    try {
      await linkGoogleToAccount();
      setFeedback({ type: 'success', text: 'Conta Google vinculada com sucesso.' });
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err).message });
    } finally {
      setLinkingGoogle(false);
    }
  };

  const handleSaveAIConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setFeedback(null);
    setSavingAI(true);
    try {
      await updateAssistantProfile(selectedProfile);
      setFeedback({
        type: 'success',
        text: 'Perfil de eficiência da IA salvo e aplicado ao servidor.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao atualizar configuração de IA.',
      });
    } finally {
      setSavingAI(false);
    }
  };

  const isWideTab =
    activeTab === 'usage' || (isAdmin && (activeTab === 'database' || activeTab === 'ai'));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Configurações e Conta"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full ${
              isWideTab ? 'max-w-3xl' : 'max-w-lg'
            } depth-panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[92vh] flex flex-col transition-all`}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Configurações e Conta
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar janela"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('preferences');
                    setFeedback(null);
                  }}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'preferences'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>Preferências</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('profile');
                    setFeedback(null);
                  }}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'profile'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Perfil</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('security');
                    setFeedback(null);
                  }}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'security'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Segurança</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('usage');
                    setFeedback(null);
                  }}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'usage'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span>Uso de API</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ai');
                      setFeedback(null);
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                      activeTab === 'ai'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 shrink-0" />
                    <span>IA (Admin)</span>
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('database');
                      setFeedback(null);
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
                      activeTab === 'database'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5 shrink-0" />
                    <span>Banco (Admin)</span>
                  </button>
                )}
              </div>
            </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {feedback && (
            <div
              role="alert"
              className={`rounded-lg border px-4 py-3 text-xs leading-relaxed ${
                feedback.type === 'error'
                  ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200'
                  : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Moeda Principal
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Define a formatação financeira sincronizada na Web, Linux, Windows e Android.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { code: 'BRL', label: 'Real', symbol: 'R$' },
                      { code: 'USD', label: 'Dólar', symbol: 'US$' },
                      { code: 'EUR', label: 'Euro', symbol: '€' },
                    ] as Array<{ code: CurrencyCode; label: string; symbol: string }>
                  ).map((item) => {
                    const active = currency === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setCurrency(item.code)}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          active
                            ? 'border-teal-700 dark:border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                          {item.code}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.label} ({item.symbol})
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Tema da Interface
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Escolha a aparência visual aplicada automaticamente à sua conta.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'light') toggleTheme();
                    }}
                    className={`p-3.5 rounded-xl border flex items-center gap-3 text-left transition-colors ${
                      theme === 'light'
                        ? 'border-teal-700 dark:border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Claro</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Alto contraste diurno
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'dark') toggleTheme();
                    }}
                    className={`p-3.5 rounded-xl border flex items-center gap-3 text-left transition-colors ${
                      theme === 'dark'
                        ? 'border-teal-700 dark:border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Escuro</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Conforto visual noturno
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  E-mail da conta
                </label>
                <input
                  type="email"
                  disabled
                  value={user.email || ''}
                  className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>E-mail verificado e isolado por usuário</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  URL da foto de perfil (opcional)
                </label>
                <input
                  type="url"
                  maxLength={500}
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Connected Providers Summary */}
              <div className="space-y-2.5 pb-5 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Métodos de login vinculados
                </p>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      E-mail e Senha
                    </span>
                    <span
                      className={
                        hasPasswordProvider
                          ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                          : 'text-slate-400'
                      }
                    >
                      {hasPasswordProvider ? 'Ativo' : 'Não definido'}
                    </span>
                  </div>
                  <div className="px-3.5 py-2.5 flex items-center justify-between text-xs gap-3">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      Conta Google
                    </span>
                    {hasGoogleProvider ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        Conectado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleLinkGoogle}
                        disabled={linkingGoogle}
                        className="inline-flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>{linkingGoogle ? 'Conectando...' : 'Vincular Google'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Password Form */}
              <form onSubmit={handleSavePassword} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    <span>
                      {hasPasswordProvider
                        ? 'Alterar senha de acesso'
                        : 'Definir uma senha para login por e-mail'}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPasswords((v) => !v)}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1"
                  >
                    {showPasswords ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Mostrar</span>
                      </>
                    )}
                  </button>
                </div>

                {hasPasswordProvider && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Senha atual
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Nova senha
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Confirmar nova senha
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                {newPassword && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 rounded-full transition-colors ${
                            strength.score >= level
                              ? strength.score >= 3
                                ? 'bg-emerald-600'
                                : strength.score === 2
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Força da senha: <strong className="font-medium">{strength.label}</strong>
                    </p>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Encerrar sessão</span>
                  </button>
                  <button
                    type="submit"
                    disabled={savingSecurity}
                    className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
                  >
                    {savingSecurity
                      ? 'Atualizando...'
                      : hasPasswordProvider
                      ? 'Alterar Senha'
                      : 'Salvar Senha'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Uso de API por Modelo Acessível
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {usageData
                      ? `Medido em ${formatDateTimePt(usageData.measuredAt)} · Consumo real retornado pela API Gemini`
                      : 'Telemetria real de requisições, tokens e custo estimado de cada modelo'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setUsageScope('user')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          usageScope === 'user'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Meu consumo
                      </button>
                      <button
                        type="button"
                        onClick={() => setUsageScope('global')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          usageScope === 'global'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Global (todos)
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => loadApiUsage(usageScope)}
                    disabled={usageLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${usageLoading ? 'animate-spin' : ''}`} />
                    <span>{usageLoading ? 'Atualizando...' : 'Atualizar'}</span>
                  </button>
                </div>
              </div>

              {usageError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-xs text-red-800 dark:text-red-200 flex items-center justify-between gap-3"
                >
                  <span>{usageError}</span>
                  <button
                    type="button"
                    onClick={() => loadApiUsage(usageScope)}
                    className="font-semibold underline whitespace-nowrap"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {usageLoading && !usageData && (
                <div className="space-y-3" aria-busy="true">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 animate-pulse"
                      />
                    ))}
                  </div>
                  <div className="h-40 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
                </div>
              )}

              {usageData && (
                <>
                  {/* Totals Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <DepthCard
                      delay={0}
                      tiltStrength={2.5}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5"
                    >
                      <p className="text-xs text-slate-500 dark:text-slate-400">Requisições</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                        {usageData.totals.requests.toLocaleString('pt-BR')}
                      </p>
                    </DepthCard>

                    <DepthCard
                      delay={0.04}
                      tiltStrength={2.5}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5"
                    >
                      <p className="text-xs text-slate-500 dark:text-slate-400">Tokens Totais</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                        {usageData.totals.totalTokens.toLocaleString('pt-BR')}
                      </p>
                    </DepthCard>

                    <DepthCard
                      delay={0.08}
                      tiltStrength={2.5}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5"
                    >
                      <p className="text-xs text-slate-500 dark:text-slate-400">Latência Média</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                        {usageData.totals.avgLatencyMs > 0
                          ? `${usageData.totals.avgLatencyMs.toLocaleString('pt-BR')} ms`
                          : '—'}
                      </p>
                    </DepthCard>

                    <DepthCard
                      delay={0.12}
                      tiltStrength={2.5}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5"
                    >
                      <p className="text-xs text-slate-500 dark:text-slate-400">Custo Estimado</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                        US${' '}
                        {usageData.totals.estimatedCostUsd.toLocaleString('pt-BR', {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4,
                        })}
                      </p>
                    </DepthCard>
                  </div>

                  {/* Per-Model Cards */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      Detalhamento por Modelo Acessível ({usageData.models.length})
                    </p>

                    {usageData.models.map((m, idx) => (
                      <DepthCard
                        key={m.modelId}
                        delay={0.05 * idx}
                        tiltStrength={2.5}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-4"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {m.label}
                                </h4>
                                <span className="font-mono text-xs text-teal-700 dark:text-teal-400">
                                  {m.modelId}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                {m.family} · {m.roleSummary}
                              </p>
                            </div>
                            <div className="text-right font-mono tabular-nums shrink-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {m.requests.toLocaleString('pt-BR')} chamadas
                              </p>
                              <p className="text-xs text-teal-700 dark:text-teal-400">
                                {m.sharePercent.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}
                                % do tráfego
                              </p>
                            </div>
                          </div>

                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-600 dark:bg-teal-500 rounded-full transition-all"
                              style={{
                                width: `${
                                  m.requests > 0 ? Math.max(4, Math.min(100, m.sharePercent)) : 0
                                }%`,
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs font-mono tabular-nums">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block font-sans">
                                Entrada
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {m.inputTokens.toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block font-sans">
                                Saída
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {m.outputTokens.toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block font-sans">
                                Raciocínio
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {m.thinkingTokens.toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block font-sans">
                                Latência · Custo
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {m.avgLatencyMs > 0 ? `${m.avgLatencyMs} ms` : '—'} · US${' '}
                                {m.estimatedCostUsd.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono tabular-nums">
                              Complexidade: Simples {m.complexityBreakdown.simple} · Moderada{' '}
                              {m.complexityBreakdown.moderate} · Complexa{' '}
                              {m.complexityBreakdown.complex} · Crítica{' '}
                              {m.complexityBreakdown.critical}
                            </span>
                            <span>Último uso: {formatDateTimePt(m.lastUsedAt)}</span>
                          </div>
                        </div>
                      </DepthCard>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3 flex-wrap border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cada chamada ao Assistente IA (Web, Linux, Windows ou Android) registra tokens
                      reais e complexidade automaticamente.
                    </p>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {isAdmin && activeTab === 'ai' && (
            <form onSubmit={handleSaveAIConfig} className="space-y-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Motor, Complexidade Dinâmica e Seleção de Modelos IA
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Controle exclusivo do administrador. Escolha o Roteamento Inteligente Dinâmico
                  para que o servidor classifique a complexidade de cada ação automaticamente ou
                  fixe manualmente um dos perfis abaixo.
                </p>
              </div>

              <div className="space-y-2.5">
                {AI_PROFILE_LIST.map((item) => {
                  const isSelected = selectedProfile === item.id;
                  return (
                    <label
                      key={item.id}
                      className={`block rounded-xl border p-3.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-teal-700 dark:border-teal-500 bg-teal-50/40 dark:bg-teal-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="aiProfile"
                          value={item.id}
                          checked={isSelected}
                          onChange={() => setSelectedProfile(item.id)}
                          className="mt-1 accent-teal-700"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.label}
                            </span>
                            <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                              {item.tag}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {item.modelId} · Thinking {item.thinkingLevel} · {item.costSummary}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {selectedProfile === 'auto_dynamic' && (
                <div className="rounded-xl border border-teal-700/25 dark:border-teal-500/30 bg-teal-50/40 dark:bg-teal-950/20 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 dark:text-teal-300">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Matriz Autônoma de Complexidade de Ação (Ativa)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-2.5">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Simples (0–24 pts)
                      </p>
                      <p className="font-mono text-teal-700 dark:text-teal-400">
                        gemini-3.1-flash-lite · MINIMAL
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Perguntas diretas, saldo rápido, troca de tema, moeda ou navegação.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-2.5">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Moderada (25–54 pts)
                      </p>
                      <p className="font-mono text-teal-700 dark:text-teal-400">
                        gemini-4-hydrogen · LOW
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Registro de despesas/receitas, criação de metas, orçamentos e edição de contas.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-2.5">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Complexa (55–79 pts)
                      </p>
                      <p className="font-mono text-teal-700 dark:text-teal-400">
                        gemini-4-hydrogen · MEDIUM
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Leitura OCR de comprovantes/fotos, parcelamentos e análises comparativas.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-2.5">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Crítica (80–100 pts)
                      </p>
                      <p className="font-mono text-teal-700 dark:text-teal-400">
                        gemini-4-hydrogen · HIGH
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Auditorias patrimoniais profundas, múltiplos anexos e ações em lote.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={savingAI}
                  className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  {savingAI ? 'Aplicando...' : 'Aplicar Modelo IA'}
                </button>
              </div>
            </form>
          )}

          {isAdmin && activeTab === 'database' && (
            <div className="space-y-5">
              {/* Header Bar + Refresh */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Diagnóstico do Banco de Dados (Firestore)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {dbStats
                      ? `Medido em ${formatDateTimePt(dbStats.measuredAt)} · Latência ${dbStats.latencyMs} ms`
                      : 'Leitura direta do armazenamento, coleções e cota disponível'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadDatabaseStats}
                  disabled={dbLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`} />
                  <span>{dbLoading ? 'Consultando...' : 'Atualizar diagnóstico'}</span>
                </button>
              </div>

              {dbError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-xs text-red-800 dark:text-red-200 flex items-center justify-between gap-3"
                >
                  <span>{dbError}</span>
                  <button
                    type="button"
                    onClick={loadDatabaseStats}
                    className="font-semibold underline whitespace-nowrap"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {dbLoading && !dbStats && (
                <div className="space-y-3" aria-busy="true">
                  <div className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-16 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              )}

              {dbStats && (
                <>
                  {/* Storage Capacity & Remaining Space */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Espaço livre restante (Cota Gratuita Spark · 1 GiB)
                        </p>
                        <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums mt-0.5">
                          {formatBytes(dbStats.storage.remainingBytes)}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                          {dbStats.storage.freePercent.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                          % disponível
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Uso est. c/ índices: {formatBytes(dbStats.storage.estimatedWithIndexesBytes)} / 1,000 GB
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-teal-700 dark:bg-teal-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0.4, dbStats.storage.usagePercent))}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-slate-600 dark:text-slate-400 tabular-nums pt-0.5">
                      <span>
                        Documentos puros:{' '}
                        <strong className="font-mono text-slate-900 dark:text-white">
                          {formatBytes(dbStats.storage.usedDocumentBytes)}
                        </strong>
                      </span>
                      <span>
                        Maior doc:{' '}
                        <strong className="font-mono text-slate-900 dark:text-white">
                          {formatBytes(dbStats.storage.largestDocBytes)}
                        </strong>{' '}
                        / 1,00 MB máx.
                      </span>
                      <span>
                        Média:{' '}
                        <strong className="font-mono text-slate-900 dark:text-white">
                          {formatBytes(dbStats.storage.averageDocBytes)}
                        </strong>
                        /doc
                      </span>
                    </div>
                  </div>

                  {/* Key Totals Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total de Documentos
                      </p>
                      <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white tabular-nums mt-0.5">
                        {dbStats.totals.totalDocuments.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Usuários / Contas
                      </p>
                      <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white tabular-nums mt-0.5">
                        {dbStats.totals.usersCount.toLocaleString('pt-BR')} ·{' '}
                        {dbStats.totals.accountsCount.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Lançamentos
                      </p>
                      <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white tabular-nums mt-0.5">
                        {dbStats.totals.transactionsCount.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Última Gravação
                      </p>
                      <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums mt-1.5 truncate">
                        {formatDateTimePt(dbStats.totals.lastWriteAt)}
                      </p>
                    </div>
                  </div>

                  {/* Collection Breakdown Table */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      Ocupação por Coleção
                    </p>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="text-left font-medium px-3.5 py-2">Coleção</th>
                            <th className="text-right font-medium px-3.5 py-2">Docs</th>
                            <th className="text-right font-medium px-3.5 py-2">Maior Doc</th>
                            <th className="text-right font-medium px-3.5 py-2">Tamanho</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {dbStats.collections.map((col) => (
                            <tr
                              key={col.collection}
                              className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                            >
                              <td className="px-3.5 py-2 text-slate-800 dark:text-slate-200">
                                <span className="font-medium">{col.label}</span>
                                <span className="text-slate-400 dark:text-slate-500 font-mono ml-1.5">
                                  /{col.collection}
                                </span>
                              </td>
                              <td className="px-3.5 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                {col.docCount.toLocaleString('pt-BR')}
                              </td>
                              <td className="px-3.5 py-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                {formatBytes(col.largestDocBytes)}
                              </td>
                              <td className="px-3.5 py-2 text-right font-mono font-medium tabular-nums text-slate-900 dark:text-white">
                                {formatBytes(col.payloadBytes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Workspaces Table */}
                  {dbStats.users.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        Workspaces Registrados ({dbStats.users.length})
                      </p>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="text-left font-medium px-3.5 py-2">Usuário</th>
                              <th className="text-right font-medium px-3.5 py-2">Moeda</th>
                              <th className="text-right font-medium px-3.5 py-2">Lanç.</th>
                              <th className="text-right font-medium px-3.5 py-2">Docs</th>
                              <th className="text-right font-medium px-3.5 py-2">Uso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {dbStats.users.map((u) => (
                              <tr
                                key={u.userId}
                                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                              >
                                <td className="px-3.5 py-2 max-w-[220px]">
                                  <p className="font-medium text-slate-900 dark:text-white truncate">
                                    {u.displayName}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {u.email || u.userId}
                                  </p>
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                  {u.currency}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                  {u.transactionsCount.toLocaleString('pt-BR')}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                  {u.docCount.toLocaleString('pt-BR')}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono font-medium tabular-nums text-slate-900 dark:text-white">
                                  {formatBytes(u.payloadBytes)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Infrastructure & Quota Reference Metadata */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>
                        Projeto:{' '}
                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                          {dbStats.projectId}
                        </strong>{' '}
                        · Banco:{' '}
                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                          {dbStats.databaseId}
                        </strong>
                      </span>
                    </div>
                    <p>
                      Edição: <strong className="text-slate-800 dark:text-slate-200">{dbStats.edition}</strong>{' '}
                      · Limites diários Spark:{' '}
                      <span className="font-mono tabular-nums">
                        {dbStats.quotas.dailyReadsLimit.toLocaleString('pt-BR')} leituras
                      </span>{' '}
                      /{' '}
                      <span className="font-mono tabular-nums">
                        {dbStats.quotas.dailyWritesLimit.toLocaleString('pt-BR')} gravações
                      </span>{' '}
                      /{' '}
                      <span className="font-mono tabular-nums">
                        {dbStats.quotas.dailyDeletesLimit.toLocaleString('pt-BR')} exclusões
                      </span>{' '}
                      · Esta varredura executou{' '}
                      <span className="font-mono tabular-nums">{dbStats.diagnosticReadCalls}</span>{' '}
                      chamadas de listagem.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      O tamanho de documentos reflete a fórmula oficial do Firestore (caminho + campos +
                      32 bytes/doc), somado a uma estimativa conservadora de índices (+45%). Para
                      acompanhar faturamento e métricas exatas do console Google Cloud, acesse o
                      painel oficial.
                    </p>
                    <div className="pt-1 flex items-center justify-between gap-3 flex-wrap">
                      <a
                        href={dbStats.consoleUsageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                      >
                        <span>Abrir métricas de uso no Firebase Console</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
