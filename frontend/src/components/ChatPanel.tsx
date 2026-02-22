// frontend/src/components/ChatPanel.tsx
// Slide-in chat panel — Q&A about completed analysis with streaming responses
// Floating rounded panel with backdrop, matching ModelPanel/FilesPanel style
// Related: api.ts (streamChat, getChatHistory), ResultsPanel.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, MessageSquare, User, RotateCcw } from 'lucide-react';
import { FoxBrain } from './FoxIcons';
import { streamChat, getChatHistory, type ChatMessage } from '../lib/api';
import { SUGGESTIONS } from '../lib/chatConfig';
import Tooltip from './Tooltip';
import { clsx } from 'clsx';

interface Props {
  analysisId: string;
  open: boolean;
  onClose: () => void;
}

export default function ChatPanel({ analysisId, open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentChunks, setCurrentChunks] = useState('');
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Animate open/close matching ModelPanel pattern
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Smooth close handler
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setMessages(await getChatHistory(analysisId));
      } catch { /* ignore */ }
    })();
  }, [analysisId, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, currentChunks]);

  const handleSend = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || streaming) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q, timestamp: new Date().toISOString() }]);
    setStreaming(true);
    setCurrentChunks('');

    try {
      let full = '';
      for await (const chunk of streamChat(analysisId, q)) {
        full += chunk;
        setCurrentChunks(full);
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: full, timestamp: new Date().toISOString() },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `\u274c Klaida: ${e.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setStreaming(false);
      setCurrentChunks('');
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={clsx(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          animating ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={clsx(
          "relative w-full max-w-md flex flex-col shadow-2xl",
          "bg-surface-950 border border-surface-700/60",
          "my-2 mr-2 rounded-[10px] overflow-hidden",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          animating
            ? "translate-x-0 opacity-100"
            : "translate-x-[105%] opacity-0"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="AI Asistentas"
      >

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-surface-700/50 bg-surface-950/80 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-brand-400" />
            <h2 className="text-[14px] font-bold text-white uppercase tracking-wider">
              AI Agentas
            </h2>
          </div>
          <Tooltip content="Uždaryti pokalbį" side="bottom">
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-400 hover:text-surface-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* ── Messages ──────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Empty state */}
          {messages.length === 0 && !streaming && (
            <div className="text-center py-10 animate-fade-in">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-surface-800 flex items-center justify-center border border-surface-700/50">
                <FoxBrain className="w-5 h-5 text-brand-400" />
              </div>
              <p className="text-[14px] font-semibold text-surface-300 mb-1">AI Asistentas</p>
              <p className="text-[12px] text-surface-500 mb-6">
                Klauskite bet ką apie pirkimo dokumentus
              </p>
              <div className="space-y-2">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="block w-full text-left text-[12px] px-3.5 py-2.5 rounded-xl
                           bg-surface-800/30 border border-surface-700/50
                           text-surface-400 hover:text-surface-200 hover:bg-surface-800/50
                           hover:border-surface-600/60 transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => {
            const isError = msg.role === 'assistant' && msg.content.startsWith('\u274c');
            return (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-brand-500/12 flex items-center justify-center flex-shrink-0 mt-1">
                    <FoxBrain className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5 max-w-[85%]">
                  <div
                    className={`px-4 py-3 rounded-xl text-[13px] leading-relaxed ${msg.role === 'user'
                      ? 'bg-brand-500/10 text-white border border-brand-500/20'
                      : isError
                        ? 'bg-red-500/8 text-red-300 border border-red-500/15'
                        : 'bg-surface-800/60 text-surface-200 border border-surface-700/50'
                      }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {isError && i > 0 && (
                    <button
                      onClick={() => {
                        const lastUserMsg = messages.slice(0, i).reverse().find((m) => m.role === 'user');
                        if (lastUserMsg) {
                          setMessages((prev) => prev.filter((_, idx) => idx !== i));
                          handleSend(lastUserMsg.content);
                        }
                      }}
                      className="self-start flex items-center gap-1.5 text-[11px] text-surface-500 hover:text-brand-400 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Bandyti dar kartą
                    </button>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-brand-500/5 flex items-center justify-center flex-shrink-0 mt-1 border border-brand-500/10">
                    <User className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Streaming bubble */}
          {streaming && currentChunks && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-brand-500/12 flex items-center justify-center flex-shrink-0 mt-1">
                <FoxBrain className="w-3.5 h-3.5 text-brand-400" />
              </div>
              <div className="max-w-[85%] px-4 py-3 rounded-xl bg-surface-800/60 text-[13px] text-surface-200 border border-surface-700/50">
                <p className="whitespace-pre-wrap">{currentChunks}</p>
                <span className="inline-block w-[2px] h-4 bg-brand-400 animate-pulse ml-1 align-text-bottom" />
              </div>
            </div>
          )}

          {/* Loading dot */}
          {streaming && !currentChunks && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-brand-500/12 flex items-center justify-center flex-shrink-0">
                <FoxBrain className="w-3.5 h-3.5 text-brand-400" />
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-800/40 border border-surface-700/30">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400/60 animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400/60 animate-pulse" style={{ animationDelay: '200ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400/60 animate-pulse" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Input ─────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-surface-700/50 flex-shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Rašykite klausimą..."
              className="input-field flex-1 text-[13px]"
              disabled={streaming}
            />
            <Tooltip content="Siųsti žinutę" side="top">
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || streaming}
                className="btn-professional px-3"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
