import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Download, FileText, Search, Trash2, UploadCloud, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { adminNav, ownerNav, tenantNav } from '@/components/dashboardNav';
import { Card, EmptyState, LoadingPage, Pagination } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/hooks';
import { useToast } from '@/context/hooks';
import { formatDate, titleCase } from '@/lib/constants';

export type DocumentStatus = 'pending_review' | 'verified' | 'rejected' | 'expired' | 'archived';
export type DocumentCategory = 'lease' | 'identity' | 'property' | 'financial' | 'tax' | 'maintenance' | 'compliance' | 'other';

interface DocumentRow {
  id: string;
  title: string;
  category: DocumentCategory;
  status: DocumentStatus;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  property_id: string | null;
  lease_id: string | null;
  uploaded_by: string;
  tenant_id: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  property_name?: string | null;
  tenant_name?: string | null;
  uploader_name?: string | null;
}

const PAGE_SIZE = 20;
const categories: DocumentCategory[] = ['lease', 'identity', 'property', 'financial', 'tax', 'maintenance', 'compliance', 'other'];
const statuses: Array<'all' | DocumentStatus> = ['all', 'pending_review', 'verified', 'rejected', 'expired', 'archived'];

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClass(status: DocumentStatus) {
  if (status === 'verified') return 'bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'bg-red-50 text-red-700';
  if (status === 'expired') return 'bg-amber-50 text-amber-700';
  if (status === 'archived') return 'bg-ink-100 text-ink-600';
  return 'bg-brand-50 text-brand-700';
}

