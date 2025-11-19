import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import { formatDateTime } from '../utils/dateTime';

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
  gps_coordinates: string | null;
  total_amount: number;
  created_by: number;
  created_at: string;
  status: string;
  created_by_user?: UserSummary | null;
}

interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

const INVOICE_STATUSES = ['COMPLETED', 'PENDING_OVERRIDE', 'REJECTED'];

const SalesInvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customer, setCustomer] = useState('');
  const [status, setStatus] = useState('');

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const fetchInvoices = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const params: Record<string, any> = { page, page_size: pageSize };

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        params.start_date = start.toISOString();
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        params.end_date = end.toISOString();
      }
      if (customer.trim()) {
        params.customer = customer.trim();
      }
      if (status) {
        params.status = status;
      }

      const res = await apiClient.get<InvoiceListResponse>('/api/sales/invoices', { params });
      setInvoices(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      const { message } = parseApiError(err, t('invoiceHistory.errors.load'));
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [customer, endDate, page, pageSize, showToast, startDate, status, t, token]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handlePageChange = (next: number) => {
    if (next < 1 || next > pageCount || next === page) return;
    setPage(next);
  };

  const resetPageAnd = (updater: (value: string) => void) => (value: string) => {
    updater(value);
    setPage(1);
  };

  const renderStatusBadge = (invoiceStatus: string) => {
    const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
    if (invoiceStatus === 'PENDING_OVERRIDE') {
      return <span className={`${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200`}>Pending override</span>;
    }
    if (invoiceStatus === 'REJECTED') {
      return <span className={`${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`}>Rejected</span>;
    }
    return <span className={`${base} bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200`}>Completed</span>;
  };

  const renderDriverCell = (invoice: Invoice) => {
    if (invoice.created_by_user) {
      return invoice.created_by_user.name || invoice.created_by_user.username;
    }
    return `#${invoice.created_by}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Invoices</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Review completed and pending sales invoices with quick filters.
        </p>
      </div>

      <div className="space-y-4 rounded border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => resetPageAnd(setStartDate)(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => resetPageAnd(setEndDate)(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Customer</span>
            <input
              type="text"
              value={customer}
              placeholder="Search customer name or phone"
              onChange={(e) => resetPageAnd(setCustomer)(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Status</span>
            <select
              value={status}
              onChange={(e) => resetPageAnd(setStatus)(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">All statuses</option>
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0)}
                  {s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <span>
            Page {page} of {pageCount} · {total} invoice{total === 1 ? '' : 's'}
          </span>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="rounded border border-slate-300 px-3 py-1 transition disabled:opacity-50 dark:border-slate-600"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === pageCount || loading}
              className="rounded border border-slate-300 px-3 py-1 transition disabled:opacity-50 dark:border-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
        {error && <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Invoice</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Customer</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                  {t('driverInvoice.form.gpsCoordinatesLabel')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Driver</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    {t('invoiceHistory.loading')}
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    {t('invoiceHistory.empty')}
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">#{invoice.id}</td>
                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{formatDateTime(invoice.created_at)}</td>
                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">
                      {invoice.customer_name || t('common.messages.walkIn')}
                      {invoice.customer_phone && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">
                      {invoice.gps_coordinates || t('driverInvoice.form.locationUnavailable')}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">{renderDriverCell(invoice)}</td>
                    <td className="px-4 py-2 text-sm">{renderStatusBadge(invoice.status)}</td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                      ₱{invoice.total_amount.toFixed(2)}
                    </td>
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

export default SalesInvoicesPage;
