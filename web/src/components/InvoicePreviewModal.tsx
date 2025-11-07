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
      const unitPrice = price?.price_per_unit ?? item.unit_price ?? 0;
      const lineTotal = unitPrice * (item.qty || 0);
      return {
        ...item,
        classificationLabel: classification
          ? `${classification.size} / ${classification.color}`
          : 'Unclassified',
        unitPrice,
        lineTotal,
        hasRealTimePrice: Boolean(price),
      };
    });
  }, [classifications, items, prices]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4 py-6">
      <div className="relative max-h-full w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold">{t('invoicePreview.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-transparent px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            {t('invoicePreview.close')}
          </button>
        </div>
        <div className="space-y-6 px-6 py-4">
          {validationWarnings.length > 0 && (
            <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              <h3 className="font-semibold">{t('invoicePreview.reviewHeading')}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold">{t('invoicePreview.lineItemsHeading')}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('invoicePreview.table.classification')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('invoicePreview.table.quantity')}</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">{t('invoicePreview.table.unit')}</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">{t('invoicePreview.table.unitPrice')}</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">{t('invoicePreview.table.lineTotal')}</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">{t('invoicePreview.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lineItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                        {t('invoicePreview.noItems')}
                      </td>
                    </tr>
                  )}
                  {lineItems.map((item) => (
                    <tr key={item.id} className="bg-white">
                      <td className="px-3 py-2">
                        {editingItemId === item.id ? (
                          <select
                            className="w-full rounded border px-2 py-1"
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
                            <div>{item.classificationLabel || t('invoicePreview.unclassified')}</div>
                            {!item.hasRealTimePrice && (
                              <div className="text-xs text-yellow-600">
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
                            className="w-24 rounded border px-2 py-1"
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
                            className="w-28 rounded border px-2 py-1"
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
                      <td className="px-3 py-2 text-right">
                        {item.unitPrice ? `₱${item.unitPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.lineTotal ? `₱${item.lineTotal.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingItemId((current) =>
                                current === item.id ? null : item.id,
                              )
                            }
                            className="rounded border border-indigo-200 px-2 py-1 text-indigo-600 hover:bg-indigo-50"
                          >
                            {editingItemId === item.id
                              ? t('invoicePreview.done')
                              : t('invoicePreview.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="rounded border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
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
              <h3 className="text-lg font-semibold">{t('invoicePreview.signatureHeading')}</h3>
              {signatureDataUrl ? (
                <img
                  src={signatureDataUrl}
                  alt={t('invoicePreview.signatureAlt')}
                  className="h-40 w-full max-w-sm rounded border object-contain"
                />
              ) : (
                <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  {t('invoicePreview.noSignature')}
                </div>
              )}
            </div>
            <div className="space-y-2 rounded border bg-gray-50 p-4">
              <h3 className="text-lg font-semibold">{t('invoicePreview.summaryHeading')}</h3>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('invoicePreview.subtotal')}</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('invoicePreview.taxes', { rate: (TAX_RATE * 100).toFixed(0) })}</span>
                <span>₱{taxes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-900">
                <span>{t('invoicePreview.total')}</span>
                <span>₱{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
          >
            {t('invoicePreview.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
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
