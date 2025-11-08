import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import apiClient from '../api/axios';

const units = ['TRAY', 'DOZEN', 'PCS'] as const;
type UnitType = (typeof units)[number];

const unitIconMap: Record<UnitType, { src: string; labelKey: string }> = {
  TRAY: { src: '/unit-tray.svg', labelKey: 'common.labels.tray' },
  DOZEN: { src: '/unit-dozen.svg', labelKey: 'common.labels.dozen' },
  PCS: { src: '/unit-piece.svg', labelKey: 'common.labels.pcs' },
};

const isUnitType = (value: string): value is UnitType =>
  units.includes(value as UnitType);
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
          textClass: 'text-green-600 dark:text-green-400',
        };
      case 'reconnecting':
        return {
          label: t('common.status.reconnecting'),
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'connecting':
        return {
          label: t('common.status.connecting'),
          dotClass: 'bg-yellow-500',
          textClass: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'error':
        return {
          label: t('common.status.error'),
          dotClass: 'bg-red-500',
          textClass: 'text-red-600 dark:text-red-400',
        };
      case 'closed':
        return {
          label: t('common.status.disconnected'),
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500 dark:text-slate-400',
        };
      default:
        return {
          label: t('common.status.offline'),
          dotClass: 'bg-gray-400',
          textClass: 'text-gray-500 dark:text-slate-400',
        };
    }
  }, [streamStatus, t]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiClient.get('/api/catalog/classifications'),
      apiClient.get('/api/catalog/prices'),
    ]).then(([clsRes, priceRes]) => {
      setClassifications(clsRes.data);
      setInitialPrices(priceRes.data);
    });
  }, [token]);

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
      const res = await apiClient.post('/api/sales/invoices', {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        items: payloadItems,
        signature_png_b64: signatureDataUrl,
      });
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
    <div className="space-y-6 sm:space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('driverInvoice.title')}</h1>
          <button
            type="button"
            onClick={() => navigate('/invoices/history')}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
          >
            {t('common.actions.viewInvoiceHistory')}
          </button>
        </div>
        <div className="flex flex-col items-start text-sm sm:items-end">
          <div className={`flex items-center gap-2 ${streamStatusMeta.textClass} dark:text-slate-300`}>
            <span className={`h-2 w-2 rounded-full ${streamStatusMeta.dotClass}`} />
            <span className="text-slate-700 dark:text-slate-300">{streamStatusMeta.label}</span>
          </div>
          {streamError && (
            <div className="mt-1 text-xs text-red-600 dark:text-red-400">{streamError}</div>
          )}
        </div>
      </div>
      {message && (
        <p
          className={`mb-2 ${
            messageTone === 'error'
              ? 'text-red-600 dark:text-red-400'
              : messageTone === 'warning'
              ? 'text-yellow-700 dark:text-yellow-400'
              : 'text-green-600 dark:text-green-400'
          }`}
        >
          {message}
        </p>
      )}
      {invoiceId && (
        <div
          className={`border p-2 rounded mb-4 ${
            invoiceStatus === 'PENDING_OVERRIDE'
              ? 'border-yellow-400 bg-yellow-50 text-yellow-800 dark:border-yellow-500 dark:bg-yellow-900/40 dark:text-yellow-200'
              : invoiceStatus === 'REJECTED'
              ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200'
              : 'border-green-400 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-900/40 dark:text-green-200'
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
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-yellow-900 transition-colors dark:border-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-100">
          <h2 className="mb-2 font-semibold text-slate-900 dark:text-yellow-100">{t('driverInvoice.overrides.title')}</h2>
          <ul className="space-y-1 list-disc pl-5 text-sm">
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
      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:gap-5 md:flex-row">
          <label className="flex flex-1 flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('common.labels.customerName')}</span>
            <input
              id="invoice-customer-name"
              type="text"
              placeholder={t('driverInvoice.form.customerNamePlaceholder')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-1 flex-col text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('common.labels.customerPhone')}</span>
            <input
              id="invoice-customer-phone"
              type="text"
              placeholder={t('driverInvoice.form.customerPhonePlaceholder')}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
        {/* Line Items */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t('driverInvoice.form.itemsTitle')}
          </h2>
          <div className="md:hidden">
            {items.length > 0 ? (
              <ul className="space-y-4">
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
                  const unitIcon = isUnitType(item.unit) ? unitIconMap[item.unit] : null;
                  const unitIconAlt = unitIcon ? `${t(unitIcon.labelKey)} icon` : '';
                  const classificationInputId = `invoice-item-${item.id}-classification`;
                  const quantityInputId = `invoice-item-${item.id}-quantity`;
                  const unitInputId = `invoice-item-${item.id}-unit`;

                  return (
                    <li
                      key={item.id}
                      className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {t('driverInvoice.form.totalHeader')}
                        </span>
                        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrencyValue(item.line_total)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-3">
                        <label htmlFor={classificationInputId} className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('driverInvoice.form.classificationHeader')}
                          </span>
                          <div className="flex items-center gap-2">
                            {unitIcon ? (
                              <img
                                src={unitIcon.src}
                                alt={unitIconAlt}
                                loading="lazy"
                                className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
                              />
                            ) : null}
                            <select
                              id={classificationInputId}
                              className="flex-1 rounded border border-slate-300 px-2 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              value={item.classification_id || ''}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  classification_id: e.target.value ? Number(e.target.value) : '',
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
                          </div>
                        </label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label htmlFor={quantityInputId} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {t('driverInvoice.form.quantityHeader')}
                            </span>
                            <input
                              id={quantityInputId}
                              type="number"
                              min={1}
                              className="w-full rounded border border-slate-300 px-2 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              value={item.qty}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  qty: Number(e.target.value) > 0 ? Number(e.target.value) : 0,
                                })
                              }
                              required
                              aria-label={quantityAriaLabel}
                            />
                          </label>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {t('driverInvoice.form.unitHeader')}
                            </span>
                            <select
                              id={unitInputId}
                              className="rounded border border-slate-300 px-2 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {t('driverInvoice.form.unitTooltipWithoutClassification')}
                              </div>
                            )}
                            {classificationId && priceEntry && (
                              <div className="space-y-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                <div className="flex items-center justify-between gap-2">
                                  <span>{t('common.labels.tray')}</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {formatCurrencyValue(trayPrice)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span>{t('common.labels.dozen')}</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {formatCurrencyValue(dozenPrice)}
                                  </span>
                                </div>
                                {latestPriceChange && (
                                  <div className={isRecentPriceChange ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}>
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
                              <div className="text-[11px] text-red-600 dark:text-red-400">
                                {t('driverInvoice.form.pricingUnavailable')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('driverInvoice.form.priceHeader')}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrencyValue(item.unit_price)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-xs font-medium text-red-600 transition hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                        >
                          {t('common.actions.remove')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t('driverInvoice.messages.addLineItemWarning')}
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('driverInvoice.form.classificationHeader')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('driverInvoice.form.quantityHeader')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('driverInvoice.form.unitHeader')}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                      {t('driverInvoice.form.priceHeader')}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                      {t('driverInvoice.form.totalHeader')}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                      {t('driverInvoice.form.actionsHeader')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
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
                    const unitIcon = isUnitType(item.unit) ? unitIconMap[item.unit] : null;
                    const unitIconAlt = unitIcon ? `${t(unitIcon.labelKey)} icon` : '';

                    return (
                      <tr key={item.id} className="align-top text-slate-900 dark:text-slate-100">
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-2">
                            {unitIcon ? (
                              <img
                                src={unitIcon.src}
                                alt={unitIconAlt}
                                loading="lazy"
                                className="h-9 w-9 shrink-0 object-contain lg:h-10 lg:w-10"
                              />
                            ) : null}
                            <select
                              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              value={item.classification_id || ''}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  classification_id: e.target.value ? Number(e.target.value) : '',
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
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="number"
                            min={1}
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-1 text-sm">
                            <select
                              className="rounded border border-slate-300 px-2 py-1 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                {t('driverInvoice.form.unitTooltipWithoutClassification')}
                              </div>
                            )}
                            {classificationId && priceEntry && (
                              <div className="mt-1 space-y-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                                <div className="flex items-center justify-between gap-2">
                                  <span>{t('common.labels.tray')}</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {formatCurrencyValue(trayPrice)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span>{t('common.labels.dozen')}</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {formatCurrencyValue(dozenPrice)}
                                  </span>
                                </div>
                                {latestPriceChange && (
                                  <div className={isRecentPriceChange ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}>
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
                              <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                                {t('driverInvoice.form.pricingUnavailable')}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrencyValue(item.unit_price)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrencyValue(item.line_total)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-xs font-medium text-red-600 transition hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                          >
                            {t('common.actions.remove')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Verified layouts at 360px, 768px, and 1280px viewports. Extremely narrow screens (<340px) may still require horizontal scrolling for action labels. */}
          <button
            type="button"
            onClick={addItem}
            className="mt-2 rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
          >
            {t('common.actions.addItem')}
          </button>
        </div>
        {/* Total */}
        <div className="text-right text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t('driverInvoice.form.totalLabel')} {formatCurrencyValue(total)}
        </div>
        {/* Signature */}
        <div>
          <h2 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('common.labels.signature')}</h2>
          <SignaturePad onChange={setSignatureDataUrl} />
        </div>
        <button
          type="submit"
          className="rounded bg-green-600 px-4 py-2 text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
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