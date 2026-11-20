import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { auth } from '../firebase';
import {
  AssistantRuntimeContext,
  ExecutedActionRecord,
  GeminiContent,
  GeminiFunctionCall,
  GeminiPart,
  PendingConfirmation,
  buildFinancialSnapshot,
  executeAssistantToolCall,
} from '../lib/assistantExecutor';
import { generateSafeId } from '../lib/formatters';
import {
  AccountFormDraft,
  BudgetFormDraft,
  CategoryFormDraft,
  GoalFormDraft,
  SettingsSection,
  TransactionFormDraft,
  TransactionsFilterDraft,
  ViewTab,
} from '../types/finance';
import type { AIRoutingDecision } from '../../shared/aiProfiles';

export interface AssistantControllerCallbacks {
  onNavigate: (tab: ViewTab) => void;
  onOpenSettings?: (section?: SettingsSection) => void;
  onOpenTransactionForm?: (draft: Omit<TransactionFormDraft, 'nonce'>) => void;
  onOpenAccountForm?: (draft: Omit<AccountFormDraft, 'nonce'>) => void;
  onOpenBudgetForm?: (draft: Omit<BudgetFormDraft, 'nonce'>) => void;
  onOpenGoalForm?: (draft: Omit<GoalFormDraft, 'nonce'>) => void;
  onOpenCategoryForm?: (draft: Omit<CategoryFormDraft, 'nonce'>) => void;
  onApplyTransactionsFilter?: (draft: Omit<TransactionsFilterDraft, 'nonce'>) => void;
  onSetReportsRange?: (monthsCount: 6 | 12) => void;
  onCloseDrawer?: () => void;
}

export interface ChatDisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  imagePreview?: string;
  hasImage?: boolean;
  actionsSummary?: string[];
  modelProfileId?: string;
  routing?: AIRoutingDecision;
  usageTokens?: number;
  latencyMs?: number;
  confirmations?: PendingConfirmation[];
}

export interface AttachedImageState {
  mimeType: string;
  data: string;
  preview: string;
  name: string;
}

export const QUICK_PROMPTS = [
  'Faça um diagnóstico completo do meu mês e aponte onde posso economizar',
  'Efetive todos os lançamentos pendentes de hoje ou anteriores',
  'Pague a fatura em aberto do meu cartão usando a conta com maior saldo',
  'Crie orçamentos equilibrados em lote para minhas categorias de despesa',
  'Lance salário de R$ 6.500 e contas fixas (aluguel R$ 1.800, internet R$ 120) hoje',
  'Altere o tema para modo escuro e abra a tela de downloads',
];

function deriveConversationTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Análise de anexo';
  return cleaned.length > 58 ? `${cleaned.slice(0, 55).trim()}...` : cleaned;
}

function buildGeminiHistoryFromPersisted(
  messages: Array<{ role: 'user' | 'assistant'; text: string }>,
  maxMessages = 14
): GeminiContent[] {
  return messages.slice(-maxMessages).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));
}

