import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Edit2, Trash2, Star, Plus, Upload, X, Check, Copy, MoreVertical, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Property, PropertyImage } from '@/lib/types';
import { Card, Button, Badge, LoadingScreen, EmptyState, Modal, Input, Select, Textarea } from '@/components/ui';
import { formatKES, formatDate, availabilityColor, availabilityLabel, propertyTypeLabel, PROPERTY_TYPES } from '@/lib/utils';

interface PropertyManagementProps {
  onNavigate: (page: any) => void;
}

export function PropertyManagement({ onNavigate }: PropertyManagementProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [images, setImages] = useState<Record<string, PropertyImage[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('properties').select('*').order('created_at', { ascending: false });
    const { data } = await q;
    const props = (data ?? []) as Property[];
    setProperties(props);
    if (props.length > 0) {
      const { data: imgData } = await supabase.from('property_images').select('*').in('property_id', props.map((p) => p.id)).order('sort_order', { ascending: true });
      const map: Record<string, PropertyImage[]> = {};
      (imgData ?? []).forEach((img) => {
        if (!map[img.property_id]) map[img.property_id] = [];
        map[img.property_id].push(img);
      });
      setImages(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = properties.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !(p.county ?? '').toLowerCase().includes(search.toLowerCase()) && !(p.town ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && p.availability_status !== statusFilter) return false;
    if (typeFilter && p.property_type !== typeFilter) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('properties').update({ availability_status: status }).eq('id', id);
    setProperties(properties.map((p) => p.id === id ? { ...p, availability_status: status as any } : p));
    setActionMenu(null);
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from('properties').update({ is_featured: !current }).eq('id', id);
    setProperties(properties.map((p) => p.id === id ? { ...p, is_featured: !current } : p));
    setActionMenu(null);
  };

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from('properties').update({ is_published: !current }).eq('id', id);
    setProperties(properties.map((p) => p.id === id ? { ...p, is_published: !current } : p));
    setActionMenu(null);
  };

  const duplicateProperty = async (id: string) => {
    const prop = properties.find((p) => p.id === id);
    if (!prop) return;
    const { id: _, created_at: __, updated_at: ___, ...copy } = prop;
    await supabase.from('properties').insert({ ...copy, title: `${prop.title} (Copy)`, is_published: false, availability_status: 'available' });
    load();
    setActionMenu(null);
  };

  const deleteProperty = async () => {
    if (!deleteId) return;
    await supabase.from('properties').delete().eq('id', deleteId);
    setProperties(properties.filter((p) => p.id !== deleteId));
    setDeleteId(null);
  };

  const bulkAction = async (action: string) => {
    if (selected.size === 0) return;
    if (action === 'publish') {
      await supabase.from('properties').update({ is_published: true }).in('id', [...selected]);
    } else if (action === 'unpublish') {
      await supabase.from('properties').update({ is_published: false }).in('id', [...selected]);
    } else if (action === 'feature') {
      await supabase.from('properties').update({ is_featured: true }).in('id', [...selected]);
    } else if (action === 'delete') {
      await supabase.from('properties').delete().in('id', [...selected]);
      setSelected(new Set());
    }
    load();
  };

  if (loading) return <LoadingScreen message="Loading properties..." />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search properties..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
            <option value="sold">Sold</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:block">
            <option value="">All Types</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <Button onClick={() => onNavigate('add-property')}><Plus className="h-4 w-4" /> Add Property</Button>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-teal-50 p-3">
          <span className="text-sm font-medium text-teal-800">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkAction('publish')}>Publish</Button>
            <Button size="sm" variant="outline" onClick={() => bulkAction('unpublish')}>Unpublish</Button>
            <Button size="sm" variant="outline" onClick={() => bulkAction('feature')}>Feature</Button>
            <Button size="sm" variant="danger" onClick={() => { if (confirm('Delete selected properties?')) bulkAction('delete'); }}>Delete</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="h-12 w-12" />} title="No properties found" message="Add your first property to get started." action={<Button onClick={() => onNavigate('add-property')}><Plus className="h-4 w-4" /> Add Property</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300" /></th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Type</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Location</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Added</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((prop) => {
                  const mainImg = images[prop.id]?.find((img) => img.category === 'main') ?? images[prop.id]?.[0];
                  return (
                    <tr key={prop.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><input type="checkbox" checked={selected.has(prop.id)} onChange={() => toggleSelect(prop.id)} className="rounded border-slate-300" /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={mainImg?.url ?? 'https://images.pexels.com/photos/6585598/pexels-photo-6585598.jpeg?auto=compress&cs=tinysrgb&h=80&w=80'} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                          <div>
                            <p className="font-medium text-slate-900">{prop.title}</p>
                            {prop.is_featured && <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" />}
                            {!prop.is_published && <Badge className="ml-1 bg-slate-100 text-slate-500 border-slate-200">Draft</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{propertyTypeLabel(prop.property_type)}</td>
                      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{prop.county ?? '—'}, {prop.town ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{prop.monthly_rent ? formatKES(prop.monthly_rent) : prop.selling_price ? formatKES(prop.selling_price) : '—'}</td>
                      <td className="px-4 py-3"><Badge className={availabilityColor(prop.availability_status)}>{availabilityLabel(prop.availability_status)}</Badge></td>
                      <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{formatDate(prop.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button onClick={() => setActionMenu(actionMenu === prop.id ? null : prop.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {actionMenu === prop.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
                              <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                <button onClick={() => onNavigate(`/properties/${prop.id}`)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> View</button>
                                <button onClick={() => { setEditProperty(prop); setActionMenu(null); }} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Edit2 className="h-4 w-4" /> Edit</button>
                                <button onClick={() => duplicateProperty(prop.id)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Copy className="h-4 w-4" /> Duplicate</button>
                                <button onClick={() => togglePublish(prop.id, prop.is_published)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">{prop.is_published ? <><X className="h-4 w-4" /> Unpublish</> : <><Check className="h-4 w-4" /> Publish</>}</button>
                                <button onClick={() => toggleFeatured(prop.id, prop.is_featured)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Star className="h-4 w-4" /> {prop.is_featured ? 'Unfeature' : 'Feature'}</button>
                                <div className="border-t border-slate-100">
                                  <button onClick={() => updateStatus(prop.id, 'available')} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Mark Available</button>
                                  <button onClick={() => updateStatus(prop.id, 'occupied')} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Mark Occupied</button>
                                </div>
                                <button onClick={() => { setDeleteId(prop.id); setActionMenu(null); }} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      {editProperty && (
        <EditPropertyModal property={editProperty} onClose={() => setEditProperty(null)} onSaved={() => { setEditProperty(null); load(); }} />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal open={true} onClose={() => setDeleteId(null)} title="Delete Property" size="sm">
          <p className="text-sm text-slate-600">Are you sure you want to delete this property? This action cannot be undone.</p>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={deleteProperty} className="flex-1">Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EditPropertyModal({ property, onClose, onSaved }: { property: Property; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: property.title,
    description: property.description ?? '',
    property_type: property.property_type,
    county: property.county ?? '',
    town: property.town ?? '',
    estate: property.estate ?? '',
    bedrooms: String(property.bedrooms),
    bathrooms: String(property.bathrooms),
    parking_spaces: String(property.parking_spaces),
    floor_size: String(property.floor_size ?? ''),
    furnished: property.furnished,
    monthly_rent: String(property.monthly_rent ?? ''),
    selling_price: String(property.selling_price ?? ''),
    security_deposit: String(property.security_deposit ?? ''),
    availability_status: property.availability_status,
    is_published: property.is_published,
    is_featured: property.is_featured,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('properties').update({
      title: form.title,
      description: form.description,
      property_type: form.property_type,
      county: form.county || null,
      town: form.town || null,
      estate: form.estate || null,
      bedrooms: parseInt(form.bedrooms) || 0,
      bathrooms: parseInt(form.bathrooms) || 0,
      parking_spaces: parseInt(form.parking_spaces) || 0,
      floor_size: form.floor_size ? parseFloat(form.floor_size) : null,
      furnished: form.furnished,
      monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : null,
      selling_price: form.selling_price ? parseFloat(form.selling_price) : null,
      security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
      availability_status: form.availability_status,
      is_published: form.is_published,
      is_featured: form.is_featured,
      updated_at: new Date().toISOString(),
    }).eq('id', property.id);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open={true} onClose={onClose} title="Edit Property" size="lg">
      <div className="space-y-4">
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value as any })}>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Select label="Availability" value={form.availability_status} onChange={(e) => setForm({ ...form, availability_status: e.target.value as any })}>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
            <option value="unavailable">Unavailable</option>
            <option value="sold">Sold</option>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="County" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
          <Input label="Town" value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} />
          <Input label="Estate" value={form.estate} onChange={(e) => setForm({ ...form, estate: e.target.value })} />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Input label="Bedrooms" type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
          <Input label="Bathrooms" type="number" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
          <Input label="Parking" type="number" value={form.parking_spaces} onChange={(e) => setForm({ ...form, parking_spaces: e.target.value })} />
          <Input label="Size (sqft)" type="number" value={form.floor_size} onChange={(e) => setForm({ ...form, floor_size: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Monthly Rent" type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} />
          <Input label="Selling Price" type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <Input label="Security Deposit" type="number" value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: e.target.value })} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.furnished} onChange={(e) => setForm({ ...form, furnished: e.target.checked })} className="rounded border-slate-300" /> Furnished</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="rounded border-slate-300" /> Published</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="rounded border-slate-300" /> Featured</label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </div>
    </Modal>
  );
}
