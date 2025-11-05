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
  summary?: { timestamp: string; cards: InventoryCard[] };
  movements?: Movement[];
  prices?: PriceUpdate[];
}

interface InvoiceItemResponse {
  id: number;
  classification_id: number;
  unit: string;
  qty: number;
  unit_price: number;
  line_total: number;
  override_shortage_pcs?: number | null;
}

interface OverrideItemResponse {
  invoice_item_id: number;
  requested_qty_pcs: number;
  available_qty_pcs: number;
  shortage_qty_pcs: number;
}

interface PendingOverride {
  id: number;
  invoice_id: number;
  status: string;
  requested_by_id: number;
  reviewed_by_id: number | null;
  created_at: string;
  decided_at: string | null;
  items: OverrideItemResponse[];
  invoice: {
    id: number;
    customer_name: string | null;
    customer_phone: string | null;
    total_amount: number;
    status: string;
    created_at: string;
    items: InvoiceItemResponse[];
  };
}

const InventoryManagerPage: React.FC = () => {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<{ timestamp: string; cards: InventoryCard[] } | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [selectedCls, setSelectedCls] = useState<number | ''>('');
  const [qty, setQty] = useState<number>(0);
  const [unit, setUnit] = useState<string>('TRAY');
  const [message, setMessage] = useState<string>('');
  const [pendingOverrides, setPendingOverrides] = useState<PendingOverride[]>([]);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

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
    if (user?.role === 'admin') {
      const overridesRes = await axios.get('/api/sales/invoices/overrides/pending', {
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

  const handleApproveOverride = async (overrideId: number) => {
    try {
      await axios.post(
        `/api/sales/invoices/overrides/${overrideId}/approve`,
        { note: null },
        { headers: authHeader },
      );
      setMessage('Override approved');
      loadData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Error approving override');
    }
  };

  const handleRejectOverride = async (overrideId: number) => {
    const note = window.prompt('Add a reason for rejection (optional):', '') ?? null;
    try {
      await axios.post(
        `/api/sales/invoices/overrides/${overrideId}/reject`,
        { note },
        { headers: authHeader },
      );
      setMessage('Override rejected');
      loadData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Error rejecting override');
    }
  };

  const getClassificationLabel = (id: number) => {
    const cls = classifications.find((c) => c.id === id);
    if (!cls) return `Classification #${id}`;
    return `${cls.size} / ${cls.color}`;
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

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kiapat Inventory</h1>
        <div>{new Date(summary?.timestamp || '').toLocaleString()}</div>
      </div>
      {message && <p className="text-green-600 mt-2">{message}</p>}
      {/* Inventory Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {summary?.cards.map((card) => (
          <div key={card.classification_id} className="bg-white p-4 rounded shadow">
            <div className="flex items-center">
              <img
                src={card.color === 'WHITE' ? '/white-egg.png' : '/brown-egg.png'}
                alt="egg"
                className="h-12 w-12 mr-3"
              />
              <div>
                <h3 className="font-semibold">
                  {card.size.charAt(0)}{card.size.slice(1).toLowerCase()} / {card.color.charAt(0)}{card.color.slice(1).toLowerCase()}
                </h3>
                <p className="text-sm text-gray-600">{card.qty_tray.toFixed(1)} trays • {card.qty_dozen.toFixed(1)} dozens</p>
                <p className="text-sm text-gray-600">{card.qty_pcs} pcs</p>
                {card.unit_price && (
                  <p className="text-sm text-gray-800 mt-1">₱{card.unit_price.toFixed(2)} per dozen</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {pendingOverrides.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Pending Override Requests</h2>
          <div className="space-y-3">
            {pendingOverrides.map((override) => (
              <div key={override.id} className="bg-white p-4 rounded shadow border border-yellow-300">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">
                      Invoice #{override.invoice_id} • Submitted {new Date(override.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Driver ID {override.requested_by_id} • Total ₱{override.invoice.total_amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveOverride(override.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectOverride(override.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 uppercase text-xs">
                      <th className="py-1">Classification</th>
                      <th className="py-1">Requested</th>
                      <th className="py-1">Available pcs</th>
                      <th className="py-1">Shortage pcs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {override.invoice.items.map((item) => {
                      const shortage = override.items.find(
                        (o) => o.invoice_item_id === item.id,
                      );
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="py-1">{getClassificationLabel(item.classification_id)}</td>
                          <td className="py-1">
                            {item.qty} {item.unit.toLowerCase()}
                          </td>
                          <td className="py-1">{shortage?.available_qty_pcs ?? 0}</td>
                          <td className="py-1 text-red-600">{shortage?.shortage_qty_pcs ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Add Inventory Form */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Add Inventory</h2>
        <form className="flex flex-col sm:flex-row items-center gap-2" onSubmit={handleAdd}>
          <select
            className="border rounded px-3 py-2"
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