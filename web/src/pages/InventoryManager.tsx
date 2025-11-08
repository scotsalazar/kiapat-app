import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import useInventoryStream, { InventoryUpdateMessage } from '../hooks/useInventoryStream';
import { formatDate, formatDateTime } from '../utils/dateTime';
import apiClient from '../api/axios';

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
  unit_price?: number | null;
  stock_value: number | null;
  threshold_pcs: number | null;
  is_low: boolean;
  price_per_dozen?: number | null;
  price_per_tray?: number | null;
  price_per_dozen_changed_at?: string | null;
  price_per_tray_changed_at?: string | null;
  price_updated_at?: string | null;
  unit_price_changed_at?: string | null;
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

const RECENT_PRICE_CHANGE_WINDOW_MS = 1000 * 60 * 60 * 48; // 48 hours

const parseTimestamp = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getLatestPriceChangeTimestamp = (card: InventoryCard): Date | null => {
  const timestamps = [
    parseTimestamp(card.price_per_dozen_changed_at),
    parseTimestamp(card.price_per_tray_changed_at),
    parseTimestamp(card.price_updated_at),
    parseTimestamp(card.unit_price_changed_at),
  ].filter(Boolean) as Date[];

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps.map((timestamp) => timestamp.getTime())));
};

const InventoryManagerPage: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const paramsSnapshotRef = useRef<string>(searchParams.toString());
  const [sizeFilter, setSizeFilter] = useState<string>(() => searchParams.get('size') ?? '');
  const [colorFilter, setColorFilter] = useState<string>(() => searchParams.get('color') ?? '');
  const [searchTerm, setSearchTerm] = useState<string>(() => searchParams.get('q') ?? '');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(() => {
    const raw = searchParams.get('low');
    if (!raw) return false;
    return ['1', 'true', 'yes'].includes(raw.toLowerCase());
  });

  const { showToast } = useToast();
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
    [],
  );

  useEffect(() => {
    const paramsString = searchParams.toString();
    if (paramsString === paramsSnapshotRef.current) {
      return;
    }
    paramsSnapshotRef.current = paramsString;
    const paramSize = searchParams.get('size') ?? '';
    const paramColor = searchParams.get('color') ?? '';
    const paramSearch = searchParams.get('q') ?? '';
    const paramLowRaw = searchParams.get('low');
    const paramLow = paramLowRaw
      ? ['1', 'true', 'yes'].includes(paramLowRaw.toLowerCase())
      : false;
    if (paramSize !== sizeFilter) {
      setSizeFilter(paramSize);
    }
    if (paramColor !== colorFilter) {
      setColorFilter(paramColor);
    }
    if (paramSearch !== searchTerm) {
      setSearchTerm(paramSearch);
    }
    if (paramLow !== lowStockOnly) {
      setLowStockOnly(paramLow);
    }
  }, [searchParams, sizeFilter, colorFilter, searchTerm, lowStockOnly]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (sizeFilter) {
      params.set('size', sizeFilter);
    }
    if (colorFilter) {
      params.set('color', colorFilter);
    }
    if (searchTerm) {
      params.set('q', searchTerm);
    }
    if (lowStockOnly) {
      params.set('low', '1');
    }
    const nextSnapshot = params.toString();
    if (nextSnapshot === paramsSnapshotRef.current) {
      return;
    }
    paramsSnapshotRef.current = nextSnapshot;
    if (nextSnapshot) {
      setSearchParams(params, { replace: true });
    } else {
      setSearchParams(new URLSearchParams(), { replace: true });
    }
  }, [sizeFilter, colorFilter, searchTerm, lowStockOnly, setSearchParams]);

  const formatCurrencyValue = useCallback(
    (value: number | null | undefined) =>
      value !== null && value !== undefined
        ? currencyFormatter.format(value)
        : t('common.notAvailable'),
    [currencyFormatter, t],
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
  const filteredCards = useMemo(() => {
    if (!summary) {
      return [] as InventoryCard[];
    }
    const tokens = searchTerm
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return summary.cards.filter((card) => {
      if (sizeFilter && card.size !== sizeFilter) {
        return false;
      }
      if (colorFilter && card.color !== colorFilter) {
        return false;
      }
      if (lowStockOnly && !card.is_low) {
        return false;
      }
      if (!tokens.length) {
        return true;
      }
      const label = `${card.size} ${card.color}`.toLowerCase();
      return tokens.every((token) => label.includes(token));
    });
  }, [summary, sizeFilter, colorFilter, lowStockOnly, searchTerm]);

  const lowStockCount = useMemo(
    () => filteredCards.filter((card) => card.is_low).length,
    [filteredCards],
  );

  const totalCards = summary?.cards.length ?? 0;
  const hasActiveFilters = Boolean(sizeFilter || colorFilter || searchTerm.trim() || lowStockOnly);

  const sizeOptions = useMemo(() => {
    const unique = new Set<string>();
    classifications.forEach((cls) => unique.add(cls.size));
    return Array.from(unique).sort();
  }, [classifications]);

  const colorOptions = useMemo(() => {
    const unique = new Set<string>();
    classifications.forEach((cls) => unique.add(cls.color));
    return Array.from(unique).sort();
  }, [classifications]);

  const formatFilterLabel = useCallback((value: string) => {
    if (!value) return '';
    return value.charAt(0) + value.slice(1).toLowerCase();
  }, []);

  const filteredTotals = useMemo(() => {
    if (!filteredCards.length) {
      return null;
    }
    let totalTray = 0;
    let totalDozen = 0;
    let totalPcs = 0;
    let totalStockValue = 0;
    let hasStockValue = false;
    filteredCards.forEach((card) => {
      totalTray += card.qty_tray;
      totalDozen += card.qty_dozen;
      totalPcs += card.qty_pcs;
      if (card.stock_value !== null && card.stock_value !== undefined) {
        totalStockValue += card.stock_value;
        hasStockValue = true;
      }
    });
    return {
      qty_tray: totalTray,
      qty_dozen: totalDozen,
      qty_pcs: totalPcs,
      stock_value: hasStockValue ? totalStockValue : null,
    };
  }, [filteredCards]);

  const handleClearFilters = useCallback(() => {
    setSizeFilter('');
    setColorFilter('');
    setSearchTerm('');
    setLowStockOnly(false);
  }, []);

  const streamStatusMeta = useMemo(() => {
    switch (streamStatus) {
      case 'open':
        return {
          label: t('common.status.connected'),
          dotClass: 'bg-green-500',
          textClass: 'text-green-600 dark:text-green-400',
        };
      case 'reconnecting':
        return {
          label: t('common.status.reconnecting'),
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'connecting':
        return {
          label: t('common.status.connecting'),
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'error':
        return {
          label: t('common.status.error'),
          dotClass: 'bg-red-500',
          textClass: 'text-red-600 dark:text-red-400',
        };
      case 'closed':
        return {
          label: t('common.status.disconnected'),
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500 dark:text-slate-400',
        };
      default:
        return {
          label: t('common.status.offline'),
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500 dark:text-slate-400',
        };
    }
  }, [streamStatus, t]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const summaryParams: Record<string, string> = {};
      if (sizeFilter) {
        summaryParams.size = sizeFilter;
      }
      if (colorFilter) {
        summaryParams.color = colorFilter;
      }
      if (lowStockOnly) {
        summaryParams.low_stock = 'true';
      }
      const [summaryRes, movementsRes, clsRes] = await Promise.all([
        apiClient.get<InventorySummaryResponse>('/api/inventory/summary', {
          params: summaryParams,
        }),
        apiClient.get<Movement[]>('/api/inventory/movements?limit=20'),
        apiClient.get<Classification[]>('/api/catalog/classifications'),
      ]);
      setInitialSummary(summaryRes.data);
      setInitialMovements(movementsRes.data);
      setClassifications(clsRes.data);
      if (user?.role === 'admin') {
        const [overridesRes, salesRes] = await Promise.all([
          apiClient.get<PendingOverride[]>('/api/sales/invoices/overrides/pending'),
          apiClient.get<DailySalesSummary[]>('/api/reports/daily-sales', {
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
      const { message } = parseApiError(err, t('inventory.errors.load'));
      showToast(message, 'error');
    }
  }, [showToast, token, user?.role, sizeFilter, colorFilter, lowStockOnly, t]);

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
      await apiClient.post('/api/inventory/in/create', {
        classification_id: selectedCls,
        qty: qty,
        unit,
      });
      const draftMessage = t('inventory.messages.draftCreated');
      setSuccessMessage(draftMessage);
      showToast(t('inventory.messages.inventoryDraftCreated'), 'success');
      setQty(0);
      setSelectedCls('');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.create'));
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
      await apiClient.put('/api/inventory/thresholds', {
        thresholds: [{ classification_id: classificationId, threshold_pcs: thresholdValue }],
      });
      showToast(t('inventory.messages.thresholdUpdated'), 'success');
      await loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.updateThreshold'));
      showToast(message, 'error');
    } finally {
      setThresholdSaving((prev) => ({ ...prev, [classificationId]: false }));
    }
  };

  const handleVerify = async (id: number) => {
    try {
      await apiClient.post('/api/inventory/in/verify', { movement_id: id });
      showToast(t('inventory.messages.movementVerified'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.verify'));
      showToast(message, 'error');
    }
  };

  const handleCommit = async (id: number) => {
    try {
      await apiClient.post('/api/inventory/in/commit', { movement_id: id });
      showToast(t('inventory.messages.movementCommitted'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.commit'));
      showToast(message, 'error');
    }
  };

  const handleApproveOverride = async (invoiceId: number) => {
    try {
      const note = window.prompt(t('common.prompts.approvalNote'), '');
      await apiClient.post(
        `/api/sales/invoices/${invoiceId}/override/approve`,
        note ? { decision_reason: note } : {},
      );
      setFormError('');
      setSuccessMessage(t('inventory.messages.overrideApproved'));
      showToast(t('inventory.messages.overrideApproved'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.approveOverride'));
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const handleRejectOverride = async (invoiceId: number) => {
    try {
      const reason = window.prompt(t('common.prompts.rejectOverride'), '');
      await apiClient.post(
        `/api/sales/invoices/${invoiceId}/override/reject`,
        reason ? { decision_reason: reason } : {},
      );
      setFormError('');
      setSuccessMessage(t('inventory.messages.overrideRejected'));
      showToast(t('inventory.messages.overrideRejected'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.rejectOverride'));
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const lastUpdateLabel = summary ? formatDateTime(summary.timestamp) : '';
  const recentSalesDate = recentSalesEntry ? formatDate(recentSalesEntry.date) : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('inventory.title')}</h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/invoices/history')}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
            >
              {t('common.actions.viewInvoiceHistory')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800/80 dark:focus:ring-offset-slate-900"
            >
              {t('common.actions.manageUsers')}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-start text-sm sm:items-end">
          <div className={`flex items-center gap-2 ${streamStatusMeta.textClass} dark:text-slate-300`}>
            <span className={`h-2 w-2 rounded-full ${streamStatusMeta.dotClass}`} />
            <span className="text-slate-700 dark:text-slate-300">{streamStatusMeta.label}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {summary && lastUpdateLabel
              ? t('inventory.stream.lastUpdate', { value: lastUpdateLabel })
              : t('common.messages.awaitingInventory')}
          </div>
          {streamError && (
            <div className="mt-1 text-xs text-red-600 dark:text-red-400">{streamError}</div>
          )}
        </div>
      </div>
      {successMessage && <p className="mt-2 text-green-600 dark:text-green-400">{successMessage}</p>}
      {formError && <p className="mt-2 text-red-600 dark:text-red-400">{formError}</p>}
      {summary && (
        <>
          <h2 className="mt-6 text-lg font-medium text-slate-700 dark:text-slate-200">
            {t('inventory.sections.overview', { defaultValue: 'Overview' })}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('inventory.cards.totalStock.title')}</h2>
            <p className="mt-2 text-xl font-bold text-blue-500 dark:text-blue-300">
              {t('inventory.filters.pieces', { value: summary.totals.qty_pcs.toLocaleString() })}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {t('inventory.filters.trays', { value: summary.totals.qty_tray.toFixed(1) })} •{' '}
              {t('inventory.filters.dozens', { value: summary.totals.qty_dozen.toFixed(1) })}
            </p>
            <p className="mt-2 text-sm uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t('inventory.cards.totalStock.lowStockCount', { count: lowStockCount })}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('inventory.cards.stockValue.title')}</h2>
            <p className="mt-2 text-xl font-bold text-blue-500 dark:text-blue-300">
              {summary.totals.stock_value !== null
                ? currencyFormatter.format(summary.totals.stock_value)
                : t('common.notAvailable')}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {t('inventory.cards.stockValue.description')}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('inventory.cards.recentSales.title')}</h2>
            {recentSalesEntry ? (
              <>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {currencyFormatter.format(recentSalesEntry.total_amount)}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {t('inventory.cards.recentSales.summary', {
                    date: recentSalesDate || t('common.notAvailable'),
                    pcs: recentSalesEntry.eggs_sold_pcs.toLocaleString(),
                    count: recentSalesEntry.invoice_count,
                  })}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">{t('inventory.cards.recentSales.none')}</p>
            )}
          </div>
          </div>
        </>
      )}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col">
            <label htmlFor="size-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {t('common.labels.size')}
            </label>
            <select
              id="size-filter"
              className="mt-1 w-40 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={sizeFilter}
              onChange={(event) => setSizeFilter(event.target.value)}
            >
              <option value="">{t('inventory.filters.allSizes')}</option>
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {formatFilterLabel(option)}
                </option>
              ))}
            </select>
          </div>
            <div className="flex flex-col">
            <label htmlFor="color-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {t('common.labels.color')}
            </label>
            <select
              id="color-filter"
              className="mt-1 w-40 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={colorFilter}
              onChange={(event) => setColorFilter(event.target.value)}
            >
              <option value="">{t('inventory.filters.allColors')}</option>
              {colorOptions.map((option) => (
                <option key={option} value={option}>
                  {formatFilterLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col">
            <label htmlFor="inventory-search" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {t('common.labels.search')}
            </label>
            <input
              id="inventory-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('common.labels.searchPlaceholder')}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
            {t('common.labels.lowStockOnly')}
          </label>
          <button
            type="button"
            className="ml-auto rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
          >
            {t('common.actions.clearFilters')}
          </button>
        </div>
        <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {hasActiveFilters ? (
            <span>
              {t('inventory.filters.showingFiltered', {
                count: filteredCards.length,
                total: totalCards,
              })}
              {filteredTotals && (
                <>
                  {' '}
                  {t('common.messages.inventoryTotalsPrefix')}{' '}
                  {t('inventory.filters.trays', { value: filteredTotals.qty_tray.toFixed(1) })} •{' '}
                  {t('inventory.filters.dozens', { value: filteredTotals.qty_dozen.toFixed(1) })} •{' '}
                  {t('inventory.filters.pieces', {
                    value: filteredTotals.qty_pcs.toLocaleString(),
                  })}
                  {filteredTotals.stock_value !== null
                    ? ` • ${t('inventory.stockValueLabel', {
                        value: currencyFormatter.format(filteredTotals.stock_value),
                      })}`
                    : ''}
                </>
              )}
            </span>
          ) : (
            <span>{t('inventory.filters.showingAll', { total: totalCards })}</span>
          )}
        </div>
      </div>
      {/* Inventory Cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {filteredCards.length === 0 ? (
          <div className="col-span-full rounded border border-dashed border-slate-300 bg-slate-100 p-8 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {t('inventory.filters.noMatches')}
          </div>
        ) : (
          filteredCards.map((card) => {
            const perDozenPrice = card.price_per_dozen ?? card.unit_price ?? null;
            const perTrayPrice = card.price_per_tray ?? null;
            const latestPriceChange = getLatestPriceChangeTimestamp(card);
            const isRecentPriceChange =
              !!latestPriceChange &&
              Date.now() - latestPriceChange.getTime() <= RECENT_PRICE_CHANGE_WINDOW_MS;
            const shouldShowPriceDetails =
              perDozenPrice !== null || perTrayPrice !== null || latestPriceChange !== null;
            const latestPriceChangeLabel = latestPriceChange ? formatDateTime(latestPriceChange) : '';

            return (
              <div
                key={card.classification_id}
                className={`relative rounded border p-4 shadow-sm transition-colors ${
                  card.is_low
                    ? 'border-red-400 bg-red-50/40 ring-1 ring-red-300 dark:border-red-500 dark:bg-red-900/30'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
              {isRecentPriceChange && (
                <span className="absolute -right-2 -top-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                  Price updated
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center">
                  <img
                    src={card.color === 'WHITE' ? '/white-egg.png' : '/brown-egg.png'}
                    alt="egg"
                    className="h-12 w-12 mr-3"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {card.size.charAt(0)}
                        {card.size.slice(1).toLowerCase()} / {card.color.charAt(0)}
                        {card.color.slice(1).toLowerCase()}
                      </h3>
                      {card.is_low && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-200">
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
                  </div>
                </div>
              </div>
              {shouldShowPriceDetails && (
                <div
                  className={`mt-3 space-y-1 rounded-md border p-3 text-sm ${
                    isRecentPriceChange
                      ? 'border-blue-200 bg-blue-50/70 dark:border-blue-400/60 dark:bg-blue-900/40'
                      : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 dark:text-slate-300">{t('common.labels.perTray')}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {formatCurrencyValue(perTrayPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 dark:text-slate-300">{t('common.labels.perDozen')}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {formatCurrencyValue(perDozenPrice)}
                    </span>
                  </div>
                  {latestPriceChange && (
                    <div
                      className={`pt-1 text-xs ${
                        isRecentPriceChange ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {latestPriceChangeLabel
                        ? t('inventory.pricing.updated', { value: latestPriceChangeLabel })
                        : null}
                    </div>
                  )}
                </div>
              )}
              {card.stock_value !== null && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  {t('inventory.stockValueLabel', {
                    value: currencyFormatter.format(card.stock_value),
                  })}
                </p>
              )}
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('inventory.threshold.label')}{' '}
                {card.threshold_pcs !== null
                  ? t('inventory.filters.pieces', {
                      value: card.threshold_pcs.toLocaleString(),
                    })
                  : t('inventory.threshold.notSet')}
              </p>
              {user?.role === 'admin' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label
                    className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300"
                    htmlFor={`threshold-${card.classification_id}`}
                  >
                    {t('inventory.threshold.update')}
                  </label>
                  <input
                    id={`threshold-${card.classification_id}`}
                    type="number"
                    min={0}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={thresholdEdits[card.classification_id] ?? ''}
                    onChange={(e) => handleThresholdInputChange(card.classification_id, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveThreshold(card.classification_id)}
                    className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-100 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:focus:ring-offset-slate-900"
                    disabled={Boolean(thresholdSaving[card.classification_id])}
                  >
                    {thresholdSaving[card.classification_id]
                      ? t('common.actions.saving')
                      : t('common.actions.save')}
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
      </div>
      {/* Add Inventory Form */}
      <div className="mt-6">
        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventory.forms.addInventory')}</h2>
        <form className="flex flex-col items-center gap-2 sm:flex-row" onSubmit={handleAdd}>
          <label htmlFor="add-inventory-classification" className="sr-only">
            {t('common.labels.classification')}
          </label>
          <select
            id="add-inventory-classification"
            className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={selectedCls}
            onChange={(e) => setSelectedCls(Number(e.target.value))}
            required
          >
            <option value="" disabled>
              {t('inventory.forms.classificationPlaceholder')}
            </option>
            {classifications.map((c) => (
              <option key={c.id} value={c.id}>
                {c.size} / {c.color}
              </option>
            ))}
          </select>
          <label htmlFor="add-inventory-quantity" className="sr-only">
            {t('common.labels.quantity')}
          </label>
          <input
            id="add-inventory-quantity"
            type="number"
            className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            min={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value, 10))}
            placeholder={t('inventory.forms.quantityPlaceholder')}
            required
          />
          <label htmlFor="add-inventory-unit" className="sr-only">
            {t('common.labels.unit')}
          </label>
          <select
            id="add-inventory-unit"
            className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="TRAY">{t('common.labels.tray')}</option>
            <option value="DOZEN">{t('common.labels.dozen')}</option>
            <option value="PCS">{t('common.labels.pcs')}</option>
          </select>
          <button
            type="submit"
            className="rounded bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
          >
            {t('common.actions.addDraft')}
          </button>
        </form>
      </div>
      {user?.role === 'admin' && (
        <div className="mt-6">
          <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventory.overrides.title')}</h2>
          {pendingOverrides.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('inventory.overrides.none')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.invoice')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.customer')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.requested')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.available')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.driver')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.submitted')}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-800 dark:divide-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  {pendingOverrides.map((override) => {
                    const invoice = override.invoice;
                    const classification = override.classification;
                    const shortage = override.requested_qty_pcs - override.available_qty_pcs;
                    const submittedAt = formatDateTime(override.created_at);
                    return (
                      <tr key={override.id}>
                        <td className="px-3 py-2 text-sm">
                          #{override.invoice_id}
                          {invoice && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">₱{invoice.total_amount.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {invoice?.customer_name || t('common.messages.walkIn')}
                          {invoice?.customer_phone && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer_phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {override.requested_qty_pcs} pcs ({override.requested_unit.toLowerCase()})
                          {classification && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {classification.size} / {classification.color}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {override.available_qty_pcs} pcs
                          {shortage > 0 && (
                            <div className="text-xs text-red-500 dark:text-red-400">
                              {t('common.messages.shortage', { value: shortage })}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {invoice?.created_by_user?.name || invoice?.created_by_user?.username || `#${invoice?.created_by ?? ''}`}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {submittedAt}
                        </td>
                        <td className="space-x-2 px-3 py-2 text-right text-sm">
                          <button
                            type="button"
                            onClick={() => handleApproveOverride(override.invoice_id)}
                            className="rounded bg-green-600 px-3 py-1 text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
                          >
                            {t('common.actions.approve')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectOverride(override.invoice_id)}
                            className="rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
                          >
                            {t('common.actions.reject')}
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
        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventory.movements.title')}</h2>
        <ul className="space-y-2">
          {movements.map((m) => {
            const createdLabel = formatDateTime(m.created_at) || t('common.notAvailable');
            return (
              <li
                key={m.id}
                className="flex flex-col rounded border border-slate-200 bg-white p-3 shadow-sm transition-colors sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('inventory.movements.entry', {
                      type: m.type,
                      qty: m.qty_entered,
                      unit: m.unit_entered,
                      classification: m.classification_id,
                    })}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {t('inventory.movements.status', { status: m.status, created: createdLabel })}
                  </p>
                </div>
                {user?.role === 'admin' && m.type === 'IN' && (
                  <div className="mt-2 flex gap-2 sm:mt-0">
                    {m.status === 'DRAFT' && (
                      <button
                        onClick={() => handleVerify(m.id)}
                        className="rounded bg-yellow-500 px-2 py-1 text-white transition hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
                      >
                        {t('common.actions.verify')}
                      </button>
                    )}
                    {m.status === 'VERIFIED' && (
                      <button
                        onClick={() => handleCommit(m.id)}
                        className="rounded bg-green-600 px-2 py-1 text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
                      >
                        {t('common.actions.commit')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default InventoryManagerPage;