import { Home, Mail, Phone, MapPin, Search, ShieldCheck, TrendingUp, Building2, MessageCircle, Navigation } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Link } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';

function AboutCount({ value, suffix = '', prefix = '', label }: { value: number; suffix?: string; prefix?: string; label: string }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setStarted(true); }, { threshold: .5 });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    const start = performance.now(); const duration = 1600; let frame = 0;
    const tick = (now: number) => { const progress = Math.min(1, (now-start)/duration); const eased = 1-Math.pow(1-progress,3); setCount(Math.floor(value*eased)); if(progress<1) frame=requestAnimationFrame(tick); else setCount(value); };
    frame=requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [started, value]);
  return <div ref={ref} className="card group p-6 text-center hover:-translate-y-1 transition-all hover:shadow-soft-lg"><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-accent-500 transition-all group-hover:w-16" /><p className="text-3xl sm:text-4xl font-bold text-brand-700 tabular-nums">{prefix}{count.toLocaleString()}{suffix}</p><p className="text-sm text-ink-500 mt-1">{label}</p></div>;
}

export function AboutPage() {
  const [stats, setStats] = useState([
    { value: 0, suffix: '+', label: 'Verified Properties' },
    { value: 0, suffix: '+', label: 'Customer Accounts' },
    { value: 0, suffix: '+', label: 'Counties Represented' },
    { value: 0, prefix: 'KSh ', suffix: '+', label: 'Verified Rent Processed' },
  ]);
  useEffect(() => {
    (async () => {
      const [{ count: propertyCount }, { count: customerCount }, { data: countyRows }, { data: paymentRows }] = await Promise.all([
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('properties').select('county').eq('status', 'verified'),
        supabase.from('payments').select('amount').eq('payment_type', 'rent').eq('status', 'successful').eq('verified', true),
      ]);
      const counties = new Set((countyRows || []).map((row) => row.county).filter(Boolean)).size;
      const rent = Math.round((paymentRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0));
      setStats([
        { value: propertyCount || 0, suffix: '+', label: 'Verified Properties' },
        { value: customerCount || 0, suffix: '+', label: 'Customer Accounts' },
        { value: counties, suffix: '+', label: 'Counties Represented' },
        { value: rent, prefix: 'KSh ', suffix: '+', label: 'Verified Rent Processed' },
      ]);
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 text-brand-700 text-sm font-medium mb-4">
          <Home className="w-4 h-4" /> About HighPark Consult
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink-900 mb-4">Kenya's trusted property platform</h1>
        <p className="text-lg text-ink-500 max-w-2xl mx-auto">
          We connect tenants and property owners across Kenya — making it easy to find homes, reserve online, and manage tenancy from start to finish.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[
          { icon: <Search className="w-6 h-6" />, title: 'Our Mission', desc: 'To make finding and managing a home in Kenya simple, transparent, and accessible to everyone with a smartphone.' },
          { icon: <ShieldCheck className="w-6 h-6" />, title: 'Verified Only', desc: 'Every property on HighPark Consult is verified by our team. No fake listings, no wasted trips to properties that don\'t exist.' },
          { icon: <TrendingUp className="w-6 h-6" />, title: 'Our Vision', desc: 'To become Kenya\'s largest and most trusted property marketplace, serving tenants, owners, and managers nationwide.' },
        ].map((item) => (
          <div key={item.title} className="card p-6">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">{item.icon}</div>
            <h3 className="font-semibold text-ink-900 mb-2">{item.title}</h3>
            <p className="text-sm text-ink-500">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="card p-8 mb-12">
        <h2 className="text-2xl font-bold text-ink-900 mb-6">What we offer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { icon: <Search className="w-5 h-5" />, title: 'For Tenants', items: ['Browse verified properties across 20+ counties', 'Reserve any available house online for KSh 2,000', 'Pay rent via M-Pesa, card, or bank transfer', 'Track invoices, receipts, and payment history', 'Submit maintenance requests from your phone', 'Sign tenancy agreements electronically'] },
            { icon: <Building2 className="w-5 h-5" />, title: 'For Property Owners', items: ['List and manage unlimited properties and units', 'Track rent collection and outstanding balances', 'Record expenses and generate financial reports', 'Automated tax calculations with KRA support', 'Manage maintenance requests and assign technicians', 'Owner payouts with configurable schedules'] },
          ].map((section) => (
            <div key={section.title}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center">{section.icon}</div>
                <h3 className="font-semibold text-ink-900">{section.title}</h3>
              </div>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {stats.map((stat) => (
          <AboutCount key={stat.label} {...stat} />
        ))}
      </div>

      <div className="bg-gradient-to-br from-brand-700 to-brand-800 rounded-3xl p-8 sm:p-12 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Ready to get started?</h2>
        <p className="text-brand-100 mb-8 max-w-xl mx-auto">Whether you're looking for a home or managing properties, HighPark Consult has you covered.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/properties" className="btn-accent">Browse Properties</Link>
          <Link to="/register" className="btn-secondary bg-white text-brand-700 border-white hover:bg-brand-50">Create Account</Link>
        </div>
      </div>
    </div>
  );
}

export function ContactPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast('Message sent! We\'ll get back to you within 24 hours.', 'success');
      setForm({ name: '', email: '', subject: '', message: '' });
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink-900 mb-4">Get in Touch</h1>
        <p className="text-lg text-ink-500 max-w-xl mx-auto">Have a question or need help? Our team is here to support you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          {[
            { icon: <Phone className="w-5 h-5" />, title: 'Call Us', value: '+254 710 382989', sub: 'HighPark K Consult LTD GROUP' },
            { icon: <Mail className="w-5 h-5" />, title: 'Email Us', value: 'lawparkconsultltd@gmail.com', sub: 'We reply within 24 hours' },
            { icon: <MapPin className="w-5 h-5" />, title: 'Office', value: '5017-00100, Nairobi', sub: 'Kenya' },
            { icon: <MessageCircle className="w-5 h-5" />, title: 'WhatsApp', value: '+254 710 382989', sub: 'Chat with HighPark Consult' },
            { icon: <Navigation className="w-5 h-5" />, title: 'Postal / Office', value: '5017-00100', sub: 'Nairobi, Kenya' },
          ].map((item) => (
            <div key={item.title} className="card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm text-ink-500">{item.title}</p>
                  <p className="font-semibold text-ink-900">{item.value}</p>
                  <p className="text-xs text-ink-400">{item.sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Your Name</label>
                  <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Mwangi" />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea className="input" rows={6} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us more..." />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FAQsPage() {
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    { q: 'How does the reservation process work?', a: 'Once you find a house you like, click "Reserve This House" and pay a KSh 2,000 reservation fee via M-Pesa, card, or bank transfer. The unit is reserved for 48 hours while you complete your tenancy registration. The fee is deductible from your security deposit.' },
    { q: 'Is the KSh 2,000 reservation fee refundable?', a: 'By default, the reservation fee is non-refundable but is deducted from your security deposit when you complete your tenancy. The exact policy is displayed clearly before you make any payment, and administrators can configure this policy.' },
    { q: 'What happens if I don\'t complete tenancy within 48 hours?', a: 'Your reservation will expire and the unit will become available to other customers. You\'ll receive a reminder notification before expiry. You can reserve again if the unit is still available.' },
    { q: 'Can two people reserve the same unit?', a: 'No. Our system prevents double reservations using database-level locking. If a unit is already reserved, you\'ll see a message saying it\'s no longer available.' },
    { q: 'How do I pay rent?', a: 'Once your tenancy begins, you\'ll have access to a tenant dashboard with a "Pay Rent" button. You can pay via M-Pesa, card, or bank transfer. You\'ll receive a receipt and your payment history is tracked automatically.' },
    { q: 'Are all properties verified?', a: 'Yes. Every property on HighPark Consult goes through a verification process by our administrators before being published. You\'ll see a "Verified Property" badge on all listings.' },
    { q: 'What if I have a maintenance issue?', a: 'You can submit a maintenance request from your tenant dashboard. Select the category (plumbing, electrical, etc.), describe the issue, and optionally attach photos. Your property owner or manager will be notified and can assign a technician.' },
    { q: 'Can I save properties to view later?', a: 'Yes! Click the heart icon on any property to save it. You\'ll find all your saved properties under "My Saved Houses" in your dashboard.' },
    { q: 'Is my data secure?', a: 'We use industry-standard security including encrypted passwords, secure sessions, and role-based access control. Your personal information is never shared with third parties without your consent.' },
    { q: 'I\'m a property owner. How do I list my property?', a: 'Create an account as a Property Owner, then add your property with photos, location, and unit details. Our admin team will verify your listing before it goes live. You can then manage units, reservations, tenants, rent, expenses, and taxes from your dashboard.' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink-900 mb-4">Frequently Asked Questions</h1>
        <p className="text-lg text-ink-500">Everything you need to know about finding and managing property with HighPark Consult</p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="card overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-ink-50 transition-colors"
            >
              <span className="font-semibold text-ink-900">{faq.q}</span>
              <span className={`text-brand-600 transition-transform shrink-0 ml-4 ${open === i ? 'rotate-45' : ''}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </span>
            </button>
            {open === i && (
              <div className="px-5 pb-5 text-ink-600 text-sm leading-relaxed animate-fade-in">{faq.a}</div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-8 text-center mt-12">
        <h3 className="text-xl font-bold text-ink-900 mb-2">Still have questions?</h3>
        <p className="text-ink-500 mb-6">Our support team is ready to help you.</p>
        <Link to="/contact" className="btn-primary">Contact Support</Link>
      </div>
    </div>
  );
}
