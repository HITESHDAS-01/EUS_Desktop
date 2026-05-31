import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { to: '/members', label: 'Members', icon: 'fa-users' },
  // Phase 2+ — placeholders so the user can see where things will land.
  { to: '/transactions', label: 'Transactions', icon: 'fa-receipt', disabled: true },
  { to: '/loans', label: 'Loans', icon: 'fa-hand-holding-usd', disabled: true },
  { to: '/reports', label: 'Reports', icon: 'fa-chart-bar', disabled: true },
  { to: '/emi', label: 'Product EMI', icon: 'fa-store', disabled: true },
  { to: '/settings', label: 'Settings', icon: 'fa-gear', disabled: true },
];

export default function AdminShell() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-60 bg-[#0b3b2f] text-white flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <h1 className="text-xl font-bold">EUS Desktop</h1>
          <p className="text-xs text-white/60 mt-1">Admin Dashboard</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 text-sm">
          {navItems.map((it) =>
            it.disabled ? (
              <div
                key={it.to}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-white/40 cursor-not-allowed"
                title="Coming in a later phase"
              >
                <i className={`fas ${it.icon} w-4 text-center`}></i>
                <span>{it.label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide">soon</span>
              </div>
            ) : (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'
                  }`
                }
              >
                <i className={`fas ${it.icon} w-4 text-center`}></i>
                <span>{it.label}</span>
              </NavLink>
            ),
          )}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-white/80 hover:bg-white/5 text-sm"
          >
            <i className="fas fa-sign-out-alt w-4 text-center"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
