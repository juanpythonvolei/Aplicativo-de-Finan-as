import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import { ArchiveEntry, buildTarGzBuffer, buildZipBuffer } from './archiveBuilder.ts';

export const APP_VERSION = '2.1.0';
const DEFAULT_PUBLIC_URL =
  'https://ais-pre-26edpev5xww65gkmoof2ex-702819737353.us-east1.run.app';

export function resolvePublicAppUrl(req?: Request): string {
  if (req) {
    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost || req.headers.host;
    if (hostHeader && !hostHeader.startsWith('localhost') && !hostHeader.startsWith('127.0.0.1')) {
      const forwardedProto = req.headers['x-forwarded-proto'];
      const proto = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto || 'https';
      return `${proto}://${hostHeader}`.replace(/\/+$/, '');
    }
  }
  const sharedUrl = process.env.SHARED_APP_URL?.trim();
  if (sharedUrl && /^https?:\/\//i.test(sharedUrl)) {
    return sharedUrl.replace(/\/+$/, '');
  }
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  return DEFAULT_PUBLIC_URL;
}

export function getDownloadsManifest(appUrl: string) {
  return {
    version: APP_VERSION,
    appUrl,
    platforms: {
      linux: {
        id: 'linux',
        name: 'Linux',
        filename: `vertice-finance-linux-${APP_VERSION}.tar.gz`,
        endpoint: '/api/downloads/linux',
        format: '.tar.gz (Instalador Desktop)',
        summary:
          'Instala aplicativo desktop em janela dedicada, ícone vetorial e atalho no menu de aplicativos (Ubuntu, Fedora, Arch, Mint e derivados).',
      },
      windows: {
        id: 'windows',
        name: 'Windows',
        filename: `vertice-finance-windows-${APP_VERSION}.zip`,
        endpoint: '/api/downloads/windows',
        format: '.zip (Instalador 1-Clique .bat)',
        summary:
          'Cria atalho nativo na Área de Trabalho e Menu Iniciar abrindo o Vértice Finance em janela própria de aplicativo (Windows 10/11).',
      },
      android: {
        id: 'android',
        name: 'Android',
        filename: 'aplicativo.apk',
        endpoint: resolveAndroidApkUrl(),
        format: '.apk (Instalador Direto Android)',
        summary:
          'Aplicativo nativo Android (.apk) compilado automaticamente via GitHub Actions com Assistente IA principal e sincronização Firestore.',
      },
    },
  };
}

