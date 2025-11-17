import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ToastProvider';
import { isFullVersion } from '../config/appVersion';

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
    { to: '/dashboard', label: 'Dashboard', roles: ['admin'], enabled: isFullVersion },
    { to: '/inventory', label: 'Inventory', roles: ['admin'], enabled: isFullVersion },
    { to: '/vehicles', label: 'Vehicles', roles: ['admin'], enabled: isFullVersion },
    { to: '/admin/users', label: 'Users', roles: ['admin'], enabled: true },
    { to: '/sales-invoices', label: 'Sales Invoices', roles: ['admin'], enabled: true },
    { to: '/invoice', label: 'Invoice', roles: ['driver'], enabled: true },
    { to: '/invoices/history', label: 'History', roles: isFullVersion ? ['admin', 'driver'] : ['driver'], enabled: true },
  ].filter((item) => item.enabled);

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
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
};

export default AppLayout;
