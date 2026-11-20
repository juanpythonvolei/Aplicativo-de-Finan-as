export interface CollectionDatabaseStat {
  collection: string;
  label: string;
  docCount: number;
  payloadBytes: number;
  largestDocBytes: number;
}

export interface UserDatabaseSummary {
  userId: string;
  displayName: string;
  email: string;
  currency: string;
  theme: string;
  docCount: number;
  payloadBytes: number;
  transactionsCount: number;
  accountsCount: number;
  createdAt: string | null;
}

export interface DatabaseStatsResponse {
  projectId: string;
  databaseId: string;
  edition: string;
  consoleUsageUrl: string;
  measuredAt: string;
  latencyMs: number;
  diagnosticReadCalls: number;
  storage: {
    limitBytes: number;
    usedDocumentBytes: number;
    estimatedWithIndexesBytes: number;
    remainingBytes: number;
    usagePercent: number;
    freePercent: number;
    maxSingleDocLimitBytes: number;
    largestDocBytes: number;
    largestDocPath: string;
    averageDocBytes: number;
  };
  totals: {
    usersCount: number;
    totalDocuments: number;
    transactionsCount: number;
    accountsCount: number;
    categoriesCount: number;
    budgetsCount: number;
    goalsCount: number;
    lastWriteAt: string | null;
  };
  quotas: {
    dailyReadsLimit: number;
    dailyWritesLimit: number;
    dailyDeletesLimit: number;
  };
  collections: CollectionDatabaseStat[];
  users: UserDatabaseSummary[];
}
