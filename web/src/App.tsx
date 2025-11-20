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
import { useAuth, UserRole } from './hooks/useAuth';
import SalesInvoicesPage from './pages/SalesInvoices';
import ProductsPage from './pages/Products';
import { isFullVersion, isLiteVersion } from './config/appVersion';

const App: React.FC = () => {
  const { user } = useAuth();
  const defaultAdminPath = isLiteVersion ? '/products' : '/dashboard';
  const invoiceHistoryRoles: UserRole[] = isFullVersion ? ['admin', 'driver'] : ['driver'];

  const withLayout = (page: React.ReactNode, allowedRoles?: UserRole[]) => (
    <RequireAuth allowedRoles={allowedRoles}>
      <AppLayout>{page}</AppLayout>
    </RequireAuth>
  );

  return (
    <ToastProvider>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={user ? (user.role === 'driver' ? '/invoice' : defaultAdminPath) : '/login'} replace />}
        />
        <Route path="/login" element={<LoginPage />} />
        {isFullVersion && <Route path="/dashboard" element={withLayout(<DashboardPage />, ['admin'])} />}
        <Route path="/admin/users" element={withLayout(<AdminUsersPage />, ['admin'])} />
        {isFullVersion && <Route path="/inventory" element={withLayout(<InventoryManagerPage />, ['admin'])} />}
        <Route path="/products" element={withLayout(<ProductsPage />, ['admin'])} />
        {isFullVersion && <Route path="/vehicles" element={withLayout(<VehiclesPage />, ['admin'])} />}
        <Route path="/invoice" element={withLayout(<DriverInvoicePage />, ['driver'])} />
        <Route path="/invoices/history" element={withLayout(<InvoiceHistoryPage />, invoiceHistoryRoles)} />
        <Route path="/sales-invoices" element={withLayout(<SalesInvoicesPage />, ['admin'])} />
      </Routes>
    </ToastProvider>
  );
};

export default App;
