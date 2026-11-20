import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Content } from '@google/genai';
import {
  ASSISTANT_FUNCTION_DECLARATIONS,
  ASSISTANT_SYSTEM_INSTRUCTION,
} from './server/assistantTools.ts';
import {
  ADMIN_EMAIL,
  AIProfileConfig,
  AIRoutingDecision,
  DEFAULT_AI_PROFILE_ID,
  resolveAIProfile,
} from './shared/aiProfiles.ts';
import { resolveExecutionPlan } from './server/aiRouter.ts';
import { getApiUsageSummary, recordModelApiUsage } from './server/aiUsageTracker.ts';
import { collectDatabaseStats } from './server/adminDatabaseStats.ts';
import {
  buildLinuxPackage,
  buildWindowsPackage,
  getDownloadsManifest,
  resolvePublicAppUrl,
} from './server/downloadPackages.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8')
) as {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
};

const PORT = Number(process.env.PORT) || 3000;

let cachedProfile: AIProfileConfig = resolveAIProfile(DEFAULT_AI_PROFILE_ID);
let cacheExpiresAt = 0;

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    const email = (user.email ?? '').toLowerCase();
    const emailVerified = Boolean(user.emailVerified);
    return {
      uid: user.localId,
      email,
      emailVerified,
      isAdmin: emailVerified && email === ADMIN_EMAIL,
    };
  } catch {
    return null;
  }
}

