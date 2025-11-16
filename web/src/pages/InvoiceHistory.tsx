import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import { formatDateTime } from '../utils/dateTime';
import apiClient from '../api/axios';

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
  const { t } = useTranslation();
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

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    const applyFilters = (source: Invoice[]) => {
      let filtered = [...source];
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        filtered = filtered.filter((invoice) => new Date(invoice.created_at) >= start);
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        filtered = filtered.filter((invoice) => new Date(invoice.created_at) <= end);
      }
      if (customer.trim()) {
        const term = customer.trim().toLowerCase();
        filtered = filtered.filter((invoice) => {
          const name = invoice.customer_name?.toLowerCase() ?? '';
          const phone = invoice.customer_phone ?? '';
          return name.includes(term) || phone.includes(term);
        });
      }
      if (status) {
        filtered = filtered.filter((invoice) => invoice.status === status);
      }
      if (invoiceStatus) {
        filtered = filtered.filter((invoice) => invoice.status === invoiceStatus);
      }
      if (user?.role === 'admin' && driver.trim()) {
        const term = driver.trim().toLowerCase();
        filtered = filtered.filter((invoice) => {
          const createdBy =
            invoice.created_by_user?.name ||
            invoice.created_by_user?.username ||
            `#${invoice.created_by}`;
          return createdBy.toLowerCase().includes(term);
        });
      }
      return filtered;
    };

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
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
      if (invoiceStatus) {
        params.invoice_status = invoiceStatus;
      }
      if (user?.role === 'admin' && driver.trim()) {
        params.driver = driver.trim();
      }

      const res = await apiClient.get<InvoiceListResponse>('/api/sales/invoices', {
        params,
      });
      setInvoices(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      const { message } = parseApiError(err, t('invoiceHistory.errors.load'));
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [
    customer,
    driver,
    endDate,
    page,
    pageSize,
    showToast,
    startDate,
    status,
    token,
    user?.role,
    invoiceStatus,
  ]);

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
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('invoiceHistory.title')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('invoiceHistory.description')}</p>
      </div>
      <div className="space-y-4 rounded border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('invoiceHistory.filters.startDate')}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => resetPageAnd(setStartDate)(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('invoiceHistory.filters.endDate')}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => resetPageAnd(setEndDate)(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('invoiceHistory.filters.customer')}</span>
            <input
              type="text"
              value={customer}
              onChange={(e) => resetPageAnd(setCustomer)(e.target.value)}
              placeholder={t('invoiceHistory.filters.customerPlaceholder')}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          {user?.role === 'admin' && (
            <label className="flex flex-col text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">{t('invoiceHistory.filters.driver')}</span>
              <input
                type="text"
                value={driver}
                onChange={(e) => resetPageAnd(setDriver)(e.target.value)}
                placeholder={t('invoiceHistory.filters.driverPlaceholder')}
                className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          )}
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('invoiceHistory.filters.status')}</span>
            <select
              value={status}
              onChange={(e) => resetPageAnd(setStatus)(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t('invoiceHistory.filters.allStatuses')}</option>
              {MOVEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0)}{s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('invoiceHistory.filters.invoiceStatus')}</span>
            <select
              value={invoiceStatus}
              onChange={(e) => resetPageAnd(setInvoiceStatus)(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t('invoiceHistory.filters.allInvoiceStatuses')}</option>
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0)}{s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('invoiceHistory.filters.pageSize')}</span>
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
                  {t('invoiceHistory.filters.perPage', { count: size })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <span>
            {t('invoiceHistory.pagination.summary', {
              page,
              pageCount,
              total,
              plural: total === 1 ? '' : 's',
            })}
          </span>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="rounded border border-slate-300 px-3 py-1 transition disabled:opacity-50 dark:border-slate-600"
            >
              {t('invoiceHistory.pagination.previous')}
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === pageCount || loading}
              className="rounded border border-slate-300 px-3 py-1 transition disabled:opacity-50 dark:border-slate-600"
            >
              {t('invoiceHistory.pagination.next')}
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
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.invoice')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.created')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.customer')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.driver')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.status')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.total')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.items')}
                </th>
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
                  <tr key={invoice.id}>
                    <td className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">#{invoice.id}</td>
                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
                      {formatDateTime(invoice.created_at)}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">
                      {invoice.customer_name || t('common.messages.walkIn')}
                      {invoice.customer_phone && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">{renderDriverCell(invoice)}</td>
                    <td className="px-4 py-2 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          invoice.status === 'PENDING_OVERRIDE'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                            : invoice.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        }`}
                      >
                        {invoice.status.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                      </span>
                      {invoice.overrides.length > 0 && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t('invoiceHistory.table.overrides', {
                            count: invoice.overrides.length,
                            plural: invoice.overrides.length === 1 ? '' : 's',
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">₱{invoice.total_amount.toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-right text-slate-700 dark:text-slate-200">{invoice.items.length}</td>
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
