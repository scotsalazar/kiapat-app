import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ToastProvider';
import { isFullVersion } from '../config/appVersion';

const navIconClass = 'h-4 w-4 stroke-[2.25]';

const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={navIconClass}>
    <path d="M4 13h6V4H4zm10 0h6V9h-6zm0 7h6v-5h-6zm-10 0h6v-9H4z" />
  </svg>
);

const InventoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={navIconClass}>
    <path d="M4 7h16M7 4h10M6 7v13h12V7" />
  </svg>
);

const ProductIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={navIconClass}>
    <path d="M12 3 4 7v10l8 4 8-4V7z" />
    <path d="M12 3v18M4 7l8 4 8-4" />
  </svg>
);

const VehicleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={navIconClass}>
    <path d="m3 13 2-7h14l2 7" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
    <path d="M5 13h14" />
  </svg>
);

const SalesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={navIconClass}>
    <path d="M7 10v9M17 5v14" />
    <path d="M3 14h6l2-4 2 6 2-3h4" />
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={navIconClass}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const InvoiceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={navIconClass}>
    <path d="M7 3h10v18l-5-3-5 3z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
);

const HistoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={navIconClass}>
    <path d="M3 12a9 9 0 1 0 9-9" />
    <path d="M3 5v6h6" />
    <path d="M12 7v5l3 2" />
  </svg>
);

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const handleLogout = () => {
    logout();
    showToast('Logged out', 'info');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon />, roles: ['admin'], enabled: isFullVersion },
    { to: '/inventory', label: 'Inventory', icon: <InventoryIcon />, roles: ['admin'], enabled: isFullVersion },
    { to: '/products', label: 'Products', icon: <ProductIcon />, roles: ['admin'], enabled: true },
    { to: '/vehicles', label: 'Vehicles', icon: <VehicleIcon />, roles: ['admin'], enabled: isFullVersion },
    { to: '/sales-invoices', label: 'Sales', icon: <SalesIcon />, roles: ['admin'], enabled: true },
    { to: '/admin/users', label: 'Users', icon: <UsersIcon />, roles: ['admin'], enabled: true },
    { to: '/invoice', label: 'Invoice', icon: <InvoiceIcon />, roles: ['driver'], enabled: true },
    { to: '/invoices/history', label: 'History', icon: <HistoryIcon />, roles: isFullVersion ? ['admin', 'driver'] : ['driver'], enabled: true },
  ].filter((item) => item.enabled);

  const visibleNavItems = navItems.filter((item) => (user ? item.roles.includes(user.role) : false));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-lg transition-colors dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 pl-2">
                <img src="/logo.png" alt={t('common.appName', 'Kiapat Inventory')} className="h-9 w-9 rounded" />
                <div className="leading-tight">
                  <p className="text-base font-semibold text-slate-900 dark:text-white">{t('common.appName')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.tagline', 'Inventory & invoicing dashboard')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-full border border-slate-200/70 bg-white/70 px-2 py-1 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
                <ThemeToggle />
                {user && (
                  <div className="hidden text-right text-xs sm:block">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
                    <p className="capitalize text-slate-500 dark:text-slate-400">{user.role}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <span className="hidden sm:inline">Logout</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                    <path d="M14 3h7v18h-7" />
                    <path d="M7 12h14M10 8l-4 4 4 4" />
                  </svg>
                </button>
              </div>
            </div>
            {visibleNavItems.length > 0 && (
              <>
                <nav className="hidden sm:block">
                  <div className="flex items-center gap-2 overflow-x-auto rounded-full border border-slate-200/70 bg-white/70 px-2 py-1 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200">
                    {visibleNavItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `group flex items-center gap-2 rounded-full px-3 py-2 transition duration-150 ease-out ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/80 dark:bg-blue-500'
                              : 'text-slate-700 hover:-translate-y-0.5 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                          }`
                        }
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-white group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-900">
                          {item.icon}
                        </span>
                        <span className="hidden whitespace-nowrap md:inline">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </nav>
                <nav className="block sm:hidden">
                  <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/80 px-2 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
                    {visibleNavItems.map((item) => (
                      <NavLink
                        key={`mobile-${item.to}`}
                        to={item.to}
                        className={({ isActive }) =>
                          `group flex items-center gap-2 rounded-xl px-3 py-2 transition duration-150 ease-out ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/80 dark:bg-blue-500'
                              : 'text-slate-700 hover:-translate-y-0.5 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                          }`
                        }
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-white group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-900">
                          {item.icon}
                        </span>
                        <span className="whitespace-nowrap">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </nav>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
};

export default AppLayout;
