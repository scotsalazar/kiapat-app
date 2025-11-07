import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialSummary, setInitialSummary] =
    useState<InventorySummaryResponse | null>(null);
  const [initialMovements, setInitialMovements] = useState<Movement[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [sizeFilter, setSizeFilter] = useState<string>(() => searchParams.get('size') ?? '');
  const [colorFilter, setColorFilter] = useState<string>(() => searchParams.get('color') ?? '');
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') ?? '');
  const [showLowStockOnly, setShowLowStockOnly] = useState<boolean>(() => {
    const low = searchParams.get('low');
    return low === '1' || low === 'true';
  });
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

  const sizeOptions = useMemo(() => {
    const sizes = new Set<string>();
    classifications.forEach((cls) => sizes.add(cls.size));
    return Array.from(sizes).sort();
  }, [classifications]);

  const colorOptions = useMemo(() => {
    const colors = new Set<string>();
    classifications.forEach((cls) => colors.add(cls.color));
    return Array.from(colors).sort();
  }, [classifications]);

  const filtersActive = useMemo(
    () => Boolean(sizeFilter || colorFilter || searchQuery.trim() || showLowStockOnly),
    [colorFilter, searchQuery, showLowStockOnly, sizeFilter],
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

  const rawSummary = inventoryData.summary;
  const applyFilters = useCallback(
    (input: InventorySummaryResponse | null): InventorySummaryResponse | null => {
      if (!input) {
        return input;
      }
      let cards = [...input.cards];
      if (sizeFilter) {
        cards = cards.filter((card) => card.size === sizeFilter);
      }
      if (colorFilter) {
        cards = cards.filter((card) => card.color === colorFilter);
      }
      const trimmedSearch = searchQuery.trim().toLowerCase();
      if (trimmedSearch) {
        cards = cards.filter((card) => {
          const label = `${card.size} ${card.color} ${card.classification_id}`.toLowerCase();
          return label.includes(trimmedSearch);
        });
      }
      if (showLowStockOnly) {
        cards = cards.filter((card) => card.is_low);
      }
      const totalQtyPcs = cards.reduce((sum, card) => sum + card.qty_pcs, 0);
      const totalQtyTray = cards.reduce((sum, card) => sum + card.qty_tray, 0);
      const totalQtyDozen = cards.reduce((sum, card) => sum + card.qty_dozen, 0);
      const hasStockValue = cards.some((card) => card.stock_value !== null);
      const totalStockValue = hasStockValue
        ? cards.reduce((sum, card) => sum + (card.stock_value ?? 0), 0)
        : null;
      return {
        ...input,
        totals: {
          qty_tray: totalQtyTray,
          qty_dozen: totalQtyDozen,
          qty_pcs: totalQtyPcs,
          stock_value: totalStockValue,
        },
        cards,
      };
    },
    [colorFilter, searchQuery, showLowStockOnly, sizeFilter],
  );

  const summary = useMemo(() => applyFilters(rawSummary), [applyFilters, rawSummary]);
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
          dotClass: 'bg-green-500',
          textClass: 'text-green-600',
        };
      case 'reconnecting':
        return {
          label: 'Reconnecting…',
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600',
        };
      case 'connecting':
        return {
          label: 'Connecting…',
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600',
        };
      case 'error':
        return {
          label: 'Connection error',
          dotClass: 'bg-red-500',
          textClass: 'text-red-600',
        };
      case 'closed':
        return {
          label: 'Disconnected',
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500',
        };
      default:
        return {
          label: 'Offline',
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500',
        };
    }
  }, [streamStatus]);

  useEffect(() => {
    const trimmedSearch = searchQuery.trim();
    const nextParams = new URLSearchParams();
    if (sizeFilter) {
      nextParams.set('size', sizeFilter);
    }
    if (colorFilter) {
      nextParams.set('color', colorFilter);
    }
    if (trimmedSearch) {
      nextParams.set('q', trimmedSearch);
    }
    if (showLowStockOnly) {
      nextParams.set('low', '1');
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    sizeFilter,
    colorFilter,
    searchQuery,
    showLowStockOnly,
    searchParams,
    setSearchParams,
  ]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const trimmedSearch = searchQuery.trim();
      const summaryParams: Record<string, string> = {};
      if (sizeFilter) {
        summaryParams.size = sizeFilter;
      }
      if (colorFilter) {
        summaryParams.color = colorFilter;
      }
      if (trimmedSearch) {
        summaryParams.search = trimmedSearch;
      }
      if (showLowStockOnly) {
        summaryParams.low_stock = 'true';
      }
      const [summaryRes, movementsRes, clsRes] = await Promise.all([
        axios.get<InventorySummaryResponse>('/api/inventory/summary', {
          headers: authHeader,
          params: summaryParams,
        }),
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
  }, [
    authHeader,
    colorFilter,
    searchQuery,
    showLowStockOnly,
    sizeFilter,
    showToast,
    token,
    user?.role,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!rawSummary) return;
    setThresholdEdits(
      rawSummary.cards.reduce((acc, card) => {
        acc[card.classification_id] = card.threshold_pcs ?? '';
        return acc;
      }, {} as Record<number, number | ''>),
    );
  }, [rawSummary]);

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
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Kiapat Inventory</h1>
        <div className="flex flex-col items-start text-sm sm:items-end">
          <div className={`flex items-center gap-2 ${streamStatusMeta.textClass}`}>
            <span className={`h-2 w-2 rounded-full ${streamStatusMeta.dotClass}`} />
            <span>{streamStatusMeta.label}</span>
          </div>
          <div className="text-xs text-gray-500">
            {summary
              ? `Last update ${new Date(summary.timestamp).toLocaleString()}`
              : 'Awaiting inventory data'}
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
            <h2 className="text-sm font-medium text-gray-500">Total stock</h2>
            <p className="mt-2 text-2xl font-bold">
              {summary.totals.qty_pcs.toLocaleString()} pcs
            </p>
            <p className="text-sm text-gray-500">
              {summary.totals.qty_tray.toFixed(1)} trays • {summary.totals.qty_dozen.toFixed(1)} dozens
            </p>
            <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
              Low stock classifications: {lowStockCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            <h2 className="text-sm font-medium text-gray-500">Stock value</h2>
            <p className="mt-2 text-2xl font-bold">
              {summary.totals.stock_value !== null
                ? currencyFormatter.format(summary.totals.stock_value)
                : '—'}
            </p>
            <p className="text-sm text-gray-500">Based on current price per dozen.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            <h2 className="text-sm font-medium text-gray-500">Recent sales</h2>
            {recentSalesEntry ? (
              <>
                <p className="mt-2 text-2xl font-bold">
                  {currencyFormatter.format(recentSalesEntry.total_amount)}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(recentSalesEntry.date).toLocaleDateString()} •{' '}
                  {recentSalesEntry.eggs_sold_pcs.toLocaleString()} pcs sold •{' '}
                  {recentSalesEntry.invoice_count} invoices
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                No sales recorded in the last 7 days.
              </p>
            )}
          </div>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="filter-size">
              Size
            </label>
            <select
              id="filter-size"
              className="rounded border px-3 py-2 text-sm"
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
            >
              <option value="">All sizes</option>
              {sizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size.charAt(0)}
                  {size.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="filter-color">
              Color
            </label>
            <select
              id="filter-color"
              className="rounded border px-3 py-2 text-sm"
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
            >
              <option value="">All colors</option>
              {colorOptions.map((color) => (
                <option key={color} value={color}>
                  {color.charAt(0)}
                  {color.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:min-w-[200px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="filter-search">
              Search
            </label>
            <input
              id="filter-search"
              type="search"
              className="rounded border px-3 py-2 text-sm"
              placeholder="Search size, color, or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="filter-low-stock">
            <input
              id="filter-low-stock"
              type="checkbox"
              className="h-4 w-4"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
            />
            Low stock only
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setSizeFilter('');
                setColorFilter('');
                setSearchQuery('');
                setShowLowStockOnly(false);
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>
      {/* Inventory Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {summary ? (
          summary.cards.length > 0 ? (
            summary.cards.map((card) => (
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
                        <p className="text-sm text-gray-600">Stock value: {currencyFormatter.format(card.stock_value)}</p>
                      )}
                      <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">
                        Threshold: {card.threshold_pcs !== null ? `${card.threshold_pcs.toLocaleString()} pcs` : 'Not set'}
                      </p>
                    </div>
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500" htmlFor={`threshold-${card.classification_id}`}>
                      Update threshold
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
                      {thresholdSaving[card.classification_id] ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-full rounded border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
              No inventory classifications match the selected filters.
            </div>
          )
        ) : (
          <div className="col-span-full rounded border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
            Loading inventory summary…
          </div>
        )}
      </div>
      {/* Add Inventory Form */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Add Inventory</h2>
        <form className="flex flex-col sm:flex-row items-center gap-2" onSubmit={handleAdd}>
          <select
            className="border rounded px-3 py-2"
            value={selectedCls}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedCls(value === '' ? '' : Number(value));
            }}
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
            className="border rounded px-3 py-2"
            min={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value, 10))}
            placeholder="Quantity"
            required
          />
          <select
            className="border rounded px-3 py-2"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="TRAY">Tray</option>
            <option value="DOZEN">Dozen</option>
            <option value="PCS">Pcs</option>
          </select>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Add Draft
          </button>
        </form>
      </div>
      {user?.role === 'admin' && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Pending override approvals</h2>
          {pendingOverrides.length === 0 ? (
            <p className="text-sm text-gray-600">No override requests awaiting review.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Available</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
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
                          {invoice?.customer_name || 'Walk-in'}
                          {invoice?.customer_phone && (
                            <div className="text-xs text-gray-500">{invoice.customer_phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {override.requested_qty_pcs} pcs ({override.requested_unit.toLowerCase()})
                          {classification && (
                            <div className="text-xs text-gray-500">
                              {classification.size} / {classification.color}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {override.available_qty_pcs} pcs
                          {shortage > 0 && (
                            <div className="text-xs text-red-500">Short {shortage} pcs</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {invoice?.created_by_user?.name || invoice?.created_by_user?.username || `#${invoice?.created_by ?? ''}`}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {new Date(override.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-sm text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleApproveOverride(override.invoice_id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectOverride(override.invoice_id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Reject
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
        <h2 className="text-xl font-semibold mb-2">Recent Movements</h2>
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
                  Status: {m.status} • {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
              {user?.role === 'admin' && m.type === 'IN' && (
                <div className="flex gap-2 mt-2 sm:mt-0">
                  {m.status === 'DRAFT' && (
                    <button
                      onClick={() => handleVerify(m.id)}
                      className="px-2 py-1 bg-yellow-500 text-white rounded"
                    >
                      Verify
                    </button>
                  )}
                  {m.status === 'VERIFIED' && (
                    <button
                      onClick={() => handleCommit(m.id)}
                      className="px-2 py-1 bg-green-600 text-white rounded"
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