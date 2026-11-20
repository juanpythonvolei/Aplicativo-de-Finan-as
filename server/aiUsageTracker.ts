import {
  ACCESSIBLE_MODELS,
  AIComplexityLevel,
  AIModelUsageMetric,
  AIProfileId,
  AIUsageSummaryResponse,
  AccessibleAIModelId,
  estimateModelCostUsd,
  getModelCatalogEntry,
} from '../shared/aiProfiles.ts';

interface MutableUsageBucket {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  totalLatencyMs: number;
  errorCount: number;
  simpleCount: number;
  moderateCount: number;
  complexCount: number;
  criticalCount: number;
  lastUsedAt: string | null;
}

interface FirestoreRestValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
}

interface FirestoreRestDoc {
  name: string;
  fields?: Record<string, FirestoreRestValue>;
}

const memoryUsageByUser = new Map<string, Map<AccessibleAIModelId, MutableUsageBucket>>();

function emptyBucket(): MutableUsageBucket {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    totalTokens: 0,
    totalLatencyMs: 0,
    errorCount: 0,
    simpleCount: 0,
    moderateCount: 0,
    complexCount: 0,
    criticalCount: 0,
    lastUsedAt: null,
  };
}

function readNum(fields: Record<string, FirestoreRestValue> | undefined, key: string): number {
  const val = fields?.[key];
  if (!val) return 0;
  if (typeof val.doubleValue === 'number') return val.doubleValue;
  if (typeof val.integerValue === 'string') return Number(val.integerValue) || 0;
  return 0;
}

function readStr(fields: Record<string, FirestoreRestValue> | undefined, key: string): string {
  return fields?.[key]?.stringValue ?? '';
}

function readTimestamp(
  fields: Record<string, FirestoreRestValue> | undefined,
  key: string
): string | null {
  return fields?.[key]?.timestampValue ?? null;
}

function addBuckets(target: MutableUsageBucket, source: MutableUsageBucket): void {
  target.requests += source.requests;
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.thinkingTokens += source.thinkingTokens;
  target.totalTokens += source.totalTokens;
  target.totalLatencyMs += source.totalLatencyMs;
  target.errorCount += source.errorCount;
  target.simpleCount += source.simpleCount;
  target.moderateCount += source.moderateCount;
  target.complexCount += source.complexCount;
  target.criticalCount += source.criticalCount;
  if (source.lastUsedAt && (!target.lastUsedAt || source.lastUsedAt > target.lastUsedAt)) {
    target.lastUsedAt = source.lastUsedAt;
  }
}

function parseDocToBucket(doc: FirestoreRestDoc): {
  modelId: AccessibleAIModelId | null;
  bucket: MutableUsageBucket;
  createdAt: string | null;
} {
  const modelIdRaw = readStr(doc.fields, 'modelId');
  const modelId: AccessibleAIModelId | null =
    modelIdRaw === 'gemini-4-hydrogen' || modelIdRaw === 'gemini-3.1-flash-lite'
      ? modelIdRaw
      : null;

  return {
    modelId,
    createdAt: readTimestamp(doc.fields, 'createdAt'),
    bucket: {
      requests: readNum(doc.fields, 'requests'),
      inputTokens: readNum(doc.fields, 'inputTokens'),
      outputTokens: readNum(doc.fields, 'outputTokens'),
      thinkingTokens: readNum(doc.fields, 'thinkingTokens'),
      totalTokens: readNum(doc.fields, 'totalTokens'),
      totalLatencyMs: readNum(doc.fields, 'totalLatencyMs'),
      errorCount: readNum(doc.fields, 'errorCount'),
      simpleCount: readNum(doc.fields, 'simpleCount'),
      moderateCount: readNum(doc.fields, 'moderateCount'),
      complexCount: readNum(doc.fields, 'complexCount'),
      criticalCount: readNum(doc.fields, 'criticalCount'),
      lastUsedAt: readTimestamp(doc.fields, 'lastUsedAt'),
    },
  };
}

