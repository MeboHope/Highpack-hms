import { useState } from 'react';
import { Bell, Heart, LayoutDashboard, LogOut, Menu, X, Phone, Mail, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Brand } from '@/components/Brand';
import highparkLogo from '@/assets/highpark-logo-clean.png';

export function Header() {
  const { path, navigate } = useRouter();
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Properties', to: '/properties' },
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
    { label: 'FAQs', to: '/faqs' },
  ];

  const isActive = (to: string) =>
    to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`) || path.startsWith(`${to}?`);

  const dashboardLink =
    profile?.role === 'admin'
      ? '/admin'
      : profile?.role === 'owner' || profile?.role === 'agent'
        ? '/owner'
        : '/tenant';

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    setMobileOpen(false);
    toast('Signed out successfully', 'success');
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-24 items-center justify-between gap-6">
          <Brand compact />

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive(link.to)
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-brand-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {profile ? (
              <>
                <Link to="/favorites" className="btn-ghost" aria-label="Saved properties">
                  <Heart className="h-5 w-5" />
                </Link>
                <Link to="/notifications" className="btn-ghost" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                </Link>
                <Link to={dashboardLink} className="btn-accent">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-ink-50"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">
                      {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </button>

                  {menuOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close account menu"
                        className="fixed inset-0 z-10 h-full w-full cursor-default"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-soft-lg">
                        <div className="border-b border-ink-100 px-4 py-3">
                          <p className="truncate text-sm font-semibold text-ink-900">{profile.full_name || 'User'}</p>
                          <p className="mt-0.5 text-xs capitalize text-ink-500">{profile.role === 'customer' ? 'Tenant' : profile.role}</p>
                        </div>
                        <Link
                          to={dashboardLink}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          My Dashboard
                        </Link>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 border-t border-ink-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Sign In</Link>
                <Link to="/register" className="btn-primary">Get Started</Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="btn-ghost md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-ink-100 bg-white md:hidden">
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  isActive(link.to) ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-ink-50'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-2 border-t border-ink-100 pt-3">
              {profile ? (
                <>
                  <Link
                    to={dashboardLink}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="btn-secondary"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="btn-primary"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 bg-brand-950 text-ink-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-10 grid grid-cols-1 gap-10 rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:grid-cols-[1.3fr_.8fr_.8fr_1.1fr] md:p-9">
          <div>
            <Link to="/" className="inline-flex rounded-xl bg-white p-2" aria-label="HighPark Consult Ltd">
              <img src={highparkLogo} alt="HighPark Consult Ltd" className="h-24 w-24 object-contain" />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-ink-400">
              HighPark Consult Ltd — trusted property solutions, strategic guidance, and professional property management in Kenya.
            </p>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-300">HighPark K Consult LTD GROUP</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Explore</h3>
            <div className="mt-4 space-y-2 text-sm">
              <Link to="/properties" className="block hover:text-accent-300">Browse Properties</Link>
              <Link to="/about" className="block hover:text-accent-300">About Us</Link>
              <Link to="/faqs" className="block hover:text-accent-300">FAQs</Link>
              <Link to="/contact" className="block hover:text-accent-300">Contact</Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">For Tenants</h3>
            <div className="mt-4 space-y-2 text-sm">
              <Link to="/properties" className="block hover:text-accent-300">Find a Home</Link>
              <Link to="/register" className="block hover:text-accent-300">Create Tenant Account</Link>
              <Link to="/login" className="block hover:text-accent-300">Tenant Sign In</Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-300">Contact & Office</h3>
            <div className="mt-4 space-y-3 text-sm text-ink-400">
              <a href="tel:+254710382989" className="contact-row"><Phone className="h-4 w-4 text-accent-300" /><span><strong className="block text-white">Phone</strong>+254 710 382989</span></a>
              <a href="mailto:lawparkconsultltd@gmail.com" className="contact-row"><Mail className="h-4 w-4 text-accent-300" /><span><strong className="block text-white">Email</strong>lawparkconsultltd@gmail.com</span></a>
              <a href="https://wa.me/254710382989" target="_blank" rel="noreferrer" className="contact-row"><MessageCircle className="h-4 w-4 text-accent-300" /><span><strong className="block text-white">WhatsApp</strong>+254 710 382989</span></a>
              <div className="contact-row"><MapPin className="h-4 w-4 text-accent-300" /><span><strong className="block text-white">Postal / Office</strong>5017-00100, Nairobi, Kenya</span></div>
              <div className="contact-row"><Navigation className="h-4 w-4 text-accent-300" /><span><strong className="block text-white">Group</strong>HighPark K Consult LTD GROUP</span></div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-brand-800 pt-6 text-center text-sm text-ink-500 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} HighPark Consult Ltd. All rights reserved.</p>
          <p>Professional property solutions in Kenya.</p>
        </div>
      </div>
    </footer>
  );
}
