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

const App: React.FC = () => {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AppLayout>
              <AdminUsersPage />
            </AppLayout>
          }
        />
        <Route
          path="/inventory"
          element={
            <AppLayout>
              <InventoryManagerPage />
            </AppLayout>
          }
        />
        <Route
          path="/vehicles"
          element={
            <AppLayout>
              <VehiclesPage />
            </AppLayout>
          }
        />
        <Route
          path="/invoice"
          element={
            <AppLayout>
              <DriverInvoicePage />
            </AppLayout>
          }
        />
        <Route
          path="/invoices/history"
          element={
            <AppLayout>
              <InvoiceHistoryPage />
            </AppLayout>
          }
        />
      </Routes>
    </ToastProvider>
  );
};

export default App;