function DocumentsTable({ rows, admin, onOpen, onDelete }: { rows: DocumentRow[]; admin: boolean; onOpen: (row: DocumentRow) => void; onDelete: (row: DocumentRow) => void }) {
  if (!rows.length) return <EmptyState icon={<FileText className="h-8 w-8" />} title="No documents found" description="Documents matching the current filters will appear here." />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead><tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
          <th className="px-4 py-3">Document</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Property / tenant</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Uploaded</th><th className="px-4 py-3">Actions</th>
        </tr></thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-ink-50/70">
              <td className="px-4 py-4"><button type="button" onClick={() => onOpen(row)} className="flex items-center gap-3 text-left"><span className="rounded-xl bg-brand-50 p-2 text-brand-700"><FileText className="h-4 w-4" /></span><span><span className="block font-semibold text-ink-900 hover:text-brand-700">{row.title}</span><span className="block max-w-[260px] truncate text-xs text-ink-400">{row.file_name} · {formatBytes(row.file_size)}</span></span></button></td>
              <td className="px-4 py-4"><span className="badge bg-ink-100 text-ink-600">{titleCase(row.category)}</span></td>
              <td className="px-4 py-4"><p className="font-medium text-ink-800">{row.property_name || 'General'}</p><p className="text-xs text-ink-400">{row.tenant_name || '—'}</p></td>
              <td className="px-4 py-4"><span className={`badge ${statusClass(row.status)}`}>{titleCase(row.status.replace('_', ' '))}</span></td>
              <td className="whitespace-nowrap px-4 py-4 text-xs text-ink-500">{formatDate(row.created_at)}</td>
              <td className="px-4 py-4"><div className="flex items-center gap-1"><button type="button" onClick={() => onOpen(row)} className="rounded-lg p-2 text-ink-500 hover:bg-brand-50 hover:text-brand-700" title="Open"><Download className="h-4 w-4" /></button>{(!admin || row.uploaded_by) && <button type="button" onClick={() => onDelete(row)} className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-700" title="Delete"><Trash2 className="h-4 w-4" /></button>}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsPage({ mode }: { mode: 'admin' | 'owner' | 'tenant' }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const admin = mode === 'admin';
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | DocumentStatus>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [leases, setLeases] = useState<Array<{ id: string; property_id: string; property_name: string; tenant_id: string }>>([]);
  const [form, setForm] = useState({ title: '', category: 'compliance' as DocumentCategory, propertyId: '', leaseId: '', tenantId: '', file: null as File | null });

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_document_page', {
      p_page: page, p_page_size: PAGE_SIZE, p_query: query.trim() || null,
      p_category: category === 'all' ? null : category, p_status: status === 'all' ? null : status,
    });
    if (error) toast(error.message, 'error');
    const payload = (data || {}) as { rows?: DocumentRow[]; total?: number; total_pages?: number };
    setRows(payload.rows || []); setTotalItems(Number(payload.total || 0)); setTotalPages(Math.max(1, Number(payload.total_pages || 1))); setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id, page, category, status]);
  useEffect(() => { const t = window.setTimeout(() => { setPage(1); load(); }, 250); return () => window.clearTimeout(t); }, [query]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (admin) {
        const { data } = await supabase.from('properties').select('id,name').order('name');
        setProperties((data || []) as Array<{ id: string; name: string }>);
      } else if (mode === 'owner' || mode === 'tenant') {
        const propQuery = mode === 'owner'
          ? supabase.from('properties').select('id,name').eq('owner_id', profile.id).order('name')
          : supabase.from('leases').select('id,property_id,properties(name),tenant_id').eq('tenant_id', profile.id).order('created_at', { ascending: false });
        const { data } = await propQuery;
        if (mode === 'owner') setProperties((data || []) as Array<{ id: string; name: string }>);
        else setLeases(((data || []) as Array<{ id: string; property_id: string; properties?: { name: string } | { name: string }[]; tenant_id: string }>).map((x) => ({ id: x.id, property_id: x.property_id, property_name: Array.isArray(x.properties) ? (x.properties[0]?.name || 'Property') : (x.properties?.name || 'Property'), tenant_id: x.tenant_id })));
      }
      if (mode === 'owner' || admin) {
        const { data } = await supabase.from('leases').select('id,property_id,tenant_id,properties(name)').order('created_at', { ascending: false }).limit(200);
        setLeases(((data || []) as Array<{ id: string; property_id: string; tenant_id: string; properties?: { name: string } | { name: string }[] }>).map((x) => ({ id: x.id, property_id: x.property_id, property_name: Array.isArray(x.properties) ? (x.properties[0]?.name || 'Property') : (x.properties?.name || 'Property'), tenant_id: x.tenant_id })));
      }
    })();
  }, [profile?.id, mode]);

  const openDocument = async (row: DocumentRow) => {
    const { data, error } = await supabase.storage.from('pms-documents').createSignedUrl(row.storage_path, 300);
    if (error || !data?.signedUrl) { toast(error?.message || 'Unable to open document', 'error'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const upload = async () => {
    if (!profile || !form.file || !form.title.trim()) { toast('Enter a title and choose a document', 'error'); return; }
    if (form.file.size > 10 * 1024 * 1024) { toast('Documents must be 10 MB or smaller', 'error'); return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(form.file.type)) { toast('Unsupported document type. Use PDF, image, Word or Excel.', 'error'); return; }
    setBusy(true);
    const id = crypto.randomUUID();
    const ext = form.file.name.includes('.') ? `.${form.file.name.split('.').pop()}` : '';
    const path = `${profile.id}/${id}${ext}`;
    const { error: uploadError } = await supabase.storage.from('pms-documents').upload(path, form.file, { contentType: form.file.type, upsert: false });
    if (uploadError) { toast(uploadError.message, 'error'); setBusy(false); return; }
    const { error } = await supabase.from('documents').insert({
      id, title: form.title.trim(), category: form.category, file_name: form.file.name, mime_type: form.file.type,
      file_size: form.file.size, storage_path: path, property_id: form.propertyId || null, lease_id: form.leaseId || null,
      tenant_id: form.tenantId || (mode === 'tenant' ? profile.id : null), uploaded_by: profile.id, status: admin ? 'verified' : 'pending_review',
    });
    if (error) { await supabase.storage.from('pms-documents').remove([path]); toast(error.message, 'error'); setBusy(false); return; }
    toast('Document uploaded successfully', 'success'); setUploadOpen(false); setForm({ title: '', category: 'compliance', propertyId: '', leaseId: '', tenantId: '', file: null }); setPage(1); await load(); setBusy(false);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const { error } = await supabase.from('documents').delete().eq('id', deleteTarget.id);
    if (error) toast(error.message, 'error'); else { await supabase.storage.from('pms-documents').remove([deleteTarget.storage_path]); toast('Document deleted', 'success'); await load(); }
    setDeleteTarget(null); setBusy(false);
  };

  const review = async (next: DocumentStatus, notes: string) => {
    if (!selected || !admin) return;
    const { error } = await supabase.from('documents').update({ status: next, review_notes: notes || null }).eq('id', selected.id);
    if (error) toast(error.message, 'error'); else { toast(`Document marked ${titleCase(next.replace('_', ' '))}`, 'success'); setSelected(null); await load(); }
  };

  const title = admin ? 'Document & Compliance Centre' : mode === 'owner' ? 'Documents & Compliance' : 'My Documents';
  const nav = admin ? adminNav : mode === 'owner' ? ownerNav : tenantNav;
  const description = admin ? 'Centralize property, tenant, lease, financial and compliance records with review controls and a complete document trail.' : mode === 'owner' ? 'Keep lease, property, maintenance, tax and financial records organized in one secure workspace.' : 'Access your lease, rent, identity and other documents shared or uploaded for your tenancy.';

  const availableLeases = useMemo(() => form.propertyId ? leases.filter((x) => x.property_id === form.propertyId) : leases, [leases, form.propertyId]);

  return (
    <DashboardLayout navItems={nav} title={title}>
      <div className="mb-7 rounded-2xl brand-gradient p-6 text-white shadow-soft-lg"><p className="text-sm font-semibold text-white/90">Secure records</p><h2 className="mt-1 text-2xl font-bold">{title}</h2><p className="mt-2 max-w-3xl text-sm font-medium text-white/90">{description}</p></div>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3"><Card className="p-4"><p className="text-xs uppercase tracking-wide text-ink-400">Documents</p><p className="mt-1 text-2xl font-bold text-ink-900">{totalItems}</p></Card><Card className="p-4"><p className="text-xs uppercase tracking-wide text-ink-400">Current filter</p><p className="mt-1 font-semibold text-brand-700">{category === 'all' ? 'All categories' : titleCase(category)}</p></Card><Card className="p-4"><p className="text-xs uppercase tracking-wide text-ink-400">Secure storage</p><p className="mt-1 font-semibold text-emerald-700">Private & signed access</p></Card></div>
      <Card className="mb-5 p-4"><div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_180px_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search document, property or tenant…" /></div><select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="all">All categories</option>{categories.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select><select className="input" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}><option value="all">All statuses</option>{statuses.slice(1).map((x) => <option key={x} value={x}>{titleCase(x.replace('_', ' '))}</option>)}</select><button type="button" className="btn-primary flex items-center justify-center gap-2" onClick={() => setUploadOpen(true)}><UploadCloud className="h-4 w-4" /> Upload document</button></div></Card>
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-ink-100 px-5 py-4"><div><h3 className="font-semibold text-ink-900">Document register</h3><p className="text-xs text-ink-500">Page {page} of {totalPages}</p></div><span className="badge bg-brand-50 text-brand-700">{totalItems} records</span></div>{loading ? <LoadingPage /> : <DocumentsTable rows={rows} admin={admin} onOpen={(r) => admin ? setSelected(r) : openDocument(r)} onDelete={(r) => setDeleteTarget(r)} />}</Card>
      {totalPages > 1 && <div className="mt-5"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} /></div>}

      <Modal open={uploadOpen} onClose={() => !busy && setUploadOpen(false)} title="Upload document">
        <div className="space-y-4"><div><label className="label">Document title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Signed tenancy agreement" /></div><div><label className="label">Category</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as DocumentCategory })}>{categories.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</select></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="label">Property</label><select className="input" value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value, leaseId: '' })}><option value="">General / none</option>{properties.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div><div><label className="label">Lease</label><select className="input" value={form.leaseId} onChange={(e) => { const lease = leases.find((x) => x.id === e.target.value); setForm({ ...form, leaseId: e.target.value, propertyId: lease?.property_id || form.propertyId, tenantId: lease?.tenant_id || form.tenantId }); }}><option value="">No lease link</option>{availableLeases.map((x) => <option key={x.id} value={x.id}>{x.property_name} · {x.id.slice(0, 8)}</option>)}</select></div></div>{admin && form.leaseId && <p className="rounded-xl bg-brand-50 p-3 text-xs text-brand-700">The selected lease automatically associates the document with its tenant.</p>}<div><label className="label">File</label><input className="input py-2" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} /><p className="mt-1 text-xs text-ink-400">Maximum 10 MB. PDF, images, Word and Excel.</p></div><button type="button" disabled={busy} onClick={upload} className="btn-primary w-full">{busy ? 'Uploading…' : 'Upload securely'}</button></div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title || 'Document review'}>
        {selected && <div className="space-y-5"><div className="rounded-2xl bg-ink-50 p-4"><p className="font-semibold text-ink-900">{selected.file_name}</p><p className="mt-1 text-xs text-ink-500">{formatBytes(selected.file_size)} · {selected.mime_type}</p><p className="mt-2 text-xs text-ink-500">Uploaded by {selected.uploader_name || 'user'} on {formatDate(selected.created_at)}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-400">Current status</p><span className={`mt-2 inline-flex badge ${statusClass(selected.status)}`}>{titleCase(selected.status.replace('_', ' '))}</span></div>{selected.review_notes && <div className="rounded-xl border border-ink-100 p-3 text-sm text-ink-600"><strong>Review notes:</strong> {selected.review_notes}</div>}<div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary flex items-center gap-2" onClick={() => openDocument(selected)}><Download className="h-4 w-4" /> Open document</button>{admin && <><button type="button" className="btn-primary flex items-center gap-2" onClick={() => review('verified', 'Verified by administrator')}><CheckCircle className="h-4 w-4" /> Verify</button><button type="button" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700" onClick={() => review('rejected', 'Rejected by administrator — review required')}><XCircle className="h-4 w-4" /> Reject</button></>}</div></div>}
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={remove} title="Delete document" message="This permanently removes the document record and its stored file. Continue?" confirmLabel={busy ? 'Deleting…' : 'Delete'} />
    </DashboardLayout>
  );
}

export function AdminDocuments() { return <DocumentsPage mode="admin" />; }
export function OwnerDocuments() { return <DocumentsPage mode="owner" />; }
export function TenantDocuments() { return <DocumentsPage mode="tenant" />; }
