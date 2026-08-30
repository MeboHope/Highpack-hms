import { useState } from 'react';
import { Home, Search, Heart, Bell, User, Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHashRoute } from '@/lib/router';

interface PublicHeaderProps {
  onNavigate: (path: string) => void;
  notificationCount?: number;
}

export function PublicHeader({ onNavigate, notificationCount = 0 }: PublicHeaderProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Browse Properties', path: '/properties' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  const isAdmin = profile && profile.role !== 'customer';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <button onClick={() => onNavigate('/')} className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
                <Home className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-slate-900">Nyumba<span className="text-teal-700">254</span></span>
            </button>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {profile ? (
              <>
                <button
                  onClick={() => onNavigate('/favorites')}
                  className="hidden rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 sm:block"
                  title="Saved Properties"
                >
                  <Heart className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onNavigate('/notifications')}
                  className="relative hidden rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 sm:block"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {notificationCount}
                    </span>
                  )}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => onNavigate('/admin')}
                    className="hidden items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 md:flex"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
                      {profile.full_name?.charAt(0).toUpperCase() ?? profile.email.charAt(0).toUpperCase()}
                    </div>
                  </button>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        <div className="border-b border-slate-100 px-4 py-2">
                          <p className="text-sm font-medium text-slate-900">{profile.full_name || 'User'}</p>
                          <p className="truncate text-xs text-slate-500">{profile.email}</p>
                        </div>
                        <button onClick={() => { onNavigate('/dashboard'); setUserMenuOpen(false); }} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          <User className="h-4 w-4" /> My Dashboard
                        </button>
                        {isAdmin && (
                          <button onClick={() => { onNavigate('/admin'); setUserMenuOpen(false); }} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 md:hidden">
                            <LayoutDashboard className="h-4 w-4" /> Admin Dashboard
                          </button>
                        )}
                        <button onClick={() => { signOut(); setUserMenuOpen(false); onNavigate('/'); }} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          <LogOut className="h-4 w-4" /> Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <button onClick={() => onNavigate('/signin')} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Sign In
                </button>
                <button onClick={() => onNavigate('/signup')} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800">
                  Sign Up
                </button>
              </div>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-200 py-3 md:hidden">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { onNavigate(item.path); setMobileOpen(false); }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </button>
            ))}
            {!profile && (
              <div className="mt-2 flex gap-2 px-3">
                <button onClick={() => { onNavigate('/signin'); setMobileOpen(false); }} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Sign In</button>
                <button onClick={() => { onNavigate('/signup'); setMobileOpen(false); }} className="flex-1 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white">Sign Up</button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function PublicFooter({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
                <Home className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-white">Nyumba<span className="text-teal-500">254</span></span>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Kenya's premier property booking and management platform. Find your perfect home across all 47 counties.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Quick Links</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><button onClick={() => onNavigate('/properties')} className="hover:text-teal-400">Browse Properties</button></li>
              <li><button onClick={() => onNavigate('/about')} className="hover:text-teal-400">About Us</button></li>
              <li><button onClick={() => onNavigate('/contact')} className="hover:text-teal-400">Contact</button></li>
              <li><button onClick={() => onNavigate('/signup')} className="hover:text-teal-400">Sign Up</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Locations</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>Nairobi</li>
              <li>Mombasa</li>
              <li>Kisumu</li>
              <li>Nakuru</li>
              <li>Eldoret</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Contact</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Westlands, Nairobi, Kenya</li>
              <li>+254 700 000 000</li>
              <li>info@nyumba254.co.ke</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Nyumba254. All rights reserved. Built for the Kenyan property market.</p>
        </div>
      </div>
    </footer>
  );
}
