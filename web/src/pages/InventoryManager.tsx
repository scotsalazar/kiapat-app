import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';

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
  summary?: { timestamp: string; cards: InventoryCard[] };
  movements?: Movement[];
  prices?: PriceUpdate[];
}

const InventoryManagerPage: React.FC = () => {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<{ timestamp: string; cards: InventoryCard[] } | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [selectedCls, setSelectedCls] = useState<number | ''>('');
  const [qty, setQty] = useState<number>(0);
  const [unit, setUnit] = useState<string>('TRAY');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [pendingOverrides, setPendingOverrides] = useState<PendingOverride[]>([]);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const { showToast } = useToast();

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kiapat Inventory</h1>
        <div>{new Date(summary?.timestamp || '').toLocaleString()}</div>
      </div>
      {successMessage && <p className="text-green-600 mt-2">{successMessage}</p>}
      {formError && <p className="text-red-600 mt-2">{formError}</p>}
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