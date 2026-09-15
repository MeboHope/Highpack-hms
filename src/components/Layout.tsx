import { useEffect, useState } from 'react';
import { Bell, Heart, LayoutDashboard, LogOut, Menu, X, Phone, Mail, MapPin } from 'lucide-react';
import { Link } from '@/context/RouterContext';
import { useRouter } from '@/context/hooks';
import { useAuth } from '@/context/hooks';
import { useToast } from '@/context/hooks';
import { Brand } from '@/components/Brand';

export function Header() {
  const { path, navigate } = useRouter();
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Reduced to 4-5 key items — secondary moved to footer
  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Properties', to: '/properties' },
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ];

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

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
    <>
      <header className="header">
        <div className="header__inner">
          <Brand compact />

          <nav aria-label="Main navigation" className="header__nav">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`header__nav-link ${isActive(link.to) ? 'header__nav-link--active' : ''}`}
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
                <Link to={dashboardLink} className="btn-primary">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex items-center gap-2 p-1.5 transition-colors hover:bg-ink-50"
                    style={{ borderRadius: '6px', minHeight: '44px', minWidth: '44px' }}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    aria-label="Account menu"
                  >
                    <div className="flex h-10 w-10 items-center justify-center bg-brand-900 font-bold text-white" style={{ borderRadius: '6px' }}>
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
                      <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden border border-ink-100 bg-white py-1.5 shadow-soft">
                        <div className="border-b border-ink-100 bg-ink-50 px-4 py-3">
                          <p className="truncate text-sm font-semibold text-ink-900">{profile.full_name || 'User'}</p>
                          <p className="mt-0.5 text-xs capitalize text-ink-500">{profile.role === 'customer' ? 'Tenant' : profile.role}</p>
                        </div>
                        <Link
                          to={dashboardLink}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
                          style={{ minHeight: '44px' }}
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          My Dashboard
                        </Link>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 border-t border-ink-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                          style={{ minHeight: '44px' }}
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
            className="header__hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer — slides in from side */}
      <div className={`mobile-drawer ${mobileOpen ? 'mobile-drawer--open' : ''}`} aria-hidden={!mobileOpen}>
        <div className="mobile-drawer__overlay" onClick={() => setMobileOpen(false)} />
        <aside className="mobile-drawer__panel" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="mobile-drawer__header">
            <Brand compact />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex h-11 w-11 items-center justify-center border border-ink-100 bg-white text-ink-600 hover:bg-ink-50"
              style={{ borderRadius: '6px' }}
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mobile-drawer__nav" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`mobile-drawer__link ${isActive(link.to) ? 'mobile-drawer__link--active' : ''}`}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-6 border-t border-ink-100 pt-6">
              <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wide text-ink-400">Browse</p>
              <Link to="/properties?category=buy" onClick={() => setMobileOpen(false)} className="mobile-drawer__link">Buy</Link>
              <Link to="/properties?category=rent" onClick={() => setMobileOpen(false)} className="mobile-drawer__link">Rent</Link>
              <Link to="/properties?category=land" onClick={() => setMobileOpen(false)} className="mobile-drawer__link">Land & Plots</Link>
              <Link to="/properties?category=short_stay" onClick={() => setMobileOpen(false)} className="mobile-drawer__link">Short Stays</Link>
            </div>

            <div className="mt-auto pt-6">
              {profile ? (
                <>
                  <Link
                    to={dashboardLink}
                    onClick={() => setMobileOpen(false)}
                    className="mobile-drawer__link"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mobile-drawer__link w-full text-left text-red-600"
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
                    className="btn-secondary text-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="btn-primary text-center"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </aside>
      </div>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <Link to="/" className="inline-flex items-center gap-3" aria-label="HighPark Consult Ltd">
              <span className="flex h-10 w-10 items-center justify-center bg-white text-brand-900 font-bold text-sm" style={{ borderRadius: '6px' }}>HP</span>
              <span className="text-white font-bold tracking-wide">HIGHPARK CONSULT</span>
            </Link>
            <p>
              Trusted property solutions, strategic guidance, and professional property management in Kenya.
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-white/70">
              <a href="tel:+254710382989" className="inline-flex items-center gap-2 hover:text-white transition-colors" style={{ minHeight: '44px' }}>
                <Phone className="h-4 w-4" /> +254 710 382989
              </a>
              <a href="mailto:lawparkconsultltd@gmail.com" className="inline-flex items-center gap-2 hover:text-white transition-colors" style={{ minHeight: '44px' }}>
                <Mail className="h-4 w-4" /> lawparkconsultltd@gmail.com
              </a>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" /> 5017-00100, Nairobi, Kenya
              </span>
            </div>
          </div>

          <div className="footer__links">
            <Link to="/">Home</Link>
            <Link to="/properties">Properties</Link>
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/faqs">FAQs</Link>
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {new Date().getFullYear()} HighPark Consult Ltd. All rights reserved.</p>
          <p>Professional property solutions in Kenya.</p>
        </div>
      </div>
    </footer>
  );
}
