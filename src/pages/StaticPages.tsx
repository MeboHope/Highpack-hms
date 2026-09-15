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
      icon: <ShieldCheck className="w-6 h-6" />,
      title: 'Trust built into the experience',
      desc: 'We are building a property experience where customers can discover verified opportunities, review meaningful information and engage with a professional team before committing time or money.',
    },
    {
      icon: <Search className="w-6 h-6" />,
      title: 'Clarity before commitment',
      desc: 'Property decisions are important. HighPark brings location, pricing, availability, asset details, enquiries and next steps into a clearer digital journey so you can make informed decisions.',
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Built for the full property journey',
      desc: 'Our platform goes beyond listing houses. It supports homes, land, plots, commercial and mixed-use assets, sales, rentals, leases, short stays and the operational relationships that follow.',
    },
  ];

  const audiences = [
    {
      icon: <Home className="w-5 h-5" />,
      title: 'For customers, tenants and buyers',
      desc: 'Discover opportunities, compare options, save properties, request viewings, make enquiries and continue your property journey through a dedicated account.',
      items: ['Verified property and land opportunities', 'Location, pricing and availability information', 'Enquiries, viewings and reservation pathways', 'Rent, lease, maintenance and document services'],
    },
    {
      icon: <Building2 className="w-5 h-5" />,
      title: 'For property owners and investors',
      desc: 'Bring your portfolio into one professional workspace and gain clearer visibility across assets, units, tenants, income, expenses, maintenance, documents and sales activity.',
      items: ['Residential, commercial, land and mixed-use assets', 'Property and unit portfolio management', 'Rent, payments, expenses and reporting', 'Maintenance, documents, sales and customer communication'],
    },
  ];

  return (
    <div className="premium-page-bg">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <section className="relative overflow-hidden rounded-[2rem] bg-brand-950 px-6 py-12 text-center shadow-soft-lg sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-brand-500/15 blur-3xl" />
          <div className="relative mx-auto max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-sm font-semibold text-accent-200">
              <Home className="w-4 h-4" /> About HighPark Consult
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">A more trusted, connected way to navigate property in Kenya.</h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-brand-100 sm:text-lg">
              HighPark Consult brings property discovery and professional property management together in one connected experience — helping customers, owners and investors move from opportunity to action with greater clarity and confidence.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/properties" className="btn-accent">Explore verified opportunities</Link>
              <Link to="/contact" className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">Talk to HighPark Consult</Link>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="max-w-3xl">
            <p className="section-kicker">Why HighPark Consult</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">Property is more than a listing. It is a decision, a relationship and a long-term responsibility.</h2>
            <p className="mt-4 text-base leading-7 text-ink-600">
              We believe the digital property experience should be as professional as the decision itself. That means making it easier to discover genuine opportunities, understand what is being offered, communicate with the right people and continue receiving support after the first enquiry.
            </p>
            <p className="mt-4 text-base leading-7 text-ink-600">
              HighPark Consult is designed around that complete journey. Our marketplace brings together residential homes, land and plots, commercial spaces, mixed-use and development opportunities and short stays. Behind the marketplace is a structured management platform that helps owners and teams handle the operational work that keeps property relationships running.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {pillars.map((item) => (
              <div key={item.title} className="card p-6 transition-all hover:-translate-y-1 hover:shadow-soft-lg">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{item.icon}</div>
                <h3 className="font-semibold text-ink-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-7 sm:p-10">
          <div className="max-w-3xl">
            <p className="section-kicker">What we are building</p>
            <h2 className="mt-2 text-2xl font-bold text-ink-950 sm:text-3xl">One professional environment for discovery, transactions and property operations.</h2>
            <p className="mt-4 text-sm leading-7 text-ink-600 sm:text-base">
              HighPark is intentionally broader than a traditional house-rental website. We are building a universal property platform that can serve the different ways people use and invest in real estate — from finding a family home or commercial space to evaluating land, managing a rental portfolio or operating a short-stay property.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[
              ['Homes & residential', 'Buy or rent residential properties with clear presentation, availability and enquiry pathways.'],
              ['Land & plots', 'Explore land, plot opportunities, development potential, dimensions and location information.'],
              ['Commercial & mixed-use', 'Find business premises and multi-purpose assets suited to commercial or development objectives.'],
              ['Short stays', 'Discover flexible accommodation and manage the operational journey behind short-stay hospitality.'],
              ['Sales & investment', 'Move from discovery to enquiries, offers and controlled sales workflows for property and land opportunities.'],
              ['Property management', 'Support the ongoing work of owners and teams across leases, payments, expenses, maintenance, documents and reporting.'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl bg-ink-50/80 p-5">
                <h3 className="font-semibold text-ink-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="mb-8 max-w-3xl">
            <p className="section-kicker">Designed around people</p>
            <h2 className="mt-2 text-2xl font-bold text-ink-950 sm:text-3xl">A better experience for the people on every side of property.</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {audiences.map((section) => (
              <div key={section.title} className="card p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">{section.icon}</div>
                  <h3 className="font-semibold text-ink-950">{section.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-6 text-ink-500">{section.desc}</p>
                <ul className="mt-5 space-y-3">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-ink-600">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 pb-14 sm:grid-cols-4 sm:pb-16">
          {stats.map((stat) => <AboutCount key={stat.label} {...stat} />)}
        </section>

        <section className="overflow-hidden rounded-[2rem] bg-brand-gold-gradient p-8 text-center shadow-soft-lg sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-200">Your next move starts here</p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Explore with confidence. Decide with clarity. Work with HighPark Consult.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
            Whether you are searching for a home, looking for land, securing business space, planning an investment, booking a short stay or managing a portfolio, HighPark Consult is built to make the journey more connected and professional.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/properties" className="btn-accent">Browse verified opportunities</Link>
            <Link to="/contact" className="btn-secondary border-white bg-white text-brand-700 hover:bg-brand-50">Contact our team</Link>
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
