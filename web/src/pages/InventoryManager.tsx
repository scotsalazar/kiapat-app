import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

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
  low_stock_threshold_pcs: number | null;
  is_below_threshold: boolean;
}

interface InventoryTotals {
  qty_tray: number;
  qty_dozen: number;
  qty_pcs: number;
  stock_value: number;
}

interface RecentSalesSummary {
  period_days: number;
  total_amount: number;
  invoice_count: number;
}

interface InventorySummary {
  timestamp: string;
  totals: InventoryTotals;
  recent_sales: RecentSalesSummary;
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

interface InventoryUpdateMessage {
  type: 'inventory_update';
  summary?: InventorySummary;
  movements?: Movement[];
  prices?: PriceUpdate[];
}

const InventoryManagerPage: React.FC = () => {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [selectedCls, setSelectedCls] = useState<number | ''>('');
  const [qty, setQty] = useState<number>(0);
  const [unit, setUnit] = useState<string>('TRAY');
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<number, string>>({});
  const [alert, setAlert] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const isAdmin = user?.role === 'admin';
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
    [],
  );
  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);

  const loadData = useCallback(async () => {
    if (!token) return;
    const [summaryRes, movementsRes, clsRes] = await Promise.all([
      axios.get('/api/inventory/summary', { headers: authHeader }),
      axios.get('/api/inventory/movements?limit=20', { headers: authHeader }),
      axios.get('/api/catalog/classifications', { headers: authHeader }),
    ]);
    setSummary(summaryRes.data);
    setMovements(movementsRes.data);
    setClassifications(clsRes.data);
    setThresholdDrafts({});
  }, [authHeader, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/realtime/updates`);

    ws.onmessage = (event) => {
      try {
        const payload: InventoryUpdateMessage = JSON.parse(event.data);
        if (payload.type === 'inventory_update') {
          if (payload.summary) {
            setSummary(payload.summary);
            setThresholdDrafts({});
          }
          if (payload.movements) {
            setMovements(payload.movements);
          }
        }
      } catch (err) {
        console.error('Failed to parse realtime update', err);
      }
    };

    ws.onerror = (err) => {
      console.error('Realtime connection error', err);
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCls === '' || qty <= 0) {
      setAlert({ text: 'Select a classification and quantity greater than zero.', tone: 'error' });
      return;
    }
    try {
      await axios.post(
        '/api/inventory/in/create',
        { classification_id: selectedCls, qty: qty, unit },
        { headers: authHeader },
      );
      setAlert({ text: 'Draft created', tone: 'success' });
      setQty(0);
      setSelectedCls('');
      await loadData();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setAlert({ text: detail || 'Error creating movement', tone: 'error' });
    }
  };

  const handleVerify = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/verify', { movement_id: id }, { headers: authHeader });
      await loadData();
      setAlert({ text: 'Movement verified', tone: 'success' });
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setAlert({ text: detail || 'Unable to verify movement', tone: 'error' });
    }
  };

  const handleCommit = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/commit', { movement_id: id }, { headers: authHeader });
      await loadData();
      setAlert({ text: 'Movement committed', tone: 'success' });
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setAlert({ text: detail || 'Unable to commit movement', tone: 'error' });
    }
  };

  const handleThresholdChange = (classificationId: number, value: string) => {
    setThresholdDrafts((prev) => ({ ...prev, [classificationId]: value }));
  };

  const handleThresholdSave = async (card: InventoryCard) => {
    if (!isAdmin) return;
    const draftValue = thresholdDrafts[card.classification_id];
    const currentValue =
      draftValue !== undefined
        ? draftValue
        : card.low_stock_threshold_pcs !== null && card.low_stock_threshold_pcs !== undefined
        ? card.low_stock_threshold_pcs.toString()
        : '';
    const trimmed = currentValue.trim();
    let payload: { low_stock_pcs: number | null };
    if (trimmed === '') {
      payload = { low_stock_pcs: null };
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setAlert({ text: 'Threshold must be a non-negative number', tone: 'error' });
        return;
      }
      payload = { low_stock_pcs: parsed };
    }
    try {
      await axios.put(`/api/inventory/thresholds/${card.classification_id}`, payload, {
        headers: authHeader,
      });
      setAlert({ text: 'Threshold saved', tone: 'success' });
      setThresholdDrafts((prev) => {
        const copy = { ...prev };
        delete copy[card.classification_id];
        return copy;
      });
      await loadData();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setAlert({ text: detail || 'Error updating threshold', tone: 'error' });
    }
  };

  const lastUpdatedLabel = summary ? new Date(summary.timestamp).toLocaleString() : '';

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kiapat Inventory</h1>
        <div className="text-sm text-gray-500">{lastUpdatedLabel}</div>
      </div>
      {alert && (
        <p
          className={`mt-2 text-sm ${
            alert.tone === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {alert.text}
        </p>
      )}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white p-4 rounded shadow border border-gray-100">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Total Stock
            </h3>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {numberFormatter.format(Math.round(summary.totals.qty_pcs))} pcs
            </p>
            <p className="text-sm text-gray-500">
              {summary.totals.qty_tray.toFixed(1)} trays • {summary.totals.qty_dozen.toFixed(1)} dozens
            </p>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-100">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Stock Value
            </h3>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {currencyFormatter.format(summary.totals.stock_value)}
            </p>
            <p className="text-sm text-gray-500">Based on current dozen pricing</p>
          </div>
          <div className="bg-white p-4 rounded shadow border border-gray-100">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Recent Sales
            </h3>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {currencyFormatter.format(summary.recent_sales.total_amount)}
            </p>
            <p className="text-sm text-gray-500">
              Last {summary.recent_sales.period_days} days •{' '}
              {numberFormatter.format(summary.recent_sales.invoice_count)} invoices
            </p>
          </div>
        </div>
      )}
      {/* Inventory Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {summary?.cards.map((card) => (
          <div
            key={card.classification_id}
            className={`bg-white p-4 rounded shadow border ${
              card.is_below_threshold ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <img
                src={card.color === 'WHITE' ? '/white-egg.png' : '/brown-egg.png'}
                alt="egg"
                className="h-12 w-12"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {card.size.charAt(0)}
                    {card.size.slice(1).toLowerCase()} / {card.color.charAt(0)}
                    {card.color.slice(1).toLowerCase()}
                  </h3>
                  {card.is_below_threshold && (
                    <span className="ml-auto rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">
                      Low stock
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {card.qty_tray.toFixed(1)} trays • {card.qty_dozen.toFixed(1)} dozens
                </p>
                <p className="text-sm text-gray-600">{numberFormatter.format(card.qty_pcs)} pcs</p>
                {card.unit_price !== null && (
                  <p className="text-sm text-gray-800 mt-1">
                    {currencyFormatter.format(card.unit_price)} per dozen
                  </p>
                )}
                {card.low_stock_threshold_pcs !== null && (
                  <p className="text-xs text-gray-500 mt-2">
                    Threshold: {numberFormatter.format(card.low_stock_threshold_pcs)} pcs
                  </p>
                )}
                {isAdmin && (
                  <div className="mt-3">
                    <label className="text-xs uppercase tracking-wide text-gray-500">
                      Low stock threshold (pcs)
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border rounded px-2 py-1 text-sm"
                        value={
                          thresholdDrafts[card.classification_id] !== undefined
                            ? thresholdDrafts[card.classification_id]
                            : card.low_stock_threshold_pcs !== null && card.low_stock_threshold_pcs !== undefined
                            ? card.low_stock_threshold_pcs.toString()
                            : ''
                        }
                        onChange={(e) => handleThresholdChange(card.classification_id, e.target.value)}
                      />
                      <button
                        type="button"
                        className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                        onClick={() => handleThresholdSave(card)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Add Inventory Form */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Add Inventory</h2>
        <form className="flex flex-col sm:flex-row items-center gap-2" onSubmit={handleAdd}>
          <select
            className="border rounded px-3 py-2"
            value={selectedCls === '' ? '' : String(selectedCls)}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedCls(value ? Number(value) : '');
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
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              setQty(Number.isNaN(parsed) ? 0 : parsed);
            }}
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
              {isAdmin && m.type === 'IN' && (
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