function updateMemoryBucket(
  uid: string,
  modelId: AccessibleAIModelId,
  delta: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    totalTokens: number;
    latencyMs: number;
    complexity: AIComplexityLevel;
    isError: boolean;
  }
): void {
  let userMap = memoryUsageByUser.get(uid);
  if (!userMap) {
    userMap = new Map();
    memoryUsageByUser.set(uid, userMap);
  }
  const bucket = userMap.get(modelId) ?? emptyBucket();
  bucket.requests += 1;
  bucket.inputTokens += delta.inputTokens;
  bucket.outputTokens += delta.outputTokens;
  bucket.thinkingTokens += delta.thinkingTokens;
  bucket.totalTokens += delta.totalTokens;
  bucket.totalLatencyMs += delta.latencyMs;
  if (delta.isError) bucket.errorCount += 1;
  if (delta.complexity === 'simple') bucket.simpleCount += 1;
  else if (delta.complexity === 'moderate') bucket.moderateCount += 1;
  else if (delta.complexity === 'complex') bucket.complexCount += 1;
  else bucket.criticalCount += 1;
  bucket.lastUsedAt = new Date().toISOString();
  userMap.set(modelId, bucket);
}

export async function recordModelApiUsage(params: {
  projectId: string;
  databaseId: string;
  authHeader?: string;
  uid?: string | null;
  modelId: AccessibleAIModelId;
  complexity: AIComplexityLevel;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  latencyMs: number;
  isError?: boolean;
}): Promise<void> {
  const safeInput = Math.max(0, Math.round(params.inputTokens));
  const safeOutput = Math.max(0, Math.round(params.outputTokens));
  const safeThinking = Math.max(0, Math.round(params.thinkingTokens));
  const safeTotal = Math.max(safeInput + safeOutput + safeThinking, Math.round(params.totalTokens));
  const safeLatency = Math.max(1, Math.round(params.latencyMs));
  const isError = Boolean(params.isError);

  const memUid = params.uid || '_anonymous';
  updateMemoryBucket(memUid, params.modelId, {
    inputTokens: safeInput,
    outputTokens: safeOutput,
    thinkingTokens: safeThinking,
    totalTokens: safeTotal,
    latencyMs: safeLatency,
    complexity: params.complexity,
    isError,
  });

  if (!params.uid || !params.authHeader || !params.authHeader.startsWith('Bearer ')) {
    return;
  }

  try {
    const entry = getModelCatalogEntry(params.modelId);
    const dbRoot = `projects/${params.projectId}/databases/${params.databaseId}`;
    const docName = `${dbRoot}/documents/users/${params.uid}/aiUsage/${entry.docKey}`;
    const docUrl = `https://firestore.googleapis.com/v1/${docName}`;

    // Read existing doc to compute clean cumulative values that satisfy strict rules
    const existingResp = await fetch(docUrl, {
      headers: { Authorization: params.authHeader },
    });

    const isExisting = existingResp.ok;
    const prev = isExisting
      ? parseDocToBucket((await existingResp.json()) as FirestoreRestDoc)
      : { modelId: params.modelId, bucket: emptyBucket(), createdAt: null };

    const next = { ...prev.bucket };
    next.requests += 1;
    next.inputTokens += safeInput;
    next.outputTokens += safeOutput;
    next.thinkingTokens += safeThinking;
    next.totalTokens += safeTotal;
    next.totalLatencyMs += safeLatency;
    if (isError) next.errorCount += 1;
    if (params.complexity === 'simple') next.simpleCount += 1;
    else if (params.complexity === 'moderate') next.moderateCount += 1;
    else if (params.complexity === 'complex') next.complexCount += 1;
    else next.criticalCount += 1;

    const fields: Record<string, FirestoreRestValue> = {
      userId: { stringValue: params.uid },
      modelId: { stringValue: params.modelId },
      requests: { integerValue: String(next.requests) },
      inputTokens: { integerValue: String(next.inputTokens) },
      outputTokens: { integerValue: String(next.outputTokens) },
      thinkingTokens: { integerValue: String(next.thinkingTokens) },
      totalTokens: { integerValue: String(next.totalTokens) },
      totalLatencyMs: { integerValue: String(next.totalLatencyMs) },
      errorCount: { integerValue: String(next.errorCount) },
      simpleCount: { integerValue: String(next.simpleCount) },
      moderateCount: { integerValue: String(next.moderateCount) },
      complexCount: { integerValue: String(next.complexCount) },
      criticalCount: { integerValue: String(next.criticalCount) },
    };

    const fieldTransforms: Array<{ fieldPath: string; setToServerValue: string }> = [
      { fieldPath: 'lastUsedAt', setToServerValue: 'REQUEST_TIME' },
      { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
    ];

    if (isExisting && prev.createdAt) {
      fields.createdAt = { timestampValue: prev.createdAt };
    } else {
      fieldTransforms.push({ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' });
    }

    const commitUrl = `https://firestore.googleapis.com/v1/${dbRoot}/documents:commit`;
    const commitResp = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        Authorization: params.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: docName,
              fields,
            },
            updateTransforms: fieldTransforms,
          },
        ],
      }),
    });

    if (!commitResp.ok) {
      const errTxt = await commitResp.text().catch(() => '');
      console.warn('Falha ao persistir aiUsage no Firestore:', commitResp.status, errTxt.slice(0, 200));
    }
  } catch (err) {
    console.warn('Erro ao registrar uso da API no Firestore:', err);
  }
}

