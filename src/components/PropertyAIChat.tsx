import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Bot, ChevronDown, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from '@/context/hooks';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function PropertyAIChat() {
  const { path } = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I’m the HighPark property assistant. Ask me about properties, land, rentals, sales, short stays, availability, location, pricing or how to enquire.' },
  ]);

  const propertyId = useMemo(() => path.startsWith('/property/') ? path.split('/property/')[1].split('?')[0] : null, [path]);

  useEffect(() => {
    if (!propertyId) return;
    setMessages([{ role: 'assistant', content: 'I’m looking at this property with you. Ask me about its details, pricing, land information, available spaces, sale/lease terms or how to enquire.' }]);
  }, [propertyId]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || sending) return;
    const next = [...messages, { role: 'user' as const, content: question }];
    setMessages(next);
    setInput('');
    setSending(true);
    const { data, error } = await supabase.functions.invoke('property-ai-chat', {
      body: { property_id: propertyId, question, history: next.slice(-10) },
    });
    setSending(false);
    if (error || !data?.answer) {
      setMessages((current) => [...current, { role: 'assistant', content: 'I’m temporarily unavailable. Please use the Contact Agent / Enquire option and our team will help you.' }]);
      return;
    }
    setMessages((current) => [...current, { role: 'assistant', content: String(data.answer) }]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[80] sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[min(620px,75vh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="brand-gradient flex items-center justify-between px-5 py-4 text-white">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15"><Bot className="h-5 w-5" /></div><div><p className="text-sm font-bold">HighPark AI Assistant</p><p className="text-[11px] text-white/75">Property questions · 24/7</p></div></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close AI assistant"><X className="h-4 w-4" /></button>
          </div>
          {propertyId && <div className="flex items-center gap-2 border-b border-brand-100 bg-brand-50 px-5 py-2.5 text-xs font-semibold text-brand-800"><Sparkles className="h-3.5 w-3.5" /> Property-aware conversation</div>}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-ink-50/60 p-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md border border-ink-100 bg-white text-ink-700 shadow-sm'}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {sending && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-ink-100 bg-white px-4 py-3 text-sm text-ink-500 shadow-sm"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" /><span className="h-2 w-2 animate-pulse rounded-full bg-brand-500 [animation-delay:120ms]" /><span className="h-2 w-2 animate-pulse rounded-full bg-brand-500 [animation-delay:240ms]" /> Thinking…</span></div></div>}
          </div>
          <form onSubmit={send} className="border-t border-ink-100 bg-white p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-ink-50 p-2 focus-within:border-brand-400 focus-within:bg-white">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} placeholder="Ask about this property…" className="min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm outline-none" />
              <button disabled={!input.trim() || sending} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-700 text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><Send className="h-4 w-4" /></button>
            </div>
            <p className="px-2 pt-2 text-[10px] text-ink-400">AI answers are informational. Confirm prices, availability and legal terms with HighPark Consult.</p>
          </form>
        </div>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className="group flex items-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-brand-800" aria-expanded={open} aria-label="Open HighPark AI Assistant">
        {open ? <ChevronDown className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}<span className="hidden sm:inline">Ask HighPark AI</span>
      </button>
    </div>
  );
}
