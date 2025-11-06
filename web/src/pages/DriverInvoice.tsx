import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { z } from 'zod';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';

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

const units = ['TRAY', 'DOZEN', 'PCS'] as const;
type Unit = (typeof units)[number];

const invoiceItemSchema = z.object({
  classification_id: z.number().int().positive('Select a classification'),
  qty: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  unit: z.enum(units),
});

const invoiceSchema = z.object({
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item before submitting the invoice.'),
  signature_png_b64: z.string().optional(),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

interface InvoiceSubmitPayload {
  customer_name: string | null;
  customer_phone: string | null;
  items: InvoiceForm['items'];
  signature_png_b64: string;
}

interface InventoryUpdateMessage {
  type: 'inventory_update';
  prices?: Price[];
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
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [itemErrors, setItemErrors] = useState<Array<Partial<Record<'classification_id' | 'qty' | 'unit', string>>>>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<InvoiceSubmitPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastInvoicePayload, setLastInvoicePayload] = useState<InvoiceSubmitPayload | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchCatalogData = useCallback(async () => {
    if (!token) return;
    setLoadingError(null);
    try {
      const [clsRes, priceRes] = await Promise.all([
        axios.get('/api/catalog/classifications', { headers: authHeader }),
        axios.get('/api/catalog/prices', { headers: authHeader }),
      ]);
      setClassifications(clsRes.data);
      setPrices(priceRes.data);
    } catch (err: any) {
      console.error(err);
      setLoadingError(err.response?.data?.detail || 'Failed to load catalog data.');
    }
  }, [authHeader, token]);

  useEffect(() => {
    fetchCatalogData();
  }, [fetchCatalogData]);

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
    setItemErrors([...itemErrors, {}]);
    setItemsError(null);
    setSubmitError(null);
  };

  const updateItem = (index: number, updates: Partial<InvoiceItemForm>) => {
    const newItems = [...items];
    const updatedItem = { ...newItems[index], ...updates };
    if ('qty' in updates) {
      const numericQty = Number(updates.qty);
      updatedItem.qty = Number.isFinite(numericQty) ? numericQty : 0;
    }
    // compute price and line total if classification and unit and qty set
    const clsId = typeof updatedItem.classification_id === 'number' ? updatedItem.classification_id : null;
    const unit = updatedItem.unit as Unit;
    const qty = updatedItem.qty;
    if (clsId && unit && qty > 0) {
      const price = prices.find(
        (p) => p.classification_id === clsId && p.unit === unit,
      );
      if (price) {
        updatedItem.unit_price = price.price_per_unit;
        updatedItem.line_total = price.price_per_unit * qty;
      }
    } else {
      updatedItem.unit_price = undefined;
      updatedItem.line_total = undefined;
    }
    newItems[index] = updatedItem;
    setItems(newItems);
    setItemErrors((prev) => {
      const next = [...prev];
      next[index] = {};
      return next;
    });
    setItemsError(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSubmitError(null);
    setItemsError(null);
    setItemErrors(items.map(() => ({})));
    const rawItems = items.map((item) => ({
      classification_id: typeof item.classification_id === 'number' ? item.classification_id : 0,
      qty: Number.isFinite(item.qty) ? item.qty : 0,
      unit: item.unit as Unit,
    }));
    const validation = invoiceSchema.safeParse({
      items: rawItems,
      signature_png_b64: signatureDataUrl,
    });

    if (!validation.success) {
      const issues = validation.error.issues;
      const perItemErrors = items.map(() => ({} as Partial<Record<'classification_id' | 'qty' | 'unit', string>>));
      let generalItemsError: string | null = null;
      issues.forEach((issue) => {
        if (issue.path[0] === 'items') {
          const index = issue.path[1] as number | undefined;
          const field = issue.path[2] as 'classification_id' | 'qty' | 'unit' | undefined;
          if (typeof index === 'number') {
            if (field) {
              perItemErrors[index][field] = issue.message;
            } else {
              generalItemsError = issue.message;
            }
          } else {
            generalItemsError = issue.message;
          }
        } else if (issue.path.length === 1 && issue.path[0] === 'items') {
          generalItemsError = issue.message;
        }
      });
      setItemErrors(perItemErrors);
      setItemsError(generalItemsError);
      return;
    }

    setItemErrors(items.map(() => ({})));
    setItemsError(null);
    const payload: InvoiceSubmitPayload = {
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      items: validation.data.items,
      signature_png_b64: signatureDataUrl,
    };
    setPendingSubmit(payload);
    setLastInvoicePayload(payload);
  };

  const total = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

  const confirmSubmitInvoice = async () => {
    if (!pendingSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await axios.post('/api/sales/invoices', pendingSubmit, { headers: authHeader });
      setMessage('Invoice created');
      setInvoiceId(res.data.id);
      setItems([]);
      setItemErrors([]);
      setItemsError(null);
      setCustomerName('');
      setCustomerPhone('');
      setSignatureDataUrl('');
      setPendingSubmit(null);
      setLastInvoicePayload(null);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.response?.data?.detail || 'Error creating invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelPendingSubmit = () => {
    if (isSubmitting) return;
    setPendingSubmit(null);
  };

  const retrySubmitInvoice = () => {
    if (lastInvoicePayload) {
      setSubmitError(null);
      setPendingSubmit(lastInvoicePayload);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Generate Sales Invoice</h1>
      {message && <p className="text-green-600 mb-2">{message}</p>}
      {invoiceId && (
        <div className="bg-green-50 border border-green-400 text-green-700 p-2 rounded mb-4">
          Invoice #{invoiceId} created
        </div>
      )}
      {loadingError && (
        <div className="mb-4 flex items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{loadingError}</span>
          <button type="button" className="font-semibold underline" onClick={() => fetchCatalogData()}>
            Retry
          </button>
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
                      onChange={(e) => {
                        const value = e.target.value;
                        updateItem(idx, { classification_id: value ? Number(value) : '' });
                      }}
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
                    {itemErrors[idx]?.classification_id && (
                      <p className="mt-1 text-xs text-red-600">{itemErrors[idx]?.classification_id}</p>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={1}
                      className="border rounded px-2 py-1 w-20"
                      value={item.qty > 0 ? item.qty : ''}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        updateItem(idx, { qty: Number.isFinite(value) ? value : 0 });
                      }}
                      required
                    />
                    {itemErrors[idx]?.qty && (
                      <p className="mt-1 text-xs text-red-600">{itemErrors[idx]?.qty}</p>
                    )}
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
                    {itemErrors[idx]?.unit && (
                      <p className="mt-1 text-xs text-red-600">{itemErrors[idx]?.unit}</p>
                    )}
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
          {itemsError && <p className="mt-2 text-sm text-red-600">{itemsError}</p>}
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
        {submitError && !pendingSubmit && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>{submitError}</span>
              {lastInvoicePayload && (
                <button type="button" className="font-semibold underline" onClick={retrySubmitInvoice}>
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </form>
      <ConfirmationModal
        open={!!pendingSubmit}
        title="Submit invoice?"
        description={`You're about to submit ${items.length} line item${items.length === 1 ? '' : 's'} with a total of ₱${total.toFixed(
          2,
        )}. Confirm to finalize the invoice.`}
        confirmLabel="Submit"
        cancelLabel="Cancel"
        onCancel={cancelPendingSubmit}
        onConfirm={confirmSubmitInvoice}
        loading={isSubmitting}
        errorMessage={submitError}
      />
    </div>
  );
};

export default DriverInvoicePage;