export function useAssistantChat(callbacks: AssistantControllerCallbacks) {
  const finance = useFinance();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [statusLabel, setStatusLabel] = useState('Analisando seus dados...');
  const [attachedImage, setAttachedImage] = useState<AttachedImageState | null>(null);
  const [transientError, setTransientError] = useState<string | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const [localConfirmations, setLocalConfirmations] = useState<
    Record<string, PendingConfirmation[]>
  >({});
  const [localRouting, setLocalRouting] = useState<
    Record<string, { routing: AIRoutingDecision; totalTokens?: number; latencyMs?: number }>
  >({});
  const [lastRouting, setLastRouting] = useState<AIRoutingDecision | null>(null);

  const runtimeCtx = useMemo<AssistantRuntimeContext>(
    () => ({
      accounts: finance.accounts,
      categories: finance.categories,
      transactions: finance.transactions,
      budgets: finance.budgets,
      goals: finance.goals,
      selectedMonth: finance.selectedMonth,
      currency: finance.currency,
      theme: finance.theme,
      setSelectedMonth: finance.setSelectedMonth,
      setCurrency: finance.setCurrency,
      toggleTheme: finance.toggleTheme,
      loadSampleData: finance.loadSampleData,
      onNavigate: callbacks.onNavigate,
      createTransaction: finance.createTransaction,
      bulkCreateTransactions: finance.bulkCreateTransactions,
      updateTransaction: finance.updateTransaction,
      bulkUpdateTransactions: finance.bulkUpdateTransactions,
      toggleTransactionStatus: finance.toggleTransactionStatus,
      deleteTransaction: finance.deleteTransaction,
      bulkDeleteTransactions: finance.bulkDeleteTransactions,
      createAccount: finance.createAccount,
      updateAccount: finance.updateAccount,
      deleteAccount: finance.deleteAccount,
      createCategory: finance.createCategory,
      updateCategory: finance.updateCategory,
      deleteCategory: finance.deleteCategory,
      upsertBudget: finance.upsertBudget,
      bulkUpsertBudgets: finance.bulkUpsertBudgets,
      deleteBudget: finance.deleteBudget,
      copyPreviousMonthBudgets: finance.copyPreviousMonthBudgets,
      createGoal: finance.createGoal,
      updateGoal: finance.updateGoal,
      contributeToGoal: finance.contributeToGoal,
      deleteGoal: finance.deleteGoal,
      openTransactionForm: callbacks.onOpenTransactionForm,
      openAccountForm: callbacks.onOpenAccountForm,
      openBudgetForm: callbacks.onOpenBudgetForm,
      openGoalForm: callbacks.onOpenGoalForm,
      openCategoryForm: callbacks.onOpenCategoryForm,
      applyTransactionsFilter: callbacks.onApplyTransactionsFilter,
      setReportsRange: callbacks.onSetReportsRange,
      openSettings: callbacks.onOpenSettings,
      closeAssistantDrawer: callbacks.onCloseDrawer,
    }),
    [finance, callbacks]
  );

  const runtimeCtxRef = useRef(runtimeCtx);
  runtimeCtxRef.current = runtimeCtx;

  const displayMessages = useMemo<ChatDisplayMessage[]>(() => {
    const base: ChatDisplayMessage[] = finance.activeConversationMessages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      hasImage: m.hasImage,
      imagePreview: localPreviews[m.id],
      actionsSummary: m.actionsSummary,
      modelProfileId: m.modelProfileId,
      routing: localRouting[m.id]?.routing,
      usageTokens: localRouting[m.id]?.totalTokens,
      latencyMs: localRouting[m.id]?.latencyMs,
      confirmations: localConfirmations[m.id],
    }));
    if (transientError) {
      base.push({
        id: 'transient_error',
        role: 'error',
        text: transientError,
      });
    }
    return base;
  }, [
    finance.activeConversationMessages,
    localPreviews,
    localConfirmations,
    localRouting,
    transientError,
  ]);

  const handleImagePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) {
        finance.pushToast('error', 'Imagem muito grande. Envie uma imagem de até 6 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const match = result.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          setAttachedImage({
            mimeType: match[1],
            data: match[2],
            preview: result,
            name: file.name,
          });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [finance]
  );

  const startNewConversation = useCallback(() => {
    finance.setActiveConversationId(null);
    setTransientError(null);
    setAttachedImage(null);
    setInput('');
  }, [finance]);

  const selectConversation = useCallback(
    (conversationId: string) => {
      finance.setActiveConversationId(conversationId);
      setTransientError(null);
    },
    [finance]
  );

  const resolveConfirmation = useCallback(
    async (
      messageId: string,
      confirmationId: string,
      decision: 'confirmed' | 'cancelled'
    ) => {
      const list = localConfirmations[messageId] || [];
      const target = list.find((c) => c.id === confirmationId);
      if (!target || target.resolved) return;

      if (decision === 'confirmed') {
        try {
          await target.execute();
        } catch (err) {
          finance.pushToast(
            'error',
            err instanceof Error ? err.message : 'Erro ao executar exclusão.'
          );
        }
      }

      setLocalConfirmations((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] || []).map((c) =>
          c.id === confirmationId ? { ...c, resolved: decision } : c
        ),
      }));
    },
    [localConfirmations, finance]
  );

  const callAssistantApi = async (
    contents: GeminiContent[],
    financialSnapshot: string
  ): Promise<{
    text: string;
    functionCalls: GeminiFunctionCall[];
    modelContent: GeminiContent | null;
    profileId?: string;
    routing?: AIRoutingDecision;
    usage?: {
      promptTokens: number;
      outputTokens: number;
      thinkingTokens: number;
      totalTokens: number;
      latencyMs: number;
    };
  }> => {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents, financialSnapshot }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Erro ao comunicar com o assistente.');
    }
    return data;
  };

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const trimmed = (overrideText ?? input).trim();
      if ((!trimmed && !attachedImage) || sending) return;

      const currentImage = attachedImage;
      const userDisplayText =
        trimmed || 'Analise esta imagem e execute o que for necessário no sistema.';

      setInput('');
      setAttachedImage(null);
      setTransientError(null);
      setSending(true);
      setStatusLabel('Salvando e analisando seus dados...');

      try {
        const existingConvId = finance.activeConversationId;
        const previousPersisted = existingConvId ? finance.activeConversationMessages : [];
        const isFirstMessage = !existingConvId || previousPersisted.length === 0;
        const autoTitle = deriveConversationTitle(userDisplayText);

        let convId = existingConvId;
        if (!convId) {
          convId = await finance.createAIConversation(autoTitle);
        }

        const countAfterUser = previousPersisted.length + 1;
        const userMsgId = await finance.appendAIMessage(convId, {
          role: 'user',
          text: userDisplayText,
          hasImage: Boolean(currentImage),
          autoTitle: isFirstMessage ? autoTitle : undefined,
          nextMessageCount: countAfterUser,
        });

        if (currentImage) {
          setLocalPreviews((prev) => ({ ...prev, [userMsgId]: currentImage.preview }));
        }

        const userParts: GeminiPart[] = [];
        if (currentImage) {
          userParts.push({
            inlineData: {
              mimeType: currentImage.mimeType,
              data: currentImage.data,
            },
          });
        }
        userParts.push({ text: userDisplayText });

        let workingHistory: GeminiContent[] = [
          ...buildGeminiHistoryFromPersisted(previousPersisted, 14),
          { role: 'user', parts: userParts },
        ];

        const collectedActions: ExecutedActionRecord[] = [];
        const collectedConfirmations: PendingConfirmation[] = [];
        let finalText = '';
        let resolvedProfileId = finance.assistantProfileId;
        let stepRouting: AIRoutingDecision | undefined;
        let accumulatedTokens = 0;
        let accumulatedLatency = 0;

        for (let step = 0; step < 8; step++) {
          const snapshot = buildFinancialSnapshot(runtimeCtxRef.current);
          const result = await callAssistantApi(workingHistory, snapshot);
          if (result.profileId) {
            resolvedProfileId = result.profileId as typeof resolvedProfileId;
          }
          if (result.routing) {
            stepRouting = result.routing;
            setLastRouting(result.routing);
          }
          if (result.usage) {
            accumulatedTokens += result.usage.totalTokens || 0;
            accumulatedLatency += result.usage.latencyMs || 0;
          }

          if (result.modelContent) {
            workingHistory = [...workingHistory, result.modelContent];
          }

          const calls = result.functionCalls || [];
          if (calls.length === 0) {
            finalText = result.text || 'Concluído.';
            break;
          }

          setStatusLabel('Executando ações no sistema...');
          const responseParts: GeminiPart[] = [];

          for (const call of calls) {
            const outcome = await executeAssistantToolCall(call, runtimeCtxRef.current);
            if (outcome.executedAction) {
              collectedActions.push(outcome.executedAction);
            }
            if (outcome.pendingConfirmation) {
              collectedConfirmations.push(outcome.pendingConfirmation);
            }
            responseParts.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: outcome.response,
              },
            });
          }

          workingHistory = [...workingHistory, { role: 'user', parts: responseParts }];
          setStatusLabel('Consolidando resposta...');

          if (step === 7 && !finalText) {
            finalText = result.text || 'Ações concluídas no sistema.';
          }
        }

        const actionsSummary = collectedActions.map((act) => `${act.label}: ${act.detail}`);
        const assistantMsgId = await finance.appendAIMessage(convId, {
          role: 'assistant',
          text: finalText || 'Pronto! Operação concluída.',
          actionsSummary,
          modelProfileId: resolvedProfileId,
          nextMessageCount: countAfterUser + 1,
        });

        const resolvedMsgKey = assistantMsgId || generateSafeId('msg');
        if (stepRouting) {
          setLocalRouting((prev) => ({
            ...prev,
            [resolvedMsgKey]: {
              routing: stepRouting!,
              totalTokens: accumulatedTokens,
              latencyMs: accumulatedLatency,
            },
          }));
        }

        if (collectedConfirmations.length > 0) {
          setLocalConfirmations((prev) => ({
            ...prev,
            [resolvedMsgKey]: collectedConfirmations,
          }));
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Não foi possível obter resposta do assistente.';
        setTransientError(message);
      } finally {
        setSending(false);
      }
    },
    [input, attachedImage, sending, finance]
  );

  return {
    conversations: finance.aiConversations,
    activeConversationId: finance.activeConversationId,
    activeConversation:
      finance.aiConversations.find((c) => c.id === finance.activeConversationId) || null,
    messages: displayMessages,
    messagesLoading: finance.messagesLoading,
    input,
    setInput,
    sending,
    statusLabel,
    attachedImage,
    setAttachedImage,
    handleImagePick,
    sendMessage,
    startNewConversation,
    selectConversation,
    renameConversation: finance.renameAIConversation,
    deleteConversation: finance.deleteAIConversation,
    resolveConfirmation,
    lastRouting,
  };
}
