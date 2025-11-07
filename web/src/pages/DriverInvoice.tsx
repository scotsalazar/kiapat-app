import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import SignaturePad from '../components/SignaturePad';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import useInventoryStream, { InventoryUpdateMessage } from '../hooks/useInventoryStream';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import type { Classification, InvoiceItemForm, Price } from '../types/invoice';
import { formatDateTime } from '../utils/dateTime';

const units = ['TRAY', 'DOZEN', 'PCS'];
const PRICE_RECENT_CHANGE_WINDOW_MS = 1000 * 60 * 60 * 48; // 48 hours

type PriceLookupEntry = {
  TRAY?: Price;
  DOZEN?: Price;
  PCS?: Price;
};

const parseTimestamp = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getLatestTimestamp = (
  values: Array<string | null | undefined>,
): Date | null => {
  const timestamps = values
    .map((value) => parseTimestamp(value))
    .filter((value): value is Date => Boolean(value));
  if (!timestamps.length) {
    return null;
  }
  return new Date(Math.max(...timestamps.map((date) => date.getTime())));
};

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const { showToast } = useToast();

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
    [],
  );

  const formatCurrencyValue = useCallback(
    (value: number | null | undefined) =>
      value !== null && value !== undefined
        ? currencyFormatter.format(value)
        : t('common.notAvailable'),
    [currencyFormatter, t],
  );

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

  const classificationPriceLookup = useMemo(() => {
    const map = new Map<number, PriceLookupEntry>();
    prices.forEach((price) => {
      const unitKey = price.unit.toUpperCase();
      const entry = map.get(price.classification_id) ?? {};
      if (unitKey === 'TRAY' || unitKey === 'DOZEN' || unitKey === 'PCS') {
        entry[unitKey] = price;
      }
      map.set(price.classification_id, entry);
    });
    return map;
  }, [prices]);

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
      showToast(t('driverInvoice.messages.resolveIssues'), 'error');
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
      showToast(t('driverInvoice.messages.addItem'), 'error');
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
        const pendingMessage = t('driverInvoice.messages.pendingSubmission');
        setMessage(pendingMessage);
        setMessageTone('warning');
        showToast(pendingMessage, 'info');
      } else if (data.status === 'REJECTED') {
        const rejectedMessage = t('driverInvoice.messages.rejectedSubmission');
        setMessage(rejectedMessage);
        setMessageTone('error');
        showToast(rejectedMessage, 'error');
      } else {
        const successMessage = t('driverInvoice.messages.successSubmission');
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
      const { message: errorMessage } = parseApiError(err, t('driverInvoice.messages.errorSubmission'));
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
      warnings.push(t('driverInvoice.messages.signatureRequired'));
    }
    if (items.length === 0) {
      warnings.push(t('driverInvoice.messages.addLineItemWarning'));
    }
    items.forEach((item, index) => {
      const classification =
        item.classification_id && classificationMap.get(item.classification_id);
      const baseLabel = t('driverInvoice.messages.lineItemLabel', { index: index + 1 });
      const itemLabel = classification
        ? `${classification.size} / ${classification.color}`
        : baseLabel;
      if (!item.classification_id) {
        warnings.push(t('driverInvoice.messages.missingClassification', { item: baseLabel }));
      }
      if (!item.qty || item.qty <= 0) {
        warnings.push(t('driverInvoice.messages.quantityRequired', { item: itemLabel }));
      }
      if (!item.unit) {
        warnings.push(t('driverInvoice.messages.unitRequired', { item: itemLabel }));
      }
      if (item.classification_id && item.unit) {
        const priceMatch = prices.find(
          (p) =>
            p.classification_id === item.classification_id &&
            p.unit.toLowerCase() === item.unit.toLowerCase(),
        );
        if (!priceMatch) {
          warnings.push(
            t('driverInvoice.messages.priceUnavailable', {
              item: itemLabel,
              unit: item.unit.toLowerCase(),
            }),
          );
        }
      }
    });
    return warnings;
  }, [classificationMap, items, prices, signatureDataUrl, t]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="text-2xl font-bold">{t('driverInvoice.title')}</h1>
          <button
            type="button"
            onClick={() => navigate('/invoices/history')}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            {t('common.actions.viewInvoiceHistory')}
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
            ? t('driverInvoice.statusBadge.pending')
            : invoiceStatus === 'REJECTED'
            ? t('driverInvoice.statusBadge.rejected')
            : t('driverInvoice.statusBadge.created')}
        </div>
      )}
      {overrides.length > 0 && (
        <div className="mb-4 border border-yellow-300 bg-yellow-50 text-yellow-900 rounded p-3">
          <h2 className="font-semibold mb-2">{t('driverInvoice.overrides.title')}</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {overrides.map((override) => {
              const cls = classificationMap.get(override.classification_id);
              const shortage = override.requested_qty_pcs - override.available_qty_pcs;
              const classificationLabel = cls
                ? `${cls.size} / ${cls.color}`
                : t('driverInvoice.overrides.classificationFallback', {
                    id: override.classification_id,
                  });
              const shortageText =
                shortage > 0
                  ? t('driverInvoice.overrides.shortage', { value: shortage })
                  : '';
              return (
                <li key={override.id}>
                  {t('driverInvoice.overrides.entry', {
                    classification: classificationLabel,
                    requested: override.requested_qty_pcs,
                    unit: override.requested_unit.toLowerCase(),
                    available: override.available_qty_pcs,
                    shortage: shortageText,
                  })}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <label className="flex flex-col text-sm flex-1">
            <span className="font-medium text-gray-700">{t('common.labels.customerName')}</span>
            <input
              id="invoice-customer-name"
              type="text"
              placeholder={t('driverInvoice.form.customerNamePlaceholder')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm flex-1">
            <span className="font-medium text-gray-700">{t('common.labels.customerPhone')}</span>
            <input
              id="invoice-customer-phone"
              type="text"
              placeholder={t('driverInvoice.form.customerPhonePlaceholder')}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
        </div>
        {/* Line Items */}
        <div>
          <h2 className="text-xl font-semibold mb-2">{t('driverInvoice.form.itemsTitle')}</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('driverInvoice.form.classificationHeader')}
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('driverInvoice.form.quantityHeader')}
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('driverInvoice.form.unitHeader')}
                </th>
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('driverInvoice.form.priceHeader')}
                </th>
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('driverInvoice.form.totalHeader')}
                </th>
                <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('driverInvoice.form.actionsHeader')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const classificationId =
                  typeof item.classification_id === 'number' ? item.classification_id : null;
                const priceEntry =
                  classificationId !== null
                    ? classificationPriceLookup.get(classificationId)
                    : undefined;
                const trayPrice = priceEntry?.TRAY?.price_per_unit ?? null;
                const dozenPrice = priceEntry?.DOZEN?.price_per_unit ?? null;
                const latestPriceChange = priceEntry
                  ? getLatestTimestamp([
                      priceEntry.TRAY?.effective_from,
                      priceEntry.DOZEN?.effective_from,
                    ])
                  : null;
                const isRecentPriceChange =
                  !!latestPriceChange &&
                  Date.now() - latestPriceChange.getTime() <= PRICE_RECENT_CHANGE_WINDOW_MS;
                const unitSelectTitle =
                  classificationId && priceEntry
                    ? t('driverInvoice.form.unitTooltipWithPrices', {
                        tray: formatCurrencyValue(trayPrice),
                        dozen: formatCurrencyValue(dozenPrice),
                      })
                    : t('driverInvoice.form.unitTooltipWithoutClassification');
                const lineItemLabel = t('driverInvoice.aria.classification', {
                  index: index + 1,
                });

                const quantityAriaLabel = t('driverInvoice.aria.quantity', {
                  index: index + 1,
                });
                const unitAriaLabel = t('driverInvoice.aria.unit', {
                  index: index + 1,
                });
                const latestPriceChangeLabel = latestPriceChange
                  ? formatDateTime(latestPriceChange)
                  : '';

                return (
                  <tr key={item.id} className="bg-white align-top">
                    <td className="px-2 py-1 align-top">
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
                        aria-label={lineItemLabel}
                      >
                        <option value="" disabled>
                          {t('driverInvoice.form.classificationPlaceholder')}
                        </option>
                        {classifications.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.size} / {c.color}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1 align-top">
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
                        aria-label={quantityAriaLabel}
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <div className="flex flex-col">
                        <select
                          className="border rounded px-2 py-1"
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                          title={unitSelectTitle}
                          aria-label={unitAriaLabel}
                        >
                          {units.map((u) => (
                            <option key={u} value={u}>
                              {t(
                                u === 'TRAY'
                                  ? 'common.labels.tray'
                                  : u === 'DOZEN'
                                  ? 'common.labels.dozen'
                                  : 'common.labels.pcs',
                              )}
                            </option>
                          ))}
                        </select>
                        {!classificationId && (
                          <div className="mt-1 text-[11px] text-gray-400">
                            {t('driverInvoice.form.unitTooltipWithoutClassification')}
                          </div>
                        )}
                        {classificationId && priceEntry && (
                          <div className="mt-1 space-y-1 text-[11px] leading-tight text-gray-500">
                            <div className="flex items-center justify-between gap-2">
                              <span>{t('common.labels.tray')}</span>
                              <span className="font-medium text-gray-700">
                                {formatCurrencyValue(trayPrice)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span>{t('common.labels.dozen')}</span>
                              <span className="font-medium text-gray-700">
                                {formatCurrencyValue(dozenPrice)}
                              </span>
                            </div>
                            {latestPriceChange && (
                              <div
                                className={
                                  isRecentPriceChange ? 'text-blue-600' : 'text-gray-400'
                                }
                              >
                                {latestPriceChangeLabel
                                  ? t('inventory.pricing.updated', {
                                      value: latestPriceChangeLabel,
                                    })
                                  : null}
                              </div>
                            )}
                          </div>
                        )}
                        {classificationId && !priceEntry && (
                          <div className="mt-1 text-[11px] text-red-600">
                            {t('driverInvoice.form.pricingUnavailable')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right align-top">
                      {formatCurrencyValue(item.unit_price)}
                    </td>
                    <td className="px-2 py-1 text-right align-top">
                      {formatCurrencyValue(item.line_total)}
                    </td>
                    <td className="px-2 py-1 text-right align-top">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        {t('common.actions.remove')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addItem}
            className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded"
          >
            {t('common.actions.addItem')}
          </button>
        </div>
        {/* Total */}
        <div className="text-right text-lg font-semibold">
          {t('driverInvoice.form.totalLabel')} {formatCurrencyValue(total)}
        </div>
        {/* Signature */}
        <div>
          <h2 className="text-xl font-semibold mb-1">{t('common.labels.signature')}</h2>
          <SignaturePad onChange={setSignatureDataUrl} />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {t('common.actions.previewInvoice')}
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