export function resolveAndroidApkUrl(): string {
  const directUrl = (process.env.VITE_ANDROID_APK_URL || process.env.ANDROID_APK_URL || '').trim();
  if (directUrl && /^https?:\/\//i.test(directUrl)) {
    return directUrl;
  }
  const repoSlug = (process.env.VITE_GITHUB_REPO || process.env.GITHUB_REPO || '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git$/i, '');
  if (repoSlug && !repoSlug.includes('[')) {
    return `https://github.com/${repoSlug}/releases/download/latest/aplicativo.apk`;
  }
  return 'https://github.com/juanpythonvolei/Aplicativo-de-Finan-as/releases/download/latest/aplicativo.apk';
}

export function buildLinuxPackage(rootDir: string, appUrl: string): {
  filename: string;
  buffer: Buffer;
  contentType: string;
} {
  const svgPath = path.join(rootDir, 'public', 'icon.svg');
  const iconSvg = fs.existsSync(svgPath)
    ? fs.readFileSync(svgPath)
    : Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0F766E"/><path d="M18 20l14 26 14-26h-7l-7 13-7-13z" fill="#fff"/></svg>'
      );

  const installSh = `#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Vértice Finance"
APP_SLUG="vertice-finance"
APP_URL="${appUrl}"
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
APP_DIR="$HOME/.local/share/applications"
BIN_DIR="$HOME/.local/bin"

mkdir -p "$ICON_DIR" "$APP_DIR" "$BIN_DIR"
cp "$SCRIPT_DIR/vertice-finance.svg" "$ICON_DIR/$APP_SLUG.svg"

BROWSER=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge microsoft-edge-stable vivaldi-stable; do
  if command -v "$candidate" >/dev/null 2>&1; then
    BROWSER="$(command -v "$candidate")"
    break
  fi
done

LAUNCHER="$BIN_DIR/$APP_SLUG"
if [ -n "$BROWSER" ]; then
  cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
exec "$BROWSER" --app="$APP_URL" --class="$APP_SLUG" --user-data-dir="$HOME/.config/$APP_SLUG-profile" "\$@"
EOF
else
  cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
exec xdg-open "$APP_URL"
EOF
fi
chmod +x "$LAUNCHER"

DESKTOP_FILE="$APP_DIR/$APP_SLUG.desktop"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$APP_NAME
Comment=Gestão financeira pessoal com Assistente IA autônomo
Exec=$LAUNCHER
Icon=$ICON_DIR/$APP_SLUG.svg
Terminal=false
Categories=Office;Finance;
StartupWMClass=$APP_SLUG
StartupNotify=true
EOF
chmod +x "$DESKTOP_FILE"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
fi

for desk in "$HOME/Desktop" "$HOME/Área de Trabalho"; do
  if [ -d "$desk" ]; then
    cp "$DESKTOP_FILE" "$desk/$APP_SLUG.desktop"
    chmod +x "$desk/$APP_SLUG.desktop"
    break
  fi
done

echo ""
echo "✅ $APP_NAME instalado com sucesso!"
echo "   Atalho criado no menu de aplicativos (e na Área de Trabalho, se disponível)."
echo "   Para desinstalar futuramente, execute: ./uninstall.sh"
echo ""
echo "Abrindo $APP_NAME..."
nohup "$LAUNCHER" >/dev/null 2>&1 &
`;

  const uninstallSh = `#!/usr/bin/env bash
set -euo pipefail

APP_SLUG="vertice-finance"
rm -f "$HOME/.local/bin/$APP_SLUG"
rm -f "$HOME/.local/share/applications/$APP_SLUG.desktop"
rm -f "$HOME/.local/share/icons/hicolor/scalable/apps/$APP_SLUG.svg"
rm -f "$HOME/Desktop/$APP_SLUG.desktop" "$HOME/Área de Trabalho/$APP_SLUG.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
fi

echo "✅ Vértice Finance removido deste computador. Seus dados continuam seguros na nuvem."
`;

  const readmeTxt = `VÉRTICE FINANCE — INSTALADOR DESKTOP LINUX (v${APP_VERSION})
==============================================================

Como instalar (2 passos):
1. Extraia este arquivo .tar.gz e abra a pasta "vertice-finance-linux".
2. Execute no terminal:
   ./install.sh

O que o instalador faz:
- Cria o aplicativo "Vértice Finance" no menu do sistema em janela dedicada (sem barra de abas).
- Instala o ícone oficial em ~/.local/share/icons/.
- Cria atalho na Área de Trabalho (quando disponível) e abre o app automaticamente.
- Inclui a v2.1.0 completa: interface refinada com profundidade 3D e animações fluidas, roteamento inteligente de modelos IA por complexidade e painel de Uso de API por modelo.
- Sincroniza 100% em tempo real com sua conta, finanças e histórico de conversas IA.

Servidor conectado: ${appUrl}
Para remover: execute ./uninstall.sh
`;

  const entries: ArchiveEntry[] = [
    { path: 'vertice-finance-linux/install.sh', content: installSh, mode: 0o755 },
    { path: 'vertice-finance-linux/uninstall.sh', content: uninstallSh, mode: 0o755 },
    { path: 'vertice-finance-linux/vertice-finance.svg', content: iconSvg, mode: 0o644 },
    { path: 'vertice-finance-linux/README.txt', content: readmeTxt, mode: 0o644 },
  ];

  return {
    filename: `vertice-finance-linux-${APP_VERSION}.tar.gz`,
    buffer: buildTarGzBuffer(entries),
    contentType: 'application/gzip',
  };
}

