import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ToastProvider';
import { isDemoMode } from '../utils/env';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const demoMode = isDemoMode();

  const handleLogout = () => {
    logout();
    showToast(demoMode ? 'Logged out of demo session' : 'Logged out', 'info');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', roles: ['admin'] },
    { to: '/inventory', label: 'Inventory', roles: ['admin'] },
    { to: '/vehicles', label: 'Vehicles', roles: ['admin'] },
    { to: '/admin/users', label: 'Users', roles: ['admin'] },
    { to: '/invoice', label: 'Invoice', roles: ['driver'] },
    { to: '/invoices/history', label: 'History', roles: ['admin', 'driver'] },
  ];

  const visibleNavItems = navItems.filter((item) => (user ? item.roles.includes(user.role) : false));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm transition-colors dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt={t('common.appName', 'Kiapat Inventory')} className="h-9 w-9 rounded" />
            <div>
              <p className="text-base font-semibold leading-tight">{t('common.appName')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.tagline', 'Inventory & invoicing dashboard')}</p>
            </div>
            {demoMode && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                Demo mode
              </span>
            )}
          </div>
          {visibleNavItems.length > 0 && (
            <nav className="hidden flex-1 items-center justify-center gap-3 text-sm font-medium text-slate-500 sm:flex">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1 transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-3">
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
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      {demoMode && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Demo mode: no backend calls are made. All data is static.
        </div>
      )}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
};

export default AppLayout;