async function resolveServerAIProfile(authHeader?: string): Promise<AIProfileConfig> {
  const now = Date.now();
  if (now < cacheExpiresAt) {
    return cachedProfile;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const docUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/appConfig/assistant`;
      const resp = await fetch(docUrl, {
        headers: { Authorization: authHeader },
      });
      if (resp.ok) {
        const docData = (await resp.json()) as {
          fields?: { profileId?: { stringValue?: string } };
        };
        const profileId = docData.fields?.profileId?.stringValue;
        cachedProfile = resolveAIProfile(profileId);
        cacheExpiresAt = now + 15_000;
        return cachedProfile;
      }
      if (resp.status === 404) {
        cachedProfile = resolveAIProfile(DEFAULT_AI_PROFILE_ID);
        cacheExpiresAt = now + 15_000;
        return cachedProfile;
      }
    } catch (err) {
      console.warn('Não foi possível consultar appConfig/assistant no Firestore:', err);
    }
  }

  return cachedProfile;
}

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry(
  ai: GoogleGenAI,
  contents: Content[],
  systemInstruction: string,
  routing: AIRoutingDecision,
  maxRetries = 2
) {
  let lastError: unknown;
  const thinkingLevelValue =
    routing.selectedModel === 'gemini-4-hydrogen' && routing.selectedThinkingLevel !== 'MINIMAL'
      ? ThinkingLevel[routing.selectedThinkingLevel]
      : undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: routing.selectedModel,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: ASSISTANT_FUNCTION_DECLARATIONS }],
          ...(thinkingLevelValue ? { thinkingConfig: { thinkingLevel: thinkingLevelValue } } : {}),
        },
      });
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('DEADLINE_EXCEEDED');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

function mapGeminiError(
  err: unknown,
  modelId: string
): { status: number; message: string; code: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403')) {
    return {
      status: 403,
      code: 'API_KEY_ERROR',
      message:
        'Chave da API Gemini ausente ou inválida. Verifique a configuração em Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message:
        'Limite de requisições atingido no momento. Aguarde alguns instantes e tente novamente.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message: `Modelo de IA indisponível (${modelId}).`,
    };
  }
  return {
    status: 500,
    code: 'GEMINI_ERROR',
    message: 'Não foi possível processar sua solicitação com a IA agora. Tente novamente.',
  };
}

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      model: cachedProfile.modelId,
      profileId: cachedProfile.id,
      thinkingLevel: cachedProfile.thinkingLevel,
    });
  });

  app.get('/api/downloads/manifest', (req, res) => {
    const appUrl = resolvePublicAppUrl(req);
    res.json(getDownloadsManifest(appUrl));
  });

  app.get('/api/downloads/linux', (req, res) => {
    try {
      const appUrl = resolvePublicAppUrl(req);
      const pkg = buildLinuxPackage(__dirname, appUrl);
      res.setHeader('Content-Type', pkg.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
      res.setHeader('Content-Length', String(pkg.buffer.length));
      res.setHeader('Cache-Control', 'no-store');
      res.send(pkg.buffer);
    } catch (err) {
      console.error('Erro ao gerar pacote Linux:', err);
      res.status(500).json({ error: 'Não foi possível gerar o instalador Linux.' });
    }
  });

  app.get('/api/downloads/windows', (req, res) => {
    try {
      const appUrl = resolvePublicAppUrl(req);
      const pkg = buildWindowsPackage(__dirname, appUrl);
      res.setHeader('Content-Type', pkg.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
      res.setHeader('Content-Length', String(pkg.buffer.length));
      res.setHeader('Cache-Control', 'no-store');
      res.send(pkg.buffer);
    } catch (err) {
      console.error('Erro ao gerar pacote Windows:', err);
      res.status(500).json({ error: 'Não foi possível gerar o instalador Windows.' });
    }
  });

  app.post('/api/assistant/config/invalidate', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticação ausente.' });
      return;
    }

    const idToken = authHeader.slice(7).trim();
    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified?.isAdmin) {
      res.status(403).json({ error: 'Acesso restrito ao administrador.' });
      return;
    }

    const body = req.body as { profileId?: string } | undefined;
    if (body?.profileId) {
      cachedProfile = resolveAIProfile(body.profileId);
      cacheExpiresAt = Date.now() + 15_000;
    } else {
      cacheExpiresAt = 0;
    }

    res.json({ ok: true, profile: cachedProfile });
  });

  app.get('/api/assistant/usage', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticação ausente.' });
      return;
    }

    const idToken = authHeader.slice(7).trim();
    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified) {
      res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      return;
    }

    const activeProfile = await resolveServerAIProfile(authHeader);
    const requestedScope = req.query.scope === 'global' ? 'global' : 'user';

    try {
      const summary = await getApiUsageSummary({
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
        authHeader,
        uid: verified.uid,
        isAdmin: verified.isAdmin,
        requestedScope,
        activeProfileId: activeProfile.id,
      });
      res.json(summary);
    } catch (err) {
      console.error('Erro na rota /api/assistant/usage:', err);
      res.status(500).json({ error: 'Não foi possível consultar o uso da API.' });
    }
  });

  app.get('/api/admin/database-stats', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticação ausente.' });
      return;
    }

    const idToken = authHeader.slice(7).trim();
    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified?.isAdmin) {
      res.status(403).json({ error: 'Acesso restrito ao administrador.' });
      return;
    }

    try {
      const stats = await collectDatabaseStats({
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
        authHeader,
      });
      res.json(stats);
    } catch (err) {
      console.error('Erro na rota /api/admin/database-stats:', err);
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Não foi possível consultar as métricas do banco de dados.',
      });
    }
  });

  app.post('/api/assistant/chat', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error:
          'A chave GEMINI_API_KEY não está configurada no servidor. Verifique o painel Settings > Secrets.',
      });
      return;
    }

    const body = req.body as {
      contents?: Content[];
      financialSnapshot?: string;
    };

    if (!Array.isArray(body?.contents) || body.contents.length === 0) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Envie ao menos uma mensagem para conversar com o assistente.',
      });
      return;
    }

    const authHeader = req.headers.authorization;
    const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const [activeProfile, verifiedUser] = await Promise.all([
      resolveServerAIProfile(authHeader),
      idToken ? verifyFirebaseIdToken(idToken) : Promise.resolve(null),
    ]);

    const routing = resolveExecutionPlan(activeProfile, body.contents);

    const snapshotBlock = body.financialSnapshot
      ? `\n\n--- CONTEXTO FINANCEIRO ATUAL DO USUÁRIO ---\n${body.financialSnapshot}`
      : '';

    const fullSystemInstruction = `${ASSISTANT_SYSTEM_INSTRUCTION}${snapshotBlock}`;
    const startedAt = Date.now();

    try {
      const response = await generateWithRetry(
        ai,
        body.contents,
        fullSystemInstruction,
        routing
      );
      const latencyMs = Math.max(1, Date.now() - startedAt);
      const modelContent = response.candidates?.[0]?.content ?? null;
      const functionCalls = response.functionCalls ?? [];
      const text = response.text ?? '';

      const meta = response.usageMetadata;
      const promptTokens = Number(meta?.promptTokenCount ?? 0);
      const outputTokens = Number(meta?.candidatesTokenCount ?? 0);
      const thinkingTokens = Number(meta?.thoughtsTokenCount ?? 0);
      const totalTokens = Number(
        meta?.totalTokenCount ?? promptTokens + outputTokens + thinkingTokens
      );

      // Persist real API usage asynchronously without delaying the response
      void recordModelApiUsage({
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
        authHeader,
        uid: verifiedUser?.uid ?? null,
        modelId: routing.selectedModel,
        complexity: routing.complexity,
        inputTokens: promptTokens,
        outputTokens,
        thinkingTokens,
        totalTokens,
        latencyMs,
        isError: false,
      });

      res.json({
        text,
        functionCalls,
        modelContent,
        profileId: activeProfile.id,
        routing,
        usage: {
          promptTokens,
          outputTokens,
          thinkingTokens,
          totalTokens,
          latencyMs,
        },
      });
    } catch (err) {
      const latencyMs = Math.max(1, Date.now() - startedAt);
      void recordModelApiUsage({
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
        authHeader,
        uid: verifiedUser?.uid ?? null,
        modelId: routing.selectedModel,
        complexity: routing.complexity,
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
        latencyMs,
        isError: true,
      });

      console.error('Erro na rota /api/assistant/chat:', err);
      const mapped = mapGeminiError(err, routing.selectedModel);
      res.status(mapped.status).json({
        code: mapped.code,
        error: mapped.message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Vértice Finance server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
