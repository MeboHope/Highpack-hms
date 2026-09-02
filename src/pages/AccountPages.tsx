import { useState, useEffect } from 'react';
import { Heart, Bell, MapPin, CheckCircle, Trash2 } from 'lucide-react';
import { Header, Footer } from '@/components/Layout';
import { Card, Badge, EmptyState, LoadingPage } from '@/components/ui';
import { Link } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/constants';
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
        <h1 className="text-2xl font-bold text-ink-900 mb-6">My Saved Houses</h1>
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
