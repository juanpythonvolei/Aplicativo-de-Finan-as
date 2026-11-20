import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  History,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import {
  AssistantControllerCallbacks,
  QUICK_PROMPTS,
  useAssistantChat,
} from '../hooks/useAssistantChat';
import { formatCurrency } from '../lib/formatters';
import { resolveAIProfile } from '../../shared/aiProfiles';
import { FormattedAssistantText } from './AssistantMarkdown';
import { DepthCard } from './DepthCard';

function formatConversationTimestamp(ts: { toDate?: () => Date } | null): string {
  if (!ts?.toDate) return 'Agora';
  const d = ts.toDate();
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function AssistantMainView(props: AssistantControllerCallbacks) {
  const { accounts, transactions, selectedMonth, currency, assistantProfileId } = useFinance();
  const activeProfile = useMemo(() => resolveAIProfile(assistantProfileId), [assistantProfileId]);
  const chat = useAssistantChat(props);

  const [historyOpenMobile, setHistoryOpenMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compact top financial strip metrics
  const summary = useMemo(() => {
    const activeAccounts = accounts.filter((a) => !a.archived);
    const consolidated = activeAccounts.reduce((s, a) => s + a.balance, 0);
    let monthIncome = 0;
    let monthExpense = 0;
    let pendingCount = 0;

    for (const tx of transactions) {
      if (tx.status === 'pending') pendingCount++;
      if (!tx.date.startsWith(selectedMonth)) continue;
      if (tx.type === 'income') monthIncome += tx.amount;
      if (tx.type === 'expense') monthExpense += tx.amount;
    }

    return { consolidated, monthIncome, monthExpense, pendingCount };
  }, [accounts, transactions, selectedMonth]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chat.conversations;
    return chat.conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)
    );
  }, [chat.conversations, searchQuery]);

  // Smooth auto-scroll on new messages
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages.length, chat.sending]);

  // Desktop keyboard ergonomics (Ctrl+K new chat, Ctrl+/ focus composer, Esc close mobile history)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        chat.startNewConversation();
        textareaRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        textareaRef.current?.focus();
      } else if (e.key === 'Escape') {
        setHistoryOpenMobile(false);
        setEditingId(null);
        setConfirmDeleteId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chat.startNewConversation]);

  const handleRenameSubmit = async (convId: string) => {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    await chat.renameConversation(convId, trimmed);
  };

  const historySidebarContent = (
    <div className="h-full flex flex-col bg-slate-50/70 dark:bg-slate-950/60 border-r border-slate-200 dark:border-slate-800 w-[272px]">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              chat.startNewConversation();
              setHistoryOpenMobile(false);
              textareaRef.current?.focus();
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <MessageSquarePlus className="w-4 h-4 shrink-0" />
            <span>Nova conversa</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryOpenMobile(false)}
            aria-label="Fechar histórico"
            className="md:hidden p-2 min-h-[40px] min-w-[40px] rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversas..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="px-3 py-8 text-center space-y-1.5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {searchQuery ? 'Nenhuma conversa encontrada' : 'Histórico vazio'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
              {searchQuery
                ? 'Tente outro termo de busca.'
                : 'Suas conversas com a IA serão salvas automaticamente aqui.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === chat.activeConversationId;
            const isEditing = editingId === conv.id;
            const isConfirmingDelete = confirmDeleteId === conv.id;

            return (
              <div
                key={conv.id}
                className={`group rounded-lg border transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 border-teal-600/50 dark:border-teal-500/50'
                    : 'border-transparent hover:bg-white/80 dark:hover:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-800'
                }`}
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRenameSubmit(conv.id);
                    }}
                    className="p-2 flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      maxLength={120}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-teal-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Salvar título"
                      className="p-1.5 rounded bg-teal-700 text-white"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancelar"
                      className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : isConfirmingDelete ? (
                  <div className="p-2.5 space-y-2">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug">
                      Excluir esta conversa permanentemente?
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          setConfirmDeleteId(null);
                          await chat.deleteConversation(conv.id);
                        }}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-red-600 hover:bg-red-700 text-white"
                      >
                        Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1 p-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        chat.selectConversation(conv.id);
                        setHistoryOpenMobile(false);
                      }}
                      className="flex-1 min-w-0 text-left space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isActive
                              ? 'text-teal-800 dark:text-teal-300'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {conv.title}
                        </p>
                        <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                          {formatConversationTimestamp(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {conv.preview || `${conv.messageCount} mensagem(ns)`}
                      </p>
                    </button>

                    <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(conv.id);
                          setEditingTitle(conv.title);
                        }}
                        title="Renomear conversa"
                        aria-label="Renomear conversa"
                        className="p-1.5 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(conv.id)}
                        title="Excluir conversa"
                        aria-label="Excluir conversa"
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>{chat.conversations.length} conversa(s)</span>
        <span className="hidden sm:inline font-mono">Ctrl+K</span>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-4rem)] flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      {/* Compact Financial Summary Strip */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-5 sm:gap-7 min-w-0 shrink-0">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Saldo Consolidado
            </p>
            <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
              {formatCurrency(summary.consolidated, currency)}
            </p>
          </div>

          <div className="h-7 w-px bg-slate-200 dark:bg-slate-800 shrink-0" aria-hidden="true" />

          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Receitas ({selectedMonth})
            </p>
            <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
              +{formatCurrency(summary.monthIncome, currency)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Despesas ({selectedMonth})
            </p>
            <p className="font-mono text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums whitespace-nowrap">
              -{formatCurrency(summary.monthExpense, currency)}
            </p>
          </div>

          {summary.pendingCount > 0 && (
            <button
              type="button"
              onClick={() => props.onNavigate('transactions')}
              className="hidden sm:block text-left hover:underline"
            >
              <p className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
                Pendências
              </p>
              <p className="font-mono text-sm font-semibold text-amber-800 dark:text-amber-300 tabular-nums whitespace-nowrap">
                {summary.pendingCount} item(ns)
              </p>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => props.onNavigate('dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap shrink-0"
        >
          <span>Visão Geral</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Split Body: History Left + Central Chat Canvas */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Desktop History Sidebar */}
        <aside className="hidden md:block shrink-0 h-full">{historySidebarContent}</aside>

        {/* Mobile History Drawer */}
        {historyOpenMobile && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/50"
              onClick={() => setHistoryOpenMobile(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 h-full">{historySidebarContent}</div>
          </div>
        )}

        {/* Central Chat Area */}
        <section className="flex-1 min-w-0 flex flex-col h-full">
          {/* Sub-header for Mobile History Trigger + Active Conversation Title */}
          <div className="px-4 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setHistoryOpenMobile(true)}
                aria-label="Abrir histórico de conversas"
                className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <History className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>Histórico</span>
              </button>

              <div className="w-8 h-8 rounded-lg bg-teal-700 text-white hidden sm:flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>

              <div className="min-w-0">
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {chat.activeConversation?.title || 'Nova conversa com o Assistente Vértice'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {chat.lastRouting
                    ? `${chat.lastRouting.selectedModel} · ${chat.lastRouting.complexityLabel} · ${chat.lastRouting.reason}`
                    : `${activeProfile.label} · Conversas sincronizadas em todos os dispositivos`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {props.onOpenSettings && (
                <button
                  type="button"
                  onClick={() => props.onOpenSettings?.('usage')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-teal-600 dark:hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-400 transition-colors whitespace-nowrap"
                >
                  <Activity className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span className="hidden sm:inline">Uso de API</span>
                  <span className="sm:hidden">API</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  chat.startNewConversation();
                  textareaRef.current?.focus();
                }}
                title="Iniciar nova conversa (Ctrl+K)"
                className="md:hidden inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] rounded-lg bg-teal-700 text-white text-xs font-medium shrink-0"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>Nova</span>
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6">
            <div className="max-w-3xl mx-auto space-y-5">
              {chat.messagesLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-700 dark:text-teal-400" />
                  <span>Carregando histórico da conversa...</span>
                </div>
              ) : chat.messages.length === 0 ? (
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      O que vamos resolver nas suas finanças hoje?
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                      Comande todo o sistema diretamente por aqui — sem precisar operar menus. Posso
                      lançar ou editar transações em lote, conciliar saldos, pagar faturas de cartão,
                      estruturar orçamentos e metas, alterar moeda ou tema, analisar comprovantes por
                      foto e gerar relatórios.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Comandos rápidos
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {QUICK_PROMPTS.map((prompt, idx) => (
                        <DepthCard
                          key={prompt}
                          delay={idx * 0.04}
                          tiltStrength={3}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 hover:border-teal-600 dark:hover:border-teal-500"
                        >
                          <button
                            type="button"
                            onClick={() => chat.sendMessage(prompt)}
                            disabled={chat.sending}
                            className="w-full h-full text-left px-4 py-3.5 min-h-[54px] text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed transition-colors"
                          >
                            {prompt}
                          </button>
                        </DepthCard>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                chat.messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex flex-col gap-2 ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-br-sm bg-teal-700 text-white px-4 py-3 text-sm space-y-2 shadow-sm">
                        {msg.imagePreview && (
                          <img
                            src={msg.imagePreview}
                            alt="Comprovante enviado"
                            className="max-h-52 rounded-lg object-cover border border-white/20"
                          />
                        )}
                        {!msg.imagePreview && msg.hasImage && (
                          <p className="text-xs text-teal-100/90 font-mono">
                            [Imagem anexada nesta mensagem]
                          </p>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      </div>
                    ) : msg.role === 'error' ? (
                      <div className="w-full rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-4 py-3 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{msg.text}</span>
                      </div>
                    ) : (
                      <div className="w-full space-y-2.5">
                        {msg.actionsSummary && msg.actionsSummary.length > 0 && (
                          <div className="space-y-1.5">
                            {msg.actionsSummary.map((summaryItem, idx) => (
                              <div
                                key={`${msg.id}-act-${idx}`}
                                className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/40 px-3 py-2 text-xs"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                                <span className="text-emerald-900 dark:text-emerald-200 leading-relaxed">
                                  {summaryItem}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="rounded-2xl rounded-tl-sm border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-4 py-3.5 depth-panel">
                          <FormattedAssistantText text={msg.text} />
                        </div>

                        {msg.routing && (
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 px-1 tabular-nums leading-relaxed">
                            {msg.routing.isDynamic ? 'Roteamento autônomo' : 'Perfil fixo'} ·{' '}
                            {msg.routing.selectedModel} ({msg.routing.selectedThinkingLevel}) ·
                            Complexidade {msg.routing.complexityLabel} ({msg.routing.score}/100)
                            {msg.usageTokens
                              ? ` · ${msg.usageTokens.toLocaleString('pt-BR')} tokens`
                              : ''}
                            {msg.latencyMs ? ` · ${msg.latencyMs} ms` : ''}
                          </p>
                        )}

                        {msg.confirmations && msg.confirmations.length > 0 && (
                          <div className="space-y-2">
                            {msg.confirmations.map((conf) => (
                              <div
                                key={conf.id}
                                className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/40 p-3.5 space-y-2.5"
                              >
                                <div className="flex items-start gap-2.5">
                                  <Trash2 className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                                      {conf.title}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                      {conf.detail}
                                    </p>
                                  </div>
                                </div>

                                {conf.resolved ? (
                                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    {conf.resolved === 'confirmed'
                                      ? 'Exclusão executada.'
                                      : 'Exclusão cancelada.'}
                                  </p>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        chat.resolveConfirmation(msg.id, conf.id, 'confirmed')
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Confirmar exclusão
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        chat.resolveConfirmation(msg.id, conf.id, 'cancelled')
                                      }
                                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))
              )}

              {chat.sending && (
                <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-700 dark:text-teal-400" />
                  <span>{chat.statusLabel}</span>
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>
          </div>

          {/* Sticky Bottom Composer */}
          <div className="px-4 sm:px-6 lg:px-10 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="max-w-3xl mx-auto space-y-2.5">
              {chat.attachedImage && (
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={chat.attachedImage.preview}
                      alt={chat.attachedImage.name}
                      className="w-9 h-9 rounded object-cover shrink-0"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
                      {chat.attachedImage.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => chat.setAttachedImage(null)}
                    aria-label="Remover anexo"
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={chat.handleImagePick}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={chat.sending}
                  title="Anexar nota fiscal, comprovante ou fatura"
                  aria-label="Anexar imagem"
                  className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0 flex items-center justify-center"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={chat.input}
                  onChange={(e) => chat.setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      chat.sendMessage();
                    }
                  }}
                  placeholder="Explique o que precisa fazer ou analisar... (Enter para enviar)"
                  rows={1}
                  disabled={chat.sending}
                  className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
                />

                <button
                  type="button"
                  onClick={() => chat.sendMessage()}
                  disabled={chat.sending || (!chat.input.trim() && !chat.attachedImage)}
                  aria-label="Enviar mensagem"
                  className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white transition-colors shrink-0 flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
