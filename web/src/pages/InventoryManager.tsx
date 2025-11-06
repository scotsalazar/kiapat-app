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
  linked_invoice_id: number | null;
}

interface OverrideRequest {
  id: number;
  movement_id: number;
  status: string;
  shortage_qty_pcs: number;
  available_qty_pcs: number;
  admin_comment: string | null;
  requested_at: string;
  movement: Movement;
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
  override_requests?: OverrideRequest[];
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
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [overrides, setOverrides] = useState<OverrideRequest[]>([]);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const loadData = useCallback(async () => {
    if (!token) return;
    const [summaryRes, movementsRes, clsRes, overridesRes] = await Promise.all([
      axios.get('/api/inventory/summary', { headers: authHeader }),
      axios.get('/api/inventory/movements?limit=20', { headers: authHeader }),
      axios.get('/api/catalog/classifications', { headers: authHeader }),
      axios.get('/api/inventory/overrides?status=PENDING', { headers: authHeader }),
    ]);
    setSummary(summaryRes.data);
    setMovements(movementsRes.data);
    setClassifications(clsRes.data);
    setOverrides(overridesRes.data);
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
          }
          if (payload.movements) {
            setMovements(payload.movements);
          }
          if (payload.override_requests) {
            setOverrides(payload.override_requests);
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
      setMessageType('success');
      setQty(0);
      setSelectedCls('');
      loadData();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Error creating movement');
      setMessageType('error');
    }
  };

  const handleVerify = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/verify', { movement_id: id }, { headers: authHeader });
      setMessage('Movement verified');
      setMessageType('success');
      loadData();
    } catch (err) {
      console.error(err);
      setMessage('Unable to verify movement');
      setMessageType('error');
    }
  };

  const handleCommit = async (id: number) => {
    try {
      await axios.post('/api/inventory/in/commit', { movement_id: id }, { headers: authHeader });
      setMessage('Movement committed');
      setMessageType('success');
      loadData();
    } catch (err) {
      console.error(err);
      setMessage('Unable to commit movement');
      setMessageType('error');
    }
  };

  const handleApproveOverride = async (id: number) => {
    try {
      await axios.post(`/api/inventory/overrides/${id}/approve`, {}, { headers: authHeader });
      setMessage('Override approved');
      setMessageType('success');
      loadData();
    } catch (err) {
      console.error(err);
      setMessage('Failed to approve override');
      setMessageType('error');
    }
  };

  const handleRejectOverride = async (id: number) => {
    const adminComment = window.prompt('Optional rejection note', '');
    try {
      await axios.post(
        `/api/inventory/overrides/${id}/reject`,
        adminComment ? { admin_comment: adminComment } : {},
        { headers: authHeader },
      );
      setMessage('Override rejected');
      setMessageType('success');
      loadData();
    } catch (err) {
      console.error(err);
      setMessage('Failed to reject override');
      setMessageType('error');
    }
  };

  const classificationLabel = useCallback(
    (id: number) => {
      const cls = classifications.find((c) => c.id === id);
      if (!cls) return `#${id}`;
      return `${cls.size} / ${cls.color}`;
    },
    [classifications],
  );

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kiapat Inventory</h1>
        <div>{new Date(summary?.timestamp || '').toLocaleString()}</div>
      </div>
      {message && (
        <p className={`${messageType === 'error' ? 'text-red-600' : 'text-green-600'} mt-2`}>
          {message}
        </p>
      )}
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
      {/* Override Requests */}
      {user?.role === 'admin' && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Pending Override Requests</h2>
          {overrides.length === 0 ? (
            <p className="text-sm text-gray-600">No pending overrides.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 bg-white rounded shadow">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shortage (pcs)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {overrides.map((o) => {
                    const movement = o.movement;
                    return (
                      <tr key={o.id}>
                        <td className="px-3 py-2 text-sm text-gray-700">#{movement?.linked_invoice_id ?? movement?.id ?? o.movement_id}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {movement
                            ? `${classificationLabel(movement.classification_id)} — ${movement.qty_entered} ${movement.unit_entered}`
                            : 'Movement unavailable'}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">{movement ? `${movement.qty_pcs} pcs` : '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{o.shortage_qty_pcs}</td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveOverride(o.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectOverride(o.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded"
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
    </div>
  );
};

export default InventoryManagerPage;