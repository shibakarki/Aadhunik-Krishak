import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bot,
  Calendar,
  Compass,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  ShieldCheck,
  Sprout,
  Stethoscope,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { isAdminEmail } from '../lib/admin';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/farms/new', label: 'Add Farmland', icon: MapPin, end: false },
  {
    to: '/land-intelligence',
    label: 'Land Intelligence',
    icon: Compass,
    end: false,
  },
  { to: '/crops', label: 'Crops', icon: Sprout, end: false },
  { to: '/calendar', label: 'Calendar', icon: Calendar, end: false },
  {
    to: '/plant-doctor',
    label: 'Plant Doctor',
    icon: Stethoscope,
    end: false,
  },
  { to: '/assistant', label: 'AI Assistant', icon: Bot, end: false },
  { to: '/feedback', label: 'Feedback', icon: MessageSquare, end: false },
];

export function Layout() {
  const { user, profile, signOut } = useAuth();
  const { farms, activeFarm, setActiveFarm } = useFarm();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = isAdminEmail(user?.email);

  const displayName =
    profile?.full_name || user?.email?.split('@')[0] || 'Farmer';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}

      {isAdmin && (
        <NavLink
          to="/admin"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100'
            }`
          }
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Admin Panel</span>
        </NavLink>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">
              Aadhunik Krishak
            </p>
            <p className="text-[11px] text-emerald-700 font-medium">
              Smart Farming Nepal
            </p>
          </div>
        </div>

        {/* Active Farm Switcher in Sidebar */}
        <div className="px-4 pt-4 pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Active Farm
            </span>
            <Link
              to="/farms/new"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              New
            </Link>
          </div>
          {farms.length > 0 ? (
            <select
              aria-label="Select active farm"
              value={activeFarm?.id ?? ''}
              onChange={(e) => {
                const chosen =
                  farms.find((f) => f.id === e.target.value) ?? null;
                setActiveFarm(chosen);
              }}
              className="w-full text-xs font-medium text-slate-800 bg-emerald-50/70 border border-emerald-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                  {farm.district ? ` (${farm.district})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <Link
              to="/farms/new"
              className="block text-xs text-center font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg py-2 px-3 transition-colors"
            >
              + Add Your First Farm
            </Link>
          )}
        </div>

        {renderNavLinks()}

        <div className="p-4 border-t border-slate-100">
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {displayName}
            </p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200/80 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Navbar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
            <Sprout className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 text-sm">
            Aadhunik Krishak
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col shadow-xl z-50">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100">
              <span className="font-bold text-slate-900 text-sm">Menu</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavLinks(() => setMobileMenuOpen(false))}
            <div className="p-4 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-800 truncate mb-2">
                {displayName}
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}