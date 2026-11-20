import {
  CollectionDatabaseStat,
  DatabaseStatsResponse,
  UserDatabaseSummary,
} from '../shared/databaseStats.ts';

interface FirestoreRestValue {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  bytesValue?: string;
  referenceValue?: string;
  geoPointValue?: { latitude?: number; longitude?: number };
  arrayValue?: { values?: FirestoreRestValue[] };
  mapValue?: { fields?: Record<string, FirestoreRestValue> };
}

interface FirestoreRestDocument {
  name: string;
  fields?: Record<string, FirestoreRestValue>;
  createTime?: string;
  updateTime?: string;
}

interface FirestoreRunQueryEntry {
  document?: FirestoreRestDocument;
  readTime?: string;
}

const ONE_GIB_BYTES = 1024 * 1024 * 1024; // 1 GiB Firestore Spark free storage quota
const ONE_MIB_BYTES = 1024 * 1024; // 1 MiB max single document size

function getRelativePath(fullDocName: string): string {
  const marker = '/documents/';
  const idx = fullDocName.indexOf(marker);
  return idx >= 0 ? fullDocName.slice(idx + marker.length) : fullDocName;
}

function measureValueBytes(val: FirestoreRestValue | undefined): number {
  if (!val) return 1;
  if ('nullValue' in val) return 1;
  if ('booleanValue' in val) return 1;
  if ('integerValue' in val || 'doubleValue' in val || 'timestampValue' in val) return 8;
  if ('stringValue' in val && typeof val.stringValue === 'string') {
    return Buffer.byteLength(val.stringValue, 'utf8') + 1;
  }
  if ('bytesValue' in val && typeof val.bytesValue === 'string') {
    return Buffer.from(val.bytesValue, 'base64').length;
  }
  if ('geoPointValue' in val) return 16;
  if ('referenceValue' in val && typeof val.referenceValue === 'string') {
    const rel = getRelativePath(val.referenceValue);
    const segBytes = rel
      .split('/')
      .filter(Boolean)
      .reduce((sum, seg) => sum + Buffer.byteLength(seg, 'utf8') + 1, 0);
    return segBytes + 16;
  }
  if ('arrayValue' in val) {
    const items = val.arrayValue?.values ?? [];
    return items.reduce((sum, item) => sum + measureValueBytes(item), 0);
  }
  if ('mapValue' in val) {
    return measureFieldsBytes(val.mapValue?.fields);
  }
  return 0;
}

function measureFieldsBytes(fields: Record<string, FirestoreRestValue> | undefined): number {
  if (!fields) return 0;
  let total = 0;
  for (const [key, val] of Object.entries(fields)) {
    total += Buffer.byteLength(key, 'utf8') + 1 + measureValueBytes(val);
  }
  return total;
}

function measureDocumentBytes(doc: FirestoreRestDocument): number {
  const relPath = getRelativePath(doc.name);
  const pathBytes =
    16 +
    relPath
      .split('/')
      .filter(Boolean)
      .reduce((sum, seg) => sum + Buffer.byteLength(seg, 'utf8') + 1, 0);
  const fieldsBytes = measureFieldsBytes(doc.fields);
  return pathBytes + fieldsBytes + 32;
}

async function runCollectionQuery(
  baseDocUrl: string,
  parentRelPath: string,
  collectionId: string,
  authHeader: string
): Promise<{ docs: FirestoreRestDocument[]; apiCalls: number }> {
  const queryUrl = parentRelPath
    ? `${baseDocUrl}/${parentRelPath}:runQuery`
    : `${baseDocUrl}:runQuery`;

  const resp = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
      },
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    const fullLabel = parentRelPath ? `${parentRelPath}/${collectionId}` : collectionId;
    throw new Error(
      `Erro ao consultar ${fullLabel} no Firestore (${resp.status}): ${errBody.slice(0, 220)}`
    );
  }

  const entries = (await resp.json()) as FirestoreRunQueryEntry[];
  const docs: FirestoreRestDocument[] = [];
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry.document) {
        docs.push(entry.document);
      }
    }
  }

  return { docs, apiCalls: 1 };
}

