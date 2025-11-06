import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { z } from 'zod';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';

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

interface InventoryUpdateMessage {
  type: 'inventory_update';
  summary?: { timestamp: string; cards: InventoryCard[] };
  movements?: Movement[];
  prices?: PriceUpdate[];
}

const movementSchema = z.object({
  classification_id: z.number().int().positive('Select a classification'),
  qty: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Enter a quantity greater than 0'),
  unit: z.enum(['TRAY', 'DOZEN', 'PCS'] as const),
});

type MovementForm = z.infer<typeof movementSchema>;

const InventoryManagerPage: React.FC = () => {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<{ timestamp: string; cards: InventoryCard[] } | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [selectedCls, setSelectedCls] = useState<number | ''>('');
  const [qty, setQty] = useState<number>(0);
  const [unit, setUnit] = useState<MovementForm['unit']>('TRAY');
  const [message, setMessage] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof MovementForm, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastDraftPayload, setLastDraftPayload] = useState<MovementForm | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'verify' | 'commit'; id: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoadingError(null);
    try {
      const [summaryRes, movementsRes, clsRes] = await Promise.all([
        axios.get('/api/inventory/summary', { headers: authHeader }),
        axios.get('/api/inventory/movements?limit=20', { headers: authHeader }),
        axios.get('/api/catalog/classifications', { headers: authHeader }),
      ]);
      setSummary(summaryRes.data);
      setMovements(movementsRes.data);
      setClassifications(clsRes.data);
    } catch (err: any) {
      console.error(err);
      setLoadingError(err.response?.data?.detail || 'Failed to load inventory data.');
    }
  }, [authHeader, token]);

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

  const submitDraft = useCallback(
    async (payload: MovementForm) => {
      setIsSubmitting(true);
      setApiError(null);
      try {
        await axios.post('/api/inventory/in/create', payload, { headers: authHeader });
        setMessage('Draft created');
        setQty(0);
        setSelectedCls('');
        setLastDraftPayload(null);
        await loadData();
      } catch (err: any) {
        console.error(err);
        setApiError(err.response?.data?.detail || 'Error creating movement');
        setLastDraftPayload(payload);
      } finally {
        setIsSubmitting(false);
      }
    },
    [authHeader, loadData],
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const rawPayload: MovementForm = {
      classification_id: typeof selectedCls === 'number' ? selectedCls : 0,
      qty,
      unit,
    };
    const result = movementSchema.safeParse(rawPayload);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setFormErrors({
        classification_id: fieldErrors.classification_id?.[0],
        qty: fieldErrors.qty?.[0],
        unit: fieldErrors.unit?.[0],
      });
      return;
    }
    setFormErrors({});
    await submitDraft(result.data);
  };

  const retrySubmitDraft = async () => {
    if (!lastDraftPayload) return;
    await submitDraft(lastDraftPayload);
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      const endpoint =
        pendingAction.type === 'verify' ? '/api/inventory/in/verify' : '/api/inventory/in/commit';
      await axios.post(endpoint, { movement_id: pendingAction.id }, { headers: authHeader });
      setMessage(
        pendingAction.type === 'verify' ? 'Movement verified successfully' : 'Movement committed successfully',
      );
      setPendingAction(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setActionError(
        err.response?.data?.detail ||
          (pendingAction.type === 'verify' ? 'Failed to verify movement' : 'Failed to commit movement'),
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const closePendingAction = () => {
    if (isActionLoading) return;
    setPendingAction(null);
    setActionError(null);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kiapat Inventory</h1>
        <div>{new Date(summary?.timestamp || '').toLocaleString()}</div>
      </div>
      {message && <p className="mt-2 text-green-600">{message}</p>}
      {loadingError && (
        <div className="mt-4 flex items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{loadingError}</span>
          <button type="button" className="font-semibold underline" onClick={() => loadData()}>
            Retry
          </button>
        </div>
      )}
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
          <div className="flex w-full flex-col sm:w-auto">
            <select
              className="border rounded px-3 py-2"
              value={selectedCls === '' ? '' : selectedCls}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedCls(value ? Number(value) : '');
                setFormErrors((prev) => ({ ...prev, classification_id: undefined }));
              }}
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
            {formErrors.classification_id && (
              <p className="mt-1 text-sm text-red-600">{formErrors.classification_id}</p>
            )}
          </div>
          <div className="flex w-full flex-col sm:w-auto">
            <input
              type="number"
              className="border rounded px-3 py-2"
              min={1}
              value={qty > 0 ? qty : ''}
              onChange={(e) => {
                const value = Number(e.target.value);
                setQty(Number.isFinite(value) ? value : 0);
                setFormErrors((prev) => ({ ...prev, qty: undefined }));
              }}
              placeholder="Quantity"
              required
            />
            {formErrors.qty && <p className="mt-1 text-sm text-red-600">{formErrors.qty}</p>}
          </div>
          <select
            className="border rounded px-3 py-2"
            value={unit}
            onChange={(e) => setUnit(e.target.value as MovementForm['unit'])}
          >
            <option value="TRAY">Tray</option>
            <option value="DOZEN">Dozen</option>
            <option value="PCS">Pcs</option>
          </select>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting…' : 'Add Draft'}
          </button>
        </form>
        {apiError && (
          <div className="mt-3 flex flex-col gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:flex-row sm:items-center">
            <span>{apiError}</span>
            {lastDraftPayload && (
              <button type="button" className="font-semibold underline" onClick={retrySubmitDraft}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>
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
                      onClick={() => {
                        setPendingAction({ type: 'verify', id: m.id });
                        setActionError(null);
                      }}
                      className="px-2 py-1 bg-yellow-500 text-white rounded"
                    >
                      Verify
                    </button>
                  )}
                  {m.status === 'VERIFIED' && (
                    <button
                      onClick={() => {
                        setPendingAction({ type: 'commit', id: m.id });
                        setActionError(null);
                      }}
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
      <ConfirmationModal
        open={!!pendingAction}
        title={pendingAction?.type === 'verify' ? 'Verify inventory movement?' : 'Commit inventory movement?'}
        description={
          pendingAction?.type === 'verify'
            ? 'Please confirm that the selected draft movement has been reviewed. This action will mark it as verified.'
            : 'Committing will update the on-hand inventory balances for this movement. Ensure the quantities are correct before continuing.'
        }
        confirmLabel={pendingAction?.type === 'verify' ? 'Verify' : 'Commit'}
        cancelLabel="Cancel"
        onCancel={closePendingAction}
        onConfirm={confirmPendingAction}
        loading={isActionLoading}
        errorMessage={actionError}
      />
    </div>
  );
};

export default InventoryManagerPage;