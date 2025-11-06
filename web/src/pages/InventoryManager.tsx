import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

interface Classification {
  id: number;
  size: string;
  color: string;
}

interface InventorySettings {
  low_stock_threshold_pcs: number;
}

interface InventoryTotals {
  qty_tray: number;
  qty_dozen: number;
  qty_pcs: number;
  stock_value: number;
}

interface InventoryRecentSales {
  days: number;
  total_amount: number;
  eggs_sold_pcs: number;
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
  threshold_pcs: number;
  is_low_stock: boolean;
}

interface InventorySummary {
  timestamp: string;
  settings: InventorySettings;
  totals: InventoryTotals;
  recent_sales: InventoryRecentSales;
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
  available_qty_pcs: number;
  status: string;
  created_at: string;
  decision_reason?: string | null;
  invoice?: OverrideInvoiceSummary;
  classification?: OverrideClassification;
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
  const [message, setMessage] = useState<string>('');
  const [pendingOverrides, setPendingOverrides] = useState<PendingOverride[]>([]);
  const [thresholdDraft, setThresholdDraft] = useState<number | ''>('');
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
    [],
  );
  const decimalFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }),
    [],
  );
  const quantityFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const summaryMetrics = useMemo(() => {
    if (!summary) return [];
    return [
      {
        title: 'Total Stock',
        primary: `${decimalFormatter.format(summary.totals.qty_tray)} trays`,
        secondary: `${quantityFormatter.format(summary.totals.qty_pcs)} pcs on hand`,
      },
      {
        title: 'Stock Value',
        primary: currencyFormatter.format(summary.totals.stock_value ?? 0),
        secondary: 'Based on current dozen prices',
      },
      {
        title: `Sales (last ${summary.recent_sales.days}d)`,
        primary: currencyFormatter.format(summary.recent_sales.total_amount ?? 0),
        secondary: `${quantityFormatter.format(summary.recent_sales.eggs_sold_pcs)} pcs sold`,
      },
    ];
  }, [currencyFormatter, decimalFormatter, quantityFormatter, summary]);

  const loadData = useCallback(async () => {
    if (!token) return;
    const [summaryRes, movementsRes, clsRes] = await Promise.all([
      axios.get<InventorySummary>('/api/inventory/summary', { headers: authHeader }),
      axios.get('/api/inventory/movements?limit=20', { headers: authHeader }),
      axios.get('/api/catalog/classifications', { headers: authHeader }),
    ]);
    setSummary(summaryRes.data);
    setMovements(movementsRes.data);
    setClassifications(clsRes.data);
    if (user?.role === 'admin') {
      const overridesRes = await axios.get<PendingOverride[]>('/api/sales/invoices/overrides/pending', {
        headers: authHeader,
      });
      setPendingOverrides(overridesRes.data);
    } else {
      setPendingOverrides([]);
    }
  }, [authHeader, token, user?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (summary?.settings) {
      setThresholdDraft(summary.settings.low_stock_threshold_pcs);
    }
  }, [summary?.settings]);

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
    if (!selectedCls || qty <= 0) return;
    try {
      await axios.post(
        '/api/inventory/in/create',
        { classification_id: selectedCls, qty: qty, unit },
        { headers: authHeader },
      );
      setMessage('Draft created');
      setQty(0);
      setSelectedCls('');
      loadData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Error creating movement');
    }
  };

  const handleVerify = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/verify', { movement_id: id }, { headers: authHeader });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommit = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/commit', { movement_id: id }, { headers: authHeader });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleThresholdSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof thresholdDraft !== 'number' || thresholdDraft <= 0) {
      return;
    }
    try {
      setSettingsSaving(true);
      await axios.put(
        '/api/inventory/settings',
        { low_stock_threshold_pcs: thresholdDraft },
        { headers: authHeader },
      );
      setMessage('Low stock threshold updated');
      await loadData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to update threshold');
    } finally {
      setSettingsSaving(false);
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
      setMessage('Override approved');
      loadData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to approve override');
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
      setMessage('Override rejected');
      loadData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to reject override');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Kiapat Inventory</h1>
        <div className="text-sm text-gray-600">
          {summary ? new Date(summary.timestamp).toLocaleString() : '--'}
        </div>
      </div>
      {message && <p className="mt-2 text-green-600">{message}</p>}
      {summary && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {summaryMetrics.map((metric) => (
            <div key={metric.title} className="rounded bg-white p-4 shadow">
              <h3 className="text-sm font-medium text-gray-500">{metric.title}</h3>
              <p className="mt-1 text-xl font-semibold text-gray-900">{metric.primary}</p>
              <p className="text-sm text-gray-600">{metric.secondary}</p>
            </div>
          ))}
        </div>
      )}
      {user?.role === 'admin' && summary && (
        <form
          className="mt-4 flex flex-col gap-2 rounded bg-white p-4 shadow sm:flex-row sm:items-center"
          onSubmit={handleThresholdSave}
        >
          <label htmlFor="low-stock-threshold" className="text-sm font-medium text-gray-700">
            Low stock threshold (pcs)
          </label>
          <div className="flex flex-1 items-center gap-2">
            <input
              id="low-stock-threshold"
              type="number"
              min={1}
              className="w-full max-w-xs rounded border px-3 py-2"
              value={thresholdDraft}
              onChange={(e) => {
                const value = e.target.value;
                setThresholdDraft(value === '' ? '' : Number(value));
              }}
            />
            <button
              type="submit"
              className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={settingsSaving || typeof thresholdDraft !== 'number' || thresholdDraft <= 0}
            >
              {settingsSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
      {/* Inventory Cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {summary?.cards.map((card) => (
          <div
            key={card.classification_id}
            className={`relative rounded border bg-white p-4 shadow ${
              card.is_low_stock ? 'border-red-300 ring-2 ring-red-100' : 'border-transparent'
            }`}
          >
            <div className="flex items-start gap-3">
              <img
                src={card.color === 'WHITE' ? '/white-egg.png' : '/brown-egg.png'}
                alt="egg"
                className="h-12 w-12 flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">
                    {card.size.charAt(0)}
                    {card.size.slice(1).toLowerCase()} / {card.color.charAt(0)}
                    {card.color.slice(1).toLowerCase()}
                  </h3>
                  {card.is_low_stock && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Low stock
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {decimalFormatter.format(card.qty_tray)} trays • {decimalFormatter.format(card.qty_dozen)} dozens
                </p>
                <p className="text-sm text-gray-600">{quantityFormatter.format(card.qty_pcs)} pcs</p>
                {card.unit_price !== null && (
                  <p className="mt-2 text-sm text-gray-800">
                    {currencyFormatter.format(card.unit_price)} per dozen
                  </p>
                )}
                {card.stock_value !== null && (
                  <p className="text-sm text-gray-800">
                    {currencyFormatter.format(card.stock_value)} total value
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Threshold: {quantityFormatter.format(card.threshold_pcs)} pcs
                </p>
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
                          {override.requested_qty_pcs} pcs
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