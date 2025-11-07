import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';

interface InvoiceItem {
  id: number;
  classification_id: number;
  unit: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

interface InvoiceOverride {
  id: number;
  status: string;
  classification_id: number;
  requested_qty_pcs: number;
  requested_unit: string;
  available_qty_pcs: number;
  decision_reason?: string | null;
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
  status: string;
  created_by_user?: UserSummary | null;
  items: InvoiceItem[];
  overrides: InvoiceOverride[];
}

interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

const MOVEMENT_STATUSES = ['DRAFT', 'VERIFIED', 'COMMITTED', 'PENDING_OVERRIDE', 'REJECTED'];
const INVOICE_STATUSES = ['COMPLETED', 'PENDING_OVERRIDE', 'REJECTED'];

const InvoiceHistoryPage: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customer, setCustomer] = useState<string>('');
  const [driver, setDriver] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [invoiceStatus, setInvoiceStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const fieldStyles =
    'rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-400 dark:focus:ring-offset-slate-900';

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
      if (invoiceStatus) {
        params.invoice_status = invoiceStatus;
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
      const { message } = parseApiError(err, 'Failed to load invoices');
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [authHeader, customer, driver, endDate, page, pageSize, showToast, startDate, status, token, user?.role, invoiceStatus]);

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
    <div className="space-y-4 p-4 text-slate-900 transition-colors md:p-6 dark:text-slate-100">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Invoice History</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Use the filters below to refine invoice results by date range, customer, driver, and status.
        </p>
      </div>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => resetPageAnd(setStartDate)(e.target.value)}
              className={fieldStyles}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-200">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => resetPageAnd(setEndDate)(e.target.value)}
              className={fieldStyles}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Customer</span>
            <input
              type="text"
              value={customer}
              onChange={(e) => resetPageAnd(setCustomer)(e.target.value)}
              placeholder="Search name or phone"
              className={fieldStyles}
            />
          </label>
          {user?.role === 'admin' && (
            <label className="flex flex-col text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Driver</span>
              <input
                type="text"
                value={driver}
                onChange={(e) => resetPageAnd(setDriver)(e.target.value)}
                placeholder="Name or username"
                className={fieldStyles}
              />
            </label>
          )}
          <label className="flex flex-col text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Status</span>
            <select
              value={status}
              onChange={(e) => resetPageAnd(setStatus)(e.target.value)}
              className={fieldStyles}
            >
              <option value="">All statuses</option>
              {MOVEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0)}{s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Invoice status</span>
            <select
              value={invoiceStatus}
              onChange={(e) => resetPageAnd(setInvoiceStatus)(e.target.value)}
              className={fieldStyles}
            >
              <option value="">All invoice statuses</option>
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0)}{s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Page size</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className={fieldStyles}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing page {page} of {pageCount} • {total} total invoice{total === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="rounded-full border border-slate-300 px-3 py-1 font-medium text-slate-700 transition-colors hover:border-brand-500 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-100 dark:hover:border-brand-400 dark:hover:text-brand-300 dark:focus-visible:ring-offset-slate-900"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === pageCount || loading}
              className="rounded-full border border-slate-300 px-3 py-1 font-medium text-slate-700 transition-colors hover:border-brand-500 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-100 dark:hover:border-brand-400 dark:hover:text-brand-300 dark:focus-visible:ring-offset-slate-900"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        {error && <div className="border-b border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-100/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2">Invoice #</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Driver</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/60 dark:divide-slate-800 dark:bg-slate-900/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No invoices found for the selected filters.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">#{invoice.id}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {new Date(invoice.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {invoice.customer_name || 'Walk-in'}
                      {invoice.customer_phone && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{renderDriverCell(invoice)}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          invoice.status === 'PENDING_OVERRIDE'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                            : invoice.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                        }`}
                      >
                        {invoice.status.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                      </span>
                      {invoice.overrides.length > 0 && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {invoice.overrides.length} override{invoice.overrides.length === 1 ? '' : 's'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">
                      ₱{invoice.total_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{invoice.items.length}</td>
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
