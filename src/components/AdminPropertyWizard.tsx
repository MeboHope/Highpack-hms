import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Upload, X, Star, Save, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, Input, Select, Textarea, Card, Badge } from '@/components/ui';
import { PROPERTY_TYPES, KENYAN_COUNTIES, AMENITIES_LIST } from '@/lib/utils';

const STEPS = [
  'Basic Info', 'Location', 'Details', 'Pricing', 'Amenities', 'Images', 'Availability', 'Publish',
];

export function AddPropertyWizard({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: '', description: '', property_type: 'apartment', listing_type: 'rent',
    county: '', town: '', estate: '', address: '', latitude: '', longitude: '',
    bedrooms: '0', bathrooms: '0', parking_spaces: '0', floor_size: '', furnished: false,
    monthly_rent: '', selling_price: '', security_deposit: '', reservation_fee: '',
    availability_status: 'available', is_featured: false, is_published: false,
    contact_name: '', contact_phone: '', contact_email: '', nearby_landmarks: '',
  });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<{ url: string; caption: string; category: string }[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, value: any) => setForm({ ...form, [key]: value });

  const toggleAmenity = (a: string) => {
    setAmenities(amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a]);
  };

  const addImage = () => {
    if (!imageUrlInput) return;
    setImageUrls([...imageUrls, { url: imageUrlInput, caption: '', category: 'gallery' }]);
    setImageUrlInput('');
  };

  const removeImage = (idx: number) => setImageUrls(imageUrls.filter((_, i) => i !== idx));
  const setMainImage = (idx: number) => setImageUrls(imageUrls.map((img, i) => ({ ...img, category: i === idx ? 'main' : img.category === 'main' ? 'gallery' : img.category })));

  const handleSave = async (publish: boolean) => {
    if (!form.title) { setError('Property title is required'); setStep(0); return; }
    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase.from('properties').insert({
      title: form.title,
      description: form.description || null,
      property_type: form.property_type,
      listing_type: form.listing_type,
      county: form.county || null,
      town: form.town || null,
      estate: form.estate || null,
      address: form.address || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      bedrooms: parseInt(form.bedrooms) || 0,
      bathrooms: parseInt(form.bathrooms) || 0,
      parking_spaces: parseInt(form.parking_spaces) || 0,
      floor_size: form.floor_size ? parseFloat(form.floor_size) : null,
      furnished: form.furnished,
      monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : null,
      selling_price: form.selling_price ? parseFloat(form.selling_price) : null,
      security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
      reservation_fee: form.reservation_fee ? parseFloat(form.reservation_fee) : null,
      availability_status: form.availability_status,
      is_featured: form.is_featured,
      is_published: publish,
      owner_id: user?.id ?? null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      nearby_landmarks: form.nearby_landmarks || null,
    }).select().single();

    if (insertError || !data) {
      setError('Failed to save property. Please try again.');
      setSaving(false);
      return;
    }

    if (imageUrls.length > 0) {
      await supabase.from('property_images').insert(imageUrls.map((img, i) => ({
        property_id: data.id,
        url: img.url,
        caption: img.caption || null,
        category: img.category,
        sort_order: i,
      })));
    }

    setSaving(false);
    onDone();
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <div className="mb-6 flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center">
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${i < step ? 'bg-teal-700 text-white' : i === step ? 'bg-teal-600 text-white ring-4 ring-teal-100' : 'bg-slate-200 text-slate-500'}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`ml-2 hidden text-sm font-medium sm:block ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 rounded ${i < step ? 'bg-teal-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>
            <Input label="Property Title *" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Modern 2 Bedroom Apartment in Kilimani" />
            <Select label="Property Type" value={form.property_type} onChange={(e) => update('property_type', e.target.value)}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Select label="Listing Type" value={form.listing_type} onChange={(e) => update('listing_type', e.target.value)}>
              <option value="rent">For Rent</option>
              <option value="sale">For Sale</option>
              <option value="both">Both</option>
            </Select>
            <Textarea label="Description" value={form.description} onChange={(e) => update('description', e.target.value)} rows={4} placeholder="Describe the property..." />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Location</h3>
            <div className="grid grid-cols-2 gap-3">
              <Select label="County" value={form.county} onChange={(e) => update('county', e.target.value)}>
                <option value="">Select County</option>
                {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input label="Town" value={form.town} onChange={(e) => update('town', e.target.value)} placeholder="Kilimani" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Estate" value={form.estate} onChange={(e) => update('estate', e.target.value)} placeholder="Kilimani" />
              <Input label="Address" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Kindaruma Road" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Latitude" type="number" value={form.latitude} onChange={(e) => update('latitude', e.target.value)} placeholder="-1.2920" />
              <Input label="Longitude" type="number" value={form.longitude} onChange={(e) => update('longitude', e.target.value)} placeholder="36.7819" />
            </div>
            <Textarea label="Nearby Landmarks" value={form.nearby_landmarks} onChange={(e) => update('nearby_landmarks', e.target.value)} rows={2} placeholder="Yaya Centre, Kilimani Police Station" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Property Details</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input label="Bedrooms" type="number" value={form.bedrooms} onChange={(e) => update('bedrooms', e.target.value)} />
              <Input label="Bathrooms" type="number" value={form.bathrooms} onChange={(e) => update('bathrooms', e.target.value)} />
              <Input label="Parking" type="number" value={form.parking_spaces} onChange={(e) => update('parking_spaces', e.target.value)} />
              <Input label="Size (sqft)" type="number" value={form.floor_size} onChange={(e) => update('floor_size', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.furnished} onChange={(e) => update('furnished', e.target.checked)} className="rounded border-slate-300" /> Furnished
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Pricing</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Monthly Rent (KSh)" type="number" value={form.monthly_rent} onChange={(e) => update('monthly_rent', e.target.value)} placeholder="85000" />
              <Input label="Selling Price (KSh)" type="number" value={form.selling_price} onChange={(e) => update('selling_price', e.target.value)} placeholder="45000000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Security Deposit (KSh)" type="number" value={form.security_deposit} onChange={(e) => update('security_deposit', e.target.value)} placeholder="170000" />
              <Input label="Reservation Fee (KSh)" type="number" value={form.reservation_fee} onChange={(e) => update('reservation_fee', e.target.value)} placeholder="2000" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Amenities</h3>
            <p className="text-sm text-slate-500">Select the amenities available at this property</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AMENITIES_LIST.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAmenity(a)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${amenities.includes(a) ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {amenities.includes(a) && <Check className="h-4 w-4" />} {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Property Images</h3>
            <p className="text-sm text-slate-500">Add image URLs for the property. You can set one as the main image.</p>
            <div className="flex gap-2">
              <input value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} placeholder="Paste image URL..." className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none" />
              <Button onClick={addImage} variant="outline"><Upload className="h-4 w-4" /> Add</Button>
            </div>
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {imageUrls.map((img, i) => (
                  <div key={i} className="relative overflow-hidden rounded-lg border border-slate-200">
                    <img src={img.url} alt="" className="h-32 w-full object-cover" />
                    {img.category === 'main' && <Badge className="absolute left-2 top-2 bg-teal-700 text-white border-teal-600">Main</Badge>}
                    <button onClick={() => removeImage(i)} className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow-sm hover:bg-white"><X className="h-3 w-3 text-red-500" /></button>
                    <button onClick={() => setMainImage(i)} className="absolute bottom-2 right-2 rounded-full bg-white/90 p-1 shadow-sm hover:bg-white" title="Set as main"><Star className="h-3 w-3 text-slate-600" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Availability & Contact</h3>
            <Select label="Availability Status" value={form.availability_status} onChange={(e) => update('availability_status', e.target.value)}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="unavailable">Unavailable</option>
            </Select>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => update('is_featured', e.target.checked)} className="rounded border-slate-300" /> Featured Property
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input label="Contact Name" value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} placeholder="James Mwangi" />
              <Input label="Contact Phone" value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} placeholder="+254 712 345 678" />
              <Input label="Contact Email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} placeholder="agent@nyumba254.co.ke" />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Review & Publish</h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-semibold text-slate-900">{form.title || 'Untitled Property'}</h4>
              <p className="mt-1 text-sm text-slate-500">{form.county}, {form.town} {form.estate ? `— ${form.estate}` : ''}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                <span>Type: {PROPERTY_TYPES.find((t) => t.value === form.property_type)?.label}</span>
                <span>Bedrooms: {form.bedrooms}</span>
                <span>Bathrooms: {form.bathrooms}</span>
                {form.monthly_rent && <span>Rent: KSh {form.monthly_rent}</span>}
                {form.selling_price && <span>Price: KSh {form.selling_price}</span>}
                <span>Status: {form.availability_status}</span>
              </div>
              {imageUrls.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {imageUrls.map((img, i) => <img key={i} src={img.url} alt="" className="h-16 w-24 flex-shrink-0 rounded-lg object-cover" />)}
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : onDone()}>
            <ChevronLeft className="h-4 w-4" /> {step > 0 ? 'Back' : 'Cancel'}
          </Button>
          {step < 7 ? (
            <Button onClick={() => setStep(step + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}><Save className="h-4 w-4" /> Save as Draft</Button>
              <Button onClick={() => handleSave(true)} disabled={saving}><Eye className="h-4 w-4" /> {saving ? 'Publishing...' : 'Publish Property'}</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