export async function collectDatabaseStats(options: {
  projectId: string;
  databaseId: string;
  authHeader: string;
}): Promise<DatabaseStatsResponse> {
  const startedAt = Date.now();
  const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${options.projectId}/databases/${options.databaseId}/documents`;

  let diagnosticReadCalls = 0;

  const [usersRes, appConfigRes] = await Promise.all([
    runCollectionQuery(baseDocUrl, '', 'users', options.authHeader),
    runCollectionQuery(baseDocUrl, '', 'appConfig', options.authHeader),
  ]);
  diagnosticReadCalls += usersRes.apiCalls + appConfigRes.apiCalls;

  const subcollections: Array<{ key: string; label: string }> = [
    { key: 'transactions', label: 'Lançamentos' },
    { key: 'accounts', label: 'Contas e Cartões' },
    { key: 'categories', label: 'Categorias' },
    { key: 'budgets', label: 'Orçamentos' },
    { key: 'goals', label: 'Metas' },
    { key: 'aiConversations', label: 'Conversas IA' },
    { key: 'aiUsage', label: 'Uso de API (IA)' },
    { key: 'private', label: 'Perfis Privados' },
  ];

  const colStatsMap = new Map<string, CollectionDatabaseStat>([
    [
      'users',
      {
        collection: 'users',
        label: 'Workspaces de Usuários',
        docCount: 0,
        payloadBytes: 0,
        largestDocBytes: 0,
      },
    ],
    [
      'appConfig',
      {
        collection: 'appConfig',
        label: 'Configurações Globais',
        docCount: 0,
        payloadBytes: 0,
        largestDocBytes: 0,
      },
    ],
    [
      'aiMessages',
      {
        collection: 'aiConversations/messages',
        label: 'Mensagens IA Salvas',
        docCount: 0,
        payloadBytes: 0,
        largestDocBytes: 0,
      },
    ],
    ...subcollections.map(
      (s): [string, CollectionDatabaseStat] => [
        s.key,
        {
          collection: s.key,
          label: s.label,
          docCount: 0,
          payloadBytes: 0,
          largestDocBytes: 0,
        },
      ]
    ),
  ]);

  let largestDocBytes = 0;
  let largestDocPath = '';
  let lastWriteAt: string | null = null;

  const recordDoc = (collectionKey: string, doc: FirestoreRestDocument): number => {
    const bytes = measureDocumentBytes(doc);
    const stat = colStatsMap.get(collectionKey);
    if (stat) {
      stat.docCount += 1;
      stat.payloadBytes += bytes;
      if (bytes > stat.largestDocBytes) {
        stat.largestDocBytes = bytes;
      }
    }
    if (bytes > largestDocBytes) {
      largestDocBytes = bytes;
      largestDocPath = getRelativePath(doc.name);
    }
    if (doc.updateTime && (!lastWriteAt || doc.updateTime > lastWriteAt)) {
      lastWriteAt = doc.updateTime;
    }
    return bytes;
  };

  for (const cfgDoc of appConfigRes.docs) {
    recordDoc('appConfig', cfgDoc);
  }

  const userSummaries: UserDatabaseSummary[] = [];

  for (const userDoc of usersRes.docs) {
    const relPath = getRelativePath(userDoc.name);
    const userId = relPath.split('/')[1] || relPath;
    const workspaceBytes = recordDoc('users', userDoc);

    let userTotalBytes = workspaceBytes;
    let userDocCount = 1;
    let userTransactionsCount = 0;
    let userAccountsCount = 0;
    let displayName = userId;
    let email = '';

    const subResults = await Promise.all(
      subcollections.map(async (sub) => {
        const res = await runCollectionQuery(
          baseDocUrl,
          `users/${userId}`,
          sub.key,
          options.authHeader
        );
        return { key: sub.key, res };
      })
    );

    const conversationIds: string[] = [];
    for (const { key, res } of subResults) {
      diagnosticReadCalls += res.apiCalls;
      for (const d of res.docs) {
        const b = recordDoc(key, d);
        userTotalBytes += b;
        userDocCount += 1;
        if (key === 'transactions') userTransactionsCount += 1;
        if (key === 'accounts') userAccountsCount += 1;
        if (key === 'aiConversations') {
          const convRel = getRelativePath(d.name);
          const convId = convRel.split('/').pop();
          if (convId) conversationIds.push(convId);
        }
        if (key === 'private') {
          displayName = d.fields?.displayName?.stringValue || displayName;
          email = d.fields?.email?.stringValue || email;
        }
      }
    }

    if (conversationIds.length > 0) {
      const msgResults = await Promise.all(
        conversationIds.map((convId) =>
          runCollectionQuery(
            baseDocUrl,
            `users/${userId}/aiConversations/${convId}`,
            'messages',
            options.authHeader
          )
        )
      );
      for (const mRes of msgResults) {
        diagnosticReadCalls += mRes.apiCalls;
        for (const msgDoc of mRes.docs) {
          const b = recordDoc('aiMessages', msgDoc);
          userTotalBytes += b;
          userDocCount += 1;
        }
      }
    }

    userSummaries.push({
      userId,
      displayName,
      email,
      currency: userDoc.fields?.currency?.stringValue || 'BRL',
      theme: userDoc.fields?.theme?.stringValue || 'light',
      docCount: userDocCount,
      payloadBytes: userTotalBytes,
      transactionsCount: userTransactionsCount,
      accountsCount: userAccountsCount,
      createdAt: userDoc.createTime ?? null,
    });
  }

  userSummaries.sort((a, b) => b.payloadBytes - a.payloadBytes);

  const collections = Array.from(colStatsMap.values()).sort(
    (a, b) => b.payloadBytes - a.payloadBytes
  );

  const totalDocuments = collections.reduce((s, c) => s + c.docCount, 0);
  const usedDocumentBytes = collections.reduce((s, c) => s + c.payloadBytes, 0);
  // Firestore maintains ascending+descending single-field indexes (~1.45x payload footprint typical for structured docs)
  const estimatedWithIndexesBytes = Math.round(usedDocumentBytes * 1.45);
  const remainingBytes = Math.max(0, ONE_GIB_BYTES - estimatedWithIndexesBytes);
  const usagePercent = Number(((estimatedWithIndexesBytes / ONE_GIB_BYTES) * 100).toFixed(4));
  const freePercent = Number(Math.max(0, 100 - usagePercent).toFixed(4));
  const latencyMs = Math.max(1, Date.now() - startedAt);

  return {
    projectId: options.projectId,
    databaseId: options.databaseId,
    edition: 'Cloud Firestore Enterprise · Cota Spark (Gratuita)',
    consoleUsageUrl: `https://console.firebase.google.com/project/${options.projectId}/firestore/databases/${options.databaseId}/usage`,
    measuredAt: new Date().toISOString(),
    latencyMs,
    diagnosticReadCalls,
    storage: {
      limitBytes: ONE_GIB_BYTES,
      usedDocumentBytes,
      estimatedWithIndexesBytes,
      remainingBytes,
      usagePercent,
      freePercent,
      maxSingleDocLimitBytes: ONE_MIB_BYTES,
      largestDocBytes,
      largestDocPath,
      averageDocBytes: totalDocuments > 0 ? Math.round(usedDocumentBytes / totalDocuments) : 0,
    },
    totals: {
      usersCount: userSummaries.length,
      totalDocuments,
      transactionsCount: colStatsMap.get('transactions')?.docCount ?? 0,
      accountsCount: colStatsMap.get('accounts')?.docCount ?? 0,
      categoriesCount: colStatsMap.get('categories')?.docCount ?? 0,
      budgetsCount: colStatsMap.get('budgets')?.docCount ?? 0,
      goalsCount: colStatsMap.get('goals')?.docCount ?? 0,
      lastWriteAt,
    },
    quotas: {
      dailyReadsLimit: 50000,
      dailyWritesLimit: 20000,
      dailyDeletesLimit: 20000,
    },
    collections,
    users: userSummaries,
  };
}
