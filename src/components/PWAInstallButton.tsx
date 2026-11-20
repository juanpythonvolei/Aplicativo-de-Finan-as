import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) setGuideOpen(true);
    } else {
      setGuideOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleAction}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-teal-700/30 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded-lg transition-colors whitespace-nowrap shrink-0'
            : 'w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-teal-700/30 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded-lg transition-colors whitespace-nowrap'
        }
      >
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{isInstallable ? 'Instalar no Android' : 'App Android'}</span>
      </button>

      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Usar no Android com os Mesmos Dados
              </h3>
              <button
                onClick={() => setGuideOpen(false)}
                aria-label="Fechar"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white">
                  1. Instalação Direta no Celular (Android Chrome)
                </p>
                <p>
                  {isIOS
                    ? 'No Safari, toque no botão Compartilhar e escolha "Adicionar à Tela de Início".'
                    : 'Abra este link no Chrome do seu Android, toque no menu (⋮) no canto superior direito e escolha "Instalar aplicativo" ou "Adicionar à tela inicial". Ele funciona em tela cheia conectado exatamente à mesma conta Google e banco Firestore.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white">
                  2. Projeto Nativo Android Studio (Kotlin + Compose)
                </p>
                <p>
                  O código-fonte nativo completo em Kotlin e Jetpack Compose está disponível na
                  pasta <code className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">/android</code> do projeto, pré-configurado com o banco Firestore{' '}
                  <code className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                    ai-studio-05d8f155-f145-495f-b648-b83217284450
                  </code>
                  .
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              {isInstallable && (
                <button
                  onClick={install}
                  className="px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
                >
                  Instalar Agora
                </button>
              )}
              <button
                onClick={() => setGuideOpen(false)}
                className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
