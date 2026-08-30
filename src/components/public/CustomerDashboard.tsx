import { useState, useEffect, useCallback } from 'react';
import { Heart, Calendar, Receipt, Bell, User as UserIcon, Home, CreditCard, FileText, ArrowRight, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Property, PropertyImage, Reservation, Payment, Viewing, Favorite, Notification } from '@/lib/types';
import { Badge, Button, Card, LoadingScreen, EmptyState } from '@/components/ui';
import { formatKES, formatDate, formatDateTime, timeAgo, reservationStatusColor, reservationStatusLabel, paymentStatusColor, paymentStatusLabel } from '@/lib/utils';
import { PropertyCard } from '@/components/public/PropertyCard';

interface CustomerDashboardProps {
  navigate: (path: string) => void;
}

type Tab = 'overview' | 'favorites' | 'reservations' | 'viewings' | 'payments' | 'notifications' | 'profile';

export function CustomerDashboard({ navigate }: CustomerDashboardProps) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favProperties, setFavProperties] = useState<Record<string, { property: Property; images: PropertyImage[] }>>({});
  const [reservations, setReservations] = useState<(Reservation & { property?: Property })[]>([]);
  const [viewings, setViewings] = useState<(Viewing & { property?: Property })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [favRes, resRes, viewRes, payRes, notifRes] = await Promise.all([
      supabase.from('favorites').select('*, property:properties(*)').eq('customer_id', user.id),
      supabase.from('reservations').select('*, property:properties(*)').eq('customer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('viewings').select('*, property:properties(*)').eq('customer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    setFavorites((favRes.data ?? []) as Favorite[]);
    setReservations((resRes.data ?? []) as (Reservation & { property?: Property })[]);
    setViewings((viewRes.data ?? []) as (Viewing & { property?: Property })[]);
    setPayments((payRes.data ?? []) as Payment[]);
    setNotifications((notifRes.data ?? []) as Notification[]);

    const favs = (favRes.data ?? []) as Favorite[];
    if (favs.length > 0) {
      const propIds = favs.map((f) => f.property_id);
      const { data: props } = await supabase.from('properties').select('*').in('id', propIds);
      const { data: imgs } = await supabase.from('property_images').select('*').in('property_id', propIds).order('sort_order', { ascending: true });
      const map: Record<string, { property: Property; images: PropertyImage[] }> = {};
      (props ?? []).forEach((p) => { map[p.id] = { property: p as Property, images: [] }; });
      (imgs ?? []).forEach((img) => {
        if (map[img.property_id]) map[img.property_id].images.push(img as PropertyImage);
      });
      setFavProperties(map);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const removeFavorite = async (propertyId: string) => {
    if (!user) return;
    await supabase.from('favorites').delete().eq('property_id', propertyId).eq('customer_id', user.id);
    setFavorites(favorites.filter((f) => f.property_id !== propertyId));
    const newMap = { ...favProperties };
    delete newMap[propertyId];
    setFavProperties(newMap);
  };

  if (!user) {
    return <EmptyState title="Please sign in" message="You need to be signed in to view your dashboard." action={<Button onClick={() => navigate('/signin')}>Sign In</Button>} />;
  }

  if (loading) return <LoadingScreen message="Loading your dashboard..." />;

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const confirmedReservations = reservations.filter((r) => r.status === 'confirmed' || r.status === 'reserved');
  const upcomingViewings = viewings.filter((v) => v.status === 'confirmed' || v.status === 'requested');
  const totalSpent = payments.filter((p) => p.status === 'successful').reduce((sum, p) => sum + p.amount, 0);

  const tabs: { id: Tab; label: string; icon: typeof Home; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'favorites', label: 'Saved Properties', icon: Heart, count: favorites.length },
    { id: 'reservations', label: 'Reservations', icon: Calendar, count: reservations.length },
    { id: 'viewings', label: 'Viewings', icon: Calendar, count: upcomingViewings.length },
    { id: 'payments', label: 'Payments', icon: CreditCard, count: payments.length },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: unreadCount },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-slate-900">My Dashboard</h1>
          <p className="text-sm text-slate-500">Welcome back, {profile?.full_name || profile?.email}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 lg:flex-col">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <t.icon className="h-4 w-4" />
                  <span className="hidden sm:inline lg:inline">{t.label}</span>
                  {t.count !== undefined && t.count > 0 && (
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${tab === t.id ? 'bg-teal-600' : 'bg-slate-200 text-slate-700'}`}>{t.count}</span>
                  )}
                </button>
              ))}
              <button onClick={() => { signOut(); navigate('/'); }} className="flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                <Settings className="h-4 w-4" /><span className="hidden sm:inline lg:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div>
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: 'Saved Properties', value: favorites.length, icon: Heart, color: 'text-rose-600 bg-rose-50' },
                    { label: 'Reservations', value: reservations.length, icon: Calendar, color: 'text-teal-600 bg-teal-50' },
                    { label: 'Upcoming Viewings', value: upcomingViewings.length, icon: Bell, color: 'text-blue-600 bg-blue-50' },
                    { label: 'Total Spent', value: formatKES(totalSpent), icon: CreditCard, color: 'text-amber-600 bg-amber-50' },
                  ].map((stat) => (
                    <Card key={stat.label} className="p-4">
                      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                        <stat.icon className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-xs text-slate-500">{stat.label}</p>
                    </Card>
                  ))}
                </div>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Recent Reservations</h3>
                    <button onClick={() => setTab('reservations')} className="text-sm font-medium text-teal-700 hover:text-teal-800">View all</button>
                  </div>
                  {reservations.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">No reservations yet. Browse properties to get started.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {reservations.slice(0, 3).map((res) => (
                        <div key={res.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{res.property?.title ?? 'Property'}</p>
                            <p className="text-xs text-slate-500">Ref: {res.reference} · {formatDate(res.created_at)}</p>
                          </div>
                          <Badge className={reservationStatusColor(res.status)}>{reservationStatusLabel(res.status)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Saved Properties</h3>
                    <button onClick={() => setTab('favorites')} className="text-sm font-medium text-teal-700 hover:text-teal-800">View all</button>
                  </div>
                  {favorites.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">No saved properties yet.</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {favorites.slice(0, 2).map((fav) => {
                        const data = favProperties[fav.property_id];
                        if (!data) return null;
                        return <PropertyCard key={fav.property_id} property={data.property} images={data.images} onClick={(id) => navigate(`/properties/${id}`)} />;
                      })}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {tab === 'favorites' && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Saved Properties</h2>
                {favorites.length === 0 ? (
                  <EmptyState icon={<Heart className="h-12 w-12" />} title="No saved properties" message="Save properties you're interested in to find them quickly later." action={<Button onClick={() => navigate('/properties')}>Browse Properties</Button>} />
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {favorites.map((fav) => {
                      const data = favProperties[fav.property_id];
                      if (!data) return null;
                      return (
                        <div key={fav.property_id} className="relative">
                          <PropertyCard property={data.property} images={data.images} isFavorite onClick={(id) => navigate(`/properties/${id}`)} />
                          <button onClick={() => removeFavorite(fav.property_id)} className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow-sm hover:bg-white">
                            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'reservations' && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">My Reservations</h2>
                {reservations.length === 0 ? (
                  <EmptyState icon={<Calendar className="h-12 w-12" />} title="No reservations" message="Reserve a property to see it here." action={<Button onClick={() => navigate('/properties')}>Browse Properties</Button>} />
                ) : (
                  <div className="space-y-3">
                    {reservations.map((res) => (
                      <Card key={res.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{res.property?.title ?? 'Property'}</h3>
                              <Badge className={reservationStatusColor(res.status)}>{reservationStatusLabel(res.status)}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">Reference: {res.reference}</p>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                              <span>Fee: {formatKES(res.reservation_fee)}</span>
                              <span>Booked: {formatDate(res.created_at)}</span>
                              {res.preferred_move_in && <span>Move-in: {formatDate(res.preferred_move_in)}</span>}
                            </div>
                          </div>
                          {res.property && (
                            <Button variant="outline" size="sm" onClick={() => navigate(`/properties/${res.property!.id}`)}>View Property</Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'viewings' && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Property Viewings</h2>
                {viewings.length === 0 ? (
                  <EmptyState icon={<Calendar className="h-12 w-12" />} title="No viewings scheduled" message="Schedule a viewing from any property page." action={<Button onClick={() => navigate('/properties')}>Browse Properties</Button>} />
                ) : (
                  <div className="space-y-3">
                    {viewings.map((v) => (
                      <Card key={v.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-900">{v.property?.title ?? 'Property'}</h3>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                              <span>Date: {formatDate(v.preferred_date)}</span>
                              <span>Time: {v.preferred_time}</span>
                              <Badge className={v.status === 'confirmed' ? 'bg-green-100 text-green-800 border-green-200' : v.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                                {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                              </Badge>
                            </div>
                          </div>
                          {v.property && <Button variant="outline" size="sm" onClick={() => navigate(`/properties/${v.property!.id}`)}>View Property</Button>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'payments' && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Payment History</h2>
                {payments.length === 0 ? (
                  <EmptyState icon={<CreditCard className="h-12 w-12" />} title="No payments yet" message="Your payment history will appear here." />
                ) : (
                  <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Transaction ID</th>
                          <th className="px-4 py-3 font-semibold">Amount</th>
                          <th className="px-4 py-3 font-semibold">Method</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.transaction_id ?? '—'}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{formatKES(p.amount)}</td>
                            <td className="px-4 py-3 capitalize text-slate-600">{p.payment_method}</td>
                            <td className="px-4 py-3"><Badge className={paymentStatusColor(p.status)}>{paymentStatusLabel(p.status)}</Badge></td>
                            <td className="px-4 py-3 text-slate-600">{formatDateTime(p.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            )}

            {tab === 'notifications' && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Notifications</h2>
                {notifications.length === 0 ? (
                  <EmptyState icon={<Bell className="h-12 w-12" />} title="No notifications" message="You're all caught up!" />
                ) : (
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <Card key={n.id} className={`p-4 ${!n.is_read ? 'border-teal-200 bg-teal-50/30' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {!n.is_read && <span className="h-2 w-2 rounded-full bg-teal-500" />}
                              <h3 className="font-semibold text-slate-900">{n.title}</h3>
                            </div>
                            {n.message && <p className="mt-1 text-sm text-slate-600">{n.message}</p>}
                            <p className="mt-1 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                          </div>
                          {!n.is_read && <button onClick={() => markNotificationRead(n.id)} className="text-xs font-medium text-teal-700 hover:text-teal-800">Mark read</button>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'profile' && (
              <ProfileTab profile={profile} onUpdated={refreshProfile} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ profile, onUpdated }: { profile: import('@/lib/types').Profile | null; onUpdated: () => Promise<void> }) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    id_number: profile?.id_number ?? '',
    address: profile?.address ?? '',
    emergency_contact: profile?.emergency_contact ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('profiles').update(form).eq('id', profile!.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdated();
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">My Profile</h2>
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-800">
            {profile.full_name?.charAt(0).toUpperCase() ?? profile.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{profile.full_name || 'User'}</p>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <Badge className="mt-1 bg-slate-100 text-slate-700 border-slate-200 capitalize">{profile.role.replace('_', ' ')}</Badge>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">ID/Passport Number</label>
            <input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Emergency Contact</label>
            <input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          {saved && <span className="text-sm text-green-600">Saved successfully!</span>}
        </div>
      </Card>
    </div>
  );
}
