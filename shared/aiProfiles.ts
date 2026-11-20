export const ADMIN_EMAIL = 'juanpablozonho@gmail.com';

export type AIProfileId = 'economic_smart' | 'ultra_lite' | 'balanced' | 'deep';
export type AIModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
export type AIThinkingLevelKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'MINIMAL';

export interface AIProfileConfig {
  id: AIProfileId;
  label: string;
  tag: string;
  modelId: AIModelId;
  thinkingLevel: AIThinkingLevelKey;
  costSummary: string;
  description: string;
}

export const DEFAULT_AI_PROFILE_ID: AIProfileId = 'economic_smart';

export const AI_PROFILES: Record<AIProfileId, AIProfileConfig> = {
  economic_smart: {
    id: 'economic_smart',
    label: 'Econômico & Eficiente',
    tag: 'Padrão Recomendado',
    modelId: 'gemini-4-hydrogen',
    thinkingLevel: 'LOW',
    costSummary: 'Baixo custo · Alta precisão em ferramentas',
    description:
      'Utiliza Gemini 4 Hydrogen com raciocínio otimizado (LOW) e contexto financeiro compacto. Reduz drasticamente o consumo de tokens e a latência sem perder confiabilidade nas 36 ações autônomas e leitura de comprovantes.',
  },
  ultra_lite: {
    id: 'ultra_lite',
    label: 'Ultra Econômico (Lite)',
    tag: 'Menor Custo',
    modelId: 'gemini-3.1-flash-lite',
    thinkingLevel: 'MINIMAL',
    costSummary: 'Custo mínimo · Resposta instantânea',
    description:
      'Utiliza Gemini 3.1 Flash Lite com raciocínio mínimo. Ideal para lançamentos simples e consultas rápidas com o menor consumo possível.',
  },
  balanced: {
    id: 'balanced',
    label: 'Equilibrado',
    tag: 'Análise Intermediária',
    modelId: 'gemini-4-hydrogen',
    thinkingLevel: 'MEDIUM',
    costSummary: 'Custo moderado · Raciocínio médio',
    description:
      'Utiliza Gemini 4 Hydrogen com raciocínio MEDIUM para análises comparativas mais ricas mantendo economia frente ao nível máximo.',
  },
  deep: {
    id: 'deep',
    label: 'Máxima Profundidade',
    tag: 'Alta Capacidade',
    modelId: 'gemini-4-hydrogen',
    thinkingLevel: 'HIGH',
    costSummary: 'Maior consumo · Auditoria completa',
    description:
      'Utiliza Gemini 4 Hydrogen com raciocínio HIGH para diagnósticos patrimoniais profundos e sequências complexas de múltiplas etapas.',
  },
};

export const AI_PROFILE_LIST: AIProfileConfig[] = [
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
