import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';

interface Classification {
  id: number;
  size: string;
  color: string;
}
interface Price {
  id: number;
  classification_id: number;
  unit: string;
  price_per_unit: number;
  effective_from: string;
  effective_to: string | null;
}
interface InvoiceItemForm {
  id: number;
  classification_id: number | '';
  qty: number;
  unit: string;
  unit_price?: number;
  line_total?: number;
}

const units = ['TRAY', 'DOZEN', 'PCS'];

interface InventoryUpdateMessage {
  type: 'inventory_update';
  prices?: Price[];
}

interface InvoiceOverride {
  id: number;
  classification_id: number;
  requested_qty_pcs: number;
  requested_unit: string;
  available_qty_pcs: number;
  status: string;
  decision_reason?: string | null;
}

interface InvoiceResponse {
  id: number;
  status: 'COMPLETED' | 'PENDING_OVERRIDE' | 'REJECTED';
  overrides: InvoiceOverride[];
}

const DriverInvoicePage: React.FC = () => {
  const { token } = useAuth();
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messageTone, setMessageTone] = useState<'success' | 'warning' | 'error'>('success');
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<string>('');
  const [overrides, setOverrides] = useState<InvoiceOverride[]>([]);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const { showToast } = useToast();

  const classificationMap = useMemo(() => {
    const map = new Map<number, Classification>();
    classifications.forEach((cls) => map.set(cls.id, cls));
    return map;
  }, [classifications]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      axios.get('/api/catalog/classifications', { headers: authHeader }),
      axios.get('/api/catalog/prices', { headers: authHeader }),
    ]).then(([clsRes, priceRes]) => {
      setClassifications(clsRes.data);
      setPrices(priceRes.data);
    });
  }, [authHeader, token]);

  useEffect(() => {
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/realtime/updates`);

    ws.onmessage = (event) => {
      try {
        const payload: InventoryUpdateMessage = JSON.parse(event.data);
        if (payload.type === 'inventory_update' && payload.prices) {
          setPrices(payload.prices);
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

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now(), classification_id: '', qty: 1, unit: 'DOZEN' },
    ]);
  };

  const updateItem = (index: number, updates: Partial<InvoiceItemForm>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    // compute price and line total if classification and unit and qty set
    const clsId = newItems[index].classification_id;
    const unit = newItems[index].unit;
    const qty = newItems[index].qty;
    if (clsId && unit) {
      const price = prices.find(
        (p) => p.classification_id === clsId && p.unit === unit,
      );
      if (price) {
        newItems[index].unit_price = price.price_per_unit;
        newItems[index].line_total = price.price_per_unit * qty;
      }
    }
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // compile items
    const payloadItems = items
      .filter((item) => item.classification_id)
      .map((item) => ({
        classification_id: item.classification_id,
        qty: item.qty,
        unit: item.unit,
      }));
    try {
      const res = await axios.post(
        '/api/sales/invoices',
        {
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          items: payloadItems,
          signature_png_b64: signatureDataUrl,
        },
        { headers: authHeader },
      );
      const data: InvoiceResponse = res.data;
      setInvoiceId(data.id);
      setInvoiceStatus(data.status);
      setOverrides(data.overrides || []);
      if (data.status === 'PENDING_OVERRIDE') {
        const pendingMessage = 'Invoice submitted. Awaiting admin approval due to low stock.';
        setMessage(pendingMessage);
        setMessageTone('warning');
        showToast(pendingMessage, 'info');
      } else if (data.status === 'REJECTED') {
        const rejectedMessage = 'Invoice requires attention. Please contact an administrator.';
        setMessage(rejectedMessage);
        setMessageTone('error');
        showToast(rejectedMessage, 'error');
      } else {
        const successMessage = 'Invoice created';
        setMessage(successMessage);
        setMessageTone('success');
        showToast(successMessage, 'success');
      }
      // clear form
      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setSignatureDataUrl('');
    } catch (err) {
      const { message: errorMessage } = parseApiError(err, 'Error creating invoice');
      setMessage(errorMessage);
      setMessageTone('error');
      showToast(errorMessage, 'error');
      setInvoiceStatus('');
      setOverrides([]);
      setInvoiceId(null);
    }
  };

  const total = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Generate Sales Invoice</h1>
      {message && (
        <p
          className={`mb-2 ${
            messageTone === 'error'
              ? 'text-red-600'
              : messageTone === 'warning'
              ? 'text-yellow-700'
              : 'text-green-600'
          }`}
        >
          {message}
        </p>
      )}
      {invoiceId && (
        <div
          className={`border p-2 rounded mb-4 ${
            invoiceStatus === 'PENDING_OVERRIDE'
              ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
              : invoiceStatus === 'REJECTED'
              ? 'bg-red-50 border-red-400 text-red-700'
              : 'bg-green-50 border-green-400 text-green-700'
          }`}
        >
          Invoice #{invoiceId}{' '}
          {invoiceStatus === 'PENDING_OVERRIDE'
            ? 'pending approval'
            : invoiceStatus === 'REJECTED'
            ? 'requires admin follow-up'
            : 'created'}
        </div>
      )}
      {overrides.length > 0 && (
        <div className="mb-4 border border-yellow-300 bg-yellow-50 text-yellow-900 rounded p-3">
          <h2 className="font-semibold mb-2">Requested override details</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {overrides.map((override) => {
              const cls = classificationMap.get(override.classification_id);
              const shortage = override.requested_qty_pcs - override.available_qty_pcs;
              return (
                <li key={override.id}>
                  {cls ? `${cls.size} / ${cls.color}` : `Classification #${override.classification_id}`}:
                  {' '}requested {override.requested_qty_pcs} pcs ({override.requested_unit.toLowerCase()})
                  , available {override.available_qty_pcs} pcs
                  {shortage > 0 && ` (short ${shortage} pcs)`}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
          <input
            type="text"
            placeholder="Customer phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
        </div>
        {/* Line Items */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Items</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="bg-white"> 
                  <td className="px-2 py-1">
                    <select
                      className="border rounded px-2 py-1"
                      value={item.classification_id}
                      onChange={(e) => updateItem(idx, { classification_id: Number(e.target.value) })}
                      required
                    >
                      <option value="" disabled>
                        Select
                      </option>
                      {classifications.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.size} / {c.color}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={1}
                      className="border rounded px-2 py-1 w-20"
                      value={item.qty}
                      onChange={(e) => updateItem(idx, { qty: parseInt(e.target.value, 10) })}
                      required
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="border rounded px-2 py-1"
                      value={item.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u.charAt(0)}{u.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right">
                    {item.unit_price ? `₱${item.unit_price.toFixed(2)}` : '-'}
                  </td>
                    <td className="px-2 py-1 text-right">
                      {item.line_total ? `₱${item.line_total.toFixed(2)}` : '-'}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addItem}
            className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded"
          >
            Add Item
          </button>
        </div>
        {/* Total */}
        <div className="text-right text-lg font-semibold">Total: ₱{total.toFixed(2)}</div>
        {/* Signature */}
        <div>
          <h2 className="text-xl font-semibold mb-1">Signature</h2>
          <SignaturePad onChange={setSignatureDataUrl} />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Submit Invoice
        </button>
      </form>
    </div>
  );
};

export default DriverInvoicePage;