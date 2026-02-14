// frontend/src/components/ChatPanel.tsx
// Slide-in chat panel — Q&A about completed analysis with streaming responses
// Fixed right panel with message history, suggested questions, and input
// Related: api.ts (streamChat, getChatHistory), ResultsView.tsx

import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, MessageSquare, Bot, User, Cpu, RotateCcw } from 'lucide-react';
import { streamChat, getChatHistory, type ChatMessage } from '../lib/api';
import { SUGGESTIONS } from '../lib/chatConfig';

interface Props {
  analysisId: string;
  onClose: () => void;
}

export default function ChatPanel({ analysisId, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentChunks, setCurrentChunks] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        setMessages(await getChatHistory(analysisId));
      } catch { /* ignore */ }
    })();
  }, [analysisId]);

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

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md z-50 flex flex-col
                    bg-surface-950/98 backdrop-blur-3xl border-l border-surface-700/50
                    shadow-[-12px_0_60px_rgba(0,0,0,0.5)] animate-slide-in-right">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-surface-700/50 flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-accent-400" />
        <span className="text-[14px] font-bold text-surface-100 flex-1 tracking-tight">
          AI Agentas
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-surface-700/40 text-surface-500 hover:text-surface-300 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Messages ──────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {/* Empty state */}
        {messages.length === 0 && !streaming && (
          <div className="text-center py-10 animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-surface-800 flex items-center justify-center border border-surface-700/50">
              <Cpu className="w-5 h-5 text-brand-400" />
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
                  <Bot className="w-3 h-3 text-brand-400" />
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
                  <User className="w-3 h-3 text-brand-400" />
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming bubble */}
        {streaming && currentChunks && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-brand-500/12 flex items-center justify-center flex-shrink-0 mt-1">
              <Bot className="w-3 h-3 text-brand-400" />
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
              <Bot className="w-3 h-3 text-brand-400" />
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
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || streaming}
            className="btn-professional px-3"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
