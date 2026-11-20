import type { Content } from '@google/genai';
import {
  AIComplexityLevel,
  AIProfileConfig,
  AIRoutingDecision,
  AccessibleAIModelId,
  ExecutableThinkingLevel,
} from '../shared/aiProfiles.ts';

const COMPLEXITY_LABELS: Record<AIComplexityLevel, string> = {
  simple: 'Simples',
  moderate: 'Moderada',
  complex: 'Complexa',
  critical: 'Crítica / Profunda',
};

const SIMPLE_PATTERNS = [
  /^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|obrigado|valeu)\b/i,
  /\b(mude|alterar?|trocar?)\s+(o\s+)?(tema|modo escuro|modo claro|moeda)\b/i,
  /\b(abrir?|ir para|navegar|mostrar?)\s+(a\s+)?(aba|tela|página|resumo|extrato|contas|metas|downloads)\b/i,
  /\b(qual|quanto)\s+(é|e|está|esta|tenho)\s+(o\s+)?(meu\s+)?(saldo|total)\b/i,
];

const ACTION_MUTATION_PATTERNS = [
  /\b(lan[çc]ar?|registr(e|ar)|adicion(e|ar)|cri(e|ar)|exclu(a|ir)|remov(a|er)|apag(ue|ar)|edit(e|ar)|atualiz(e|ar)|transfer(ir|a)|aport(e|ar)|pag(ue|ar)|efetiv(e|ar)|marc(ar|a))\b/gi,
];

const COMPLEX_ANALYSIS_PATTERNS = [
  /\b(compar(e|ar|ativo)|tend[êe]ncia|evolu[çc][ãa]o|an[áa]lis(e|ar)|categoriz(e|ar)|distribu(i[çc][ãa]o|ir)|or[çc]amentos?\s+equilibrados?|sugir(a|ir)|recomenda[çc][õo]es?|onde\s+cortar|reduzir\s+gastos|fluxo\s+de\s+caixa|fatura|parcelad[oa]|recorrente)\b/gi,
];

const CRITICAL_STRATEGY_PATTERNS = [
  /\b(auditoria|diagn[óo]stico\s+completo|planejamento\s+(anual|estrat[ée]gico|financeiro)|proje[çc][ãa]o|simul(e|ar|a[çc][ãa]o)|otimiz(e|ar)|rebalance(ar|amento)|independ[êe]ncia\s+financeira|aposentadoria|estrat[ée]gia|cen[áa]rios?|plano\s+de\s+a[çc][ãa]o|reestrutur(ar|a[çc][ãa]o)|todos?\s+os?\s+(meses|lan[çc]amentos|or[çc]amentos))\b/gi,
];

function extractLastUserTurnSignals(contents: Content[]): {
  latestText: string;
  hasImage: boolean;
  isToolFollowup: boolean;
  toolResponseCount: number;
  totalTurns: number;
} {
  let latestText = '';
  let hasImage = false;
  let toolResponseCount = 0;

  for (const turn of contents) {
    const parts = Array.isArray(turn.parts) ? turn.parts : [];
    for (const part of parts) {
      if (part && typeof part === 'object' && 'functionResponse' in part && part.functionResponse) {
        toolResponseCount += 1;
      }
    }
  }

  const lastTurn = contents[contents.length - 1];
  const lastParts = Array.isArray(lastTurn?.parts) ? lastTurn.parts : [];
  const isToolFollowup = lastParts.some(
    (p) => p && typeof p === 'object' && 'functionResponse' in p && Boolean(p.functionResponse)
  );

  // Walk backwards to inspect the latest user textual/image message
  for (let i = contents.length - 1; i >= 0; i--) {
    const turn = contents[i];
    if (turn.role !== 'user') continue;
    const parts = Array.isArray(turn.parts) ? turn.parts : [];
    const texts: string[] = [];
    for (const part of parts) {
      if (part && typeof part === 'object') {
        if ('text' in part && typeof part.text === 'string' && part.text.trim()) {
          texts.push(part.text.trim());
        }
        if ('inlineData' in part && part.inlineData) {
          hasImage = true;
        }
      }
    }
    if (texts.length > 0 || hasImage) {
      latestText = texts.join(' ');
      break;
    }
  }

  return {
    latestText,
    hasImage,
    isToolFollowup,
    toolResponseCount,
    totalTurns: contents.length,
  };
}

function countPatternMatches(text: string, patterns: RegExp[]): number {
  let total = 0;
  for (const regex of patterns) {
    const matches = text.match(regex);
    if (matches) total += matches.length;
  }
  return total;
}

