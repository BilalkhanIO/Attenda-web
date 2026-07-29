'use client';
import { useState, useRef, useEffect } from 'react';
import { analyticsApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Sparkles, Send, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message { role: 'user' | 'assistant'; text: string; }

const SUGGESTIONS = ["Who's checked in?", "Pending leaves?", "Late arrivals today?", "Monthly payroll cost?"];

export default function AIChatWidget() {
  const [open, setOpen]       = useState(false);
  const [minimised, setMin]   = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: "Hi! I'm your HR assistant. Ask me about attendance, payroll, leave, or headcount." }
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !minimised) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, minimised]);

  const send = async (text = input) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const { data } = await analyticsApi.chat(msg);
      setMessages(m => [...m, { role: 'assistant', text: data.data?.reply || 'No response.' }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', text: `Error: ${getApiError(err)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMin(false); }}
          className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-400 transition-all hover:scale-110 active:scale-95"
          title="HR Assistant"
        >
          <Sparkles size={20} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className={cn(
          'fixed bottom-5 right-5 z-50 w-80 rounded-2xl border border-white/10 bg-[#0d1420] shadow-2xl flex flex-col transition-all',
          minimised ? 'h-12' : 'h-[440px]'
        )}>
          {/* Header */}
          <div className="h-12 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white">HR Assistant</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setMin(m => !m)} aria-label={minimised ? 'Expand chat' : 'Minimise chat'} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <Minus size={12} />
              </button>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X size={12} />
              </button>
            </div>
          </div>

          {!minimised && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={cn(
                      'max-w-[85%] px-3 py-2 rounded-xl text-[13px] leading-relaxed',
                      m.role === 'user'
                        ? 'bg-emerald-500 text-white rounded-br-sm'
                        : 'bg-white/[0.06] text-slate-300 border border-white/[0.06] rounded-bl-sm'
                    )}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.06] border border-white/[0.06] px-3 py-2 rounded-xl rounded-bl-sm">
                      <div className="flex gap-1">
                        {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Suggestions */}
              <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-[10px] px-2 py-1 rounded-full border border-white/10 text-slate-500 hover:text-white hover:border-white/20 transition-colors">
                    {s}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-white/10 flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Ask anything…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/50 transition-colors"
                />
                <button onClick={() => send()} disabled={loading || !input.trim()} aria-label="Send message"
                  className="w-9 h-9 flex items-center justify-center bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-30 transition-colors shrink-0">
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
