import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { extractApiError } from '../utils/errorHandling';

interface InvoiceItem {
  id: number;
  classification_id: number;
  unit: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

interface UserSummary {
  id: number;
  name: string;
  username: string;
  role: string;
  created_at: string;
}

interface Invoice {
  id: number;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  signature_png_path: string | null;
  created_by: number;
  created_at: string;
  created_by_user?: UserSummary | null;
  items: InvoiceItem[];
}

interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

const STATUSES = ['DRAFT', 'VERIFIED', 'COMMITTED'];

const InvoiceHistoryPage: React.FC = () => {
  const { token, user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customer, setCustomer] = useState<string>('');
  const [driver, setDriver] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const { showToast } = useToast();

  const fetchInvoices = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
      if (startDate) {
        params.start_date = new Date(`${startDate}T00:00:00`);
      }
      if (endDate) {
        params.end_date = new Date(`${endDate}T23:59:59`);
      }
      if (customer.trim()) {
        params.customer = customer.trim();
      }
      if (status) {
        params.status = status;
      }
      if (user?.role === 'admin' && driver.trim()) {
        params.driver = driver.trim();
      }

      const res = await axios.get<InvoiceListResponse>('/api/sales/invoices', {
        params,
        headers: authHeader,
      });
      setInvoices(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      const parsed = extractApiError(err, 'Failed to load invoices');
      setError(parsed.message);
      showToast({ message: parsed.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [authHeader, customer, driver, endDate, page, pageSize, showToast, startDate, status, token, user?.role]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const handlePageChange = (next: number) => {
    if (next < 1 || next > pageCount || next === page) return;
    setPage(next);
  };

  const resetPageAnd = (updater: (value: string) => void) => (value: string) => {
    updater(value);
    setPage(1);
  };

  const renderDriverCell = (invoice: Invoice) => {
    if (invoice.created_by_user) {
      return invoice.created_by_user.name || invoice.created_by_user.username;
    }
    return `#${invoice.created_by}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Invoice History</h1>
        <p className="text-sm text-gray-600">
          Use the filters below to refine invoice results by date range, customer, driver, and status.
        </p>
      </div>
      <div className="bg-white rounded shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="flex flex-col text-sm">
            <span className="font-medium text-gray-700">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => resetPageAnd(setStartDate)(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-gray-700">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => resetPageAnd(setEndDate)(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-gray-700">Customer</span>
            <input
              type="text"
              value={customer}
              onChange={(e) => resetPageAnd(setCustomer)(e.target.value)}
              placeholder="Search name or phone"
              className="border rounded px-3 py-2"
            />
          </label>
          {user?.role === 'admin' && (
            <label className="flex flex-col text-sm">
              <span className="font-medium text-gray-700">Driver</span>
              <input
                type="text"
                value={driver}
                onChange={(e) => resetPageAnd(setDriver)(e.target.value)}
                placeholder="Name or username"
                className="border rounded px-3 py-2"
              />
            </label>
          )}
          <label className="flex flex-col text-sm">
            <span className="font-medium text-gray-700">Status</span>
            <select
              value={status}
              onChange={(e) => resetPageAnd(setStatus)(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0)}{s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-gray-700">Page size</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="border rounded px-3 py-2"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing page {page} of {pageCount} • {total} total invoice{total === 1 ? '' : 's'}
          </span>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === pageCount || loading}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded shadow">
        {error && <div className="p-4 text-red-600 text-sm">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    No invoices found for the selected filters.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">#{invoice.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {new Date(invoice.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {invoice.customer_name || 'Walk-in'}
                      {invoice.customer_phone && (
                        <div className="text-xs text-gray-500">{invoice.customer_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{renderDriverCell(invoice)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">₱{invoice.total_amount.toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 text-right">{invoice.items.length}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoiceHistoryPage;
