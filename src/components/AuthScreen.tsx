import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Target,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { firebaseConfig } from '../firebase';
import { evaluatePasswordStrength, mapFirebaseAuthError } from '../lib/authErrors';
import { PWAInstallButton } from './PWAInstallButton';

type AuthMode = 'login' | 'signup' | 'reset';

function GoogleLogo() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function AuthScreen() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    theme,
    toggleTheme,
  } = useFinance();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerHelp, setProviderHelp] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const strength = evaluatePasswordStrength(password);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setProviderHelp(false);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setProviderHelp(false);
    setSuccessMsg(null);

    if (mode === 'reset') {
      if (!email.trim()) {
        setErrorMsg('Informe o e-mail cadastrado para receber o link de redefinição.');
        return;
      }
      setSubmitting(true);
      try {
        await sendPasswordReset(email);
        setSuccessMsg(
          `Enviamos um link de redefinição de senha para ${email.trim()}. Verifique sua caixa de entrada e spam.`
        );
      } catch (err) {
        const mapped = mapFirebaseAuthError(err);
        setErrorMsg(mapped.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'signup') {
      if (name.trim().length < 2) {
        setErrorMsg('Informe seu nome completo (mínimo de 2 caracteres).');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('A senha deve possuir no mínimo 8 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }
      setSubmitting(true);
      try {
        await signUpWithEmail(name, email, password);
      } catch (err) {
        const mapped = mapFirebaseAuthError(err);
        setErrorMsg(mapped.message);
        setProviderHelp(Boolean(mapped.isProviderDisabled));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Login mode
    if (!email.trim() || !password) {
      setErrorMsg('Preencha seu e-mail e senha para entrar.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email, password, rememberMe);
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      setErrorMsg(mapped.message);
      setProviderHelp(Boolean(mapped.isProviderDisabled));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setProviderHelp(false);
    setSuccessMsg(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle(rememberMe);
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      if (
        mapped.code !== 'auth/popup-closed-by-user' &&
        mapped.code !== 'auth/cancelled-popup-request'
      ) {
        setErrorMsg(mapped.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const capabilities = [
    {
      icon: BarChart3,
      title: 'Fluxo de caixa e DRE pessoal',
      desc: 'Acompanhe entradas, saídas e taxa de poupança mês a mês com precisão contábil.',
    },
    {
      icon: CreditCard,
      title: 'Contas bancárias e cartões',
      desc: 'Controle saldos consolidados, faturas abertas, limite disponível e transferências.',
    },
    {
      icon: Target,
      title: 'Orçamentos, metas e Assistente IA',
      desc: 'Planeje tetos por categoria e conte com IA autônoma para lançar, conciliar e analisar.',
    },
    {
      icon: ShieldCheck,
      title: 'Acesso verificado e dados isolados',
      desc: 'Autenticação segura com criptografia e isolamento estrito no Firestore por usuário.',
    },
  ];

  const consoleAuthUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800">
        <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
          Vértice Finance
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            {theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left Column: Value Proposition & Capabilities */}
        <div className="lg:col-span-6 space-y-6 order-2 lg:order-1">
          <div className="space-y-4">
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400 tracking-wide">
              Controle Financeiro Pessoal
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.12] text-slate-900 dark:text-white [text-wrap:balance]">
              Clareza patrimonial para cada decisão do seu mês.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              Centralize receitas, despesas, parcelamentos no cartão, orçamentos por categoria e
              metas de reserva em um livro-razão pessoal sincronizado entre Web e Android.
            </p>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="py-4 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h2>
                    <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Suporte a BRL (R$), USD ($) e EUR (€)
            </span>
            <span aria-hidden="true">·</span>
            <span>Exportação CSV completa</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Sincronização em tempo real</span>
          </div>
        </div>

        {/* Right Column: Complete Login / Signup / Reset Card */}
        <div className="lg:col-span-6 order-1 lg:order-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6 max-w-md mx-auto lg:ml-auto lg:mr-0 w-full">
            {mode !== 'reset' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      mode === 'login'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      mode === 'signup'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Criar conta
                  </button>
                </div>

                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta gratuita'}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {mode === 'login'
                      ? 'Entre com seu e-mail e senha ou continue com o Google.'
                      : 'Cadastre-se com seu e-mail (com verificação) ou conta Google.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para o login</span>
                </button>
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Recuperar senha
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Informe seu e-mail cadastrado e enviaremos um link seguro para redefinir sua
                    senha.
                  </p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-3.5 py-3 text-xs text-red-800 dark:text-red-200 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
                {providerHelp && (
                  <a
                    href={consoleAuthUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block font-semibold underline hover:text-red-950 dark:hover:text-white pl-6"
                  >
                    Abrir Console do Firebase (Sign-in method)
                  </a>
                )}
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Nome completo
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-name"
                      type="text"
                      required
                      maxLength={120}
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Senha
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={mode === 'signup' ? 8 : 6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : 'Sua senha'}
                      className="w-full pl-9 pr-10 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {mode === 'signup' && password.length > 0 && (
                    <div className="mt-2.5 space-y-2">
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
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Força: <strong className="font-medium">{strength.label}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {strength.checks.minLength && (
                            <Check className="w-3 h-3 text-emerald-600" />
                          )}
                          8+ caracteres
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita sua senha"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>Manter conectado neste dispositivo</span>
                </label>
              )}

              <button
                type="submit"
                disabled={submitting || googleLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                <span>
                  {submitting
                    ? 'Processando...'
                    : mode === 'login'
                    ? 'Entrar na conta'
                    : mode === 'signup'
                    ? 'Criar conta'
                    : 'Enviar link de recuperação'}
                </span>
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {mode !== 'reset' && (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                  <span className="px-3 text-xs text-slate-400 bg-white dark:bg-slate-900 shrink-0">
                    ou
                  </span>
                  <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={submitting || googleLoading}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-800 dark:text-slate-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  <GoogleLogo />
                  <span>
                    {googleLoading ? 'Conectando ao Google...' : 'Continuar com Google'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
