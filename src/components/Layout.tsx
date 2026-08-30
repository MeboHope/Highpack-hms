import { useState } from 'react';
import {
  Menu,
  X,
  User,
  LogOut,
  LayoutDashboard,
  Bell,
  Heart,
} from 'lucide-react';

import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

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
    to === '/' ? path === '/' : path.startsWith(to);

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    toast('Signed out successfully', 'success');
    navigate('/');
  };

  const dashboardLink =
    profile?.role === 'admin'
      ? '/admin'
      : profile?.role === 'owner'
        ? '/owner'
        : '/tenant';

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* BRAND */}
          <Link to="/" className="flex items-center gap-3 shrink-0">

            {/* Temporary logo mark using the HighPark colours */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: '#0b2d5c' }}
            >
              <span
                className="font-serif text-2xl font-bold"
                style={{ color: '#c9962b' }}
              >
                HP
              </span>
            </div>

            <div className="leading-tight">
              <div
                className="font-serif text-xl font-bold tracking-wide"
                style={{ color: '#0b2d5c' }}
              >
                HIGHPARK
              </div>

              <div
                className="text-[10px] font-semibold tracking-[0.28em]"
                style={{ color: '#c9962b' }}
              >
                CONSULT LTD
              </div>
            </div>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                style={
                  isActive(link.to)
                    ? { backgroundColor: '#0b2d5c' }
                    : undefined
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center gap-3">
            {profile ? (
              <>
                <Link
                  to="/favorites"
                  className="p-2.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  aria-label="Saved properties"
                >
                  <Heart className="w-5 h-5" />
                </Link>

                <Link
                  to="/notifications"
                  className="p-2.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                </Link>

                <Link
                  to={dashboardLink}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: '#0b2d5c' }}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{
                        backgroundColor: '#f6ead0',
                        color: '#0b2d5c',
                      }}
                    >
                      {profile.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>

                    <span className="text-sm font-medium text-slate-700 max-w-[100px] truncate">
                      {profile.full_name || 'User'}
                    </span>
                  </button>

                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                      />

                      <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-20 animate-scale-in">
                        <Link
                          to={dashboardLink}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <User className="w-4 h-4" />
                          My Account
                        </Link>

                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Sign In
                </Link>

                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: '#0b2d5c' }}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* MOBILE NAVIGATION */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white animate-fade-in">
          <nav className="px-4 py-4 space-y-1">

            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium ${
                  isActive(link.to)
                    ? 'text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                style={
                  isActive(link.to)
                    ? { backgroundColor: '#0b2d5c' }
                    : undefined
                }
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-3 mt-3 border-t border-slate-200 space-y-2">
              {profile ? (
                <>
                  <Link
                    to={dashboardLink}
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Dashboard
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Sign In
                  </Link>

                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: '#0b2d5c' }}
                  >
                    Get Started
                  </Link>
                </>
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
    <footer
      className="text-slate-300 mt-20"
      style={{ backgroundColor: '#071d3a' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">

          {/* FOOTER BRAND */}
          <div className="col-span-2 md:col-span-1">

            <div className="flex items-center gap-3 mb-5">

              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#0b2d5c' }}
              >
                <span
                  className="font-serif text-xl font-bold"
                  style={{ color: '#c9962b' }}
                >
                  HP
                </span>
              </div>

              <div>
                <div
                  className="font-serif font-bold text-lg tracking-wide"
                  style={{ color: '#ffffff' }}
                >
                  HIGHPARK
                </div>

                <div
                  className="text-[9px] font-semibold tracking-[0.25em]"
                  style={{ color: '#c9962b' }}
                >
                  CONSULT LTD
                </div>
              </div>

            </div>

            <p className="text-sm text-slate-400 max-w-xs leading-6">
              Professional property solutions, strategic advice and
              reliable services for Kenya's property market.
            </p>
          </div>

          {/* EXPLORE */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">
              Explore
            </h4>

            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  to="/properties"
                  className="hover:text-white transition-colors"
                >
                  Properties
                </Link>
              </li>

              <li>
                <Link
                  to="/about"
                  className="hover:text-white transition-colors"
                >
                  About Us
                </Link>
              </li>

              <li>
                <Link
                  to="/faqs"
                  className="hover:text-white transition-colors"
                >
                  FAQs
                </Link>
              </li>

              <li>
                <Link
                  to="/contact"
                  className="hover:text-white transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* SERVICES */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">
              Services
            </h4>

            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  to="/register"
                  className="hover:text-white transition-colors"
                >
                  Property Management
                </Link>
              </li>

              <li>
                <Link
                  to="/owner"
                  className="hover:text-white transition-colors"
                >
                  Owner Services
                </Link>
              </li>

              <li>
                <Link
                  to="/about"
                  className="hover:text-white transition-colors"
                >
                  Property Consulting
                </Link>
              </li>
            </ul>
          </div>

          {/* CONTACT */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">
              Contact
            </h4>

            <ul className="space-y-3 text-sm text-slate-400">
              <li>Nairobi, Kenya</li>
              <li>+254 700 000 000</li>
              <li>hello@highpark.co.ke</li>
            </ul>
          </div>
        </div>

        {/* FOOTER BOTTOM */}
        <div className="border-t border-slate-700/60 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © 2026 HighPark Consult Ltd. All rights reserved.
          </p>

          <p
            className="text-sm"
            style={{ color: '#c9962b' }}
          >
            Strategy • Solutions • Success
          </p>
        </div>
      </div>
    </footer>
  );
}