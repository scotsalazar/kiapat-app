import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import useInventoryStream, { InventoryUpdateMessage } from '../hooks/useInventoryStream';

interface Classification {
  id: number;
  size: string;
  color: string;
}

interface InventoryCard {
  classification_id: number;
  size: string;
  color: string;
  qty_tray: number;
  qty_dozen: number;
  qty_pcs: number;
  unit_price: number | null;
  stock_value: number | null;
  threshold_pcs: number | null;
  is_low: boolean;
}

interface InventoryTotals {
  qty_tray: number;
  qty_dozen: number;
  qty_pcs: number;
  stock_value: number | null;
}

interface InventorySummaryResponse {
  timestamp: string;
  totals: InventoryTotals;
  cards: InventoryCard[];
}

interface Movement {
  id: number;
  type: string;
  classification_id: number;
  qty_pcs: number;
  unit_entered: string;
  qty_entered: number;
  by_user_id: number;
  status: string;
  created_at: string;
  committed_at: string | null;
}

interface PriceUpdate {
  id: number;
  classification_id: number;
  unit: string;
  price_per_unit: number;
  effective_from: string;
  effective_to: string | null;
}

interface OverrideUserSummary {
  id: number;
  name: string;
  username: string;
}

interface OverrideInvoiceSummary {
  id: number;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  status: string;
  created_by: number;
  created_at: string;
  created_by_user?: OverrideUserSummary | null;
}

interface OverrideClassification {
  id: number;
  size: string;
  color: string;
}

interface PendingOverride {
  id: number;
  invoice_id: number;
  classification_id: number;
  requested_qty_pcs: number;
  requested_unit: string;
  available_qty_pcs: number;
  status: string;
  created_at: string;
  decision_reason?: string | null;
  invoice?: OverrideInvoiceSummary;
  classification?: OverrideClassification;
}

interface DailySalesSummary {
  date: string;
  total_amount: number;
  eggs_sold_pcs: number;
  invoice_count: number;
}

type InventoryStreamState = {
  summary: InventorySummaryResponse | null;
  movements: Movement[];
};

