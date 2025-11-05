import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/Login';
import InventoryManagerPage from './pages/InventoryManager';
import AdminUsersPage from './pages/AdminUsers';
import DriverInvoicePage from './pages/DriverInvoice';
import InvoiceHistoryPage from './pages/InvoiceHistory';

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

const App: React.FC = () => {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
};

export default App;