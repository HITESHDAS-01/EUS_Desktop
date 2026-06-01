import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useSettings } from '@/lib/SettingsContext';
import { api } from '@/lib/api';

const navItems: { path: string; label: string; icon: string; exact?: boolean; disabled?: boolean }[] = [
  { path: '/admin', label: 'Dashboard', icon: 'fas fa-home', exact: true },
  { path: '/admin/members', label: 'Members', icon: 'fas fa-users' },
  { path: '/admin/transactions', label: 'Transactions', icon: 'fas fa-rupee-sign' },
  { path: '/admin/loans', label: 'Loans', icon: 'fas fa-hand-holding-usd' },
  { path: '/admin/investments', label: 'Investments', icon: 'fas fa-chart-line' },
  { path: '/admin/emi', label: 'Product EMI', icon: 'fas fa-mobile-alt' },
  { path: '/admin/reports', label: 'Reports', icon: 'fas fa-chart-bar' },
  { path: '/admin/settings', label: 'Settings', icon: 'fas fa-cog' },
];

export default function AdminShell() {
  const { logout } = useAuth();
  const { brand, text } = useSettings();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024,
  );
  const [adminName, setAdminName] = useState('Admin');
  const logoUrl = text.org_logo_url || '';

  useEffect(() => {
    api
      .getAdminProfile()
      .then((p) => setAdminName(p.full_name || 'Admin'))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[#f4f7f6] relative">
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-10"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed lg:static top-0 left-0 h-full z-20 transition-all duration-300 ease-in-out bg-[#0b3b2f] text-white flex flex-col shadow-2xl overflow-hidden lg:rounded-r-3xl ${
          isSidebarOpen ? 'w-72' : 'w-0 lg:w-20'
        }`}
      >
        <div className="h-16 flex items-center px-4 shrink-0">
          <Link to="/admin" className="flex items-center" title="Dashboard">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${brand.orgShort} Logo`}
                className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-sm shrink-0 hover:ring-2 hover:ring-[#f7b05e] transition-all"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-sm shrink-0 flex items-center justify-center text-[#0b3b2f] font-bold hover:ring-2 hover:ring-[#f7b05e] transition-all">
                {brand.orgShort.slice(0, 3)}
              </div>
            )}
            <span
              className={`ml-3 font-bold text-lg tracking-wide whitespace-nowrap transition-opacity duration-300 hover:text-[#f7b05e] ${
                isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
              }`}
            >
              Admin Panel
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) =>
            item.disabled ? (
              <div
                key={item.path}
                className="flex items-center px-4 py-3.5 rounded-full text-gray-500 cursor-not-allowed"
                title="Coming in a later phase"
              >
                <i className={`${item.icon} text-lg w-6 text-center shrink-0`}></i>
                <span
                  className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${
                    isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                  }`}
                >
                  {item.label}
                </span>
                {isSidebarOpen && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">
                    soon
                  </span>
                )}
              </div>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3.5 rounded-full transition-all duration-200 group ${
                    isActive
                      ? 'bg-[#1a5f4a] text-[#f7b05e] shadow-md'
                      : 'hover:bg-white/10 text-gray-300 hover:text-white'
                  }`
                }
                title={!isSidebarOpen ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <i
                      className={`${item.icon} text-lg w-6 text-center shrink-0 ${
                        isActive
                          ? 'text-[#f7b05e]'
                          : 'text-gray-400 group-hover:text-white'
                      }`}
                    ></i>
                    <span
                      className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${
                        isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                      }`}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            ),
          )}
        </nav>

        <div className="p-3 shrink-0 border-t border-white/10">
          <button
            onClick={() => logout()}
            className={`flex items-center px-4 py-3.5 w-full rounded-full text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all duration-200 ${
              !isSidebarOpen ? 'justify-center lg:justify-start' : ''
            }`}
            title={!isSidebarOpen ? 'Logout' : undefined}
          >
            <i className="fas fa-sign-out-alt text-lg w-6 text-center shrink-0"></i>
            <span
              className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${
                isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-[#0b3b2f] text-white shadow-md z-10 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-colors focus:ring-2 focus:ring-[#f7b05e] focus:outline-none"
            >
              <i className="fas fa-bars text-lg"></i>
            </button>
            <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block">
              {brand.orgNameNative}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-white">{adminName}</p>
                <p className="text-xs text-gray-300">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-[#1a5f4a] rounded-full flex items-center justify-center text-[#f7b05e] shadow-md">
                <i className="fas fa-user-shield"></i>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
