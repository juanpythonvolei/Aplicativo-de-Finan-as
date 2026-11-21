import React, { useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { AlertCircle, ArrowUpRight, CheckCircle2, Cloud, Loader2, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

function GoogleBadgeIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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

const STATE_STORAGE_KEY = 'vertice_android_auth_state';

function buildDeepLink(idToken: string, accessToken: string, state: string): string {
  const params = new URLSearchParams();
  if (idToken) params.set('idToken', idToken);
  if (accessToken) params.set('accessToken', accessToken);
  if (state) params.set('state', state);
  return `verticefinance://auth-callback#${params.toString()}`;
}

export function AndroidAuthBridge() {
  const stateParam = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('state') || '';
    if (fromUrl) {
      try {
        sessionStorage.setItem(STATE_STORAGE_KEY, fromUrl);
      } catch {
        // ignore storage errors
      }
      return fromUrl;
    }
    try {
      return sessionStorage.getItem(STATE_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [signedEmail, setSignedEmail] = useState<string>('');

  const completeAndRedirect = (
    idToken: string,
    accessToken: string,
    email: string
  ) => {
    if (!idToken && !accessToken) {
      setErrorMsg('O Google não retornou token de autenticação. Tente novamente.');
      return;
    }
    const url = buildDeepLink(idToken, accessToken, stateParam);
    setSignedEmail(email);
    setDeepLink(url);
    // Attempt automatic deep link handoff back into the Android APK
    window.location.href = url;
  };

  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then((result) => {
        if (!active || !result) return;
        const cred = GoogleAuthProvider.credentialFromResult(result);
        if (cred && (cred.idToken || cred.accessToken)) {
          completeAndRedirect(
            cred.idToken || '',
            cred.accessToken || '',
            result.user?.email || ''
          );
        }
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Falha ao finalizar login com Google.';
        setErrorMsg(msg);
      })
      .finally(() => {
        if (active) setCheckingRedirect(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      completeAndRedirect(
        cred?.idToken || '',
        cred?.accessToken || '',
        result.user?.email || ''
      );
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setErrorMsg(
            redirectErr instanceof Error
              ? redirectErr.message
              : 'Não foi possível redirecionar para o login Google.'
          );
        }
      } else if (code !== 'auth/popup-closed-by-user') {
        setErrorMsg(
          err instanceof Error ? err.message : 'Erro ao conectar com sua conta Google.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
            <Cloud className="w-4 h-4" />
            <span>Conexão Segura · App Android</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Vértice Finance
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Autentique com sua conta Google para sincronizar seus dados locais com a nuvem e
            acessar seu histórico financeiro no aplicativo Android.
          </p>
        </div>

        {checkingRedirect ? (
          <div className="flex items-center justify-center gap-3 py-8 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <span>Verificando sessão Google...</span>
          </div>
        ) : deepLink ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                  Conta Google autorizada!
                </p>
                {signedEmail && (
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 break-all">
                    {signedEmail}
                  </p>
                )}
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Se o aplicativo não abrir automaticamente, toque no botão abaixo para retornar ao
                  Vértice Finance.
                </p>
              </div>
            </div>

            <a
              href={deepLink}
              className="w-full h-12 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span>Voltar para o aplicativo Vértice Finance</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full py-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Trocar de conta Google
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-60 font-semibold text-sm flex items-center justify-center gap-3 shadow-sm transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GoogleBadgeIcon />
              )}
              <span>{loading ? 'Conectando com Google...' : 'Continuar com Google'}</span>
            </button>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-3.5 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <span>
                Após confirmar sua conta Google, você voltará automaticamente para o app Android com
                sincronização local e em nuvem ativada.
              </span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 p-3.5 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
