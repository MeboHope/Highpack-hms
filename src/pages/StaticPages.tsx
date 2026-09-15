import { Home, Mail, Phone, MapPin, Search, ShieldCheck, TrendingUp, Building2, MessageCircle, Navigation } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Link } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/hooks';

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
    const start = performance.now(); const duration = 1200; let frame = 0;
    const tick = (now: number) => { const progress = Math.min(1, (now-start)/duration); const eased = 1-Math.pow(1-progress,3); setCount(Math.floor(value*eased)); if(progress<1) frame=requestAnimationFrame(tick); else setCount(value); };
    frame=requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [started, value]);
  return (
    <div ref={ref} className="card text-center" style={{ padding: '1rem' }}>
      <p className="text-2xl font-bold tabular-nums" style={{ color: '#0d2342' }}>{prefix}{count.toLocaleString()}{suffix}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 mt-1">{label}</p>
    </div>
  );
}

export function AboutPage() {
  const [stats, setStats] = useState([
    { value: 0, suffix: '+', label: 'Verified Properties' },
    { value: 0, suffix: '+', label: 'Customer Accounts' },
    { value: 0, suffix: '+', label: 'Counties Represented' },
    { value: 0, prefix: 'KSh ', suffix: '+', label: 'Verified Rent Processed' },
  ]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: catalog, error: catalogError }, { data: siteStats, error: statsError }] = await Promise.all([
        supabase.rpc('get_public_property_catalog'),
        supabase.rpc('get_public_site_stats'),
      ]);
      if (catalogError) console.error('About public catalog error:', catalogError);
      if (statsError) console.error('About public statistics error:', statsError);
      const rows = (catalog || []) as Array<Record<string, unknown>>;
      const verifiedProperties = new Set(rows.map((row) => String(row.property_id))).size;
      const counties = new Set(rows.map((row) => row.county).filter(Boolean)).size;
      const aggregate = (siteStats?.[0] || {}) as Record<string, unknown>;
      const customerCount = Number(aggregate.customer_accounts || 0);
      const rent = Math.round(Number(aggregate.verified_rent_processed || 0));
      if (!cancelled) {
        setStats([
          { value: verifiedProperties, suffix: '+', label: 'Verified Properties' },
          { value: customerCount, suffix: '+', label: 'Customer Accounts' },
          { value: counties, suffix: '+', label: 'Counties Represented' },
          { value: rent, prefix: 'KSh ', suffix: '+', label: 'Verified Rent Processed' },
        ]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pillars = [
    {
      icon: <ShieldCheck className="w-5 h-5" />,
      title: 'Trust built into the experience',
      desc: 'We are building a property experience where customers can discover verified opportunities and engage with a professional team.',
    },
    {
      icon: <Search className="w-5 h-5" />,
      title: 'Clarity before commitment',
      desc: 'Location, pricing, availability and next steps are brought into a clearer digital journey.',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Built for the full journey',
      desc: 'Our platform supports homes, land, commercial, sales, rentals and the operational relationships that follow.',
    },
  ];

  return (
    <div style={{ background: '#ffffff' }}>
      <div className="container-main" style={{ paddingTop: '24px', paddingBottom: '48px' }}>
        <section className="card" style={{ padding: '32px', background: '#0d2342', borderColor: '#0d2342', textAlign: 'center' }}>
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/80" style={{ borderRadius: '6px' }}>
              <Home className="w-4 h-4" /> About HighPark Consult
            </div>
            <h1 style={{ color: '#ffffff' }}>A more trusted, connected way to navigate property in Kenya.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6" style={{ color: 'rgba(255,255,255,0.8)' }}>
              HighPark Consult brings property discovery and professional property management together in one connected experience.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/properties" className="btn-accent">Explore opportunities</Link>
              <Link to="/contact" className="btn-secondary" style={{ background: 'transparent', color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' }}>Talk to us</Link>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingBottom: '24px' }}>
          <div className="max-w-3xl">
            <p className="section-kicker">Why HighPark Consult</p>
            <h2 className="mt-2">Property is more than a listing. It is a decision and a long-term responsibility.</h2>
            <p className="mt-4 text-sm leading-6 text-ink-600 max-w-3xl">
              We believe the digital property experience should be as professional as the decision itself. That means making it easier to discover genuine opportunities and continue receiving support after the first enquiry.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {pillars.map((item) => (
              <div key={item.title} className="card" style={{ padding: '1rem' }}>
                <div className="flex h-10 w-10 items-center justify-center bg-ink-50 text-brand-900 border border-ink-100" style={{ borderRadius: '6px' }}>{item.icon}</div>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card mt-8" style={{ padding: '24px' }}>
          <div className="max-w-3xl">
            <p className="section-kicker">What we are building</p>
            <h2 className="mt-2">One professional environment for discovery, transactions and operations.</h2>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Homes & residential', 'Buy or rent residential properties with clear presentation and enquiry pathways.'],
              ['Land & plots', 'Explore land, plot opportunities, development potential and location information.'],
              ['Commercial & mixed-use', 'Find business premises and multi-purpose assets suited to your objectives.'],
              ['Short stays', 'Discover flexible accommodation and manage short-stay operations.'],
              ['Sales & investment', 'Move from discovery to enquiries and controlled sales workflows.'],
              ['Property management', 'Support ongoing work across leases, payments, maintenance and reporting.'],
            ].map(([title, desc]) => (
              <div key={title} className="bg-ink-50 p-4 border border-ink-100" style={{ borderRadius: '8px' }}>
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => <AboutCount key={stat.label} {...stat} />)}
        </section>

        <section className="card mt-8 text-center" style={{ padding: '32px', background: '#0d2342', borderColor: '#0d2342' }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#c9972e' }}>Your next move starts here</p>
          <h2 className="mt-3" style={{ color: '#ffffff' }}>Explore with confidence. Decide with clarity.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Whether you are searching for a home, land, business space or managing a portfolio, HighPark Consult is built to make the journey more connected.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/properties" className="btn-accent">Browse opportunities</Link>
            <Link to="/contact" className="btn-secondary" style={{ background: '#ffffff', color: '#0d2342', borderColor: '#ffffff' }}>Contact team</Link>
          </div>
        </section>
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
    <div className="container-main" style={{ paddingTop: '32px', paddingBottom: '48px' }}>
      <div className="mx-auto max-w-2xl text-center mb-10">
        <h1>Get in Touch</h1>
        <p className="mt-3 text-sm text-ink-500 leading-6">Have a question or need help? Our team is here to support you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {[
            { icon: <Phone className="w-5 h-5" />, title: 'Call Us', value: '+254 710 382989', sub: 'HighPark K Consult LTD GROUP' },
            { icon: <Mail className="w-5 h-5" />, title: 'Email Us', value: 'lawparkconsultltd@gmail.com', sub: 'We reply within 24 hours' },
            { icon: <MapPin className="w-5 h-5" />, title: 'Office', value: '5017-00100, Nairobi', sub: 'Kenya' },
            { icon: <MessageCircle className="w-5 h-5" />, title: 'WhatsApp', value: '+254 710 382989', sub: 'Chat with us' },
            { icon: <Navigation className="w-5 h-5" />, title: 'Postal', value: '5017-00100', sub: 'Nairobi, Kenya' },
          ].map((item) => (
            <div key={item.title} className="card" style={{ padding: '1rem' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-ink-50 text-brand-900 border border-ink-100 shrink-0" style={{ borderRadius: '6px' }}>{item.icon}</div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-400 font-semibold">{item.title}</p>
                  <p className="font-semibold text-sm mt-1">{item.value}</p>
                  <p className="text-xs text-ink-400">{item.sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          <div className="card" style={{ padding: '24px' }}>
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
    { q: 'Is the KSh 2,000 reservation fee refundable?', a: 'By default, the reservation fee is non-refundable but is deducted from your security deposit when you complete your tenancy. The exact policy is displayed clearly before you make any payment.' },
    { q: 'What happens if I don\'t complete tenancy within 48 hours?', a: 'Your reservation will expire and the unit will become available to other customers. You\'ll receive a reminder notification before expiry.' },
    { q: 'Can two people reserve the same unit?', a: 'No. Our system prevents double reservations using database-level locking.' },
    { q: 'How do I pay rent?', a: 'Once your tenancy begins, you\'ll have access to a tenant dashboard with a "Pay Rent" button. You can pay via M-Pesa, card, or bank transfer.' },
    { q: 'Are all properties verified?', a: 'Yes. Every property goes through verification by our administrators before being published.' },
    { q: 'What if I have a maintenance issue?', a: 'You can submit a maintenance request from your tenant dashboard. Select the category, describe the issue, and optionally attach photos.' },
    { q: 'Can I save properties to view later?', a: 'Yes! Click the heart icon on any property to save it.' },
    { q: 'Is my data secure?', a: 'We use industry-standard security including encrypted passwords, secure sessions, and role-based access control.' },
    { q: 'I\'m a property owner. How do I list my property?', a: 'Create an account as a Property Owner, then add your property with photos, location, and unit details. Our admin team will verify your listing before it goes live.' },
  ];

  return (
    <div className="container-main" style={{ paddingTop: '32px', paddingBottom: '48px', maxWidth: '800px' }}>
      <div className="text-center mb-10">
        <h1>Frequently Asked Questions</h1>
        <p className="mt-3 text-sm text-ink-500 leading-6">Everything you need to know about finding and managing property with HighPark Consult</p>
      </div>

      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="card overflow-hidden" style={{ padding: 0 }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-ink-50 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <span className="font-semibold text-sm">{faq.q}</span>
              <span className={`text-ink-400 transition-transform shrink-0 ml-4 ${open === i ? 'rotate-45' : ''}`} style={{ display: 'inline-flex' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </span>
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm leading-6 text-ink-600">{faq.a}</div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-6 text-center mt-8">
        <h3 className="font-bold">Still have questions?</h3>
        <p className="text-sm text-ink-500 mt-2 mb-4">Our support team is ready to help you.</p>
        <Link to="/contact" className="btn-primary">Contact Support</Link>
      </div>
    </div>
  );
}
