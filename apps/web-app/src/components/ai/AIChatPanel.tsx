/**
 * AI Chat Panel Component
 *
 * Reusable chat panel that works with any of the three AI agents:
 * ORION (direction / strategic), SARA (assistant / support), ATLAS (pedagogy).
 *
 * Uses the unified AI Gateway API client for requests.
 * Follows the codebase patterns: shadcn/ui Card, Button, Input, Badge;
 * lucide-react icons; cn() utility for class merging.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { aiGatewayApi, type AIAgent, type AIChatResponse } from '@/lib/api/ai-gateway';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  Bot,
  GraduationCap,
  Send,
  Loader2,
  Wrench,
  AlertTriangle,
  Sparkles,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

interface AgentConfig {
  label: string;
  description: string;
  icon: typeof Shield;
  headerBg: string;
  headerText: string;
  accentColor: string;
  botBubbleBg: string;
  botBubbleBorder: string;
  botBubbleText: string;
  userBubbleBg: string;
  userBubbleText: string;
  dotColor: string;
  placeholder: string;
}

const AGENT_CONFIGS: Record<AIAgent, AgentConfig> = {
  ORION: {
    label: 'ORION',
    description: 'Assistant de direction — analyse stratégique, scores et vigilance',
    icon: Shield,
    headerBg: 'bg-slate-900',
    headerText: 'text-white',
    accentColor: 'text-amber-500',
    botBubbleBg: 'bg-slate-50',
    botBubbleBorder: 'border-slate-200',
    botBubbleText: 'text-slate-800',
    userBubbleBg: 'bg-slate-700',
    userBubbleText: 'text-white',
    dotColor: 'bg-amber-400',
    placeholder: 'Posez une question stratégique à ORION…',
  },
  SARA: {
    label: 'SARA',
    description: 'Assistance intelligente — support opérationnel et aide contextuelle',
    icon: Bot,
    headerBg: 'bg-emerald-700',
    headerText: 'text-white',
    accentColor: 'text-emerald-500',
    botBubbleBg: 'bg-emerald-50',
    botBubbleBorder: 'border-emerald-200',
    botBubbleText: 'text-emerald-900',
    userBubbleBg: 'bg-emerald-600',
    userBubbleText: 'text-white',
    dotColor: 'bg-emerald-400',
    placeholder: 'Demandez de l\u2019aide à SARA…',
  },
  ATLAS: {
    label: 'ATLAS',
    description: 'Intelligence pédagogique — analyse de cours, recommandations, soutien enseignant',
    icon: GraduationCap,
    headerBg: 'bg-violet-700',
    headerText: 'text-white',
    accentColor: 'text-violet-500',
    botBubbleBg: 'bg-violet-50',
    botBubbleBorder: 'border-violet-200',
    botBubbleText: 'text-violet-900',
    userBubbleBg: 'bg-violet-600',
    userBubbleText: 'text-white',
    dotColor: 'bg-violet-400',
    placeholder: 'Posez une question pédagogique à ATLAS…',
  },
};

// ---------------------------------------------------------------------------
// Internal message type (unifies user + assistant messages)
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: Array<{ toolName: string; executionMs: number }>;
  suggestedActions?: Array<{
    type: string;
    label: string;
    description: string;
    requiresConfirmation: boolean;
  }>;
  confidence?: number;
  isPlaceholder?: boolean;
  executionMs?: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AIChatPanelProps {
  /** Which AI agent this panel is connected to */
  agent: AIAgent;
  /** Optional class name for the outer container */
  className?: string;
  /** Optional initial session ID to resume a conversation */
  initialSessionId?: string;
  /** Callback when a suggested action is clicked */
  onSuggestedAction?: (action: { type: string; label: string; description: string }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIChatPanel({
  agent,
  className,
  initialSessionId,
  onSuggestedAction,
}: AIChatPanelProps) {
  const config = AGENT_CONFIGS[agent];
  const AgentIcon = config.icon;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // -----------------------------------------------------------------------
  // Send message
  // -----------------------------------------------------------------------

  const handleSend = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed || isLoading) return;

      // Add user message optimistically
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setIsLoading(true);
      setError(null);

      try {
        const response: AIChatResponse = await aiGatewayApi.chat({
          agent,
          message: trimmed,
          sessionId,
        });

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          toolsUsed: response.toolsUsed,
          suggestedActions: response.suggestedActions,
          confidence: response.confidence,
          isPlaceholder: response.isPlaceholder,
          executionMs: response.executionMs,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (response.sessionId) {
          setSessionId(response.sessionId);
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Une erreur est survenue. Veuillez réessayer.';
        setError(msg);

        // Add error as assistant message for visibility
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ ${msg}`,
            timestamp: new Date(),
            isPlaceholder: true,
          },
        ]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [inputValue, isLoading, agent, sessionId],
  );

  // -----------------------------------------------------------------------
  // Suggested action click
  // -----------------------------------------------------------------------

  const handleSuggestedAction = useCallback(
    (action: { type: string; label: string; description: string; requiresConfirmation: boolean }) => {
      onSuggestedAction?.(action);
      // Also pre-fill the input with the action label so the user can send it
      setInputValue(action.label);
    },
    [onSuggestedAction],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      {/* ---- Header ---- */}
      <CardHeader className={cn('flex-shrink-0', config.headerBg, config.headerText)}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
            <AgentIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold tracking-wide">
              {config.label}
            </CardTitle>
            <p className="text-xs opacity-80 truncate mt-0.5">{config.description}</p>
          </div>
          {sessionId && (
            <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-white/30">
              Session active
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* ---- Messages area ---- */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-96 sm:h-[28rem] lg:h-[34rem] overflow-y-auto p-4 space-y-4 bg-gray-50/50"
        >
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className={cn('w-16 h-16 rounded-full flex items-center justify-center mb-4', config.headerBg)}>
                <AgentIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Bonjour, je suis {config.label}
              </h3>
              <p className="text-gray-500 max-w-md mt-2 text-sm leading-relaxed">
                {config.description}. Posez-moi une question et je vous répondrai avec précision.
              </p>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm',
                  msg.role === 'user'
                    ? cn(config.userBubbleBg, config.userBubbleText, 'rounded-tr-none')
                    : cn(config.botBubbleBg, 'border', config.botBubbleBorder, config.botBubbleText, 'rounded-tl-none'),
                )}
              >
                {/* Content */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                {/* Tool usage indicators */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Wrench className="w-3.5 h-3.5 opacity-60" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                        Outils utilisés
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.toolsUsed.map((tool, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-[10px] flex items-center gap-1"
                        >
                          <Zap className="w-2.5 h-2.5" />
                          {tool.toolName}
                          <span className="opacity-50">({tool.executionMs}ms)</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence indicator */}
                {msg.confidence !== undefined && msg.role === 'assistant' && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                        Confiance
                      </span>
                      <span className="text-[10px] font-bold opacity-70">
                        {Math.round(msg.confidence * 100)}%
                      </span>
                    </div>
                    <Progress
                      value={msg.confidence * 100}
                      size="sm"
                      variant={
                        msg.confidence >= 0.8
                          ? 'success'
                          : msg.confidence >= 0.5
                            ? 'warning'
                            : 'error'
                      }
                    />
                  </div>
                )}

                {/* Suggested actions */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 opacity-60" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
                        Actions suggérées
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.suggestedActions.map((action, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSuggestedAction(action)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                            'border transition-colors cursor-pointer',
                            'hover:bg-white/80',
                            config.botBubbleBorder,
                            config.botBubbleText,
                          )}
                        >
                          {action.label}
                          {action.requiresConfirmation && (
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execution time & placeholder indicator */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] opacity-50">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[10px] opacity-50 flex items-center gap-1">
                    {msg.executionMs !== undefined && `${msg.executionMs}ms`}
                    {msg.isPlaceholder && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        Placeholder
                      </Badge>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className={cn(
                  'rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2',
                  config.botBubbleBg,
                  'border',
                  config.botBubbleBorder,
                )}
              >
                <div className="flex gap-1">
                  <span
                    className={cn('w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s]', config.dotColor)}
                  />
                  <span
                    className={cn('w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s]', config.dotColor)}
                  />
                  <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', config.dotColor)} />
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  {config.label} réfléchit…
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* ---- Input area ---- */}
      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSend} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={config.placeholder}
            className={cn(
              'w-full bg-gray-100 border-none rounded-full py-3 pl-5 pr-12 text-sm',
              'focus:ring-2 focus:ring-offset-0 transition-all outline-none',
              agent === 'ORION' && 'focus:ring-slate-400',
              agent === 'SARA' && 'focus:ring-emerald-400',
              agent === 'ATLAS' && 'focus:ring-violet-400',
            )}
            disabled={isLoading}
          />
          <Button
            type="submit"
            variant="default"
            size="icon-sm"
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 rounded-full',
              agent === 'ORION' && 'bg-slate-700 hover:bg-slate-800',
              agent === 'SARA' && 'bg-emerald-600 hover:bg-emerald-700',
              agent === 'ATLAS' && 'bg-violet-600 hover:bg-violet-700',
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-center text-gray-400 mt-2">
          {config.label} peut faire des erreurs. Vérifiez les informations importantes.
        </p>
      </div>
    </Card>
  );
}
