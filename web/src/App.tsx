import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider';
import InventoryManagerPage from './pages/InventoryManager';
import AdminUsersPage from './pages/AdminUsers';
import DriverInvoicePage from './pages/DriverInvoice';
import InvoiceHistoryPage from './pages/InvoiceHistory';
import DashboardPage from './pages/Dashboard';
import VehiclesPage from './pages/Vehicles';
import AppLayout from './components/AppLayout';
import RequireAuth from './components/RequireAuth';
import LoginPage from './pages/Login';
import { useAuth } from './hooks/useAuth';

const App: React.FC = () => {
  const { user } = useAuth();

  const withLayout = (page: React.ReactNode) => (
    <RequireAuth>
      <AppLayout>{page}</AppLayout>
    </RequireAuth>
  );

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={withLayout(<DashboardPage />)} />
        <Route path="/admin/users" element={withLayout(<AdminUsersPage />)} />
        <Route path="/inventory" element={withLayout(<InventoryManagerPage />)} />
        <Route path="/vehicles" element={withLayout(<VehiclesPage />)} />
        <Route path="/invoice" element={withLayout(<DriverInvoicePage />)} />
        <Route path="/invoices/history" element={withLayout(<InvoiceHistoryPage />)} />
      </Routes>
    </ToastProvider>
  );
};

export default App;
