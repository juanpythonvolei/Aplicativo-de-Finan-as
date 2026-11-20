import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  AssistantControllerCallbacks,
  QUICK_PROMPTS,
  useAssistantChat,
} from '../hooks/useAssistantChat';
import { FormattedAssistantText } from './AssistantMarkdown';

interface AIChatDrawerProps extends AssistantControllerCallbacks {
  open: boolean;
  onClose: () => void;
}

export function AIChatDrawer({ open, onClose, ...callbacks }: AIChatDrawerProps) {
  const chat = useAssistantChat({ ...callbacks, onCloseDrawer: onClose });
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat.messages.length, chat.sending, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <section
        aria-label="Chat rápido com Assistente Financeiro IA"
        className="relative z-10 w-full sm:max-w-[460px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-xl"
      >
        <header className="h-16 px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white truncate">
                {chat.activeConversation?.title || 'Assistente Vértice'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Conversa salva automaticamente no histórico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                callbacks.onNavigate('assistant');
                onClose();
              }}
              title="Abrir painel completo da IA"
              aria-label="Abrir painel completo da IA"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={chat.startNewConversation}
              title="Nova conversa"
              aria-label="Nova conversa"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar assistente"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-4">
          {chat.messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-1.5">
                <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Acesso rápido ao Assistente IA
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Execute qualquer ação enquanto navega nos módulos secundários. Todas as mensagens
                  ficam registradas na aba principal do Assistente IA.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_PROMPTS.slice(0, 4).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => chat.sendMessage(prompt)}
                    className="text-left px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-600 dark:hover:border-teal-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-2 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-teal-700 text-white px-4 py-2.5 text-sm space-y-2">
                    {msg.imagePreview && (
                      <img
                        src={msg.imagePreview}
                        alt="Anexo financeiro"
                        className="max-h-44 rounded-lg object-cover border border-white/20"
                      />
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
                        {msg.actionsSummary.map((act, idx) => (
                          <div
                            key={`${msg.id}-act-${idx}`}
                            className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/40 px-3 py-2 text-xs"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-emerald-900 dark:text-emerald-200">{act}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="rounded-2xl rounded-tl-sm border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-4 py-3">
                      <FormattedAssistantText text={msg.text} />
                    </div>

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
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    chat.resolveConfirmation(msg.id, conf.id, 'cancelled')
                                  }
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
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
              </div>
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

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2.5">
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
                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0"
            >
              <ImagePlus className="w-4 h-4" />
            </button>

            <textarea
              value={chat.input}
              onChange={(e) => chat.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  chat.sendMessage();
                }
              }}
              placeholder="Pergunte algo ou dê um comando..."
              rows={1}
              disabled={chat.sending}
              className="flex-1 min-h-[42px] max-h-28 resize-none rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
            />

            <button
              type="button"
              onClick={() => chat.sendMessage()}
              disabled={chat.sending || (!chat.input.trim() && !chat.attachedImage)}
              aria-label="Enviar mensagem"
              className="p-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
