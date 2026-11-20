# Vértice Finance — App Android Nativo (Kotlin + Jetpack Compose)

Este é o projeto nativo completo do **Vértice Finance** para Android, sincronizado em tempo real com a mesma conta Firebase e banco Cloud Firestore da versão Web, Linux e Windows.

## Recursos incluídos nesta versão
- **Assistente IA como tela principal**: opera o sistema por comandos naturais conectado ao endpoint `/api/assistant/chat` com o mesmo perfil econômico configurado pelo administrador.
- **Conversas salvas no Firestore**: histórico sincronizado entre Web, Linux, Windows e Android (`/users/{uid}/aiConversations`).
- **Módulos secundários**: Visão Geral, Extrato, Contas/Cartões e Metas na barra inferior ergonômica.
- **Configurações dedicadas**: Moeda principal (`BRL`, `USD`, `EUR`) e Tema (`Claro` / `Escuro`) centralizados no menu de Configurações.

## Automação de APK via GitHub Actions
O workflow na raiz do repositório (`.github/workflows/release-apk.yml`) compila automaticamente este projeto nativo em todo `push` para a branch `main` (ou via execução manual `workflow_dispatch`) e publica/atualiza o arquivo `aplicativo.apk` na Release fixa `latest`:

```
https://github.com/juanpythonvolei/Aplicativo-de-Finan-as/releases/download/latest/aplicativo.apk
```

## Compilação local (Android Studio)
1. Abra a pasta `android/` no **Android Studio (Ladybug ou superior)**.
2. Aguarde a sincronização automática do Gradle.
3. Clique em **Build > Build Bundle(s) / APK(s) > Build APK(s)** ou conecte seu celular Android via USB e clique em **Run**.
