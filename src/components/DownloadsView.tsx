import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Loader2,
  Monitor,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { DepthCard } from './DepthCard';

type PlatformId = 'linux' | 'windows' | 'android';

function detectUserPlatform(): PlatformId | null {
  if (typeof navigator === 'undefined') return null;
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('windows') || ua.includes('win32') || ua.includes('win64')) return 'windows';
  if (ua.includes('linux') && !ua.includes('android')) return 'linux';
  return null;
}

const DEFAULT_GITHUB_REPO = 'juanpythonvolei/Aplicativo-de-Finan-as';

const CONFIGURED_GITHUB_REPO = (import.meta.env.VITE_GITHUB_REPO || DEFAULT_GITHUB_REPO)
  .trim()
  .replace(/^https?:\/\/github\.com\//i, '')
  .replace(/^\/+|\/+$/g, '')
  .replace(/\.git$/i, '');

const ANDROID_APK_RELEASE_URL =
  (import.meta.env.VITE_ANDROID_APK_URL || '').trim() ||
  `https://github.com/${CONFIGURED_GITHUB_REPO}/releases/download/latest/aplicativo.apk`;

interface PlatformCardConfig {
  id: PlatformId;
  name: string;
  subtitle: string;
  endpoint?: string;
  directDownloadUrl?: string;
  defaultFilename: string;
  formatLabel: string;
  buttonLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  includes: string[];
  steps: string[];
}

const PLATFORMS: PlatformCardConfig[] = [
  {
    id: 'linux',
    name: 'Linux Desktop',
    subtitle: 'Ubuntu, Debian, Fedora, Arch, Mint e derivados',
    endpoint: '/api/downloads/linux',
    defaultFilename: 'vertice-finance-linux-2.1.0.tar.gz',
    formatLabel: 'Arquivo .tar.gz · Instalador Desktop v2.1.0',
    buttonLabel: 'Baixar para Linux',
    icon: Terminal,
    includes: [
      'Script install.sh em 1 comando + desinstalador uninstall.sh com atalho (.desktop)',
      'Interface 3D com animações fluidas e roteamento dinâmico de modelos de IA',
      'Painel de Uso de API por modelo acessível sincronizado em tempo real',
    ],
    steps: [
      'Extraia o pacote .tar.gz baixado',
      'Execute ./install.sh dentro da pasta extraída',
    ],
  },
  {
    id: 'windows',
    name: 'Windows 10 / 11',
    subtitle: 'Instalador direto em janela dedicada de aplicativo',
    endpoint: '/api/downloads/windows',
    defaultFilename: 'vertice-finance-windows-2.1.0.zip',
    formatLabel: 'Arquivo .zip · Instalador 1-Clique (.bat) v2.1.0',
    buttonLabel: 'Baixar para Windows',
    icon: Monitor,
    includes: [
      'Instalador Instalar-Vertice-Finance.bat + desinstalador com ícones no Menu Iniciar',
      'Interface 3D revisada com animações suaves e roteamento dinâmico de complexidade IA',
      'Acompanhamento de Uso de API por modelo e histórico de conversas em tempo real',
    ],
    steps: [
      'Extraia o arquivo .zip baixado',
      'Dê duplo clique em Instalar-Vertice-Finance.bat',
    ],
  },
  {
    id: 'android',
    name: 'Android (.apk)',
    subtitle: 'Instalador nativo Kotlin + Jetpack Compose compilado via GitHub Releases',
    directDownloadUrl: ANDROID_APK_RELEASE_URL,
    defaultFilename: 'aplicativo.apk',
    formatLabel: 'Arquivo .apk · Instalador Direto Android v2.1.0',
    buttonLabel: 'Baixar instalador Android (.apk)',
    icon: Smartphone,
    includes: [
      'Download direto do aplicativo.apk nativo pronto para instalar no celular',
      'Roteamento dinâmico de complexidade IA, animações fluidas e painel de Uso de API',
      'Atualizado automaticamente a cada nova versão publicada na branch main',
    ],
    steps: [
      'Toque em "Baixar instalador Android (.apk)" para salvar o aplicativo.apk',
      'Abra o arquivo baixado no Android e confirme a instalação (autorize fontes desconhecidas se solicitado)',
    ],
  },
];

export function DownloadsView() {
  const { pushToast } = useFinance();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [downloadingId, setDownloadingId] = useState<PlatformId | null>(null);
  const [installingPwa, setInstallingPwa] = useState(false);

  const detectedPlatform = useMemo(() => detectUserPlatform(), []);

  const handleDownload = async (platform: PlatformCardConfig) => {
    if (downloadingId || !platform.endpoint) return;
    setDownloadingId(platform.id);
    try {
      const response = await fetch(platform.endpoint);
      if (!response.ok) {
        throw new Error(`Falha ao baixar o pacote (${response.status}).`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const nameMatch = disposition.match(/filename="([^"]+)"/i);
      const filename = nameMatch?.[1] || platform.defaultFilename;

      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);

      pushToast('success', `Download iniciado: ${filename}`);
    } catch (err) {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Não foi possível concluir o download.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDirectPwaInstall = async () => {
    setInstallingPwa(true);
    try {
      if (isInstallable) {
        const accepted = await install();
        if (accepted) {
          pushToast('success', 'Vértice Finance instalado neste dispositivo!');
        }
      } else {
        pushToast(
          'info',
          isIOS
            ? 'No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".'
            : 'No Chrome do Android, toque no menu (⋮) e escolha "Instalar aplicativo".'
        );
      }
    } finally {
      setInstallingPwa(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
        <p className="text-xs font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">
          Distribuições Multiplataforma · v2.1.0
        </p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Baixar Vértice Finance para Linux, Windows e Android
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Clique no botão correspondente ao seu sistema para baixar o instalador pronto. Todas as
          distribuições abrem com o Assistente IA como painel principal, roteamento dinâmico de
          modelos e acompanhamento do uso de API sincronizado em tempo real.
        </p>
      </div>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {PLATFORMS.map((platform, idx) => {
          const Icon = platform.icon;
          const isDetected = detectedPlatform === platform.id;
          const isBusy = downloadingId === platform.id;

          return (
            <DepthCard
              key={platform.id}
              as="article"
              delay={idx * 0.06}
              tiltStrength={3.5}
              className={`h-full rounded-xl border bg-white dark:bg-slate-900 p-6 transition-colors ${
                isDetected
                  ? 'border-teal-700 dark:border-teal-500'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex flex-col justify-between gap-6 h-full">
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-700/20 dark:border-teal-500/30 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    {isDetected && (
                      <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                        Detectado neste dispositivo
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                      {platform.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {platform.subtitle}
                    </p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                      {platform.formatLabel}
                    </p>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {platform.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Instalação rápida
                    </p>
                    <ol className="space-y-1 text-xs text-slate-600 dark:text-slate-400 list-decimal pl-4">
                      {platform.steps.map((step) => (
                        <li key={step} className="leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

              <div className="space-y-2.5 pt-2">
                {platform.directDownloadUrl ? (
                  <a
                    href={platform.directDownloadUrl}
                    download={platform.defaultFilename}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      pushToast('success', `Download iniciado: ${platform.defaultFilename}`)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{platform.buttonLabel}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDownload(platform)}
                    disabled={downloadingId !== null}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Preparando arquivo...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>{platform.buttonLabel}</span>
                      </>
                    )}
                  </button>
                )}

                {platform.id === 'android' && !isInstalled && (
                  <button
                    type="button"
                    onClick={handleDirectPwaInstall}
                    disabled={installingPwa}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                  >
                    <Smartphone className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    <span>
                      {isInstallable
                        ? 'Instalar direto no celular agora'
                        : 'Como instalar direto no celular (PWA)'}
                    </span>
                  </button>
                )}

                {platform.id === 'android' && isInstalled && (
                  <p className="text-center text-xs text-emerald-700 dark:text-emerald-400 font-medium pt-1">
                    Aplicativo já instalado neste dispositivo
                  </p>
                )}
              </div>
              </div>
            </DepthCard>
          );
        })}
      </div>

      {/* Unified Cloud Sync Info */}
      <div className="depth-panel rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Sincronização Unificada e Controle Total por IA
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Use sua mesma conta no Linux, Windows, Android e navegador Web. Lançamentos, saldos,
            preferências de moeda/tema e todas as conversas registradas com a IA ficam disponíveis
            em tempo real em qualquer distribuição.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
          Web · Linux · Windows · Android
        </div>
      </div>
    </div>
  );
}
