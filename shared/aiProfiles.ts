export const ADMIN_EMAIL = 'juanpablozonho@gmail.com';

export type AIProfileId =
  | 'auto_dynamic'
  | 'economic_smart'
  | 'ultra_lite'
  | 'balanced'
  | 'deep';

export type AccessibleAIModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
export type AIModelId = 'auto' | AccessibleAIModelId;
export type AIThinkingLevelKey = 'DYNAMIC' | 'LOW' | 'MEDIUM' | 'HIGH' | 'MINIMAL';
export type ExecutableThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'MINIMAL';
export type AIComplexityLevel = 'simple' | 'moderate' | 'complex' | 'critical';

export interface AIProfileConfig {
  id: AIProfileId;
  label: string;
  tag: string;
  modelId: AIModelId;
  thinkingLevel: AIThinkingLevelKey;
  costSummary: string;
  description: string;
}

export interface AIModelCatalogEntry {
  modelId: AccessibleAIModelId;
  docKey: string;
  label: string;
  family: string;
  roleSummary: string;
  supportedComplexity: AIComplexityLevel[];
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

export interface AIRoutingDecision {
  complexity: AIComplexityLevel;
  complexityLabel: string;
  score: number;
  selectedModel: AccessibleAIModelId;
  selectedThinkingLevel: ExecutableThinkingLevel;
  reason: string;
  isDynamic: boolean;
}

export interface AIModelUsageMetric {
  modelId: AccessibleAIModelId;
  label: string;
  family: string;
  roleSummary: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorCount: number;
  estimatedCostUsd: number;
  sharePercent: number;
  lastUsedAt: string | null;
  complexityBreakdown: {
    simple: number;
    moderate: number;
    complex: number;
    critical: number;
  };
}

export interface AIUsageSummaryResponse {
  scope: 'user' | 'global';
  isAdmin: boolean;
  activeProfileId: AIProfileId;
  measuredAt: string;
  totals: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    totalTokens: number;
    avgLatencyMs: number;
    errorCount: number;
    estimatedCostUsd: number;
  };
  models: AIModelUsageMetric[];
}

export const ACCESSIBLE_MODELS: AIModelCatalogEntry[] = [
  {
    modelId: 'gemini-3.1-flash-lite',
    docKey: 'gemini-3_1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    family: 'Ultra-leve · Baixa latência',
    roleSummary: 'Consultas diretas, comandos rápidos de navegação, tema/moeda e perguntas simples.',
    supportedComplexity: ['simple'],
    inputUsdPer1M: 0.075,
    outputUsdPer1M: 0.3,
  },
  {
    modelId: 'gemini-4-hydrogen',
    docKey: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    family: 'Raciocínio escalável (LOW / MEDIUM / HIGH)',
    roleSummary: 'Lançamentos estruturados, OCR de comprovantes, análises comparativas e auditorias patrimoniais.',
    supportedComplexity: ['moderate', 'complex', 'critical'],
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
  },
];

export function getModelCatalogEntry(modelId: AccessibleAIModelId): AIModelCatalogEntry {
  return (
    ACCESSIBLE_MODELS.find((m) => m.modelId === modelId) ?? ACCESSIBLE_MODELS[1]
  );
}

export function estimateModelCostUsd(
  modelId: AccessibleAIModelId,
  inputTokens: number,
  outputTokens: number,
  thinkingTokens = 0
): number {
  const entry = getModelCatalogEntry(modelId);
  const inputCost = (Math.max(0, inputTokens) / 1_000_000) * entry.inputUsdPer1M;
  const outCombined = Math.max(0, outputTokens) + Math.max(0, thinkingTokens);
  const outputCost = (outCombined / 1_000_000) * entry.outputUsdPer1M;
  return Number((inputCost + outputCost).toFixed(6));
}

export const DEFAULT_AI_PROFILE_ID: AIProfileId = 'auto_dynamic';

export const AI_PROFILES: Record<AIProfileId, AIProfileConfig> = {
  auto_dynamic: {
    id: 'auto_dynamic',
    label: 'Roteamento Inteligente Dinâmico',
    tag: 'Autônomo Recomendado',
    modelId: 'auto',
    thinkingLevel: 'DYNAMIC',
    costSummary: 'Seleção autônoma por complexidade · Melhor eficiência',
    description:
      'Analisa a complexidade de cada pedido em tempo real (consultas simples, ações estruturadas, comprovantes ou auditorias profundas) e escolhe autonomamente entre Gemini 3.1 Flash Lite e Gemini 4 Hydrogen (LOW / MEDIUM / HIGH).',
  },
  economic_smart: {
    id: 'economic_smart',
    label: 'Econômico & Eficiente (Fixo)',
    tag: 'Fixo Econômico',
    modelId: 'gemini-4-hydrogen',
    thinkingLevel: 'LOW',
    costSummary: 'Baixo custo · Alta precisão em ferramentas',
    description:
      'Fixa o uso em Gemini 4 Hydrogen com raciocínio LOW. Mantém alta confiabilidade nas ações autônomas e leitura de comprovantes com custo previsível.',
  },
  ultra_lite: {
    id: 'ultra_lite',
    label: 'Ultra Econômico (Lite Fixo)',
    tag: 'Menor Custo',
    modelId: 'gemini-3.1-flash-lite',
    thinkingLevel: 'MINIMAL',
    costSummary: 'Custo mínimo · Resposta instantânea',
    description:
      'Fixa o uso em Gemini 3.1 Flash Lite com raciocínio mínimo. Ideal para lançamentos simples e consultas rápidas com o menor consumo possível.',
  },
  balanced: {
    id: 'balanced',
    label: 'Equilibrado (Fixo)',
    tag: 'Análise Intermediária',
    modelId: 'gemini-4-hydrogen',
    thinkingLevel: 'MEDIUM',
    costSummary: 'Custo moderado · Raciocínio médio',
    description:
      'Fixa o uso em Gemini 4 Hydrogen com raciocínio MEDIUM para análises comparativas mais ricas mantendo economia frente ao nível máximo.',
  },
  deep: {
    id: 'deep',
    label: 'Máxima Profundidade (Fixo)',
    tag: 'Alta Capacidade',
    modelId: 'gemini-4-hydrogen',
    thinkingLevel: 'HIGH',
    costSummary: 'Maior consumo · Auditoria completa',
    description:
      'Fixa o uso em Gemini 4 Hydrogen com raciocínio HIGH para diagnósticos patrimoniais profundos e sequências complexas de múltiplas etapas.',
  },
};

export const AI_PROFILE_LIST: AIProfileConfig[] = [
  AI_PROFILES.auto_dynamic,
  AI_PROFILES.economic_smart,
  AI_PROFILES.ultra_lite,
  AI_PROFILES.balanced,
  AI_PROFILES.deep,
];

export function resolveAIProfile(profileId: unknown): AIProfileConfig {
  if (typeof profileId === 'string' && profileId in AI_PROFILES) {
    return AI_PROFILES[profileId as AIProfileId];
  }
  return AI_PROFILES[DEFAULT_AI_PROFILE_ID];
}
