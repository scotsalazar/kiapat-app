import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ToastProvider';
import LoginPage from './pages/Login';
import InventoryManagerPage from './pages/InventoryManager';
import AdminUsersPage from './pages/AdminUsers';
import DriverInvoicePage from './pages/DriverInvoice';
import InvoiceHistoryPage from './pages/InvoiceHistory';
import DashboardPage from './pages/Dashboard';
import VehiclesPage from './pages/Vehicles';
import AppLayout from './components/AppLayout';

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
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/invoice" replace />;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<DefaultRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AppLayout>
                  <AdminUsersPage />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/inventory"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AppLayout>
                  <InventoryManagerPage />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/vehicles"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AppLayout>
                  <VehiclesPage />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/invoice"
            element={
              <RequireAuth allowedRoles={['driver']}>
                <AppLayout>
                  <DriverInvoicePage />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/invoices/history"
            element={
              <RequireAuth allowedRoles={['admin', 'driver']}>
                <AppLayout>
                  <InvoiceHistoryPage />
                </AppLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;