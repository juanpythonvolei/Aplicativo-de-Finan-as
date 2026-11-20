import React, { useEffect, useState } from 'react';
import { CheckCircle2, LogOut, MailCheck, RefreshCw } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { mapFirebaseAuthError } from '../lib/authErrors';

export function EmailVerificationScreen() {
  const {
    user,
    checkEmailVerification,
    resendVerificationEmail,
    logout,
    theme,
    toggleTheme,
  } = useFinance();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleCheck = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const verified = await checkEmailVerification();
      if (!verified) {
        setFeedback({
          type: 'info',
          text: 'Seu e-mail ainda consta como não verificado. Abra a mensagem na sua caixa de entrada (ou spam), clique no link de confirmação e tente novamente.',
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err).message });
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setFeedback(null);
    try {
      await resendVerificationEmail();
      setCooldown(60);
      setFeedback({
        type: 'info',
        text: 'Enviamos um novo e-mail de confirmação. Verifique sua caixa de entrada e a pasta de spam.',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err).message });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800">
        <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
          Vértice Finance
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            {theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-900 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <MailCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Confirme seu endereço de e-mail
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Para proteger seus dados financeiros, exigimos a verificação de e-mail antes de
                liberar o acesso ao painel. Enviamos um link para{' '}
                <strong className="font-semibold text-slate-900 dark:text-white">
                  {user?.email}
                </strong>
                .
              </p>
            </div>
          </div>

          {feedback && (
            <div
              role="alert"
              className={`rounded-lg border px-4 py-3 text-xs leading-relaxed ${
                feedback.type === 'error'
                  ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200'
                  : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{checking ? 'Verificando...' : 'Já confirmei meu e-mail'}</span>
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap tabular-nums"
            >
              <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
              <span>
                {cooldown > 0
                  ? `Reenviar link em ${cooldown}s`
                  : resending
                  ? 'Enviando...'
                  : 'Reenviar e-mail de verificação'}
              </span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Digitou o e-mail errado?</span>
            <button
              type="button"
              onClick={logout}
              className="font-medium text-teal-700 dark:text-teal-400 hover:underline"
            >
              Entrar com outra conta
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
