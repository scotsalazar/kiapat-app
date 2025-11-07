import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ToastProvider';
import LoginPage from './pages/Login';
import InventoryManagerPage from './pages/InventoryManager';
import AdminUsersPage from './pages/AdminUsers';
import DriverInvoicePage from './pages/DriverInvoice';
import InvoiceHistoryPage from './pages/InvoiceHistory';
import ThemeToggle from './components/ThemeToggle';

const RequireAuth: React.FC<{ allowedRoles?: string[]; children: JSX.Element }> = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // redirect to appropriate home
    return <Navigate to="/" replace />;
  }
  return children;
};

const DefaultRoute: React.FC = () => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'admin') {
    return <Navigate to="/admin/users" replace />;
  }
  return <Navigate to="/invoice" replace />;
};

const AppHeader: React.FC = () => {
  const { user } = useAuth();
  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm transition-colors dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div>
          <div className="text-lg font-semibold tracking-tight">Kiapat</div>
          {user ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">Signed in as {user.name ?? user.username}</div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">Welcome back</div>
          )}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
          <AppHeader />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<DefaultRoute />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/admin/users"
                element={
                  <RequireAuth allowedRoles={['admin']}>
                    <AdminUsersPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/inventory"
                element={
                  <RequireAuth allowedRoles={['admin']}>
                    <InventoryManagerPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/invoice"
                element={
                  <RequireAuth allowedRoles={['driver']}>
                    <DriverInvoicePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/invoices/history"
                element={
                  <RequireAuth allowedRoles={['admin', 'driver']}>
                    <InvoiceHistoryPage />
                  </RequireAuth>
                }
              />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;