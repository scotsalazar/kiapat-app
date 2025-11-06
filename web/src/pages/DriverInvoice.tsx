import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';
import { InventoryPrice, useInventoryStream } from '../hooks/useInventoryStream';

interface Classification {
  id: number;
  size: string;
  color: string;
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

const DriverInvoicePage: React.FC = () => {
  const { token } = useAuth();
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [invoiceId, setInvoiceId] = useState<number | null>(null);

  const { prices, hydrate, connectionStatus, reconnect } = useInventoryStream({ token });

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      axios.get('/api/catalog/classifications', { headers: authHeader }),
      axios.get('/api/catalog/prices', { headers: authHeader }),
    ]).then(([clsRes, priceRes]) => {
      setClassifications(clsRes.data);
      hydrate({ prices: priceRes.data as InventoryPrice[] });
    });
  }, [authHeader, hydrate, token]);

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
      setMessage('Invoice created');
      setInvoiceId(res.data.id);
      // clear form
      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setSignatureDataUrl('');
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Error creating invoice');
    }
  };

  const total = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Generate Sales Invoice</h1>
        <button
          type="button"
          onClick={connectionStatus === 'open' ? undefined : reconnect}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            connectionStatus === 'open'
              ? 'border-green-200 bg-green-50 text-green-700'
              : connectionStatus === 'connecting'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          }`}
          disabled={connectionStatus === 'open'}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connectionStatus === 'open'
                ? 'bg-green-500'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          />
          <span className="capitalize">{connectionStatus}</span>
        </button>
      </div>
      {message && <p className="text-green-600 mb-2">{message}</p>}
      {invoiceId && (
        <div className="bg-green-50 border border-green-400 text-green-700 p-2 rounded mb-4">
          Invoice #{invoiceId} created
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