async function listUserAiUsageDocs(
  baseDocUrl: string,
  userId: string,
  authHeader: string
): Promise<FirestoreRestDoc[]> {
  const queryUrl = `${baseDocUrl}/users/${userId}:runQuery`;
  const resp = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'aiUsage' }],
      },
    }),
  });
  if (!resp.ok) return [];
  const entries = (await resp.json()) as Array<{ document?: FirestoreRestDoc }>;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((e) => (e.document ? [e.document] : []));
}

async function listAllUserIds(baseDocUrl: string, authHeader: string): Promise<string[]> {
  const queryUrl = `${baseDocUrl}:runQuery`;
  const resp = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
      },
    }),
  });
  if (!resp.ok) return [];
  const entries = (await resp.json()) as Array<{ document?: FirestoreRestDoc }>;
  if (!Array.isArray(entries)) return [];
  return entries
    .map((e) => e.document?.name ?? '')
    .filter(Boolean)
    .map((name) => {
      const marker = '/documents/users/';
      const idx = name.indexOf(marker);
      return idx >= 0 ? name.slice(idx + marker.length).split('/')[0] : '';
    })
    .filter(Boolean);
}

export async function getApiUsageSummary(params: {
  projectId: string;
  databaseId: string;
  authHeader: string;
  uid: string;
  isAdmin: boolean;
  requestedScope?: 'user' | 'global';
  activeProfileId: AIProfileId;
}): Promise<AIUsageSummaryResponse> {
  const scope: 'user' | 'global' =
    params.isAdmin && params.requestedScope === 'global' ? 'global' : 'user';

  const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${params.projectId}/databases/${params.databaseId}/documents`;

  const aggregated = new Map<AccessibleAIModelId, MutableUsageBucket>();
  for (const m of ACCESSIBLE_MODELS) {
    aggregated.set(m.modelId, emptyBucket());
  }

  let firestoreDocsFound = false;

  try {
    if (scope === 'global') {
      const userIds = await listAllUserIds(baseDocUrl, params.authHeader);
      const docGroups = await Promise.all(
        userIds.map((u) => listUserAiUsageDocs(baseDocUrl, u, params.authHeader))
      );
      for (const docs of docGroups) {
        for (const doc of docs) {
          const parsed = parseDocToBucket(doc);
          if (parsed.modelId) {
            firestoreDocsFound = true;
            const target = aggregated.get(parsed.modelId);
            if (target) addBuckets(target, parsed.bucket);
          }
        }
      }
    } else {
      const docs = await listUserAiUsageDocs(baseDocUrl, params.uid, params.authHeader);
      for (const doc of docs) {
        const parsed = parseDocToBucket(doc);
        if (parsed.modelId) {
          firestoreDocsFound = true;
          const target = aggregated.get(parsed.modelId);
          if (target) addBuckets(target, parsed.bucket);
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar uso da API no Firestore:', err);
  }

  // Merge in-memory fallback if Firestore had no documents yet (e.g., workspace not seeded yet)
  if (!firestoreDocsFound) {
    if (scope === 'global') {
      for (const userMap of memoryUsageByUser.values()) {
        for (const [modelId, bucket] of userMap.entries()) {
          const target = aggregated.get(modelId);
          if (target) addBuckets(target, bucket);
        }
      }
    } else {
      const userMap = memoryUsageByUser.get(params.uid);
      if (userMap) {
        for (const [modelId, bucket] of userMap.entries()) {
          const target = aggregated.get(modelId);
          if (target) addBuckets(target, bucket);
        }
      }
    }
  }

  let totalRequests = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalThinking = 0;
  let totalTokens = 0;
  let totalLatencySum = 0;
  let totalErrors = 0;
  let totalCostUsd = 0;

  for (const m of ACCESSIBLE_MODELS) {
    const b = aggregated.get(m.modelId) ?? emptyBucket();
    totalRequests += b.requests;
    totalInput += b.inputTokens;
    totalOutput += b.outputTokens;
    totalThinking += b.thinkingTokens;
    totalTokens += b.totalTokens;
    totalLatencySum += b.totalLatencyMs;
    totalErrors += b.errorCount;
    totalCostUsd += estimateModelCostUsd(m.modelId, b.inputTokens, b.outputTokens, b.thinkingTokens);
  }

  const models: AIModelUsageMetric[] = ACCESSIBLE_MODELS.map((entry) => {
    const b = aggregated.get(entry.modelId) ?? emptyBucket();
    const cost = estimateModelCostUsd(
      entry.modelId,
      b.inputTokens,
      b.outputTokens,
      b.thinkingTokens
    );
    const sharePercent =
      totalTokens > 0
        ? Number(((b.totalTokens / totalTokens) * 100).toFixed(1))
        : totalRequests > 0
        ? Number(((b.requests / totalRequests) * 100).toFixed(1))
        : 0;

    return {
      modelId: entry.modelId,
      label: entry.label,
      family: entry.family,
      roleSummary: entry.roleSummary,
      requests: b.requests,
      inputTokens: b.inputTokens,
      outputTokens: b.outputTokens,
      thinkingTokens: b.thinkingTokens,
      totalTokens: b.totalTokens,
      avgLatencyMs: b.requests > 0 ? Math.round(b.totalLatencyMs / b.requests) : 0,
      errorCount: b.errorCount,
      estimatedCostUsd: cost,
      sharePercent,
      lastUsedAt: b.lastUsedAt,
      complexityBreakdown: {
        simple: b.simpleCount,
        moderate: b.moderateCount,
        complex: b.complexCount,
        critical: b.criticalCount,
      },
    };
  });

  return {
    scope,
    isAdmin: params.isAdmin,
    activeProfileId: params.activeProfileId,
    measuredAt: new Date().toISOString(),
    totals: {
      requests: totalRequests,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      thinkingTokens: totalThinking,
      totalTokens,
      avgLatencyMs: totalRequests > 0 ? Math.round(totalLatencySum / totalRequests) : 0,
      errorCount: totalErrors,
      estimatedCostUsd: Number(totalCostUsd.toFixed(6)),
    },
    models,
  };
}
