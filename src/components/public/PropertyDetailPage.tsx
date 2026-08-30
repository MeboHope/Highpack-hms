import { useState, useEffect } from 'react';
import { Bed, Bath, Car, Square, MapPin, Heart, Phone, Mail, Calendar, CheckCircle2, ArrowLeft, X, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Property, PropertyImage, SystemSettings, Favorite } from '@/lib/types';
import { Badge, Button, Modal, Input, Select, Textarea, LoadingScreen, EmptyState } from '@/components/ui';
import { formatKES, availabilityColor, availabilityLabel, propertyTypeLabel } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { generateReference } from '@/lib/utils';

interface PropertyDetailPageProps {
  propertyId: string;
  navigate: (path: string) => void;
}

export function PropertyDetailPage({ propertyId, navigate }: PropertyDetailPageProps) {
  const { user, profile } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [showViewing, setShowViewing] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    async function load() {
      const [propRes, imgRes, settingsRes] = await Promise.all([
        supabase.from('properties').select('*').eq('id', propertyId).maybeSingle(),
        supabase.from('property_images').select('*').eq('property_id', propertyId).order('sort_order', { ascending: true }),
        supabase.from('system_settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      setProperty(propRes.data as Property | null);
      setImages((imgRes.data ?? []) as PropertyImage[]);
      setSettings(settingsRes.data as SystemSettings | null);

      if (user) {
        const { data: fav } = await supabase.from('favorites').select('*').eq('property_id', propertyId).eq('customer_id', user.id).maybeSingle();
        setIsFavorite(!!fav);
      }

      // Increment view count
      if (propRes.data) {
        await supabase.rpc('increment_views', { property_id: propertyId }).then(() => {});
      }
      setLoading(false);
    }
    load();
  }, [propertyId, user]);

  const toggleFavorite = async () => {
    if (!user) { navigate('/signin'); return; }
    if (isFavorite) {
      await supabase.from('favorites').delete().eq('property_id', propertyId).eq('customer_id', user.id);
      setIsFavorite(false);
    } else {
      await supabase.from('favorites').insert({ property_id: propertyId, customer_id: user.id });
      setIsFavorite(true);
    }
  };

  if (loading) return <LoadingScreen message="Loading property details..." />;
  if (!property) return <EmptyState title="Property not found" message="This property may have been removed." action={<Button onClick={() => navigate('/properties')}>Browse Properties</Button>} />;

  const mainImage = images.find((img) => img.category === 'main') ?? images[0];
  const galleryImages = images.length > 0 ? images : [{ url: 'https://images.pexels.com/photos/6585598/pexels-photo-6585598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', caption: 'Property', category: 'main', sort_order: 0, id: 'default', property_id: propertyId }];
  const displayImage = galleryImages[activeImage] ?? galleryImages[0];

  const price = property.listing_type === 'sale' || property.listing_type === 'both'
    ? (property.selling_price ? formatKES(property.selling_price) : null)
    : (property.monthly_rent ? `${formatKES(property.monthly_rent)}/mo` : null);

  const canReserve = property.availability_status === 'available';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button onClick={() => navigate('/properties')} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-teal-700">
          <ArrowLeft className="h-4 w-4" /> Back to Properties
        </button>

        {/* Image Gallery */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="relative aspect-[16/10] cursor-pointer" onClick={() => setLightbox(true)}>
            <img src={displayImage.url} alt={displayImage.caption ?? property.title} className="h-full w-full object-cover" />
            <div className="absolute left-3 top-3 flex gap-2">
              <Badge className={availabilityColor(property.availability_status)}>{availabilityLabel(property.availability_status)}</Badge>
              {property.is_featured && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Featured</Badge>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(); }} className="absolute right-3 top-3 rounded-full bg-white/90 p-2.5 shadow-md transition-colors hover:bg-white">
              <Heart className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />
            </button>
            {galleryImages.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage - 1 + galleryImages.length) % galleryImages.length); }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md hover:bg-white">
                  <ChevronLeft className="h-5 w-5 text-slate-700" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage + 1) % galleryImages.length); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md hover:bg-white">
                  <ChevronRight className="h-5 w-5 text-slate-700" />
                </button>
              </>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3">
              {galleryImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${activeImage === i ? 'border-teal-600' : 'border-transparent'}`}
                >
                  <img src={img.url} alt={img.caption ?? ''} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{property.title}</h1>
                  <p className="mt-1 flex items-center gap-1 text-slate-500">
                    <MapPin className="h-4 w-4" /> {property.address ?? property.estate ?? property.town ?? property.county ?? 'Kenya'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-teal-700">{price}</p>
                  {property.security_deposit && <p className="text-sm text-slate-500">Deposit: {formatKES(property.security_deposit)}</p>}
                </div>
              </div>

              {/* Key Details */}
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { icon: Bed, label: 'Bedrooms', value: property.bedrooms },
                  { icon: Bath, label: 'Bathrooms', value: property.bathrooms },
                  { icon: Car, label: 'Parking', value: property.parking_spaces },
                  { icon: Square, label: 'Size', value: property.floor_size ? `${property.floor_size} sqft` : '—' },
                ].map((detail) => (
                  <div key={detail.label} className="rounded-xl bg-slate-50 p-3 text-center">
                    <detail.icon className="mx-auto h-5 w-5 text-slate-400" />
                    <p className="mt-1 text-lg font-semibold text-slate-900">{detail.value}</p>
                    <p className="text-xs text-slate-500">{detail.label}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-slate-900">About this property</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{property.description}</p>
              </div>

              {/* Property Info */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Property Details</h3>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-slate-500">Type</dt><dd className="font-medium text-slate-900">{propertyTypeLabel(property.property_type)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Listing</dt><dd className="font-medium text-slate-900 capitalize">{property.listing_type}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Furnished</dt><dd className="font-medium text-slate-900">{property.furnished ? 'Yes' : 'No'}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">County</dt><dd className="font-medium text-slate-900">{property.county ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Town</dt><dd className="font-medium text-slate-900">{property.town ?? '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Estate</dt><dd className="font-medium text-slate-900">{property.estate ?? '—'}</dd></div>
                  </dl>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Nearby Landmarks</h3>
                  <p className="mt-2 text-sm text-slate-600">{property.nearby_landmarks ?? 'No landmarks listed'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Reserve This House</h3>
              <p className="mt-1 text-sm text-slate-500">
                Secure this property with a reservation fee of <span className="font-semibold text-teal-700">{formatKES(settings?.reservation_fee ?? property.reservation_fee ?? 2000)}</span>
              </p>

              <div className="mt-4 space-y-3">
                <Button
                  onClick={() => canReserve ? setShowReserve(true) : null}
                  disabled={!canReserve}
                  size="lg"
                  className="w-full"
                >
                  {canReserve ? 'Reserve This House' : 'Not Available'}
                </Button>
                <Button onClick={() => setShowViewing(true)} variant="outline" size="lg" className="w-full">
                  <Calendar className="h-4 w-4" /> Schedule Viewing
                </Button>
              </div>

              {property.contact_phone && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Contact Agent</p>
                  <p className="mt-1 text-sm text-slate-600">{property.contact_name ?? 'Agent'}</p>
                  <div className="mt-2 flex gap-2">
                    {property.contact_phone && (
                      <a href={`tel:${property.contact_phone}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    )}
                    {property.contact_email && (
                      <a href={`mailto:${property.contact_email}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-start gap-2 rounded-xl bg-teal-50 p-3 text-xs text-teal-800">
                <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>Your reservation fee is fully refundable if the property is not as described. Secure payment via M-Pesa, Card, or Bank Transfer.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setLightbox(false)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-6 w-6" /></button>
          <img src={displayImage.url} alt={displayImage.caption ?? property.title} className="max-h-[90vh] max-w-[90vw] object-contain" />
        </div>
      )}

      {/* Reservation Modal */}
      {showReserve && settings && (
        <ReservationModal
          property={property}
          settings={settings}
          userId={user?.id}
          userEmail={profile?.email ?? user?.email ?? ''}
          userName={profile?.full_name ?? ''}
          userPhone={profile?.phone ?? ''
          }
          onClose={() => setShowReserve(false)}
          navigate={navigate}
        />
      )}

      {/* Viewing Modal */}
      {showViewing && (
        <ViewingModal
          property={property}
          userId={user?.id}
          userEmail={profile?.email ?? user?.email ?? ''}
          userName={profile?.full_name ?? ''}
          userPhone={profile?.phone ?? ''}
          onClose={() => setShowViewing(false)}
        />
      )}
    </div>
  );
}

function ReservationModal({ property, settings, userId, userEmail, userName, userPhone, onClose, navigate }: {
  property: Property; settings: SystemSettings; userId?: string; userEmail: string; userName: string; userPhone: string;
  onClose: () => void; navigate: (path: string) => void;
}) {
  const [form, setForm] = useState({
    name: userName, phone: userPhone, email: userEmail, idNumber: '', moveInDate: '', notes: '', paymentMethod: 'mpesa', phoneForMpesa: userPhone,
  });
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservationRef, setReservationRef] = useState<string>('');

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.email) { setError('Please fill in all required fields'); return; }
    setError(null);
    setSubmitting(true);

    const ref = generateReference('RES');
    const expiresAt = new Date(Date.now() + settings.reservation_expiration_minutes * 60 * 1000).toISOString();

    const { data, error: insertError } = await supabase.from('reservations').insert({
      reference: ref,
      property_id: property.id,
      customer_id: userId ?? null,
      customer_name: form.name,
      customer_phone: form.phone,
      customer_email: form.email,
      id_number: form.idNumber || null,
      preferred_move_in: form.moveInDate || null,
      reservation_fee: settings.reservation_fee,
      status: 'pending_payment',
      notes: form.notes || null,
      expires_at: expiresAt,
    }).select().single();

    setSubmitting(false);
    if (insertError) { setError('Failed to create reservation. Please try again.'); return; }
    setReservationRef(ref);
    setStep('payment');
  };

  const handlePayment = async () => {
    setSubmitting(true);
    setError(null);

    const txRef = generateReference('PAY');
    const { data: paymentData } = await supabase.from('payments').insert({
      transaction_id: txRef,
      payment_reference: reservationRef,
      reservation_id: null,
      customer_id: userId ?? null,
      property_id: property.id,
      amount: settings.reservation_fee,
      payment_method: form.paymentMethod,
      phone: form.phoneForMpesa,
      status: 'successful',
    }).select().single();

    // Update reservation status
    await supabase.from('reservations').update({ status: 'confirmed' }).eq('reference', reservationRef);

    // Update property status
    await supabase.from('properties').update({ availability_status: 'reserved' }).eq('id', property.id);

    // Create notification
    if (userId) {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Reservation Confirmed',
        message: `Your reservation for "${property.title}" has been confirmed. Reference: ${reservationRef}`,
        type: 'reservation',
      });
    }

    setSubmitting(false);
    setStep('success');
  };

  return (
    <Modal open={true} onClose={onClose} title={step === 'success' ? 'Reservation Confirmed' : step === 'payment' ? 'Payment' : 'Reserve This House'} size="md">
      {step === 'form' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-teal-50 p-3 text-sm">
            <p className="font-semibold text-teal-900">{property.title}</p>
            <p className="mt-1 text-teal-700">Reservation Fee: <span className="font-bold">{formatKES(settings.reservation_fee)}</span></p>
          </div>
          <Input label="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone Number *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 712 345 678" />
            <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ID/Passport Number" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} placeholder="12345678" />
            <Input label="Preferred Move-in Date" type="date" value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} />
          </div>
          <Textarea label="Additional Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Any special requests..." />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">{submitting ? 'Processing...' : 'Continue to Payment'}</Button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Property</span><span className="font-medium">{property.title}</span></div>
            <div className="mt-1 flex justify-between text-sm"><span className="text-slate-500">Reservation Ref</span><span className="font-medium">{reservationRef}</span></div>
            <div className="mt-1 flex justify-between text-lg"><span className="font-semibold text-slate-900">Amount Due</span><span className="font-bold text-teal-700">{formatKES(settings.reservation_fee)}</span></div>
          </div>
          <Select label="Payment Method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
            {settings.mpesa_enabled && <option value="mpesa">M-Pesa</option>}
            {settings.card_enabled && <option value="card">Card Payment</option>}
            {settings.bank_transfer_enabled && <option value="bank">Bank Transfer</option>}
          </Select>
          {form.paymentMethod === 'mpesa' && (
            <Input label="M-Pesa Phone Number" value={form.phoneForMpesa} onChange={(e) => setForm({ ...form, phoneForMpesa: e.target.value })} placeholder="+254 712 345 678" />
          )}
          {form.paymentMethod === 'card' && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-500">
              <p>You will be redirected to a secure payment page. We never store your card details.</p>
            </div>
          )}
          {form.paymentMethod === 'bank' && (
            <div className="space-y-1 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
              <p>Bank: Equity Bank Kenya</p>
              <p>Account: Nyumba254 Ltd</p>
              <p>Account No: 011-000-000-000</p>
              <p>Use reference: {reservationRef}</p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('form')} className="flex-1">Back</Button>
            <Button onClick={handlePayment} disabled={submitting} className="flex-1">
              {submitting ? 'Processing...' : `Pay ${formatKES(settings.reservation_fee)}`}
            </Button>
          </div>
          <p className="text-center text-xs text-slate-400">Demo payment — no real transaction is processed.</p>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">Reservation Confirmed!</h3>
          <p className="mt-2 text-sm text-slate-500">Your reservation has been successfully created.</p>
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-left text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-semibold">{reservationRef}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-slate-500">Property</span><span className="font-medium">{property.title}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-slate-500">Amount Paid</span><span className="font-medium">{formatKES(settings.reservation_fee)}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-slate-500">Status</span><span className="font-medium text-green-700">Confirmed</span></div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
            <Button onClick={() => { onClose(); navigate('/dashboard'); }} className="flex-1">View My Reservations</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ViewingModal({ property, userId, userEmail, userName, userPhone, onClose }: {
  property: Property; userId?: string; userEmail: string; userName: string; userPhone: string; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: userName, phone: userPhone, email: userEmail, date: '', time: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.email || !form.date || !form.time) { setError('Please fill in all required fields'); return; }
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from('viewings').insert({
      property_id: property.id,
      customer_id: userId ?? null,
      customer_name: form.name,
      customer_phone: form.phone,
      customer_email: form.email,
      preferred_date: form.date,
      preferred_time: form.time,
      status: 'requested',
      notes: form.notes || null,
    });
    setSubmitting(false);
    if (insertError) { setError('Failed to schedule viewing. Please try again.'); return; }
    setSuccess(true);
  };

  return (
    <Modal open={true} onClose={onClose} title={success ? 'Viewing Scheduled' : 'Schedule a Viewing'} size="md">
      {success ? (
        <div className="text-center py-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">Viewing Request Sent!</h3>
          <p className="mt-2 text-sm text-slate-500">An agent will contact you shortly to confirm your viewing appointment for "{property.title}".</p>
          <Button onClick={onClose} className="mt-6 w-full">Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-teal-50 p-3 text-sm">
            <p className="font-semibold text-teal-900">{property.title}</p>
          </div>
          <Input label="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 712 345 678" />
            <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Preferred Date *" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input label="Preferred Time *" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Any specific requests..." />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">{submitting ? 'Submitting...' : 'Request Viewing'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
