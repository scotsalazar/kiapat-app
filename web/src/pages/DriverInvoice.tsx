import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import useInventoryStream, { InventoryUpdateMessage } from '../hooks/useInventoryStream';

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
  const { t } = useTranslation();
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
          label: t('common.status.connected'),
          dotClass: 'bg-green-500',
          textClass: 'text-green-600',
        };
      case 'reconnecting':
        return {
          label: t('common.status.reconnecting'),
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600',
        };
      case 'connecting':
        return {
          label: t('common.status.connecting'),
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600',
        };
      case 'error':
        return {
          label: t('common.status.error'),
          dotClass: 'bg-red-500',
          textClass: 'text-red-600',
        };
      case 'closed':
        return {
          label: t('common.status.disconnected'),
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500',
        };
      default:
        return {
          label: t('common.status.offline'),
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500',
        };
    }
  }, [streamStatus, t]);

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
        const pendingMessage = t('driverInvoice.messages.pendingApproval');
        setMessage(pendingMessage);
        setMessageTone('warning');
        showToast(pendingMessage, 'info');
      } else if (data.status === 'REJECTED') {
        const rejectedMessage = t('driverInvoice.messages.requiresAttention');
        setMessage(rejectedMessage);
        setMessageTone('error');
        showToast(rejectedMessage, 'error');
      } else {
        const successMessage = t('driverInvoice.messages.created');
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
      const { message: errorMessage } = parseApiError(err, t('driverInvoice.messages.creationError'));
      setMessage(errorMessage);
      setMessageTone('error');
      showToast(errorMessage, 'error');
      setInvoiceStatus('');
      setOverrides([]);
      setInvoiceId(null);
    }
  };

  const total = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

  const invoiceStatusText = useMemo(() => {
    if (!invoiceId) {
      return '';
    }
    if (invoiceStatus === 'PENDING_OVERRIDE') {
      return t('driverInvoice.invoiceStatus.pendingApproval');
    }
    if (invoiceStatus === 'REJECTED') {
      return t('driverInvoice.invoiceStatus.requiresFollowUp');
    }
    return t('driverInvoice.invoiceStatus.created');
  }, [invoiceId, invoiceStatus, t]);

  const totalText = useMemo(
    () => t('driverInvoice.total', { amount: total.toFixed(2) }),
    [t, total],
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t('driverInvoice.title')}</h1>
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
          {t('driverInvoice.invoiceNotice', { id: invoiceId, status: invoiceStatusText })}
        </div>
      )}
      {overrides.length > 0 && (
        <div className="mb-4 border border-yellow-300 bg-yellow-50 text-yellow-900 rounded p-3">
          <h2 className="font-semibold mb-2">{t('driverInvoice.overrideDetails')}</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {overrides.map((override) => {
              const cls = classificationMap.get(override.classification_id);
              const shortage = override.requested_qty_pcs - override.available_qty_pcs;
              const classificationLabel = cls
                ? `${cls.size} / ${cls.color}`
                : `${t('driverInvoice.tableHeaders.classification')} #${override.classification_id}`;
              const unitLabel = t(`driverInvoice.units.${override.requested_unit as 'TRAY' | 'DOZEN' | 'PCS'}`).toLowerCase();
              return (
                <li key={override.id}>
                  {t('driverInvoice.overrideItem', {
                    classification: classificationLabel,
                    requested: override.requested_qty_pcs,
                    unit: unitLabel,
                    available: override.available_qty_pcs,
                    shortage: shortage > 0 ? t('driverInvoice.overrideShortage', { value: shortage }) : '',
                  })}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <label className="flex flex-col flex-1 text-sm text-gray-700">
            <span className="font-medium">{t('driverInvoice.customerNameLabel')}</span>
            <input
              type="text"
              placeholder={t('driverInvoice.customerNameLabel')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col flex-1 text-sm text-gray-700">
            <span className="font-medium">{t('driverInvoice.customerPhoneLabel')}</span>
            <input
              type="text"
              placeholder={t('driverInvoice.customerPhoneLabel')}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
        </div>
        {/* Line Items */}
        <div>
          <h2 className="text-xl font-semibold mb-2">{t('driverInvoice.items')}</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('driverInvoice.tableHeaders.classification')}</th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('driverInvoice.tableHeaders.quantity')}</th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('driverInvoice.tableHeaders.unit')}</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('driverInvoice.tableHeaders.price')}</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('driverInvoice.tableHeaders.total')}</th>
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
                      aria-label={`${t('driverInvoice.tableHeaders.classification')} ${idx + 1}`}
                    >
                      <option value="" disabled>
                        {t('common.placeholders.select')}
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
                      aria-label={`${t('driverInvoice.tableHeaders.quantity')} ${idx + 1}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="border rounded px-2 py-1"
                      value={item.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      aria-label={`${t('driverInvoice.tableHeaders.unit')} ${idx + 1}`}
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {t(`driverInvoice.units.${u as 'TRAY' | 'DOZEN' | 'PCS'}`)}
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
            {t('driverInvoice.form.addItem')}
          </button>
        </div>
        {/* Total */}
        <div className="text-right text-lg font-semibold">{totalText}</div>
        {/* Signature */}
        <div>
          <h2 className="text-xl font-semibold mb-1">{t('driverInvoice.signature')}</h2>
          <SignaturePad onChange={setSignatureDataUrl} />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {t('driverInvoice.form.submit')}
        </button>
      </form>
    </div>
  );
};

export default DriverInvoicePage;