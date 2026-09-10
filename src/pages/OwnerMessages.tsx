import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCheck, MessageSquare, RefreshCw, Send, UserRound } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ownerNav } from '@/components/dashboardNav';
import { EmptyState, LoadingPage } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/hooks';
import { useToast } from '@/context/hooks';
import { formatDate } from '@/lib/constants';

interface MessageRow { id: string; sender_id: string; receiver_id: string; property_id: string | null; body: string; read: boolean; created_at: string; }
interface Person { id: string; full_name: string | null; phone: string | null; }
interface PropertyRef { id: string; name: string; property_type: string; asset_class: string; }

export function OwnerMessages() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [properties, setProperties] = useState<Record<string, PropertyRef>>({});
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    // Query incoming and outgoing messages separately instead of using a PostgREST
    // OR filter. This is more reliable with Supabase RLS and makes the owner inbox
    // work even when either side of the conversation is empty.
    const { data: inboxRows, error: inboxError } = await supabase.rpc('get_owner_messages');
    if (inboxError) {
      console.error('Owner messages RPC load error:', inboxError);
      toast('Unable to load your enquiries. Please refresh and try again.', 'error');
      setLoading(false);
      return;
    }
    const rows = ((inboxRows || []) as MessageRow[]);
    const uniqueRows = [...new Map(rows.map(message => [message.id, message])).values()]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-500);
    setMessages(uniqueRows);
    const participantIds = [...new Set(rows.flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== profile.id))];
    const propertyIds = [...new Set(rows.map(m => m.property_id).filter(Boolean) as string[])];
    const [{ data: profiles, error: profilesError }, { data: props, error: propsError }] = await Promise.all([
      participantIds.length ? supabase.from('profiles').select('id,full_name,phone').in('id', participantIds) : Promise.resolve({ data: [] as Person[], error: null }),
      propertyIds.length ? supabase.from('properties').select('id,name,property_type,asset_class').in('id', propertyIds) : Promise.resolve({ data: [] as PropertyRef[], error: null }),
    ]);
    if (profilesError || propsError) {
      console.error('Owner messages related-data load error:', profilesError || propsError);
    }
    setPeople(Object.fromEntries(((profiles || []) as Person[]).map(p => [p.id, p])));
    setProperties(Object.fromEntries(((props || []) as PropertyRef[]).map(p => [p.id, p])));
    setLoading(false);
  }, [profile?.id, toast]);

  useEffect(() => { load(); }, [load]);

  const threads = useMemo(() => {
    const map = new Map<string, MessageRow[]>();
    messages.forEach(m => { const otherId = m.sender_id === profile?.id ? m.receiver_id : m.sender_id; const key = `${otherId}:${m.property_id || 'general'}`; const list = map.get(key) || []; list.push(m); map.set(key, list); });
    return [...map.entries()].map(([key, rows]) => ({ key, rows, latest: rows[rows.length - 1] })).sort((a, b) => b.latest.created_at.localeCompare(a.latest.created_at));
  }, [messages, profile?.id]);

  const unread = messages.filter(m => !m.read).length;
  const selected = threads.find(t => t.key === selectedKey) || threads[0];
  const selectedPerson = selected ? people[selected.rows[0].sender_id === profile?.id ? selected.rows[0].receiver_id : selected.rows[0].sender_id] : null;
  const selectedProperty = selected?.latest.property_id ? properties[selected.latest.property_id] : null;

  useEffect(() => { if (selected && !selectedKey) setSelectedKey(selected.key); }, [selected, selectedKey]);

  const openThread = async (key: string) => {
    setSelectedKey(key);
    const thread = threads.find(t => t.key === key);
    const unreadIds = thread?.rows.filter(m => !m.read && m.receiver_id === profile?.id).map(m => m.id) || [];
    if (unreadIds.length) {
      await supabase.from('messages').update({ read: true }).in('id', unreadIds).eq('receiver_id', profile?.id);
      setMessages(current => current.map(m => unreadIds.includes(m.id) ? { ...m, read: true } : m));
    }
  };

  const sendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !selected || !reply.trim()) return;
    const receiverId = selected.rows[0].sender_id === profile.id ? selected.rows[0].receiver_id : selected.rows[0].sender_id;
    setSending(true);
    const replyRpc = supabase.rpc('send_owner_reply', {
      p_receiver_id: receiverId,
      p_property_id: selected.latest.property_id,
      p_body: reply.trim(),
    }) as unknown as Promise<{
      data: MessageRow[] | null;
      error: { message: string; details?: string; hint?: string; code?: string } | null;
    }>;
    const { data: replyRows, error } = await replyRpc;
    setSending(false);
    if (error) {
      console.error('Owner reply error:', error);
      toast(error.message || 'Could not send the reply. Please try again.', 'error');
      return;
    }
    const sentMessage = replyRows?.[0];
    if (!sentMessage) {
      console.error('Owner reply RPC returned no message.');
      toast('Could not send the reply. Please try again.', 'error');
      return;
    }
    setMessages(current => [...current, sentMessage]);
    setReply('');
    toast('Reply sent successfully.', 'success');
  };

  if (loading) return <DashboardLayout navItems={ownerNav} title="Messages & Enquiries"><LoadingPage /></DashboardLayout>;

  return <DashboardLayout navItems={ownerNav} title="Messages & Enquiries">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Customer communication</p><h2 className="mt-1 text-2xl font-bold text-ink-900">Messages & Enquiries</h2><p className="mt-1 text-sm text-ink-500">Customer enquiries are linked to the property or asset they contacted you about.</p></div>
      <div className="flex gap-2"><span className="badge bg-brand-50 text-brand-700">{unread} unread</span><button type="button" onClick={load} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
    </div>
    <div className="grid min-h-[600px] grid-cols-1 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm lg:grid-cols-[360px_1fr]">
      <aside className="border-b border-ink-100 lg:border-b-0 lg:border-r">
        {threads.length === 0 ? <div className="p-6"><EmptyState icon={<MessageSquare className="h-8 w-8" />} title="No enquiries yet" description="Customer messages about your properties and assets will appear here." /></div> : threads.map(thread => { const first = thread.rows[0]; const participantId = first.sender_id === profile?.id ? first.receiver_id : first.sender_id; const p = people[participantId]; const prop = thread.latest.property_id ? properties[thread.latest.property_id] : null; const unreadThread = thread.rows.some(m => !m.read && m.receiver_id === profile?.id); return <button key={thread.key} type="button" onClick={() => openThread(thread.key)} className={`w-full border-b border-ink-100 p-4 text-left transition-colors ${selected?.key === thread.key ? 'bg-brand-50/70' : 'hover:bg-ink-50'}`}><div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><UserRound className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className={`truncate ${unreadThread ? 'font-bold text-ink-900' : 'font-semibold text-ink-800'}`}>{p?.full_name || 'Customer'}</p><span className="shrink-0 text-[10px] text-ink-400">{formatDate(thread.latest.created_at)}</span></div><p className="mt-0.5 truncate text-xs font-medium text-brand-700">{prop?.name || 'General enquiry'}</p><p className="mt-1 line-clamp-2 text-xs text-ink-500">{thread.latest.body}</p></div>{unreadThread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}</div></button>; })}
      </aside>
      <section className="flex min-h-[600px] flex-col">
        {!selected ? <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-ink-500">Select an enquiry to view the conversation.</div> : <>
          <div className="border-b border-ink-100 p-5"><div className="flex items-center justify-between gap-4"><div><h3 className="font-bold text-ink-900">{selectedPerson?.full_name || 'Customer'}</h3><p className="mt-1 text-sm text-ink-500">{selectedProperty ? `${selectedProperty.name} · ${selectedProperty.property_type}` : 'General enquiry'}</p></div><CheckCheck className="h-5 w-5 text-brand-600" /></div></div>
          <div className="flex-1 space-y-4 overflow-y-auto bg-ink-50/40 p-5">{selected.rows.map(message => { const mine = message.sender_id === profile?.id; return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md bg-white text-ink-800 shadow-sm'}`}><p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p><p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-ink-400'}`}>{formatDate(message.created_at)}</p></div></div>; })}</div>
          <form onSubmit={sendReply} className="border-t border-ink-100 bg-white p-4"><div className="flex gap-2"><textarea className="input min-h-[48px] resize-none" rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply to this customer..." /><button disabled={sending || !reply.trim()} className="btn-primary self-end"><Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send'}</button></div></form>
        </>}
      </section>
    </div>
  </DashboardLayout>;
}
