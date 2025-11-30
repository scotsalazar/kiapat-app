import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import { formatDateTime } from '../utils/dateTime';
import apiClient from '../api/axios';
import type { Classification } from '../types/invoice';

interface InvoiceItem {
  id: number;
  classification_id: number;
  unit: string;
  qty: number;
  unit_price: number;
  line_total: number;
  classification?: Classification | null;
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
  gps_coordinates?: string | null;
  total_amount: number;
  signature_url: string | null;
  created_by: number;
  created_at: string;
  status: string;
  created_by_user?: UserSummary | null;
  receipt_reprint_count: number;
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
  const isDriver = user?.role === 'driver';
  const isAdmin = user?.role === 'admin';
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
  const [reprintingId, setReprintingId] = useState<number | null>(null);
  const [signaturePreviews, setSignaturePreviews] = useState<Record<number, string>>({});

  const effectivePageSize = useMemo(() => (isDriver ? 50 : pageSize), [isDriver, pageSize]);

  useEffect(() => {
    if (isDriver) {
      setPage(1);
      setPageSize(50);
    }
  }, [isDriver]);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
    [],
  );

  const formatCurrencyValue = useCallback(
    (value: number | null | undefined) =>
      value !== null && value !== undefined ? currencyFormatter.format(value) : t('common.notAvailable'),
    [currencyFormatter, t],
  );

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const params: Record<string, any> = {
        page,
        page_size: effectivePageSize,
      };
      if (!isDriver) {
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
  }, [customer, driver, effectivePageSize, endDate, invoiceStatus, isDriver, page, startDate, status, t, token, showToast, user?.role]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
  const tableColumnCount = isAdmin ? 9 : 8;

  useEffect(() => {
    if (!isDriver && page > pageCount) {
      setPage(pageCount);
    }
  }, [isDriver, page, pageCount]);

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

  const buildReceiptHtml = useCallback(
    (invoice: Invoice) => {
      const submissionTime = formatDateTime(invoice.created_at);
      const subtotal = invoice.items.reduce((sum, item) => sum + (item.line_total || 0), 0);
      const taxes = subtotal * 0.12;
      const totalWithTax = subtotal + taxes;

      const lineItemRows = invoice.items
        .map((item) => {
          const classification = item.classification;
          const label = classification
            ? `${classification.size} / ${classification.color}`
            : t('invoicePreview.unclassified');

          return `
            <tr>
              <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0;">${label}</td>
              <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.qty}</td>
              <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.unit}</td>
              <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrencyValue(item.unit_price)}</td>
              <td style="padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrencyValue(item.line_total)}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Sales Invoice Receipt</title>
            <style>
              body { font-family: Arial, sans-serif; color: #0f172a; padding: 16px; }
              h1 { font-size: 18px; margin-bottom: 8px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              tfoot td { font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>${t('driverInvoice.title')}</h1>
            <p><strong>${t('invoicePreview.summaryHeading')}:</strong> #${invoice.id} | ${submissionTime}</p>
            <p><strong>${t('common.labels.customerName')}:</strong> ${invoice.customer_name || '—'}<br />
               <strong>${t('common.labels.customerPhone')}:</strong> ${invoice.customer_phone || '—'}<br />
               <strong>${t('common.labels.address')}:</strong> ${t('common.messages.walkIn')}<br />
               <strong>${t('driverInvoice.form.gpsCoordinatesLabel')}:</strong> ${invoice.gps_coordinates || t('driverInvoice.form.locationUnavailable')}</p>
            <table>
              <thead>
                <tr>
                  <th style="text-align:left; padding: 6px 4px; border-bottom: 1px solid #e2e8f0;">${t('invoicePreview.table.classification')}</th>
                  <th style="text-align:right; padding: 6px 4px; border-bottom: 1px solid #e2e8f0;">${t('invoicePreview.table.quantity')}</th>
                  <th style="text-align:right; padding: 6px 4px; border-bottom: 1px solid #e2e8f0;">${t('invoicePreview.table.unit')}</th>
                  <th style="text-align:right; padding: 6px 4px; border-bottom: 1px solid #e2e8f0;">${t('invoicePreview.table.unitPrice')}</th>
                  <th style="text-align:right; padding: 6px 4px; border-bottom: 1px solid #e2e8f0;">${t('invoicePreview.table.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>${lineItemRows}</tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="padding: 6px 4px; text-align: right;">${t('invoicePreview.subtotal')}</td>
                  <td style="padding: 6px 4px; text-align: right;">${formatCurrencyValue(subtotal)}</td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: 6px 4px; text-align: right;">${t('invoicePreview.taxes', { rate: '12' })}</td>
                  <td style="padding: 6px 4px; text-align: right;">${formatCurrencyValue(taxes)}</td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: 6px 4px; text-align: right;">${t('invoicePreview.total')}</td>
                  <td style="padding: 6px 4px; text-align: right;">${formatCurrencyValue(totalWithTax)}</td>
                </tr>
              </tfoot>
            </table>
          </body>
        </html>
      `;
    },
    [formatCurrencyValue, t],
  );

  const triggerPrint = useCallback((html: string) => {
    const androidPrintManager = (
      window as unknown as {
        AndroidPrintManager?: { print?: (content: string) => void; printHtml?: (content: string) => void };
      }
    ).AndroidPrintManager;

    if (androidPrintManager?.printHtml) {
      androidPrintManager.printHtml(html);
      return;
    }
    if (androidPrintManager?.print) {
      androidPrintManager.print(html);
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  }, []);

  const handleReprint = useCallback(
    async (invoiceId: number) => {
      if (!token) return;
      setReprintingId(invoiceId);
      try {
        const res = await apiClient.post<Invoice>(`/api/sales/invoices/${invoiceId}/reprint`);
        triggerPrint(buildReceiptHtml(res.data));
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? res.data : inv)));
      } catch (err) {
        const { message } = parseApiError(err, t('invoiceHistory.errors.reprint'));
        showToast(message, 'error');
      } finally {
        setReprintingId(null);
      }
    },
    [buildReceiptHtml, showToast, t, token, triggerPrint],
  );

  const handleLoadSignature = useCallback(
    async (invoice: Invoice) => {
      if (!invoice.signature_url || signaturePreviews[invoice.id]) {
        return;
      }

      try {
        const res = await apiClient.get<Blob>(invoice.signature_url, { responseType: 'blob' });
        const objectUrl = URL.createObjectURL(res.data);
        setSignaturePreviews((prev) => ({ ...prev, [invoice.id]: objectUrl }));
      } catch (err) {
        const { message } = parseApiError(err, t('invoiceHistory.errors.load'));
        showToast(message, 'error');
      }
    },
    [signaturePreviews, showToast, t],
  );

  const signaturePreviewRef = useRef(signaturePreviews);

  useEffect(() => {
    signaturePreviewRef.current = signaturePreviews;
  }, [signaturePreviews]);

  useEffect(
    () => () => {
      Object.values(signaturePreviewRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const driverView = (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('invoiceHistory.title')}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('invoiceHistory.driverDescription')}</p>
        </div>
        <button
          type="button"
          onClick={fetchInvoices}
          className="inline-flex items-center rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
        >
          {t('common.actions.refresh')}
        </button>
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
                  {t('invoiceHistory.table.status')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.total')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.items')}
                </th>
                {isAdmin && (
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                    {t('common.labels.signature')}
                  </th>
                )}
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.reprintCount')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    {t('invoiceHistory.loading')}
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
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
                    <td className="px-4 py-2 text-sm">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          invoice.status === 'PENDING_OVERRIDE'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                            : invoice.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        }`}
                      >
                        {invoice.status.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrencyValue(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-slate-700 dark:text-slate-200">{invoice.items.length}</td>
                    <td className="px-4 py-2 text-sm text-right text-slate-700 dark:text-slate-200">
                      {invoice.receipt_reprint_count}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleReprint(invoice.id)}
                        disabled={reprintingId === invoice.id}
                        className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {reprintingId === invoice.id
                          ? t('invoiceHistory.table.reprinting')
                          : t('common.actions.reprintReceipt')}
                      </button>
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

  if (isDriver) {
    return driverView;
  }

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
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('invoiceHistory.filters.pageSize')}</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
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
                {isAdmin && (
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                    {t('common.labels.signature')}
                  </th>
                )}
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                  {t('invoiceHistory.table.reprintCount')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    {t('invoiceHistory.loading')}
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
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
                    <td className="px-4 py-2 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrencyValue(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-slate-700 dark:text-slate-200">{invoice.items.length}</td>
                    {isAdmin && (
                      <td className="px-4 py-2 text-sm text-right text-slate-700 dark:text-slate-200">
                        {invoice.signature_url ? (
                          signaturePreviews[invoice.id] ? (
                            <div className="flex flex-col items-end gap-2">
                              <img
                                src={signaturePreviews[invoice.id]}
                                alt={t('invoicePreview.signatureAlt')}
                                className="h-16 w-28 rounded border border-slate-200 object-contain dark:border-slate-700"
                              />
                              <a
                                href={signaturePreviews[invoice.id]}
                                download={`invoice-${invoice.id}-signature.png`}
                                className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                              >
                                {t('common.actions.download')}
                              </a>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLoadSignature(invoice)}
                              className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                            >
                              {t('common.actions.view')}
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{t('invoicePreview.noSignature')}</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2 text-sm text-right text-slate-700 dark:text-slate-200">
                      {invoice.receipt_reprint_count}
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

export default InvoiceHistoryPage;
