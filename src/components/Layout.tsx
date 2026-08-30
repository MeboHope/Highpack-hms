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
import { Brand } from '@/components/Brand';

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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[72px]">
          {/* HighPark Logo */}
          <Brand compact />

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? 'text-brand-700 bg-brand-50'
                    : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop account actions */}
          <div className="hidden md:flex items-center gap-2">
            {profile ? (
              <>
                <Link
                  to="/favorites"
                  className="btn-ghost"
                  aria-label="Saved properties"
                >
                  <Heart className="w-5 h-5" />
                </Link>

                <Link
                  to="/notifications"
                  className="btn-ghost relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                </Link>

                <Link to={dashboardLink} className="btn-secondary">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-ink-100"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
                      {profile.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>

                    <span className="text-sm font-medium text-ink-700 max-w-[100px] truncate">
                      {profile.full_name || 'User'}
                    </span>
                  </button>

                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                      />

                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-ink-100 py-1 z-20 animate-scale-in">
                        <Link
                          to={dashboardLink}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                        >
                          <User className="w-4 h-4" />
                          My Account
                        </Link>

                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
                <Link to="/login" className="btn-ghost">
                  Sign In
                </Link>

                <Link to="/register" className="btn-primary">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden btn-ghost"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div className="md:hidden border-t border-ink-100 bg-white animate-fade-in">
          <nav className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive(link.to)
                    ? 'text-brand-700 bg-brand-50'
                    : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-2 border-t border-ink-100 space-y-2">
              {profile ? (
                <>
                  <Link
                    to={dashboardLink}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Dashboard
                  </Link>

                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Sign In
                  </Link>

                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-brand-700 bg-brand-50"
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
    <footer className="bg-ink-950 text-ink-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              to="/"
              className="inline-flex items-center bg-white rounded-xl p-2 mb-4"
              aria-label="HighPark Consult Ltd"
            >
              <img
                src={new URL('@/assets/highpark-logo.jpg', import.meta.url).href}
                alt="HighPark Consult Ltd"
                className="w-28 h-28 object-contain"
              />
            </Link>

            <p className="text-sm text-ink-400 max-w-xs">
              HighPark Consult Ltd — providing trusted property solutions,
              strategic guidance, and professional property management in
              Kenya.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">
              Explore
            </h4>

            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/properties"
                  className="hover:text-white transition-colors"
                >
                  Browse Properties
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

          {/* For Owners */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">
              For Owners
            </h4>

            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/register"
                  className="hover:text-white transition-colors"
                >
                  List Your Property
                </Link>
              </li>

              <li>
                <Link
                  to="/owner"
                  className="hover:text-white transition-colors"
                >
                  Owner Dashboard
                </Link>
              </li>

              <li>
                <Link
                  to="/about"
                  className="hover:text-white transition-colors"
                >
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">
              Contact
            </h4>

            <ul className="space-y-2 text-sm text-ink-400">
              <li>Nairobi, Kenya</li>
              <li>+254 700 000 000</li>
              <li>hello@highparkconsult.co.ke</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-ink-800 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-ink-500">
            © 2026 HighPark Consult Ltd. All rights reserved.
          </p>

          <p className="text-sm text-ink-500">
            Professional property solutions in Kenya
          </p>
        </div>
      </div>
    </footer>
  );
}