# Vértice Finance — App Android Nativo (Kotlin + Jetpack Compose)

Este é o projeto nativo completo do **Vértice Finance** para Android, sincronizado em tempo real com a mesma conta Firebase e banco Cloud Firestore da versão Web, Linux e Windows.

## Recursos incluídos nesta versão
- **Assistente IA como tela principal**: opera o sistema por comandos naturais conectado ao endpoint `/api/assistant/chat` com o mesmo perfil econômico configurado pelo administrador.
- **Conversas salvas no Firestore**: histórico sincronizado entre Web, Linux, Windows e Android (`/users/{uid}/aiConversations`).
- **Módulos secundários**: Visão Geral, Extrato, Contas/Cartões e Metas na barra inferior ergonômica.
- **Configurações dedicadas**: Moeda principal (`BRL`, `USD`, `EUR`) e Tema (`Claro` / `Escuro`) centralizados no menu de Configurações.

## Como gerar o APK instalável

### Opção 1 — Android Studio (local)
1. Extraia este pacote `.zip` e abra a pasta no **Android Studio (Ladybug ou superior)**.
2. Aguarde a sincronização automática do Gradle.
3. Clique em **Build > Build Bundle(s) / APK(s) > Build APK(s)** ou conecte seu celular Android via USB e clique em **Run**.

### Opção 2 — GitHub Actions (na nuvem, sem instalar Android Studio)
1. Envie os arquivos desta pasta para um repositório no GitHub.
2. Abra a aba **Actions > Build Vertice Finance Android APK** e clique em **Run workflow**.
3. Baixe o artefato `vertice-finance-android-debug-apk` gerado automaticamente.
