import { useState, useEffect } from 'react';
import { Heart, Bell, MapPin, CheckCircle, Trash2, CalendarDays, BedDouble } from 'lucide-react';
import { Header, Footer } from '@/components/Layout';
import { Card, Badge, EmptyState, LoadingPage } from '@/components/ui';
import { Link } from '@/context/RouterContext';
import { useAuth } from '@/context/hooks';
import { useToast } from '@/context/hooks';
import { supabase } from '@/lib/supabase';
import { timeAgo, formatKES } from '@/lib/constants';
import { getPropertyImages } from '@/lib/images';
import type { Property, Notification, Favorite } from '@/lib/supabase';

export function FavoritesPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<(Favorite & { properties: Property })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('favorites').select('*, properties(*)').eq('user_id', profile.id).order('created_at', { ascending: false });
      setFavorites((data as typeof favorites) || []);
      setLoading(false);
    })();
  }, [profile]);

  const removeFavorite = async (id: string) => {
    await supabase.from('favorites').delete().eq('id', id);
    setFavorites(favorites.filter((f) => f.id !== id));
    toast('Removed from saved properties', 'info');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <h1 className="text-2xl font-bold text-ink-900 mb-6">My Saved Opportunities</h1>
        {loading ? <LoadingPage /> : favorites.length === 0 ? (
          <EmptyState icon={<Heart className="w-8 h-8" />} title="No saved properties yet" description="Click the heart icon on any property to save it here for later." action={<Link to="/properties" className="btn-primary">Browse Properties</Link>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((fav) => (
              <Card key={fav.id} className="overflow-hidden">
                <Link to={`/property/${fav.property_id}`}>
                  <div className="h-40 bg-ink-100 overflow-hidden">
                    <img src={fav.properties?.photos?.[0] || getPropertyImages(fav.properties?.property_type || 'Apartment')[0]} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  </div>
                </Link>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Link to={`/property/${fav.property_id}`}><h3 className="font-semibold text-ink-900 truncate">{fav.properties?.name}</h3></Link>
                    <button onClick={() => removeFavorite(fav.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <p className="text-sm text-ink-500 flex items-center gap-1 mb-2"><MapPin className="w-3.5 h-3.5" /> {fav.properties?.town}, {fav.properties?.county}</p>
                  <Badge status={fav.properties?.status} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export function NotificationsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
      setNotifications((data as Notification[]) || []);
      setLoading(false);
    })();
  }, [profile]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile?.id).eq('read', false);
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    toast('All notifications marked as read', 'success');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-ink-900">Notifications</h1>
          {notifications.some((n) => !n.read) && <button onClick={markAllRead} className="btn-secondary text-sm"><CheckCircle className="w-4 h-4" /> Mark all read</button>}
        </div>
        {loading ? <LoadingPage /> : notifications.length === 0 ? (
          <EmptyState icon={<Bell className="w-8 h-8" />} title="No notifications" description="You'll receive notifications about reservations, payments, and important updates here." />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <Card key={n.id} className={`p-4 cursor-pointer ${!n.read ? 'border-brand-200 bg-brand-50/50' : ''}`} onClick={() => markRead(n.id)}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${!n.read ? 'bg-brand-100 text-brand-600' : 'bg-ink-100 text-ink-400'}`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink-900">{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                    </div>
                    <p className="text-sm text-ink-600 mt-1">{n.message}</p>
                    <p className="text-xs text-ink-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}


export function StaysPage() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data, error } = await supabase.from('short_stay_bookings').select('*, short_stay_listings(listing_name), properties(name,town,county,photos)').eq('guest_id', profile.id).order('created_at', { ascending: false });
      if (error) console.error('Stay bookings error:', error);
      setBookings((data as Array<Record<string, unknown>>) || []); setLoading(false);
    })();
  }, [profile]);
  return <div className="min-h-screen flex flex-col"><Header /><main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
    <div className="mb-7"><p className="section-kicker">HOSPITALITY</p><h1 className="text-3xl font-bold text-ink-900">My Short Stays</h1><p className="mt-2 text-sm leading-6 text-ink-500">Track your stay requests, dates, guests and booking status in one place.</p></div>
    {loading ? <LoadingPage /> : bookings.length === 0 ? <EmptyState icon={<BedDouble className="w-8 h-8" />} title="No short stays yet" description="Explore Short Stays and choose your dates to request your first stay." action={<Link to="/properties?category=short_stay" className="btn-primary">Explore Short Stays</Link>} /> : <div className="space-y-4">{bookings.map((b) => { const listing = b.short_stay_listings as Record<string,unknown>|null; const property = b.properties as Record<string,unknown>|null; return <Card key={String(b.id)} className="p-5"><div className="flex flex-col gap-5 md:flex-row"><div className="h-36 w-full overflow-hidden rounded-2xl bg-ink-100 md:w-48 shrink-0"><img src={String((property?.photos as string[]|undefined)?.[0] || '')} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">{String(listing?.listing_name || property?.name || 'Short stay')}</p><h2 className="mt-1 text-lg font-bold text-ink-900">{String(property?.name || 'Property')}</h2><p className="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin className="h-3.5 w-3.5" />{String(property?.town || '')}, {String(property?.county || '')}</p></div><div className="badge bg-brand-50 text-brand-700">{String(b.status || 'pending')}</div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-xs text-ink-400">Check-in</p><p className="mt-1 font-semibold">{String(b.check_in)}</p></div><div><p className="text-xs text-ink-400">Check-out</p><p className="mt-1 font-semibold">{String(b.check_out)}</p></div><div><p className="text-xs text-ink-400">Guests</p><p className="mt-1 font-semibold">{String(b.guests)}</p></div><div><p className="text-xs text-ink-400">Total</p><p className="mt-1 font-semibold text-brand-700">{formatKES(Number(b.total_amount || 0))}</p></div></div><p className="mt-4 flex items-center gap-2 text-xs text-ink-400"><CalendarDays className="h-3.5 w-3.5" /> Booking submitted {timeAgo(String(b.created_at))}</p></div></div></Card>})}</div>}
  </main><Footer /></div>;
}