export function classifyActionComplexity(contents: Content[]): {
  complexity: AIComplexityLevel;
  score: number;
  reason: string;
} {
  const signals = extractLastUserTurnSignals(contents);
  const text = signals.latestText.trim();
  const wordCount = text ? text.split(/\s+/).length : 0;
  const numberTokens = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).length;
  const lineBreaks = (text.match(/\n/g) ?? []).length;

  const actionMatches = countPatternMatches(text, ACTION_MUTATION_PATTERNS);
  const complexMatches = countPatternMatches(text, COMPLEX_ANALYSIS_PATTERNS);
  const criticalMatches = countPatternMatches(text, CRITICAL_STRATEGY_PATTERNS);
  const matchesSimplePattern = SIMPLE_PATTERNS.some((re) => re.test(text));

  let score = 14;
  const reasons: string[] = [];

  if (signals.hasImage) {
    score += 42;
    reasons.push('leitura multimodal de comprovante');
  }

  if (signals.isToolFollowup) {
    score += Math.min(34, 18 + signals.toolResponseCount * 6);
    reasons.push(`síntese pós-execução (${signals.toolResponseCount} ação(ões))`);
  }

  if (actionMatches === 1) {
    score += 24;
    reasons.push('ação estruturada no sistema');
  } else if (actionMatches >= 2) {
    score += 46;
    reasons.push(`múltiplas ações encadeadas (${actionMatches})`);
  }

  if (complexMatches >= 1) {
    score += Math.min(36, 22 + (complexMatches - 1) * 10);
    reasons.push('análise financeira comparativa');
  }

  if (criticalMatches >= 1) {
    score += Math.min(48, 36 + (criticalMatches - 1) * 10);
    reasons.push('auditoria ou planejamento profundo');
  }

  if (numberTokens >= 3) {
    score += 14;
    reasons.push('alta densidade numérica');
  }

  if (wordCount >= 35 || lineBreaks >= 3) {
    score += 18;
    reasons.push('pedido extenso/estruturado');
  } else if (wordCount >= 18) {
    score += 8;
  }

  if (signals.totalTurns >= 10) {
    score += 10;
    reasons.push('contexto longo');
  }

  if (
    matchesSimplePattern &&
    !signals.hasImage &&
    !signals.isToolFollowup &&
    actionMatches === 0 &&
    complexMatches === 0 &&
    criticalMatches === 0 &&
    wordCount <= 14
  ) {
    score = Math.min(score, 18);
    reasons.length = 0;
    reasons.push('consulta rápida ou comando direto');
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  let complexity: AIComplexityLevel;
  if (clampedScore <= 27) {
    complexity = 'simple';
  } else if (clampedScore <= 56) {
    complexity = 'moderate';
  } else if (clampedScore <= 81) {
    complexity = 'complex';
  } else {
    complexity = 'critical';
  }

  const reasonText =
    reasons.length > 0
      ? reasons.slice(0, 2).join(' + ')
      : complexity === 'simple'
      ? 'consulta objetiva de baixa complexidade'
      : 'processamento financeiro contextual';

  return {
    complexity,
    score: clampedScore,
    reason: reasonText,
  };
}

export function resolveExecutionPlan(
  profile: AIProfileConfig,
  contents: Content[]
): AIRoutingDecision {
  const analysis = classifyActionComplexity(contents);

  if (profile.id === 'auto_dynamic' || profile.modelId === 'auto') {
    let selectedModel: AccessibleAIModelId;
    let selectedThinkingLevel: ExecutableThinkingLevel;

    switch (analysis.complexity) {
      case 'simple':
        selectedModel = 'gemini-3.1-flash-lite';
        selectedThinkingLevel = 'MINIMAL';
        break;
      case 'moderate':
        selectedModel = 'gemini-4-hydrogen';
        selectedThinkingLevel = 'LOW';
        break;
      case 'complex':
        selectedModel = 'gemini-4-hydrogen';
        selectedThinkingLevel = 'MEDIUM';
        break;
      case 'critical':
        selectedModel = 'gemini-4-hydrogen';
        selectedThinkingLevel = 'HIGH';
        break;
    }

    return {
      complexity: analysis.complexity,
      complexityLabel: COMPLEXITY_LABELS[analysis.complexity],
      score: analysis.score,
      selectedModel,
      selectedThinkingLevel,
      reason: analysis.reason,
      isDynamic: true,
    };
  }

  const fixedModel: AccessibleAIModelId =
    profile.modelId === 'gemini-3.1-flash-lite'
      ? 'gemini-3.1-flash-lite'
      : 'gemini-4-hydrogen';

  const fixedThinking: ExecutableThinkingLevel =
    profile.thinkingLevel === 'DYNAMIC' ? 'LOW' : profile.thinkingLevel;

  return {
    complexity: analysis.complexity,
    complexityLabel: COMPLEXITY_LABELS[analysis.complexity],
    score: analysis.score,
    selectedModel: fixedModel,
    selectedThinkingLevel: fixedThinking,
    reason: `Perfil manual (${profile.label}) · complexidade detectada: ${COMPLEXITY_LABELS[analysis.complexity]}`,
    isDynamic: false,
  };
}