const InventoryManagerPage: React.FC = () => {
  const { token, user } = useAuth();
  const [initialSummary, setInitialSummary] =
    useState<InventorySummaryResponse | null>(null);
  const [initialMovements, setInitialMovements] = useState<Movement[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [selectedCls, setSelectedCls] = useState<number | ''>('');
  const [qty, setQty] = useState<number>(0);
  const [unit, setUnit] = useState<string>('TRAY');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [pendingOverrides, setPendingOverrides] = useState<PendingOverride[]>([]);
  const [dailySales, setDailySales] = useState<DailySalesSummary[]>([]);
  const [thresholdEdits, setThresholdEdits] = useState<Record<number, number | ''>>({});
  const [thresholdSaving, setThresholdSaving] = useState<Record<number, boolean>>({});

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const { showToast } = useToast();
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
    [],
  );

  const recentSalesEntry = useMemo(() => {
    if (!dailySales.length) return null;
    return dailySales[dailySales.length - 1];
  }, [dailySales]);

  const inventoryInitialData = useMemo<InventoryStreamState>(
    () => ({
      summary: initialSummary,
      movements: initialMovements,
    }),
    [initialSummary, initialMovements],
  );

  const mergeInventoryUpdate = useCallback(
    (
      current: InventoryStreamState,
      message: InventoryUpdateMessage<
        InventorySummaryResponse | null,
        Movement[] | undefined
      >,
    ): InventoryStreamState => {
      if (message.type !== 'inventory_update') {
        return current;
      }
      return {
        summary: message.summary ?? current.summary,
        movements: message.movements ?? current.movements,
      };
    },
    [],
  );

  const { data: inventoryData, status: streamStatus, error: streamError } =
    useInventoryStream<
      InventoryStreamState,
      InventoryUpdateMessage<InventorySummaryResponse | null, Movement[] | undefined>
    >({
      token,
      initialData: inventoryInitialData,
      merge: mergeInventoryUpdate,
    });

  const summary = inventoryData.summary;
  const movements = inventoryData.movements ?? [];

  const lowStockCount = useMemo(
    () => summary?.cards.filter((card) => card.is_low).length ?? 0,
    [summary],
  );

  const streamStatusMeta = useMemo(() => {
    switch (streamStatus) {
      case 'open':
        return {
          label: 'Connected',
          dotClass: 'bg-emerald-500',
          textClass: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'reconnecting':
        return {
          label: 'Reconnecting…',
          dotClass: 'bg-amber-400',
          textClass: 'text-amber-600 dark:text-amber-300',
        };
      case 'connecting':
        return {
          label: 'Connecting…',
          dotClass: 'bg-brand-500',
          textClass: 'text-brand-600 dark:text-brand-400',
        };
      case 'error':
        return {
          label: 'Connection error',
          dotClass: 'bg-red-500',
          textClass: 'text-red-600 dark:text-red-400',
        };
      case 'closed':
        return {
          label: 'Disconnected',
          dotClass: 'bg-slate-400',
          textClass: 'text-slate-500 dark:text-slate-400',
        };
      default:
        return {
          label: 'Offline',
          dotClass: 'bg-slate-400',
          textClass: 'text-slate-500 dark:text-slate-400',
        };
    }
  }, [streamStatus]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [summaryRes, movementsRes, clsRes] = await Promise.all([
        axios.get<InventorySummaryResponse>('/api/inventory/summary', { headers: authHeader }),
        axios.get<Movement[]>('/api/inventory/movements?limit=20', { headers: authHeader }),
        axios.get<Classification[]>('/api/catalog/classifications', { headers: authHeader }),
      ]);
      setInitialSummary(summaryRes.data);
      setInitialMovements(movementsRes.data);
      setClassifications(clsRes.data);
      if (user?.role === 'admin') {
        const [overridesRes, salesRes] = await Promise.all([
          axios.get<PendingOverride[]>('/api/sales/invoices/overrides/pending', {
            headers: authHeader,
          }),
          axios.get<DailySalesSummary[]>('/api/reports/daily-sales', {
            headers: authHeader,
            params: (() => {
              const end = new Date();
              const start = new Date(end);
              start.setDate(end.getDate() - 6);
              return {
                start_date: start.toISOString(),
                end_date: end.toISOString(),
              };
            })(),
          }),
        ]);
        setPendingOverrides(overridesRes.data);
        setDailySales(salesRes.data);
      } else {
        setPendingOverrides([]);
        setDailySales([]);
      }
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to load inventory data');
      showToast(message, 'error');
    }
  }, [authHeader, showToast, token, user?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!summary) return;
    setThresholdEdits(
      summary.cards.reduce((acc, card) => {
        acc[card.classification_id] = card.threshold_pcs ?? '';
        return acc;
      }, {} as Record<number, number | ''>),
    );
  }, [summary]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCls || qty <= 0) return;
    setFormError('');
    setSuccessMessage('');
    try {
      await axios.post(
        '/api/inventory/in/create',
        { classification_id: selectedCls, qty: qty, unit },
        { headers: authHeader },
      );
      setSuccessMessage('Draft created');
      showToast('Inventory draft created', 'success');
      setQty(0);
      setSelectedCls('');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, 'Error creating movement');
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const handleThresholdInputChange = (classificationId: number, rawValue: string) => {
    if (rawValue === '') {
      setThresholdEdits((prev) => ({ ...prev, [classificationId]: '' }));
      return;
    }
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return;
    }
    setThresholdEdits((prev) => ({ ...prev, [classificationId]: parsed }));
  };

  const handleSaveThreshold = async (classificationId: number) => {
    const value = thresholdEdits[classificationId];
    const thresholdValue = value === '' || value === undefined ? 0 : value;
    setThresholdSaving((prev) => ({ ...prev, [classificationId]: true }));
    try {
      await axios.put(
        '/api/inventory/thresholds',
        { thresholds: [{ classification_id: classificationId, threshold_pcs: thresholdValue }] },
        { headers: authHeader },
      );
      showToast('Threshold updated', 'success');
      await loadData();
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to update threshold');
      showToast(message, 'error');
    } finally {
      setThresholdSaving((prev) => ({ ...prev, [classificationId]: false }));
    }
  };

  const handleVerify = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/verify', { movement_id: id }, { headers: authHeader });
      showToast('Movement verified', 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to verify movement');
      showToast(message, 'error');
    }
  };

  const handleCommit = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/commit', { movement_id: id }, { headers: authHeader });
      showToast('Movement committed', 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to commit movement');
      showToast(message, 'error');
    }
  };

  const handleApproveOverride = async (invoiceId: number) => {
    try {
      const note = window.prompt('Optional note for approval', '');
      await axios.post(
        `/api/sales/invoices/${invoiceId}/override/approve`,
        note ? { decision_reason: note } : {},
        { headers: authHeader },
      );
      setFormError('');
      setSuccessMessage('Override approved');
      showToast('Override approved', 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to approve override');
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const handleRejectOverride = async (invoiceId: number) => {
    try {
      const reason = window.prompt('Provide a reason for rejecting this override', '');
      await axios.post(
        `/api/sales/invoices/${invoiceId}/override/reject`,
        reason ? { decision_reason: reason } : {},
        { headers: authHeader },
      );
      setFormError('');
      setSuccessMessage('Override rejected');
      showToast('Override rejected', 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to reject override');
      setFormError(message);
      showToast(message, 'error');
    }
  };

  return (
    <div className="p-4 text-slate-900 transition-colors md:p-6 dark:text-slate-100">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Kiapat Inventory</h1>
        <div className="flex flex-col items-start text-sm sm:items-end">
          <div className={`flex items-center gap-2 ${streamStatusMeta.textClass}`}>
            <span className={`h-2 w-2 rounded-full ${streamStatusMeta.dotClass}`} />
            <span>{streamStatusMeta.label}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {summary
              ? `Last update ${new Date(summary.timestamp).toLocaleString()}`
              : 'Awaiting inventory data'}
          </div>
          {streamError && (
            <div className="mt-1 text-xs text-red-600 dark:text-red-400">{streamError}</div>
          )}
        </div>
      </div>
      {successMessage && (
        <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">{successMessage}</p>
      )}
      {formError && (
        <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{formError}</p>
      )}
      {summary && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur transition-colors dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total stock</h2>
            <p className="mt-2 text-2xl font-bold">{summary.totals.qty_pcs.toLocaleString()} pcs</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {summary.totals.qty_tray.toFixed(1)} trays • {summary.totals.qty_dozen.toFixed(1)} dozens
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Low stock classifications: {lowStockCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur transition-colors dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Stock value</h2>
            <p className="mt-2 text-2xl font-bold">
              {summary.totals.stock_value !== null
                ? currencyFormatter.format(summary.totals.stock_value)
                : '—'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Based on current price per dozen.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur transition-colors dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Recent sales</h2>
            {recentSalesEntry ? (
              <>
                <p className="mt-2 text-2xl font-bold">
                  {currencyFormatter.format(recentSalesEntry.total_amount)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {new Date(recentSalesEntry.date).toLocaleDateString()} •{' '}
                  {recentSalesEntry.eggs_sold_pcs.toLocaleString()} pcs sold •{' '}
                  {recentSalesEntry.invoice_count} invoices
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No sales recorded in the last 7 days.
              </p>
            )}
          </div>
        </div>
      )}
      {/* Inventory Cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {summary?.cards.map((card) => (
          <div
            key={card.classification_id}
            className={`rounded-xl border p-4 shadow-sm transition-colors ${
              card.is_low
                ? 'border-red-400/70 bg-red-50/70 dark:border-red-400/60 dark:bg-red-900/30'
                : 'border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/80'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center">
                <img
                  src={card.color === 'WHITE' ? '/white-egg.png' : '/brown-egg.png'}
                  alt="egg"
                  className="h-12 w-12 mr-3"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {card.size.charAt(0)}
                      {card.size.slice(1).toLowerCase()} / {card.color.charAt(0)}
                      {card.color.slice(1).toLowerCase()}
                    </h3>
                    {card.is_low && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-200">
                        Low stock
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {card.qty_tray.toFixed(1)} trays • {card.qty_dozen.toFixed(1)} dozens
                  </p>
                  <p
                    className={`text-sm ${
                      card.is_low
                        ? 'font-semibold text-red-600 dark:text-red-400'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {card.qty_pcs.toLocaleString()} pcs
                  </p>
                  {card.unit_price !== null && (
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                      {currencyFormatter.format(card.unit_price)} per dozen
                    </p>
                  )}
                  {card.stock_value !== null && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Stock value: {currencyFormatter.format(card.stock_value)}
                    </p>
                  )}
                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Threshold: {card.threshold_pcs !== null ? `${card.threshold_pcs.toLocaleString()} pcs` : 'Not set'}
                  </p>
                </div>
              </div>
            </div>
            {user?.role === 'admin' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label
                  className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  htmlFor={`threshold-${card.classification_id}`}
                >
                  Update threshold
                </label>
                <input
                  id={`threshold-${card.classification_id}`}
                  type="number"
                  min={0}
                  className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-400 dark:focus:ring-offset-slate-900"
                  value={thresholdEdits[card.classification_id] ?? ''}
                  onChange={(e) => handleThresholdInputChange(card.classification_id, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleSaveThreshold(card.classification_id)}
                  className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-brand-300 dark:focus-visible:ring-offset-slate-900"
                  disabled={Boolean(thresholdSaving[card.classification_id])}
                >
                  {thresholdSaving[card.classification_id] ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Add Inventory Form */}
      <div className="mt-6">
        <h2 className="mb-2 text-xl font-semibold">Add Inventory</h2>
        <form className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end" onSubmit={handleAdd}>
          <select
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-400 dark:focus:ring-offset-slate-900"
            value={selectedCls}
            onChange={(e) => setSelectedCls(Number(e.target.value))}
            required
          >
            <option value="" disabled>
              Classification
            </option>
            {classifications.map((c) => (
              <option key={c.id} value={c.id}>
                {c.size} / {c.color}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-400 dark:focus:ring-offset-slate-900"
            min={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value, 10))}
            placeholder="Quantity"
            required
          />
          <select
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-400 dark:focus:ring-offset-slate-900"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="TRAY">Tray</option>
            <option value="DOZEN">Dozen</option>
            <option value="PCS">Pcs</option>
          </select>
          <button
            type="submit"
            className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
          >
            Add Draft
          </button>
        </form>
      </div>
      {user?.role === 'admin' && (
        <div className="mt-6">
          <h2 className="mb-2 text-xl font-semibold">Pending override approvals</h2>
          {pendingOverrides.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">No override requests awaiting review.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/70 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-100/70 dark:bg-slate-900/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Invoice
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Customer
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Requested
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Available
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Driver
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Submitted
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white/90 dark:divide-slate-800 dark:bg-slate-900/60">
                  {pendingOverrides.map((override) => {
                    const invoice = override.invoice;
                    const classification = override.classification;
                    const shortage = override.requested_qty_pcs - override.available_qty_pcs;
                    return (
                      <tr key={override.id}>
                        <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                          #{override.invoice_id}
                          {invoice && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">₱{invoice.total_amount.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                          {invoice?.customer_name || 'Walk-in'}
                          {invoice?.customer_phone && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer_phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                          {override.requested_qty_pcs} pcs ({override.requested_unit.toLowerCase()})
                          {classification && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {classification.size} / {classification.color}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                          {override.available_qty_pcs} pcs
                          {shortage > 0 && (
                            <div className="text-xs text-red-500 dark:text-red-400">Short {shortage} pcs</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                          {invoice?.created_by_user?.name || invoice?.created_by_user?.username || `#${invoice?.created_by ?? ''}`}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                          {new Date(override.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveOverride(override.invoice_id)}
                              className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectOverride(override.invoice_id)}
                              className="rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Movements List */}
      <div className="mt-6">
        <h2 className="mb-2 text-xl font-semibold">Recent Movements</h2>
        <ul className="space-y-3">
          {movements.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm transition-colors sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900/70"
            >
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {m.type} {m.qty_entered} {m.unit_entered} (cls #{m.classification_id})
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Status: {m.status} • {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
              {user?.role === 'admin' && m.type === 'IN' && (
                <div className="mt-2 flex gap-2 sm:mt-0">
                  {m.status === 'DRAFT' && (
                    <button
                      onClick={() => handleVerify(m.id)}
                      className="rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                    >
                      Verify
                    </button>
                  )}
                  {m.status === 'VERIFIED' && (
                    <button
                      onClick={() => handleCommit(m.id)}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                    >
                      Commit
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default InventoryManagerPage;