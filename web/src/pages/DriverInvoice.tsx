import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import useInventoryStream, { InventoryUpdateMessage } from '../hooks/useInventoryStream';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import type { Classification, InvoiceItemForm, Price } from '../types/invoice';

const units = ['TRAY', 'DOZEN', 'PCS'];

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

type DriverInventoryStreamState = {
  prices: Price[];
};

const DriverInvoicePage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [initialPrices, setInitialPrices] = useState<Price[]>([]);
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messageTone, setMessageTone] = useState<'success' | 'warning' | 'error'>('success');
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<string>('');
  const [overrides, setOverrides] = useState<InvoiceOverride[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const { showToast } = useToast();

  const classificationMap = useMemo(() => {
    const map = new Map<number, Classification>();
    classifications.forEach((cls) => map.set(cls.id, cls));
    return map;
  }, [classifications]);

  const priceStreamInitialData = useMemo<DriverInventoryStreamState>(
    () => ({ prices: initialPrices }),
    [initialPrices],
  );

  const mergePriceUpdates = useCallback(
    (
      current: DriverInventoryStreamState,
      message: InventoryUpdateMessage<unknown, unknown, Price[] | undefined>,
    ): DriverInventoryStreamState => {
      if (message.type !== 'inventory_update') {
        return current;
      }
      return {
        prices: message.prices ?? current.prices,
      };
    },
    [],
  );

  const { data: priceStream, status: streamStatus, error: streamError } = useInventoryStream<
    DriverInventoryStreamState,
    InventoryUpdateMessage<unknown, unknown, Price[] | undefined>
  >({
    token,
    initialData: priceStreamInitialData,
    merge: mergePriceUpdates,
  });

  const prices = priceStream.prices ?? [];

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
    if (!token) return;
    Promise.all([
      axios.get('/api/catalog/classifications', { headers: authHeader }),
      axios.get('/api/catalog/prices', { headers: authHeader }),
    ]).then(([clsRes, priceRes]) => {
      setClassifications(clsRes.data);
      setInitialPrices(priceRes.data);
    });
  }, [authHeader, token]);

  const applyPricing = useCallback(
    (item: InvoiceItemForm): InvoiceItemForm => {
      if (!item.classification_id || !item.unit || !item.qty || item.qty <= 0) {
        return { ...item, unit_price: undefined, line_total: undefined };
      }
      const price = prices.find(
        (p) =>
          p.classification_id === item.classification_id &&
          p.unit.toLowerCase() === item.unit.toLowerCase(),
      );
      if (!price) {
        return { ...item, unit_price: undefined, line_total: undefined };
      }
      const unitPrice = price.price_per_unit;
      return {
        ...item,
        unit_price: unitPrice,
        line_total: unitPrice * item.qty,
      };
    },
    [prices],
  );

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      applyPricing({ id: Date.now(), classification_id: '', qty: 1, unit: 'DOZEN' }),
    ]);
  }, [applyPricing]);

  const updateItem = useCallback(
    (id: number, updates: Partial<InvoiceItemForm>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) {
            return item;
          }
          const nextItem = applyPricing({ ...item, ...updates });
          return nextItem;
        }),
      );
    },
    [applyPricing],
  );

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    setItems((prev) => {
      let changed = false;
      const nextItems = prev.map((item) => {
        const updated = applyPricing(item);
        if (
          updated.unit_price !== item.unit_price ||
          updated.line_total !== item.line_total
        ) {
          changed = true;
        }
        return updated;
      });
      return changed ? nextItems : prev;
    });
  }, [applyPricing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPreviewOpen(true);
  };

  const handleConfirmPreview = async () => {
    if (previewWarnings.length > 0) {
      showToast('Resolve the highlighted issues before submitting.', 'error');
      return;
    }
    const payloadItems = items
      .filter((item) => item.classification_id && item.qty > 0 && item.unit)
      .map((item) => ({
        classification_id: item.classification_id as number,
        qty: item.qty,
        unit: item.unit,
      }));
    if (payloadItems.length === 0) {
      showToast('Add at least one valid line item to submit the invoice.', 'error');
      return;
    }
    setIsSubmitting(true);
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
      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setSignatureDataUrl('');
      setIsPreviewOpen(false);
    } catch (err) {
      const { message: errorMessage } = parseApiError(err, 'Error creating invoice');
      setMessage(errorMessage);
      setMessageTone('error');
      showToast(errorMessage, 'error');
      setInvoiceStatus('');
      setOverrides([]);
      setInvoiceId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (item.line_total || 0), 0),
    [items],
  );

  const previewWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!signatureDataUrl) {
      warnings.push('Signature is required before submitting the invoice.');
    }
    if (items.length === 0) {
      warnings.push('Add at least one line item to continue.');
    }
    items.forEach((item, index) => {
      const classification =
        item.classification_id && classificationMap.get(item.classification_id);
      const itemLabel = classification
        ? `${classification.size} / ${classification.color}`
        : `Line item ${index + 1}`;
      if (!item.classification_id) {
        warnings.push(`Line item ${index + 1} is missing a classification.`);
      }
      if (!item.qty || item.qty <= 0) {
        warnings.push(`${itemLabel} must have a quantity greater than zero.`);
      }
      if (!item.unit) {
        warnings.push(`${itemLabel} must include a unit.`);
      }
      if (item.classification_id && item.unit) {
        const priceMatch = prices.find(
          (p) =>
            p.classification_id === item.classification_id &&
            p.unit.toLowerCase() === item.unit.toLowerCase(),
        );
        if (!priceMatch) {
          warnings.push(
            `No price available for ${itemLabel} in ${item.unit.toLowerCase()} units.`,
          );
        }
      }
    });
    return warnings;
  }, [classificationMap, items, prices, signatureDataUrl]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="text-2xl font-bold">Generate Sales Invoice</h1>
          <button
            type="button"
            onClick={() => navigate('/invoices/history')}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            View invoice history
          </button>
        </div>
        <div className="flex flex-col items-start text-sm sm:items-end">
          <div className={`flex items-center gap-2 ${streamStatusMeta.textClass}`}>
            <span className={`h-2 w-2 rounded-full ${streamStatusMeta.dotClass}`} />
            <span>{streamStatusMeta.label}</span>
          </div>
          {streamError && (
            <div className="mt-1 text-xs text-red-600">{streamError}</div>
          )}
        </div>
      </div>
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
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="bg-white">
                  <td className="px-2 py-1">
                    <select
                      className="border rounded px-2 py-1"
                      value={item.classification_id || ''}
                      onChange={(e) =>
                        updateItem(item.id, {
                          classification_id: e.target.value
                            ? Number(e.target.value)
                            : '',
                        })
                      }
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
                      onChange={(e) =>
                        updateItem(item.id, {
                          qty: Number(e.target.value) > 0 ? Number(e.target.value) : 0,
                        })
                      }
                      required
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="border rounded px-2 py-1"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
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
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
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
          Preview Invoice
        </button>
      </form>
      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        items={items}
        classifications={classifications}
        prices={prices}
        signatureDataUrl={signatureDataUrl}
        validationWarnings={previewWarnings}
        isSubmitting={isSubmitting}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={handleConfirmPreview}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />
    </div>
  );
};

export default DriverInvoicePage;