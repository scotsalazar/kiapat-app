import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import useInventoryStream, { InventoryUpdateMessage } from '../hooks/useInventoryStream';
import { formatDate, formatDateTime } from '../utils/date';

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
  const { t } = useTranslation();
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

  const recentSalesSummaryText = useMemo(() => {
    if (!recentSalesEntry) {
      return '';
    }
    return t('inventory.summary.recentSalesSummary', {
      date: formatDate(recentSalesEntry.date),
      pieces: recentSalesEntry.eggs_sold_pcs.toLocaleString(),
      count: recentSalesEntry.invoice_count,
    });
  }, [recentSalesEntry, t]);

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

  const lastUpdateText = summary
    ? t('inventory.lastUpdate', { value: formatDateTime(summary.timestamp) })
    : t('inventory.awaitingData');

  const streamStatusMeta = useMemo(() => {
    switch (streamStatus) {
      case 'open':
        return {
          label: t('common.status.connected'),
          dotClass: 'bg-green-500',
          textClass: 'text-green-600',
        };
      case 'reconnecting':
        return {
          label: t('common.status.reconnecting'),
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600',
        };
      case 'connecting':
        return {
          label: t('common.status.connecting'),
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600',
        };
      case 'error':
        return {
          label: t('common.status.error'),
          dotClass: 'bg-red-500',
          textClass: 'text-red-600',
        };
      case 'closed':
        return {
          label: t('common.status.disconnected'),
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500',
        };
      default:
        return {
          label: t('common.status.offline'),
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500',
        };
    }
  }, [streamStatus, t]);

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
      const { message } = parseApiError(err, t('inventory.messages.failedToLoad'));
      showToast(message, 'error');
    }
  }, [authHeader, showToast, t, token, user?.role]);

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
      const draftMessage = t('inventory.messages.draftCreated');
      setSuccessMessage(draftMessage);
      showToast(t('inventory.messages.inventoryDraftCreated'), 'success');
      setQty(0);
      setSelectedCls('');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.messages.movementCreateError'));
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
      showToast(t('inventory.messages.thresholdUpdated'), 'success');
      await loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.messages.failedToUpdateThreshold'));
      showToast(message, 'error');
    } finally {
      setThresholdSaving((prev) => ({ ...prev, [classificationId]: false }));
    }
  };

  const handleVerify = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/verify', { movement_id: id }, { headers: authHeader });
      showToast(t('inventory.messages.movementVerified'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.messages.failedToVerifyMovement'));
      showToast(message, 'error');
    }
  };

  const handleCommit = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/commit', { movement_id: id }, { headers: authHeader });
      showToast(t('inventory.messages.movementCommitted'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.messages.failedToCommitMovement'));
      showToast(message, 'error');
    }
  };

  const handleApproveOverride = async (invoiceId: number) => {
    try {
      const note = window.prompt(t('inventory.prompts.approvalNote'), '');
      await axios.post(
        `/api/sales/invoices/${invoiceId}/override/approve`,
        note ? { decision_reason: note } : {},
        { headers: authHeader },
      );
      setFormError('');
      const approvedMessage = t('inventory.messages.overrideApproved');
      setSuccessMessage(approvedMessage);
      showToast(approvedMessage, 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.messages.failedToApproveOverride'));
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const handleRejectOverride = async (invoiceId: number) => {
    try {
      const reason = window.prompt(t('inventory.prompts.rejectionReason'), '');
      await axios.post(
        `/api/sales/invoices/${invoiceId}/override/reject`,
        reason ? { decision_reason: reason } : {},
        { headers: authHeader },
      );
      setFormError('');
      const rejectedMessage = t('inventory.messages.overrideRejected');
      setSuccessMessage(rejectedMessage);
      showToast(rejectedMessage, 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.messages.failedToRejectOverride'));
      setFormError(message);
      showToast(message, 'error');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t('inventory.pageTitle')}</h1>
        <div className="flex flex-col items-start text-sm sm:items-end">
          <div className={`flex items-center gap-2 ${streamStatusMeta.textClass}`}>
            <span className={`h-2 w-2 rounded-full ${streamStatusMeta.dotClass}`} />
            <span>{streamStatusMeta.label}</span>
          </div>
          <div className="text-xs text-gray-500">
            {lastUpdateText}
          </div>
          {streamError && (
            <div className="mt-1 text-xs text-red-600">{streamError}</div>
          )}
        </div>
      </div>
      {successMessage && <p className="text-green-600 mt-2">{successMessage}</p>}
      {formError && <p className="text-red-600 mt-2">{formError}</p>}
      {summary && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            <h2 className="text-sm font-medium text-gray-500">{t('inventory.summary.totalStockTitle')}</h2>
            <p className="mt-2 text-2xl font-bold">
              {summary.totals.qty_pcs.toLocaleString()} pcs
            </p>
            <p className="text-sm text-gray-500">
              {t('inventory.summary.totalStockMix', {
                trays: summary.totals.qty_tray.toFixed(1),
                dozens: summary.totals.qty_dozen.toFixed(1),
              })}
            </p>
            <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
              {t('inventory.summary.lowStock', { count: lowStockCount })}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            <h2 className="text-sm font-medium text-gray-500">{t('inventory.summary.stockValueTitle')}</h2>
            <p className="mt-2 text-2xl font-bold">
              {summary.totals.stock_value !== null
                ? currencyFormatter.format(summary.totals.stock_value)
                : '—'}
            </p>
            <p className="text-sm text-gray-500">{t('inventory.summary.stockValueBasedOn')}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            <h2 className="text-sm font-medium text-gray-500">{t('inventory.summary.recentSalesTitle')}</h2>
            {recentSalesEntry ? (
              <>
                <p className="mt-2 text-2xl font-bold">
                  {currencyFormatter.format(recentSalesEntry.total_amount)}
                </p>
                <p className="text-sm text-gray-500">{recentSalesSummaryText}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-500">{t('inventory.summary.recentSalesEmpty')}</p>
            )}
          </div>
        </div>
      )}
      {/* Inventory Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {summary?.cards.map((card) => (
          <div
            key={card.classification_id}
            className={`rounded border p-4 shadow transition ${
              card.is_low
                ? 'border-red-400 bg-red-50/40 ring-1 ring-red-300'
                : 'border-gray-200 bg-white'
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
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Low stock
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {card.qty_tray.toFixed(1)} trays • {card.qty_dozen.toFixed(1)} dozens
                  </p>
                  <p className={`text-sm ${card.is_low ? 'font-semibold text-red-600' : 'text-gray-700'}`}>
                    {card.qty_pcs.toLocaleString()} pcs
                  </p>
                  {card.unit_price !== null && (
                    <p className="text-sm text-gray-800 mt-1">
                      {currencyFormatter.format(card.unit_price)} per dozen
                    </p>
                  )}
                  {card.stock_value !== null && (
                    <p className="text-sm text-gray-600">
                      {t('inventory.cards.stockValue', {
                        value: currencyFormatter.format(card.stock_value),
                      })}
                    </p>
                  )}
                  <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
                    {card.threshold_pcs !== null
                      ? t('inventory.cards.threshold.value', {
                          value: card.threshold_pcs.toLocaleString(),
                        })
                      : t('inventory.cards.threshold.notSet')}
                  </p>
                </div>
              </div>
            </div>
            {user?.role === 'admin' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-500" htmlFor={`threshold-${card.classification_id}`}>
                  {t('inventory.cards.threshold.update')}
                </label>
                <input
                  id={`threshold-${card.classification_id}`}
                  type="number"
                  min={0}
                  className="w-24 rounded border px-2 py-1 text-sm"
                  value={thresholdEdits[card.classification_id] ?? ''}
                  onChange={(e) => handleThresholdInputChange(card.classification_id, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleSaveThreshold(card.classification_id)}
                  className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                  disabled={Boolean(thresholdSaving[card.classification_id])}
                >
                  {thresholdSaving[card.classification_id]
                    ? t('inventory.cards.threshold.saving')
                    : t('inventory.cards.threshold.save')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Add Inventory Form */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">{t('inventory.actions.addInventoryTitle')}</h2>
        <form className="flex flex-col sm:flex-row items-center gap-2" onSubmit={handleAdd}>
          <label className="flex w-full sm:w-auto flex-col text-sm text-gray-700">
            <span className="font-medium">{t('inventory.actions.classificationPlaceholder')}</span>
            <select
              className="border rounded px-3 py-2"
              value={selectedCls}
              onChange={(e) => setSelectedCls(Number(e.target.value))}
              required
            >
              <option value="" disabled>
                {t('inventory.actions.classificationPlaceholder')}
              </option>
              {classifications.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.size} / {c.color}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full sm:w-auto flex-col text-sm text-gray-700">
            <span className="font-medium">{t('inventory.actions.quantityPlaceholder')}</span>
            <input
              type="number"
              className="border rounded px-3 py-2"
              min={1}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value, 10))}
              placeholder={t('inventory.actions.quantityPlaceholder')}
              required
            />
          </label>
          <label className="flex w-full sm:w-auto flex-col text-sm text-gray-700">
            <span className="font-medium">{t('driverInvoice.tableHeaders.unit')}</span>
            <select
              className="border rounded px-3 py-2"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="TRAY">{t('inventory.actions.unitTray')}</option>
              <option value="DOZEN">{t('inventory.actions.unitDozen')}</option>
              <option value="PCS">{t('inventory.actions.unitPieces')}</option>
            </select>
          </label>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            {t('inventory.actions.addDraft')}
          </button>
        </form>
      </div>
      {user?.role === 'admin' && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">{t('inventory.actions.pendingOverridesTitle')}</h2>
          {pendingOverrides.length === 0 ? (
            <p className="text-sm text-gray-600">{t('inventory.actions.noPendingOverrides')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('inventory.table.invoice')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('inventory.table.customer')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('inventory.table.requested')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('inventory.table.available')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('inventory.table.driver')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('inventory.table.submitted')}</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('inventory.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingOverrides.map((override) => {
                    const invoice = override.invoice;
                    const classification = override.classification;
                    const shortage = override.requested_qty_pcs - override.available_qty_pcs;
                    return (
                      <tr key={override.id}>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          #{override.invoice_id}
                          {invoice && (
                            <div className="text-xs text-gray-500">₱{invoice.total_amount.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {invoice?.customer_name || t('invoiceHistory.states.walkIn')}
                          {invoice?.customer_phone && (
                            <div className="text-xs text-gray-500">{invoice.customer_phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {t('driverInvoice.overrideItem', {
                            classification: classification
                              ? `${classification.size} / ${classification.color}`
                              : `${t('driverInvoice.tableHeaders.classification')} #${override.classification_id}`,
                            requested: override.requested_qty_pcs,
                            unit: t(`driverInvoice.units.${override.requested_unit as 'TRAY' | 'DOZEN' | 'PCS'}`).toLowerCase(),
                            available: override.available_qty_pcs,
                            shortage: '',
                          })}
                          {classification && (
                            <div className="text-xs text-gray-500">
                              {classification.size} / {classification.color}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {override.available_qty_pcs} pcs
                          {shortage > 0 && (
                            <div className="text-xs text-red-500">
                              {t('inventory.actions.shortage', { value: shortage })}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {invoice?.created_by_user?.name || invoice?.created_by_user?.username || `#${invoice?.created_by ?? ''}`}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {formatDateTime(override.created_at)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleApproveOverride(override.invoice_id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            {t('common.buttons.approve')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectOverride(override.invoice_id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            {t('common.buttons.reject')}
                          </button>
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
        <h2 className="text-xl font-semibold mb-2">{t('inventory.actions.recentMovementsTitle')}</h2>
        <ul className="space-y-2">
          {movements.map((m) => (
            <li
              key={m.id}
              className="bg-white p-3 rounded shadow flex flex-col sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">
                  {m.type} {m.qty_entered} {m.unit_entered} (cls #{m.classification_id})
                </p>
                <p className="text-sm text-gray-600">
                  {t('inventory.actions.movementStatus', {
                    status: m.status,
                    time: formatDateTime(m.created_at),
                  })}
                </p>
              </div>
              {user?.role === 'admin' && m.type === 'IN' && (
                <div className="flex gap-2 mt-2 sm:mt-0">
                  {m.status === 'DRAFT' && (
                    <button
                      onClick={() => handleVerify(m.id)}
                      className="px-2 py-1 bg-yellow-500 text-white rounded"
                    >
                      {t('common.buttons.verify')}
                    </button>
                  )}
                  {m.status === 'VERIFIED' && (
                    <button
                      onClick={() => handleCommit(m.id)}
                      className="px-2 py-1 bg-green-600 text-white rounded"
                    >
                      {t('common.buttons.commit')}
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