export function buildWindowsPackage(rootDir: string, appUrl: string): {
  filename: string;
  buffer: Buffer;
  contentType: string;
} {
  const icoPath = path.join(rootDir, 'public', 'favicon.ico');
  const iconIco = fs.existsSync(icoPath) ? fs.readFileSync(icoPath) : Buffer.alloc(0);

  const installBat = `@echo off\r
chcp 65001 >nul\r
echo.\r
echo ==========================================\r
echo   Instalando Vertice Finance para Windows\r
echo ==========================================\r
echo.\r
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\install.ps1"\r
echo.\r
pause\r
`;

  const uninstallBat = `@echo off\r
chcp 65001 >nul\r
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\uninstall.ps1"\r
echo.\r
pause\r
`;

  const installPs1 = `$ErrorActionPreference = 'Stop'\r
$AppName = 'Vertice Finance'\r
$AppUrl = '${appUrl}'\r
$InstallDir = Join-Path $env:LOCALAPPDATA 'VerticeFinance'\r
$ProfileDir = Join-Path $InstallDir 'Profile'\r
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null\r
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null\r
\r
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path\r
$IconSource = Join-Path (Split-Path -Parent $ScriptRoot) 'assets\\vertice-finance.ico'\r
$IconDest = Join-Path $InstallDir 'vertice-finance.ico'\r
if (Test-Path $IconSource) {\r
  Copy-Item -Force $IconSource $IconDest\r
}\r
\r
$BrowserCandidates = @(\r
  (Join-Path $env:ProgramFiles 'Microsoft\\Edge\\Application\\msedge.exe'),\r
  (Join-Path \${env:ProgramFiles(x86)} 'Microsoft\\Edge\\Application\\msedge.exe'),\r
  (Join-Path $env:ProgramFiles 'Google\\Chrome\\Application\\chrome.exe'),\r
  (Join-Path \${env:ProgramFiles(x86)} 'Google\\Chrome\\Application\\chrome.exe'),\r
  (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\Application\\chrome.exe'),\r
  (Join-Path $env:ProgramFiles 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')\r
)\r
\r
$BrowserExe = $BrowserCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1\r
$WshShell = New-Object -ComObject WScript.Shell\r
\r
$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'\r
$DesktopDir = [Environment]::GetFolderPath('Desktop')\r
$Targets = @(\r
  (Join-Path $DesktopDir "$AppName.lnk"),\r
  (Join-Path $StartMenuDir "$AppName.lnk")\r
)\r
\r
foreach ($LinkPath in $Targets) {\r
  $Shortcut = $WshShell.CreateShortcut($LinkPath)\r
  if ($BrowserExe) {\r
    $Shortcut.TargetPath = $BrowserExe\r
    $Shortcut.Arguments = "--app=$AppUrl --user-data-dir=\`"$ProfileDir\`""\r
  } else {\r
    $Shortcut.TargetPath = $AppUrl\r
  }\r
  if (Test-Path $IconDest) {\r
    $Shortcut.IconLocation = "$IconDest,0"\r
  }\r
  $Shortcut.Description = 'Vertice Finance - Gestao Financeira com Assistente IA'\r
  $Shortcut.Save()\r
}\r
\r
Write-Host "Vertice Finance instalado com sucesso!" -ForegroundColor Green\r
Write-Host "Atalhos criados na Area de Trabalho e no Menu Iniciar."\r
\r
if ($BrowserExe) {\r
  Start-Process -FilePath $BrowserExe -ArgumentList "--app=$AppUrl --user-data-dir=\`"$ProfileDir\`""\r
} else {\r
  Start-Process $AppUrl\r
}\r
`;

  const uninstallPs1 = `$AppName = 'Vertice Finance'\r
$DesktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) "$AppName.lnk"\r
$StartMenuLink = Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\$AppName.lnk"\r
$InstallDir = Join-Path $env:LOCALAPPDATA 'VerticeFinance'\r
\r
if (Test-Path $DesktopLink) { Remove-Item -Force $DesktopLink }\r
if (Test-Path $StartMenuLink) { Remove-Item -Force $StartMenuLink }\r
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }\r
\r
Write-Host "Vertice Finance desinstalado deste computador. Seus dados na nuvem permanecem intactos." -ForegroundColor Yellow\r
`;

  const readmeTxt = `VÉRTICE FINANCE — INSTALADOR WINDOWS 10/11 (v${APP_VERSION})\r
==============================================================\r
\r
Como instalar:\r
1. Extraia todos os arquivos deste arquivo .zip.\r
2. Dê duplo clique em "Instalar-Vertice-Finance.bat".\r
\r
O que será configurado automaticamente:\r
- Aplicativo em janela própria (modo app dedicado sem barra de endereço).\r
- Atalho oficial no Menu Iniciar e na Área de Trabalho com ícone do Vértice Finance.\r
- Inclui a v2.1.0 completa: efeitos 3D e animações suaves, roteamento inteligente de IA por complexidade e painel de Uso de API por modelo.\r
- Sincronização instantânea com sua conta, lançamentos e conversas com a IA.\r
\r
Servidor conectado: ${appUrl}\r
Para remover: dê duplo clique em "Desinstalar-Vertice-Finance.bat".\r
`;

  const entries: ArchiveEntry[] = [
    { path: 'vertice-finance-windows/Instalar-Vertice-Finance.bat', content: installBat },
    { path: 'vertice-finance-windows/Desinstalar-Vertice-Finance.bat', content: uninstallBat },
    { path: 'vertice-finance-windows/scripts/install.ps1', content: installPs1 },
    { path: 'vertice-finance-windows/scripts/uninstall.ps1', content: uninstallPs1 },
    { path: 'vertice-finance-windows/LEIA-ME.txt', content: readmeTxt },
  ];

  if (iconIco.length > 0) {
    entries.push({
      path: 'vertice-finance-windows/assets/vertice-finance.ico',
      content: iconIco,
    });
  }

  return {
    filename: `vertice-finance-windows-${APP_VERSION}.zip`,
    buffer: buildZipBuffer(entries),
    contentType: 'application/zip',
  };
}
