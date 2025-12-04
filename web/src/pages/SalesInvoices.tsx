import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import { formatDateTime } from '../utils/dateTime';
import type { Classification } from '../types/invoice';

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

interface InvoiceItem {
  id: number;
  classification_id: number;
  unit: string;
  qty: number;
  unit_price: number;
  line_total: number;
  classification?: Classification | null;
}

interface InvoiceDetail extends Invoice {
  signature_url: string | null;
  items: InvoiceItem[];
  subtotal_amount?: number;
  tax_amount?: number;
}

interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

const INVOICE_STATUSES = ['COMPLETED', 'PENDING_OVERRIDE', 'REJECTED'];
const TRAY_SIZE = 30;
const DOZEN_SIZE = 12;

const SalesInvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
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
  const [exporting, setExporting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<Record<number, InvoiceDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [signaturePreviews, setSignaturePreviews] = useState<Record<number, string>>({});
  const [signatureLoading, setSignatureLoading] = useState<Record<number, boolean>>({});
  const [decisionLoading, setDecisionLoading] = useState(false);

  const signaturePreviewRef = useRef(signaturePreviews);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    signaturePreviewRef.current = signaturePreviews;
  }, [signaturePreviews]);

  useEffect(
    () => () => {
      Object.values(signaturePreviewRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const buildFilterParams = useCallback(() => {
    const params: Record<string, any> = {};

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

    return params;
  }, [customer, endDate, startDate, status]);

  const fetchInvoices = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const params: Record<string, any> = { page, page_size: pageSize, ...buildFilterParams() };

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
  }, [buildFilterParams, page, pageSize, showToast, t, token]);

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
      return (
        <span className={`${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200`}>
          Pending approval
        </span>
      );
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

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);

    try {
      const params = buildFilterParams();
      const res = await apiClient.get('/api/sales/invoices/export', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales-invoices-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('XLSX report generated successfully', 'success');
    } catch (err) {
      const { message } = parseApiError(err, t('invoiceHistory.errors.load'));
      showToast(message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);
    if (!invoiceDetails[invoiceId]) {
      void fetchInvoiceDetail(invoiceId);
    }
  };

  const fetchInvoiceDetail = useCallback(
    async (invoiceId: number) => {
      if (!token) return;
      setDetailLoading(true);
      setDetailError('');

      try {
        const res = await apiClient.get<InvoiceDetail>(`/api/sales/invoices/${invoiceId}`);
        setInvoiceDetails((prev) => ({ ...prev, [invoiceId]: res.data }));
      } catch (err) {
        const { message } = parseApiError(err, t('invoiceHistory.errors.load'));
        setDetailError(message);
        showToast(message, 'error');
      } finally {
        setDetailLoading(false);
      }
    },
    [showToast, t, token],
  );

  const handleLoadSignature = useCallback(
    async (invoiceId: number) => {
      const detail = invoiceDetails[invoiceId];
      if (!detail?.signature_url || signaturePreviews[invoiceId]) {
        return;
      }

      setSignatureLoading((prev) => ({ ...prev, [invoiceId]: true }));
      try {
        const res = await apiClient.get<Blob>(detail.signature_url, { responseType: 'blob' });
        const objectUrl = URL.createObjectURL(res.data);
        setSignaturePreviews((prev) => ({ ...prev, [invoiceId]: objectUrl }));
      } catch (err) {
        const { message } = parseApiError(err, t('invoiceHistory.errors.load'));
        showToast(message, 'error');
      } finally {
        setSignatureLoading((prev) => ({ ...prev, [invoiceId]: false }));
      }
    },
    [invoiceDetails, signaturePreviews, showToast, t],
  );

  const handleApproveOverride = useCallback(
    async (invoiceId: number) => {
      setDecisionLoading(true);
      try {
        const res = await apiClient.post<InvoiceDetail>(`/api/sales/invoices/${invoiceId}/override/approve`);
        setInvoiceDetails((prev) => ({ ...prev, [invoiceId]: res.data }));
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: res.data.status } : inv)));
        showToast('Invoice approved', 'success');
      } catch (err) {
        const { message } = parseApiError(err, 'Unable to approve invoice');
        showToast(message, 'error');
      } finally {
        setDecisionLoading(false);
      }
    },
    [showToast],
  );

  const handleRejectOverride = useCallback(
    async (invoiceId: number) => {
      setDecisionLoading(true);
      try {
        const res = await apiClient.post<InvoiceDetail>(`/api/sales/invoices/${invoiceId}/override/reject`);
        setInvoiceDetails((prev) => ({ ...prev, [invoiceId]: res.data }));
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: res.data.status } : inv)));
        showToast('Invoice marked as rejected', 'info');
      } catch (err) {
        const { message } = parseApiError(err, 'Unable to reject invoice');
        showToast(message, 'error');
      } finally {
        setDecisionLoading(false);
      }
    },
    [showToast],
  );

  const closeModal = () => {
    setSelectedInvoiceId(null);
    setDetailError('');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedInvoiceId !== null) {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInvoiceId]);

  const selectedInvoice = useMemo(() => {
    if (selectedInvoiceId === null) return null;
    return invoiceDetails[selectedInvoiceId] || invoices.find((inv) => inv.id === selectedInvoiceId) || null;
  }, [invoiceDetails, invoices, selectedInvoiceId]);

  const formatCurrencyValue = useMemo(
    () => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
    [],
  );

  const totalPieces = useMemo(() => {
    if (!selectedInvoice || !('items' in selectedInvoice)) return 0;
    return selectedInvoice.items.reduce((sum, item) => {
      if (item.unit === 'TRAY') return sum + item.qty * TRAY_SIZE;
      if (item.unit === 'DOZEN') return sum + item.qty * DOZEN_SIZE;
      return sum + item.qty;
    }, 0);
  }, [selectedInvoice]);

  useEffect(() => {
    if (selectedInvoice?.signature_url && selectedInvoiceId && !signaturePreviews[selectedInvoiceId]) {
      void handleLoadSignature(selectedInvoiceId);
    }
  }, [handleLoadSignature, selectedInvoice?.signature_url, selectedInvoiceId, signaturePreviews]);

  const formatStatusLabel = (statusValue: string) => {
    if (statusValue === 'PENDING_OVERRIDE') {
      return 'Pending approval';
    }
    return statusValue.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Filter invoices by date range, customer, and status to narrow results.
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || invoices.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? 'Generating XLSX…' : 'Generate XLSX report'}
          </button>
        </div>
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
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                  {t('common.labels.driver')}
                </th>
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
                  <tr
                    key={invoice.id}
                    onClick={() => handleSelectInvoice(invoice.id)}
                    className="cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50 dark:hover:bg-slate-800/50 dark:focus-within:bg-slate-800/50"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectInvoice(invoice.id);
                      }
                    }}
                  >
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

      {selectedInvoiceId !== null && selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-details-title"
          onClick={(e) => {
            if (e.currentTarget === e.target) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl transition-colors dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 id="invoice-details-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {t('salesInvoices.details.title', { id: selectedInvoice.id })}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">{t('salesInvoices.details.description')}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t('common.actions.close')}
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-6">
              {detailLoading && (
                <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  {t('salesInvoices.details.loading')}
                </div>
              )}
              {detailError && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
                  {detailError}
                </div>
              )}

              {selectedInvoice.status === 'PENDING_OVERRIDE' && user?.role === 'admin' && (
                <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-50">
                  <div className="mb-2 font-semibold">Pending approval</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={decisionLoading}
                      onClick={() => handleApproveOverride(selectedInvoice.id)}
                      className="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                    >
                      Approve invoice
                    </button>
                    <button
                      type="button"
                      disabled={decisionLoading}
                      onClick={() => handleRejectOverride(selectedInvoice.id)}
                      className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 rounded border border-slate-200 p-4 dark:border-slate-700">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t('salesInvoices.details.summary')}
                  </h3>
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{t('common.labels.customer')}</div>
                    <div>{selectedInvoice.customer_name || t('common.messages.walkIn')}</div>
                    {selectedInvoice.customer_phone && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{selectedInvoice.customer_phone}</div>
                    )}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{t('salesInvoices.details.gps')}</div>
                    <div>{selectedInvoice.gps_coordinates || t('driverInvoice.form.locationUnavailable')}</div>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{t('common.labels.status')}</div>
                    <div>{formatStatusLabel(selectedInvoice.status)}</div>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{t('common.labels.driver')}</div>
                    <div>{renderDriverCell(selectedInvoice)}</div>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{t('common.labels.created')}</div>
                    <div>{formatDateTime(selectedInvoice.created_at)}</div>
                  </div>
                </div>

                <div className="space-y-2 rounded border border-slate-200 p-4 dark:border-slate-700">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t('salesInvoices.details.totals')}
                  </h3>
                  <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                    <span>{t('common.labels.subtotal')}</span>
                    <span>
                      {formatCurrencyValue.format(
                        'subtotal_amount' in selectedInvoice && selectedInvoice.subtotal_amount !== undefined
                          ? selectedInvoice.subtotal_amount
                          : selectedInvoice.total_amount,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                    <span>{t('common.labels.taxes')}</span>
                    <span>
                      {formatCurrencyValue.format(
                        'tax_amount' in selectedInvoice && selectedInvoice.tax_amount !== undefined
                          ? selectedInvoice.tax_amount
                          : 0,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                    <span>Total pieces</span>
                    <span>{totalPieces.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <span>{t('common.labels.total')}</span>
                    <span>{formatCurrencyValue.format(selectedInvoice.total_amount)}</span>
                  </div>
                </div>

                <div className="space-y-2 rounded border border-slate-200 p-4 dark:border-slate-700">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t('salesInvoices.details.signature')}
                  </h3>
                  {selectedInvoice.signature_url ? (
                    signaturePreviews[selectedInvoice.id] ? (
                      <div className="flex flex-col items-start gap-3">
                        <img
                          src={signaturePreviews[selectedInvoice.id]}
                          alt={t('invoicePreview.signatureAlt')}
                          className="h-28 w-auto rounded border border-slate-200 object-contain dark:border-slate-700"
                        />
                        <a
                          href={signaturePreviews[selectedInvoice.id]}
                          download={`invoice-${selectedInvoice.id}-signature.png`}
                          className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                        >
                          {t('salesInvoices.details.downloadSignature')}
                        </a>
                      </div>
                    ) : signatureLoading[selectedInvoice.id] ? (
                      <div className="text-sm text-slate-600 dark:text-slate-300">Loading signature…</div>
                    ) : (
                      <div className="text-sm text-slate-600 dark:text-slate-300">Preparing signature preview…</div>
                    )
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400">{t('invoicePreview.noSignature')}</div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded border border-slate-200 dark:border-slate-700">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {t('salesInvoices.details.items')}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                    <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">{t('invoicePreview.table.classification')}</th>
                        <th className="px-4 py-2 text-right font-semibold">{t('invoicePreview.table.quantity')}</th>
                        <th className="px-4 py-2 text-right font-semibold">{t('invoicePreview.table.unit')}</th>
                        <th className="px-4 py-2 text-right font-semibold">{t('invoicePreview.table.unitPrice')}</th>
                        <th className="px-4 py-2 text-right font-semibold">{t('invoicePreview.table.lineTotal')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                      {'items' in selectedInvoice && selectedInvoice.items.length > 0 ? (
                        selectedInvoice.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">
                              {item.classification
                                ? `${item.classification.size} ${item.classification.color}`
                                : t('invoicePreview.unclassified')}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-slate-700 dark:text-slate-200">{item.qty}</td>
                            <td className="px-4 py-2 text-right text-sm text-slate-700 dark:text-slate-200">{item.unit}</td>
                            <td className="px-4 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                              ₱{item.unit_price.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                              ₱{item.line_total.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            {t('salesInvoices.details.noItems')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesInvoicesPage;
