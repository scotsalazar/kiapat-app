import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
      aria-label={t('common.actions.toggleTheme', 'Toggle theme')}
    >
      <span aria-hidden>{isDark ? '🌙' : '☀️'}</span>
      <span className="hidden sm:inline">{isDark ? t('common.labels.darkMode', 'Dark mode') : t('common.labels.lightMode', 'Light mode')}</span>
    </button>
  );
};

export default ThemeToggle;
