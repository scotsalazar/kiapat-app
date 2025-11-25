import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Classification, InvoiceItemForm, Price } from '../types/invoice';

const TAX_RATE = 0.12;

interface InvoicePreviewModalProps {
  isOpen: boolean;
  items: InvoiceItemForm[];
  classifications: Classification[];
  prices: Price[];
  signatureDataUrl: string;
  validationWarnings: string[];
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onUpdateItem: (id: number, updates: Partial<InvoiceItemForm>) => void;
  onRemoveItem: (id: number) => void;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  items,
  classifications,
  prices,
  signatureDataUrl,
  validationWarnings,
  isSubmitting,
  onClose,
  onConfirm,
  onUpdateItem,
  onRemoveItem,
}) => {
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) {
      setEditingItemId(null);
    }
  }, [isOpen]);

  const lineItems = useMemo(() => {
    return items.map((item) => {
      const classification = classifications.find((c) => c.id === item.classification_id);
      const price = prices.find(
        (p) =>
          p.classification_id === item.classification_id &&
          p.unit.toLowerCase() === item.unit.toLowerCase(),
      );
      const unitPrice = item.unit_price ?? undefined;
      const lineTotal =
        item.line_total ??
        (unitPrice !== undefined ? unitPrice * (item.qty || 0) : undefined);
      return {
        ...item,
        classificationLabel: classification
          ? `${classification.size} / ${classification.color}`
          : t('invoicePreview.unclassified'),
        unitPrice,
        lineTotal,
        hasRealTimePrice: !item.isManualPrice && Boolean(price),
      };
    });
  }, [classifications, items, prices, t]);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0),
    [lineItems],
  );
  const taxes = subtotal * TAX_RATE;
  const total = subtotal + taxes;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6">
      <div className="relative max-h-full w-full max-w-4xl overflow-y-auto rounded-xl bg-white text-slate-900 shadow-xl transition-colors dark:bg-slate-950 dark:text-slate-100 dark:shadow-slate-950/60">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('invoicePreview.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900/60 dark:focus:ring-offset-slate-950"
          >
            {t('invoicePreview.close')}
          </button>
        </div>
        <div className="space-y-6 px-6 py-4">
          {validationWarnings.length > 0 && (
            <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 transition-colors dark:border-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-100">
              <h3 className="font-semibold">{t('invoicePreview.reviewHeading')}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('invoicePreview.lineItemsHeading')}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 text-sm dark:divide-slate-700 dark:border-slate-800">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">{t('invoicePreview.table.classification')}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t('invoicePreview.table.quantity')}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t('invoicePreview.table.unit')}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t('invoicePreview.table.unitPrice')}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t('invoicePreview.table.lineTotal')}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t('invoicePreview.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-950">
                  {lineItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                        {t('invoicePreview.noItems')}
                      </td>
                    </tr>
                  )}
                  {lineItems.map((item) => (
                    <tr key={item.id} className="bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
                      <td className="px-3 py-2">
                        {editingItemId === item.id ? (
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            value={item.classification_id}
                            onChange={(e) =>
                              onUpdateItem(item.id, {
                                classification_id: e.target.value
                                  ? Number(e.target.value)
                                  : '',
                              })
                            }
                          >
                            <option value="" disabled>
                              {t('invoicePreview.selectPlaceholder')}
                            </option>
                            {classifications.map((classification) => (
                              <option key={classification.id} value={classification.id}>
                                {classification.size} / {classification.color}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {item.classificationLabel || t('invoicePreview.unclassified')}
                            </div>
                            {!item.hasRealTimePrice && !item.isManualPrice && (
                              <div className="text-xs text-yellow-600 dark:text-yellow-300">
                                {t('invoicePreview.priceUnavailable')}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editingItemId === item.id ? (
                          <input
                            type="number"
                            min={1}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            value={item.qty}
                            onChange={(e) =>
                              onUpdateItem(item.id, {
                                qty: Number(e.target.value),
                              })
                            }
                          />
                        ) : (
                          item.qty
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editingItemId === item.id ? (
                          <select
                            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            value={item.unit}
                            onChange={(e) =>
                              onUpdateItem(item.id, {
                                unit: e.target.value,
                              })
                            }
                          >
                            <option value="TRAY">{t('common.labels.tray')}</option>
                            <option value="DOZEN">{t('common.labels.dozen')}</option>
                            <option value="PCS">{t('common.labels.pcs')}</option>
                          </select>
                        ) : (
                          item.unit
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                        {item.unitPrice !== undefined
                          ? `₱${item.unitPrice.toFixed(2)}`
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {item.lineTotal !== undefined
                          ? `₱${item.lineTotal.toFixed(2)}`
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-slate-700 dark:text-slate-200">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingItemId((current) =>
                                current === item.id ? null : item.id,
                              )
                            }
                            className="rounded border border-indigo-200 px-2 py-1 text-indigo-600 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/20 dark:focus:ring-offset-slate-950"
                          >
                            {editingItemId === item.id
                              ? t('invoicePreview.done')
                              : t('invoicePreview.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="rounded border border-red-200 px-2 py-1 text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10 dark:focus:ring-offset-slate-950"
                          >
                            {t('invoicePreview.remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('invoicePreview.signatureHeading')}</h3>
              {signatureDataUrl ? (
                <img
                  src={signatureDataUrl}
                  alt={t('invoicePreview.signatureAlt')}
                  className="h-40 w-full max-w-sm rounded border border-slate-200 object-contain dark:border-slate-700"
                />
              ) : (
                <div className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t('invoicePreview.noSignature')}
                </div>
              )}
            </div>
            <div className="space-y-2 rounded border border-slate-200 bg-slate-100 p-4 transition-colors dark:border-slate-800 dark:bg-slate-900/70">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('invoicePreview.summaryHeading')}</h3>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>{t('invoicePreview.subtotal')}</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>{t('invoicePreview.taxes', { rate: (TAX_RATE * 100).toFixed(0) })}</span>
                <span>₱{taxes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-slate-900 dark:text-slate-100">
                <span>{t('invoicePreview.total')}</span>
                <span>₱{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-100 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
          >
            {t('invoicePreview.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:bg-green-300 dark:focus:ring-offset-slate-950"
            disabled={
              validationWarnings.length > 0 || lineItems.length === 0 || isSubmitting
            }
          >
            {isSubmitting
              ? t('invoicePreview.submitting')
              : t('invoicePreview.confirmSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
