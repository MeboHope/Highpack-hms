import { useState, useEffect } from 'react';
import { MapPin, BedDouble, Bath, ShieldCheck, Heart, Share2, Phone, Calendar, ChevronLeft, ChevronRight, Car, Wifi, Droplets, Zap, PawPrint, CheckCircle, X, MessageSquare , Music2 } from 'lucide-react';
import { Link, useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { formatKES, titleCase } from '@/lib/constants';
import { Badge, Spinner, EmptyState } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getPropertyImages } from '@/lib/images';
import type { Property, PropertyUnit, Profile } from '@/lib/supabase';

interface PropertyWithOwner extends Property {
  profiles: Pick<Profile, 'full_name' | 'phone'> | null;
}

export function PropertyDetailsPage({ propertyId }: { propertyId: string }) {
  const { navigate } = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [property, setProperty] = useState<PropertyWithOwner | null>(null);
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [gallery, setGallery] = useState<string[]>([]);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showReserve, setShowReserve] = useState<string | null>(null);
  const [showViewing, setShowViewing] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('properties')
        .select('*, profiles!properties_owner_id_fkey(full_name, phone)')
        .eq('id', propertyId)
        .maybeSingle();
      setProperty(data as PropertyWithOwner | null);

      const { data: unitData } = await supabase
        .from('property_units')
        .select('*')
        .eq('property_id', propertyId)
        .order('unit_number', { ascending: true });
      setUnits((unitData as PropertyUnit[]) || []);

      // Build gallery
      const prop = data as PropertyWithOwner | null;
      if (prop) {
        const photos = prop.photos?.length > 0 ? prop.photos : getPropertyImages(prop.property_type);
        setGallery(photos);
      }

      // Check favorite
      if (profile) {
        const { data: fav } = await supabase
          .from('favorites')
          .select('id')
          .eq('property_id', propertyId)
          .eq('user_id', profile.id)
          .maybeSingle();
        setIsFavorite(!!fav);
      }

      setLoading(false);
    })();
  }, [propertyId, profile]);

  const toggleFavorite = async () => {
    if (!profile) {
      toast('Please sign in to save properties', 'info');
      navigate('/login');
      return;
    }
    if (isFavorite) {
      await supabase.from('favorites').delete().eq('property_id', propertyId).eq('user_id', profile.id);
      setIsFavorite(false);
      toast('Removed from saved properties', 'info');
    } else {
      await supabase.from('favorites').insert({ property_id: propertyId, user_id: profile.id });
      setIsFavorite(true);
      toast('Property saved to your favorites', 'success');
    }
  };

  const shareProperty = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: property?.name, url }); } catch { /* user cancelled sharing */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast('Property link copied to clipboard', 'success');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Spinner className="w-8 h-8 text-brand-500" /></div>
  );

  if (!property) return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <EmptyState icon={<X className="w-8 h-8" />} title="Property not found" description="This property may have been removed or is no longer available." action={<Link to="/properties" className="btn-primary">Browse Properties</Link>} />
    </div>
  );

  const availableUnits = units.filter((u) => u.status === 'available');
  const minRent = units.length > 0 ? Math.min(...units.map((u) => u.monthly_rent)) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/properties')} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to Properties
      </button>

      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge bg-brand-100 text-brand-700"><ShieldCheck className="w-3 h-3" /> Verified Property</span>
            <span className="badge bg-ink-100 text-ink-600">{property.property_type}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900">{property.name}</h1>
          <p className="text-ink-500 flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4" />
            {property.estate ? `${property.estate}, ` : ''}{property.town}, {property.county}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleFavorite} className={`btn-secondary ${isFavorite ? 'text-red-500 border-red-200 bg-red-50' : ''}`}>
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500' : ''}`} />
            {isFavorite ? 'Saved' : 'Save'}
          </button>
          <button onClick={shareProperty} className="btn-secondary">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      {/* Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-8">
        <div className="lg:col-span-3 relative h-64 sm:h-96 rounded-2xl overflow-hidden bg-ink-100 group cursor-pointer" onClick={() => setShowLightbox(true)}>
          <img src={gallery[activeImage]} alt={property.name} className="w-full h-full object-cover" />
          {gallery.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage - 1 + gallery.length) % gallery.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage + 1) % gallery.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-ink-950/60 text-white text-xs px-3 py-1 rounded-full">
                {activeImage + 1} / {gallery.length}
              </div>
            </>
          )}
        </div>
        <div className="hidden lg:grid grid-rows-2 gap-3">
          {gallery.slice(1, 3).map((img, i) => (
            <div key={i} className="relative h-44 rounded-2xl overflow-hidden bg-ink-100 cursor-pointer hover:opacity-90" onClick={() => setActiveImage(i + 1)}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {property.videos?.length > 0 && (
        <div className="mb-8 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-ink-900">Property walkthroughs</h3><p className="text-sm text-ink-500">Watch owner-uploaded videos before booking a viewing or reservation.</p></div><span className="badge bg-brand-50 text-brand-700">{property.videos.length} video{property.videos.length === 1 ? '' : 's'}</span></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {property.videos.map((video) => <video key={video} src={video} controls preload="metadata" className="w-full rounded-xl bg-ink-950" />)}
          </div>
        </div>
      )}

      {property.audio?.length > 0 && (
        <div className="mb-8 rounded-2xl border border-accent-200 bg-accent-50/50 p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700"><Music2 className="h-5 w-5" /></div><div><h3 className="font-semibold text-ink-900">Audio property tour</h3><p className="text-sm text-ink-500">Listen to owner-provided information about the property.</p></div></div>
          <div className="space-y-3">{property.audio.map((track) => <audio key={track} src={track} controls className="w-full" />)}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <BedDouble className="w-5 h-5" />, label: 'Bedrooms', value: units[0]?.bedrooms ?? '—' },
              { icon: <Bath className="w-5 h-5" />, label: 'Bathrooms', value: units[0]?.bathrooms ?? '—' },
              { icon: <Car className="w-5 h-5" />, label: 'Parking', value: property.parking ? 'Yes' : 'No' },
              { icon: <Calendar className="w-5 h-5" />, label: 'Available', value: `${availableUnits.length} units` },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-2">{s.icon}</div>
                <p className="text-xs text-ink-500">{s.label}</p>
                <p className="font-semibold text-ink-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {property.description && (
            <div className="card p-6">
              <h3 className="font-semibold text-ink-900 mb-3">About this property</h3>
              <p className="text-ink-600 leading-relaxed">{property.description}</p>
            </div>
          )}

          {/* Features */}
          <div className="card p-6">
            <h3 className="font-semibold text-ink-900 mb-4">Property Features</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: <Droplets className="w-4 h-4" />, label: 'Water', value: property.water_availability },
                { icon: <Zap className="w-4 h-4" />, label: 'Electricity', value: property.electricity },
                { icon: <Wifi className="w-4 h-4" />, label: 'Internet', value: property.internet },
                { icon: <Car className="w-4 h-4" />, label: 'Parking', value: property.parking },
                { icon: <PawPrint className="w-4 h-4" />, label: 'Pets Allowed', value: property.pets_allowed },
                { icon: <ShieldCheck className="w-4 h-4" />, label: 'Security', value: !!property.security_info },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-sm">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${f.value ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-400'}`}>
                    {f.icon}
                  </span>
                  <span className={f.value ? 'text-ink-700' : 'text-ink-400'}>{f.label}</span>
                  {f.value ? <CheckCircle className="w-4 h-4 text-brand-500" /> : <X className="w-4 h-4 text-ink-300" />}
                </div>
              ))}
            </div>
            {property.amenities && property.amenities.length > 0 && (
              <>
                <h4 className="text-sm font-medium text-ink-700 mt-6 mb-3">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a) => (
                    <span key={a} className="badge bg-ink-100 text-ink-600">{a}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Units */}
          <div>
            <h3 className="font-semibold text-ink-900 mb-4">Available Units ({availableUnits.length})</h3>
            {units.length === 0 ? (
              <p className="text-ink-500 text-sm">No units listed yet.</p>
            ) : (
              <div className="space-y-3">
                {units.map((unit) => (
                  <div key={unit.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-ink-900">Unit {unit.unit_number}</h4>
                        <Badge status={unit.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-500">
                        <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {unit.bedrooms || 'Studio'}</span>
                        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {unit.bathrooms}</span>
                        {unit.floor && <span>Floor {unit.floor}</span>}
                        <span>{titleCase(unit.furnishing)}</span>
                      </div>
                      {unit.description && <p className="text-sm text-ink-500 mt-1">{unit.description}</p>}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <p className="text-xl font-bold text-brand-700">{formatKES(unit.monthly_rent)}<span className="text-sm font-normal text-ink-400">/mo</span></p>
                      <p className="text-xs text-ink-400">Deposit: {formatKES(unit.security_deposit)}</p>
                      {unit.status === 'available' ? (
                        <button onClick={() => { if (!profile) { toast('Please sign in to reserve', 'info'); navigate('/login'); return; } setShowReserve(unit.id); }} className="btn-primary text-sm">
                          Reserve for {formatKES(unit.reservation_fee)}
                        </button>
                      ) : (
                        <span className="badge bg-ink-100 text-ink-500">{titleCase(unit.status)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="card p-6">
            <h3 className="font-semibold text-ink-900 mb-4">Location</h3>
            <div className="rounded-xl overflow-hidden bg-brand-50 h-64 relative">
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                <MapPin className="w-12 h-12 text-brand-500" />
                <p className="text-ink-600 font-medium">{property.name}</p>
                <p className="text-sm text-ink-500">{property.address || `${property.estate || ''} ${property.town}, ${property.county}`}</p>
                {property.latitude && property.longitude && (
                  <p className="text-xs text-ink-400">{property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Price Card */}
          <div className="card p-6 sticky top-20">
            <p className="text-sm text-ink-500">Starting from</p>
            <p className="text-3xl font-bold text-brand-700 mb-1">{formatKES(minRent)}<span className="text-base font-normal text-ink-400">/month</span></p>
            <p className="text-sm text-ink-500 mb-6">{availableUnits.length} units available</p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  if (!profile) { toast('Please sign in to reserve', 'info'); navigate('/login'); return; }
                  const firstAvailable = availableUnits[0];
                  if (firstAvailable) setShowReserve(firstAvailable.id);
                }}
                className="btn-primary w-full"
                disabled={availableUnits.length === 0}
              >
                Reserve This House
              </button>
              <button onClick={() => setShowViewing(true)} className="btn-secondary w-full">
                <Calendar className="w-4 h-4" /> Schedule Viewing
              </button>
              <button onClick={() => setShowContact(true)} className="btn-secondary w-full">
                <Phone className="w-4 h-4" /> Contact Agent
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-ink-100">
              <p className="text-sm text-ink-500 mb-2">Reservation Fee</p>
              <p className="text-xl font-bold text-accent-600">KSh 2,000</p>
              <p className="text-xs text-ink-400 mt-1">Non-refundable · Deductible from deposit</p>
            </div>
          </div>

          {/* Agent Info */}
          {property.profiles && (
            <div className="card p-6">
              <h3 className="font-semibold text-ink-900 mb-3">Property Owner</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-lg">
                  {property.profiles.full_name?.[0]?.toUpperCase() || 'O'}
                </div>
                <div>
                  <p className="font-medium text-ink-900">{property.profiles.full_name || 'Property Owner'}</p>
                  <p className="text-sm text-ink-500">Property Owner</p>
                </div>
              </div>
              <button onClick={() => setShowContact(true)} className="btn-secondary w-full mt-4">
                <MessageSquare className="w-4 h-4" /> Message Owner
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div className="fixed inset-0 z-[100] bg-ink-950/90 flex items-center justify-center p-4" onClick={() => setShowLightbox(false)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-lg"><X className="w-6 h-6" /></button>
          <img src={gallery[activeImage]} alt="" className="max-w-full max-h-[90vh] object-contain" />
          {gallery.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage - 1 + gallery.length) % gallery.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full"><ChevronLeft className="w-8 h-8" /></button>
              <button onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage + 1) % gallery.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full"><ChevronRight className="w-8 h-8" /></button>
            </>
          )}
        </div>
      )}

      {/* Reservation Modal */}
      {showReserve && (
        <ReservationModal unitId={showReserve} propertyId={propertyId} onClose={() => setShowReserve(null)} />
      )}

      {/* Viewing Modal */}
      {showViewing && (
        <ViewingModal propertyId={propertyId} units={units} onClose={() => setShowViewing(false)} />
      )}

      {/* Contact Modal */}
      {showContact && (
        <ContactModal ownerName={property.profiles?.full_name} ownerPhone={property.profiles?.phone} onClose={() => setShowContact(false)} />
      )}
    </div>
  );
}

function ReservationModal({ unitId, propertyId, onClose }: { unitId: string; propertyId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { navigate } = useRouter();
  const [step, setStep] = useState<'summary' | 'pay' | 'processing' | 'success'>('summary');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card' | 'bank_transfer'>('mpesa');
  const [phone, setPhone] = useState('');
  const [reservationFee, setReservationFee] = useState(2000);
  const [durationHours, setDurationHours] = useState(48);

  useEffect(() => {
    (async () => {
      const [{ data: unit }, { data: settings }] = await Promise.all([
        supabase.from('property_units').select('reservation_fee').eq('id', unitId).maybeSingle(),
        supabase.from('system_settings').select('reservation_fee,reservation_duration_hours').eq('id', 1).maybeSingle(),
      ]);
      setReservationFee(Number(unit?.reservation_fee ?? settings?.reservation_fee ?? 2000));
      setDurationHours(Number(settings?.reservation_duration_hours ?? 48));
    })();
  }, [unitId]);

  const handleReserve = async () => {
    if (!profile) return;
    setStep('processing');

    let { data: resData, error: resError } = await supabase.rpc('create_reservation', { p_unit_id: unitId, p_duration_hours: durationHours });
    if ((resError || !resData) && resError?.message?.toLowerCase().includes('function') ) {
      const { data: unit } = await supabase.from('property_units').select('property_id,status,reservation_fee').eq('id', unitId).maybeSingle();
      if (unit?.status === 'available') {
        const expires = new Date(Date.now() + durationHours * 3600000).toISOString();
        const { data: direct, error: directError } = await supabase.from('reservations').insert({ unit_id: unitId, property_id: unit.property_id, customer_id: profile.id, reservation_fee: Number(unit.reservation_fee || reservationFee), status: 'pending', expires_at: expires }).select('*').single();
        if (!directError && direct) { await supabase.from('property_units').update({ status: 'reserved' }).eq('id', unitId).eq('status','available'); resData = direct; resError = null; }
      }
    }
    if (resError || !resData) {
      const message = resError?.message || 'Could not create reservation. Please try again.';
      toast(message.includes('already') || message.includes('reserved') ? 'This unit is no longer available.' : message, 'error');
      setStep('summary');
      return;
    }

    const { error: paymentError } = await supabase.from('payments').insert({
      user_id: profile.id,
      reservation_id: resData.id,
      property_id: propertyId,
      unit_id: unitId,
      amount: Number(resData.reservation_fee || reservationFee),
      payment_type: 'reservation',
      payment_method: paymentMethod,
      status: 'pending',
      verified: false,
    });

    if (paymentError) {
      toast(`Reservation created, but payment setup failed: ${paymentError.message}`, 'error');
      setStep('summary');
      return;
    }

    setStep('success');

  };

  return (
    <Modal open onClose={onClose} title="Reserve This House" size="md">
      {step === 'summary' && (
        <div>
          <div className="bg-brand-50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-ink-900 mb-2">Reservation Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Reservation Fee</span> <span className="font-semibold">{formatKES(reservationFee)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Policy</span> <span>Non-refundable</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Valid For</span> <span>{durationHours} hours</span></div>
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'mpesa', label: 'M-Pesa' },
                { value: 'card', label: 'Card' },
                { value: 'bank_transfer', label: 'Bank' },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value as typeof paymentMethod)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    paymentMethod === m.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {paymentMethod === 'mpesa' && (
            <div className="mb-4">
              <label className="label">M-Pesa Phone Number</label>
              <input className="input" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="text-xs text-ink-400 mt-1">You'll receive an STK push prompt to confirm payment.</p>
            </div>
          )}
          <div className="bg-yellow-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-yellow-700">
              By proceeding, you agree to the configured reservation fee. The exact fee and holding period are shown above.
            </p>
          </div>
          <button onClick={handleReserve} className="btn-primary w-full">
            Continue with {formatKES(reservationFee)} Reservation
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div className="text-center py-8">
          <Spinner className="w-12 h-12 text-brand-500 mx-auto mb-4" />
          <h4 className="font-semibold text-ink-900 mb-1">Processing Payment</h4>
          <p className="text-sm text-ink-500">Please wait while we confirm your transaction...</p>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-ink-900 text-lg mb-1">Reservation Request Received!</h4>
          <p className="text-sm text-ink-500 mb-6">Your reservation hold is active for {durationHours} hours. Payment confirmation is still pending and will only be marked successful by the payment provider.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/tenant')} className="btn-primary flex-1">Complete Tenancy</button>
            <button onClick={onClose} className="btn-secondary flex-1">Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ViewingModal({ propertyId, units, onClose }: { propertyId: string; units: PropertyUnit[]; onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { navigate } = useRouter();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [unitId, setUnitId] = useState(units[0]?.id || '');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) { toast('Please sign in first', 'info'); navigate('/login'); return; }
    const { error } = await supabase.from('viewing_appointments').insert({
      property_id: propertyId,
      unit_id: unitId || null,
      customer_id: profile.id,
      appointment_date: date,
      appointment_time: time,
      status: 'requested',
      notes,
    });
    if (error) { toast('Could not schedule viewing. Try again.', 'error'); return; }
    toast('Viewing request sent! The owner will confirm shortly.', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Schedule a Viewing" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Select Unit</label>
          <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.id}>Unit {u.unit_number} — {formatKES(u.monthly_rent)}/mo</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="input" required value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any questions or special requests?" />
        </div>
        <button type="submit" className="btn-primary w-full">Request Viewing</button>
      </form>
    </Modal>
  );
}

function ContactModal({ ownerName, ownerPhone, onClose }: { ownerName?: string | null; ownerPhone?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  return (
    <Modal open onClose={onClose} title="Contact Owner" size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-semibold">
            {ownerName?.[0]?.toUpperCase() || 'O'}
          </div>
          <div>
            <p className="font-semibold text-ink-900">{ownerName || 'Property Owner'}</p>
            <p className="text-sm text-ink-500">Responds within 2 hours</p>
          </div>
        </div>
        {ownerPhone && (
          <a href={`tel:${ownerPhone}`} className="btn-secondary w-full">
            <Phone className="w-4 h-4" /> Call {ownerPhone}
          </a>
        )}
        <div>
          <label className="label">Send a message</label>
          <textarea className="input" rows={4} placeholder="Hi, I'm interested in your property..." />
        </div>
        <button className="btn-primary w-full" onClick={() => { toast('Message sent! The owner will respond soon.', 'success'); onClose(); }}>
          <MessageSquare className="w-4 h-4" /> Send Message
        </button>
      </div>
    </Modal>
  );
}
