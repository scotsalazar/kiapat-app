import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import useInventoryStream, { InventoryUpdateMessage } from '../hooks/useInventoryStream';
import { formatDate, formatDateTime } from '../utils/dateTime';
import apiClient from '../api/axios';
import { isDemoMode } from '../utils/env';

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
  unit_price?: number | null;
  stock_value: number | null;
  threshold_pcs: number | null;
  is_low: boolean;
  price_per_dozen?: number | null;
  price_per_tray?: number | null;
  price_per_dozen_changed_at?: string | null;
  price_per_tray_changed_at?: string | null;
  price_updated_at?: string | null;
  unit_price_changed_at?: string | null;
}

interface InventoryTotals {
  qty_tray: number;
  qty_dozen: number;
  qty_pcs: number;
  stock_value: number | null;
}

interface InventorySummaryResponse {
  timestamp: string;
  totals: InventoryTotals;
  cards: InventoryCard[];
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

interface OverrideUserSummary {
  id: number;
  name: string;
  username: string;
}

interface OverrideInvoiceSummary {
  id: number;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  status: string;
  created_by: number;
  created_at: string;
  created_by_user?: OverrideUserSummary | null;
}

interface OverrideClassification {
  id: number;
  size: string;
  color: string;
}

interface PendingOverride {
  id: number;
  invoice_id: number;
  classification_id: number;
  requested_qty_pcs: number;
  requested_unit: string;
  available_qty_pcs: number;
  status: string;
  created_at: string;
  decision_reason?: string | null;
  invoice?: OverrideInvoiceSummary;
  classification?: OverrideClassification;
}

interface DailySalesSummary {
  date: string;
  total_amount: number;
  eggs_sold_pcs: number;
  invoice_count: number;
}

type InventoryStreamState = {
  summary: InventorySummaryResponse | null;
  movements: Movement[];
};

const createDemoInventorySummary = (): InventorySummaryResponse => {
  const now = new Date();
  const cards: InventoryCard[] = [
    {
      classification_id: 1,
      size: 'MEDIUM',
      color: 'BROWN',
      qty_tray: 140,
      qty_dozen: 420,
      qty_pcs: 5040,
      unit_price: 155,
      stock_value: 781200,
      threshold_pcs: 3500,
      is_low: false,
      price_per_dozen: 180,
      price_per_tray: 2160,
      price_per_dozen_changed_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      price_per_tray_changed_at: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
      price_updated_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      unit_price_changed_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ];
  cards.push(
    {
      classification_id: 2,
      size: 'LARGE',
      color: 'WHITE',
      qty_tray: 60,
      qty_dozen: 180,
      qty_pcs: 2160,
      unit_price: 170,
      stock_value: 367200,
      threshold_pcs: 2500,
      is_low: true,
      price_per_dozen: 195,
      price_per_tray: 2340,
      price_per_dozen_changed_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      price_per_tray_changed_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      price_updated_at: null,
      unit_price_changed_at: null,
    },
    {
      classification_id: 3,
      size: 'SMALL',
      color: 'WHITE',
      qty_tray: 200,
      qty_dozen: 400,
      qty_pcs: 4800,
      unit_price: 120,
      stock_value: 576000,
      threshold_pcs: 3000,
      is_low: false,
      price_per_dozen: 135,
      price_per_tray: 1620,
      price_per_dozen_changed_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      price_per_tray_changed_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      price_updated_at: null,
      unit_price_changed_at: null,
    },
  );

  const totals = cards.reduce<InventoryTotals>(
    (acc, card) => ({
      qty_tray: acc.qty_tray + card.qty_tray,
      qty_dozen: acc.qty_dozen + card.qty_dozen,
      qty_pcs: acc.qty_pcs + card.qty_pcs,
      stock_value: (acc.stock_value ?? 0) + (card.stock_value ?? 0),
    }),
    { qty_tray: 0, qty_dozen: 0, qty_pcs: 0, stock_value: 0 },
  );

  return {
    timestamp: now.toISOString(),
    totals,
    cards,
  };
};

const createDemoMovements = (): Movement[] => {
  const now = Date.now();
  return [
    {
      id: 5001,
      type: 'IN',
      classification_id: 1,
      qty_pcs: 720,
      unit_entered: 'TRAY',
      qty_entered: 24,
      by_user_id: 12,
      status: 'COMMITTED',
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      committed_at: new Date(now - 90 * 60 * 1000).toISOString(),
    },
    {
      id: 5002,
      type: 'OUT',
      classification_id: 2,
      qty_pcs: 360,
      unit_entered: 'DOZEN',
      qty_entered: 30,
      by_user_id: 18,
      status: 'VERIFIED',
      created_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      committed_at: null,
    },
    {
      id: 5003,
      type: 'IN',
      classification_id: 3,
      qty_pcs: 1200,
      unit_entered: 'PCS',
      qty_entered: 1200,
      by_user_id: 14,
      status: 'DRAFT',
      created_at: new Date(now - 30 * 60 * 1000).toISOString(),
      committed_at: null,
    },
  ];
};

const createDemoClassificationsFromSummary = (
  summary: InventorySummaryResponse,
): Classification[] =>
  summary.cards.map((card) => ({
    id: card.classification_id,
    size: card.size,
    color: card.color,
  }));

const createDemoPendingOverrides = (): PendingOverride[] => {
  const createdAt = new Date();
  createdAt.setHours(createdAt.getHours() - 5);
  return [
    {
      id: 9100,
      invoice_id: 7801,
      classification_id: 2,
      requested_qty_pcs: 300,
      requested_unit: 'DOZEN',
      available_qty_pcs: 240,
      status: 'PENDING',
      created_at: createdAt.toISOString(),
      decision_reason: null,
      invoice: {
        id: 7801,
        customer_name: 'Mercado Deli',
        customer_phone: '0917 123 4567',
        total_amount: 15840,
        status: 'PENDING_OVERRIDE',
        created_by: 18,
        created_at: createdAt.toISOString(),
        created_by_user: {
          id: 18,
          name: 'Ivy Driver',
          username: 'ivy.driver',
        },
      },
      classification: {
        id: 2,
        size: 'LARGE',
        color: 'WHITE',
      },
    },
  ];
};

const createDemoDailySales = (): DailySalesSummary[] => {
  const days = 7;
  const today = new Date();
  const entries: DailySalesSummary[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const index = days - 1 - offset;
    entries.push({
      date: date.toISOString().split('T')[0],
      total_amount: 12000 + index * 650,
      eggs_sold_pcs: 2400 + index * 120,
      invoice_count: 18 + index * 2,
    });
  }
  return entries;
};

const RECENT_PRICE_CHANGE_WINDOW_MS = 1000 * 60 * 60 * 48; // 48 hours
const SIZE_RANK: Record<string, number> = {
  SMALL: 0,
  MEDIUM: 1,
  LARGE: 2,
};

const COLOR_RANK: Record<string, number> = {
  WHITE: 0,
  BROWN: 1,
};

const getSizeRank = (size: string) => SIZE_RANK[size] ?? Number.POSITIVE_INFINITY;
const getColorRank = (color: string) => COLOR_RANK[color] ?? Number.POSITIVE_INFINITY;

const compareInventoryCards = (a: InventoryCard, b: InventoryCard) => {
  const sizeDifference = getSizeRank(a.size) - getSizeRank(b.size);
  if (sizeDifference !== 0) {
    return sizeDifference;
  }

  const colorDifference = getColorRank(a.color) - getColorRank(b.color);
  if (colorDifference !== 0) {
    return colorDifference;
  }

  return a.classification_id - b.classification_id;
};

const parseTimestamp = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const QuickEditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path
      d="M16.862 4.487a2.25 2.25 0 0 1 3.182 3.182l-9.75 9.75a4.5 4.5 0 0 1-1.591 1.005l-3.068.878a.75.75 0 0 1-.927-.927l.878-3.068a4.5 4.5 0 0 1 1.005-1.591l9.75-9.75Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.75 8.25v7.5A2.25 2.25 0 0 1 16.5 18h-9A2.25 2.25 0 0 1 5.25 15.75v-9A2.25 2.25 0 0 1 7.5 4.5h7.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const getLatestPriceChangeTimestamp = (card: InventoryCard): Date | null => {
  const timestamps = [
    parseTimestamp(card.price_per_dozen_changed_at),
    parseTimestamp(card.price_per_tray_changed_at),
    parseTimestamp(card.price_updated_at),
    parseTimestamp(card.unit_price_changed_at),
  ].filter(Boolean) as Date[];

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps.map((timestamp) => timestamp.getTime())));
};

const InventoryManagerPage: React.FC = () => {
  const { token, user } = useAuth();
  const demoMode = isDemoMode();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const [initialSummary, setInitialSummary] =
    useState<InventorySummaryResponse | null>(null);
  const [initialMovements, setInitialMovements] = useState<Movement[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [selectedCls, setSelectedCls] = useState<number | ''>('');
  const [qty, setQty] = useState<number>(0);
  const [unit, setUnit] = useState<string>('TRAY');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [pendingOverrides, setPendingOverrides] = useState<PendingOverride[]>([]);
  const [dailySales, setDailySales] = useState<DailySalesSummary[]>([]);
  const [thresholdEdits, setThresholdEdits] = useState<Record<number, number | ''>>({});
  const [thresholdSaving, setThresholdSaving] = useState<Record<number, boolean>>({});
  const thresholdInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const paramsSnapshotRef = useRef<string>(searchParams.toString());
  const [sizeFilter, setSizeFilter] = useState<string>(() => searchParams.get('size') ?? '');
  const [colorFilter, setColorFilter] = useState<string>(() => searchParams.get('color') ?? '');
  const [searchTerm, setSearchTerm] = useState<string>(() => searchParams.get('q') ?? '');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(() => {
    const raw = searchParams.get('low');
    if (!raw) return false;
    return ['1', 'true', 'yes'].includes(raw.toLowerCase());
  });

  const { showToast } = useToast();
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
    [],
  );
  const demoBannerMessage = useMemo(
    () =>
      t('inventory.demoMode.banner', {
        defaultValue:
          'Demo mode is active. Data is mocked locally and API calls are disabled.',
      }),
    [t],
  );
  const demoActionDisabledMessage = useMemo(
    () =>
      t('inventory.demoMode.actionDisabled', {
        defaultValue: 'This action is disabled in demo mode.',
      }),
    [t],
  );
  const demoSimulatedMessage = useMemo(
    () =>
      t('inventory.demoMode.simulated', {
        defaultValue: 'Changes are simulated for the presentation.',
      }),
    [t],
  );

  useEffect(() => {
    const paramsString = searchParams.toString();
    if (paramsString === paramsSnapshotRef.current) {
      return;
    }
    paramsSnapshotRef.current = paramsString;
    const paramSize = searchParams.get('size') ?? '';
    const paramColor = searchParams.get('color') ?? '';
    const paramSearch = searchParams.get('q') ?? '';
    const paramLowRaw = searchParams.get('low');
    const paramLow = paramLowRaw
      ? ['1', 'true', 'yes'].includes(paramLowRaw.toLowerCase())
      : false;
    if (paramSize !== sizeFilter) {
      setSizeFilter(paramSize);
    }
    if (paramColor !== colorFilter) {
      setColorFilter(paramColor);
    }
    if (paramSearch !== searchTerm) {
      setSearchTerm(paramSearch);
    }
    if (paramLow !== lowStockOnly) {
      setLowStockOnly(paramLow);
    }
  }, [searchParams, sizeFilter, colorFilter, searchTerm, lowStockOnly]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (sizeFilter) {
      params.set('size', sizeFilter);
    }
    if (colorFilter) {
      params.set('color', colorFilter);
    }
    if (searchTerm) {
      params.set('q', searchTerm);
    }
    if (lowStockOnly) {
      params.set('low', '1');
    }
    const nextSnapshot = params.toString();
    if (nextSnapshot === paramsSnapshotRef.current) {
      return;
    }
    paramsSnapshotRef.current = nextSnapshot;
    if (nextSnapshot) {
      setSearchParams(params, { replace: true });
    } else {
      setSearchParams(new URLSearchParams(), { replace: true });
    }
  }, [sizeFilter, colorFilter, searchTerm, lowStockOnly, setSearchParams]);

  const formatCurrencyValue = useCallback(
    (value: number | null | undefined) =>
      value !== null && value !== undefined
        ? currencyFormatter.format(value)
        : t('common.notAvailable'),
    [currencyFormatter, t],
  );

  const recentSalesEntry = useMemo(() => {
    if (!dailySales.length) return null;
    return dailySales[dailySales.length - 1];
  }, [dailySales]);

  const inventoryInitialData = useMemo<InventoryStreamState>(
    () => ({
      summary: initialSummary,
      movements: initialMovements,
    }),
    [initialSummary, initialMovements],
  );

  const mergeInventoryUpdate = useCallback(
    (
      current: InventoryStreamState,
      message: InventoryUpdateMessage<
        InventorySummaryResponse | null,
        Movement[] | undefined
      >,
    ): InventoryStreamState => {
      if (message.type !== 'inventory_update') {
        return current;
      }
      return {
        summary: message.summary ?? current.summary,
        movements: message.movements ?? current.movements,
      };
    },
    [],
  );

  const { data: inventoryData, status: streamStatus, error: streamError } =
    useInventoryStream<
      InventoryStreamState,
      InventoryUpdateMessage<InventorySummaryResponse | null, Movement[] | undefined>
    >({
      token: demoMode ? undefined : token,
      initialData: inventoryInitialData,
      merge: mergeInventoryUpdate,
      enabled: !demoMode,
    });

  const summary = inventoryData.summary;
  const movements = inventoryData.movements ?? [];
  const latestMovementByClassification = useMemo(() => {
    const map = new Map<number, Date>();
    movements.forEach((movement) => {
      const committedAt = parseTimestamp(movement.committed_at);
      const createdAt = parseTimestamp(movement.created_at);
      const relevantTimestamp = committedAt ?? createdAt;
      if (!relevantTimestamp) {
        return;
      }
      const existing = map.get(movement.classification_id);
      if (!existing || relevantTimestamp.getTime() > existing.getTime()) {
        map.set(movement.classification_id, relevantTimestamp);
      }
    });
    return map;
  }, [movements]);
  const filteredCards = useMemo(() => {
    if (!summary) {
      return [] as InventoryCard[];
    }
    const tokens = searchTerm
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return summary.cards
      .filter((card) => {
        if (sizeFilter && card.size !== sizeFilter) {
          return false;
        }
        if (colorFilter && card.color !== colorFilter) {
          return false;
        }
        if (lowStockOnly && !card.is_low) {
          return false;
        }
        if (!tokens.length) {
          return true;
        }
        const label = `${card.size} ${card.color}`.toLowerCase();
        return tokens.every((token) => label.includes(token));
      })
      .sort(compareInventoryCards);
  }, [summary, sizeFilter, colorFilter, lowStockOnly, searchTerm]);

  const lowStockCount = useMemo(
    () => filteredCards.filter((card) => card.is_low).length,
    [filteredCards],
  );

  const totalCards = summary?.cards.length ?? 0;
  const hasActiveFilters = Boolean(sizeFilter || colorFilter || searchTerm.trim() || lowStockOnly);

  const sizeOptions = useMemo(() => {
    const unique = new Set<string>();
    classifications.forEach((cls) => unique.add(cls.size));
    return Array.from(unique).sort();
  }, [classifications]);

  const colorOptions = useMemo(() => {
    const unique = new Set<string>();
    classifications.forEach((cls) => unique.add(cls.color));
    return Array.from(unique).sort();
  }, [classifications]);

  const formatFilterLabel = useCallback((value: string) => {
    if (!value) return '';
    return value.charAt(0) + value.slice(1).toLowerCase();
  }, []);

  const filteredTotals = useMemo(() => {
    if (!filteredCards.length) {
      return null;
    }
    let totalTray = 0;
    let totalDozen = 0;
    let totalPcs = 0;
    let totalStockValue = 0;
    let hasStockValue = false;
    filteredCards.forEach((card) => {
      totalTray += card.qty_tray;
      totalDozen += card.qty_dozen;
      totalPcs += card.qty_pcs;
      if (card.stock_value !== null && card.stock_value !== undefined) {
        totalStockValue += card.stock_value;
        hasStockValue = true;
      }
    });
    return {
      qty_tray: totalTray,
      qty_dozen: totalDozen,
      qty_pcs: totalPcs,
      stock_value: hasStockValue ? totalStockValue : null,
    };
  }, [filteredCards]);

  const handleClearFilters = useCallback(() => {
    setSizeFilter('');
    setColorFilter('');
    setSearchTerm('');
    setLowStockOnly(false);
  }, []);

  const handleQuickEditPricing = useCallback((classificationId: number) => {
    window.dispatchEvent(
      new CustomEvent('inventory:quick-edit-pricing', { detail: { classificationId } }),
    );
  }, []);

  const handleQuickEditThreshold = useCallback(
    (classificationId: number) => {
      const input = thresholdInputRefs.current[classificationId];
      if (input) {
        input.focus();
        if (typeof input.select === 'function') {
          input.select();
        }
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.dispatchEvent(
        new CustomEvent('inventory:quick-edit-threshold', { detail: { classificationId } }),
      );
    },
    [],
  );

  const streamStatusMeta = useMemo(() => {
    if (demoMode) {
      return {
        label: t('inventory.demoMode.streamStatus', {
          defaultValue: 'Demo data',
        }),
        dotClass: 'bg-blue-500',
        textClass: 'text-blue-600 dark:text-blue-300',
      };
    }
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
  }, [demoMode, streamStatus, t]);

  const loadData = useCallback(async () => {
    if (demoMode) {
      const summary = createDemoInventorySummary();
      setInitialSummary(summary);
      setInitialMovements(createDemoMovements());
      setClassifications(createDemoClassificationsFromSummary(summary));
      if (user?.role === 'admin') {
        setPendingOverrides(createDemoPendingOverrides());
        setDailySales(createDemoDailySales());
      } else {
        setPendingOverrides([]);
        setDailySales([]);
      }
      return;
    }
    if (!token) return;
    try {
      const summaryParams: Record<string, string> = {};
      if (sizeFilter) {
        summaryParams.size = sizeFilter;
      }
      if (colorFilter) {
        summaryParams.color = colorFilter;
      }
      if (lowStockOnly) {
        summaryParams.low_stock = 'true';
      }
      const [summaryRes, movementsRes, clsRes] = await Promise.all([
        apiClient.get<InventorySummaryResponse>('/api/inventory/summary', {
          params: summaryParams,
        }),
        apiClient.get<Movement[]>('/api/inventory/movements?limit=20'),
        apiClient.get<Classification[]>('/api/catalog/classifications'),
      ]);
      setInitialSummary(summaryRes.data);
      setInitialMovements(movementsRes.data);
      setClassifications(clsRes.data);
      if (user?.role === 'admin') {
        const [overridesRes, salesRes] = await Promise.all([
          apiClient.get<PendingOverride[]>('/api/sales/invoices/overrides/pending'),
          apiClient.get<DailySalesSummary[]>('/api/reports/daily-sales', {
            params: (() => {
              const end = new Date();
              const start = new Date(end);
              start.setDate(end.getDate() - 6);
              return {
                start_date: start.toISOString(),
                end_date: end.toISOString(),
              };
            })(),
          }),
        ]);
        setPendingOverrides(overridesRes.data);
        setDailySales(salesRes.data);
      } else {
        setPendingOverrides([]);
        setDailySales([]);
      }
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.load'));
      showToast(message, 'error');
    }
  }, [
    demoMode,
    showToast,
    token,
    user?.role,
    sizeFilter,
    colorFilter,
    lowStockOnly,
    t,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!summary) return;
    setThresholdEdits(
      summary.cards.reduce((acc, card) => {
        acc[card.classification_id] = card.threshold_pcs ?? '';
        return acc;
      }, {} as Record<number, number | ''>),
    );
  }, [summary]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCls || qty <= 0) return;
    setFormError('');
    setSuccessMessage('');
    if (demoMode) {
      setQty(0);
      setSelectedCls('');
      const message = t('inventory.demoMode.draftCreated', {
        defaultValue: 'Inventory draft simulated for demo mode.',
      });
      setSuccessMessage(message);
      showToast(demoSimulatedMessage, 'info');
      return;
    }
    try {
      await apiClient.post('/api/inventory/in/create', {
        classification_id: selectedCls,
        qty: qty,
        unit,
      });
      const draftMessage = t('inventory.messages.draftCreated');
      setSuccessMessage(draftMessage);
      showToast(t('inventory.messages.inventoryDraftCreated'), 'success');
      setQty(0);
      setSelectedCls('');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.create'));
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const handleThresholdInputChange = (classificationId: number, rawValue: string) => {
    if (rawValue === '') {
      setThresholdEdits((prev) => ({ ...prev, [classificationId]: '' }));
      return;
    }
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return;
    }
    setThresholdEdits((prev) => ({ ...prev, [classificationId]: parsed }));
  };

  const handleSaveThreshold = async (classificationId: number) => {
    const value = thresholdEdits[classificationId];
    const thresholdValue = value === '' || value === undefined ? 0 : value;
    setThresholdSaving((prev) => ({ ...prev, [classificationId]: true }));
    if (demoMode) {
      const message = t('inventory.demoMode.thresholdUpdated', {
        defaultValue: 'Threshold updated locally for demo mode.',
      });
      setSuccessMessage(message);
      showToast(demoSimulatedMessage, 'info');
      setThresholdSaving((prev) => ({ ...prev, [classificationId]: false }));
      return;
    }
    try {
      await apiClient.put('/api/inventory/thresholds', {
        thresholds: [{ classification_id: classificationId, threshold_pcs: thresholdValue }],
      });
      showToast(t('inventory.messages.thresholdUpdated'), 'success');
      await loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.updateThreshold'));
      showToast(message, 'error');
    } finally {
      setThresholdSaving((prev) => ({ ...prev, [classificationId]: false }));
    }
  };

  const handleVerify = async (id: number) => {
    if (demoMode) {
      showToast(demoActionDisabledMessage, 'info');
      return;
    }
    try {
      await apiClient.post('/api/inventory/in/verify', { movement_id: id });
      showToast(t('inventory.messages.movementVerified'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.verify'));
      showToast(message, 'error');
    }
  };

  const handleCommit = async (id: number) => {
    if (demoMode) {
      showToast(demoActionDisabledMessage, 'info');
      return;
    }
    try {
      await apiClient.post('/api/inventory/in/commit', { movement_id: id });
      showToast(t('inventory.messages.movementCommitted'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.commit'));
      showToast(message, 'error');
    }
  };

  const handleApproveOverride = async (invoiceId: number) => {
    if (demoMode) {
      showToast(demoActionDisabledMessage, 'info');
      return;
    }
    try {
      const note = window.prompt(t('common.prompts.approvalNote'), '');
      await apiClient.post(
        `/api/sales/invoices/${invoiceId}/override/approve`,
        note ? { decision_reason: note } : {},
      );
      setFormError('');
      setSuccessMessage(t('inventory.messages.overrideApproved'));
      showToast(t('inventory.messages.overrideApproved'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.approveOverride'));
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const handleRejectOverride = async (invoiceId: number) => {
    if (demoMode) {
      showToast(demoActionDisabledMessage, 'info');
      return;
    }
    try {
      const reason = window.prompt(t('common.prompts.rejectOverride'), '');
      await apiClient.post(
        `/api/sales/invoices/${invoiceId}/override/reject`,
        reason ? { decision_reason: reason } : {},
      );
      setFormError('');
      setSuccessMessage(t('inventory.messages.overrideRejected'));
      showToast(t('inventory.messages.overrideRejected'), 'success');
      loadData();
    } catch (err) {
      const { message } = parseApiError(err, t('inventory.errors.rejectOverride'));
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const lastUpdateLabel = summary ? formatDateTime(summary.timestamp) : '';
  const recentSalesDate = recentSalesEntry ? formatDate(recentSalesEntry.date) : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('inventory.title')}</h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/invoices/history')}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
            >
              {t('common.actions.viewInvoiceHistory')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800/80 dark:focus:ring-offset-slate-900"
            >
              {t('common.actions.manageUsers')}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-start text-sm sm:items-end">
          <div className={`flex items-center gap-2 ${streamStatusMeta.textClass} dark:text-slate-300`}>
            <span className={`h-2 w-2 rounded-full ${streamStatusMeta.dotClass}`} />
            <span className="text-slate-700 dark:text-slate-300">{streamStatusMeta.label}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {summary && lastUpdateLabel
              ? t('inventory.stream.lastUpdate', { value: lastUpdateLabel })
              : t('common.messages.awaitingInventory')}
          </div>
          {streamError && (
            <div className="mt-1 text-xs text-red-600 dark:text-red-400">{streamError}</div>
          )}
        </div>
      </div>
      {demoMode && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-100">
          {demoBannerMessage}
        </div>
      )}
      {successMessage && <p className="mt-2 text-green-600 dark:text-green-400">{successMessage}</p>}
      {formError && <p className="mt-2 text-red-600 dark:text-red-400">{formError}</p>}
      {summary && (
        <>
          <h2 className="mt-6 text-lg font-medium text-slate-700 dark:text-slate-200">
            {t('inventory.sections.overview', { defaultValue: 'Overview' })}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('inventory.cards.totalStock.title')}</h2>
            <p className="mt-2 text-xl font-bold text-blue-500 dark:text-blue-300">
              {t('inventory.filters.pieces', { value: summary.totals.qty_pcs.toLocaleString() })}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {t('inventory.filters.trays', { value: summary.totals.qty_tray.toFixed(1) })} •{' '}
              {t('inventory.filters.dozens', { value: summary.totals.qty_dozen.toFixed(1) })}
            </p>
            <p className="mt-2 text-sm uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t('inventory.cards.totalStock.lowStockCount', { count: lowStockCount })}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('inventory.cards.stockValue.title')}</h2>
            <p className="mt-2 text-xl font-bold text-blue-500 dark:text-blue-300">
              {summary.totals.stock_value !== null
                ? currencyFormatter.format(summary.totals.stock_value)
                : t('common.notAvailable')}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {t('inventory.cards.stockValue.description')}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('inventory.cards.recentSales.title')}</h2>
            {recentSalesEntry ? (
              <>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {currencyFormatter.format(recentSalesEntry.total_amount)}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {t('inventory.cards.recentSales.summary', {
                    date: recentSalesDate || t('common.notAvailable'),
                    pcs: recentSalesEntry.eggs_sold_pcs.toLocaleString(),
                    count: recentSalesEntry.invoice_count,
                  })}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">{t('inventory.cards.recentSales.none')}</p>
            )}
          </div>
          </div>
        </>
      )}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col">
            <label htmlFor="size-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {t('common.labels.size')}
            </label>
            <select
              id="size-filter"
              className="mt-1 w-40 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={sizeFilter}
              onChange={(event) => setSizeFilter(event.target.value)}
            >
              <option value="">{t('inventory.filters.allSizes')}</option>
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {formatFilterLabel(option)}
                </option>
              ))}
            </select>
          </div>
            <div className="flex flex-col">
            <label htmlFor="color-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {t('common.labels.color')}
            </label>
            <select
              id="color-filter"
              className="mt-1 w-40 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={colorFilter}
              onChange={(event) => setColorFilter(event.target.value)}
            >
              <option value="">{t('inventory.filters.allColors')}</option>
              {colorOptions.map((option) => (
                <option key={option} value={option}>
                  {formatFilterLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col">
            <label htmlFor="inventory-search" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {t('common.labels.search')}
            </label>
            <input
              id="inventory-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('common.labels.searchPlaceholder')}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
            {t('common.labels.lowStockOnly')}
          </label>
          <button
            type="button"
            className="ml-auto rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
          >
            {t('common.actions.clearFilters')}
          </button>
        </div>
        <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {hasActiveFilters ? (
            <span>
              {t('inventory.filters.showingFiltered', {
                count: filteredCards.length,
                total: totalCards,
              })}
              {filteredTotals && (
                <>
                  {' '}
                  {t('common.messages.inventoryTotalsPrefix')}{' '}
                  {t('inventory.filters.trays', { value: filteredTotals.qty_tray.toFixed(1) })} •{' '}
                  {t('inventory.filters.dozens', { value: filteredTotals.qty_dozen.toFixed(1) })} •{' '}
                  {t('inventory.filters.pieces', {
                    value: filteredTotals.qty_pcs.toLocaleString(),
                  })}
                  {filteredTotals.stock_value !== null
                    ? ` • ${t('inventory.stockValueLabel', {
                        value: currencyFormatter.format(filteredTotals.stock_value),
                      })}`
                    : ''}
                </>
              )}
            </span>
          ) : (
            <span>{t('inventory.filters.showingAll', { total: totalCards })}</span>
          )}
        </div>
      </div>
      {/* Inventory Cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {filteredCards.length === 0 ? (
          <div className="col-span-full rounded border border-dashed border-slate-300 bg-slate-100 p-8 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {t('inventory.filters.noMatches')}
          </div>
        ) : (
          filteredCards.map((card) => {
            const perDozenPrice = card.price_per_dozen ?? card.unit_price ?? null;
            const perTrayPrice = card.price_per_tray ?? null;
            const latestPriceChange = getLatestPriceChangeTimestamp(card);
            const isRecentPriceChange =
              !!latestPriceChange &&
              Date.now() - latestPriceChange.getTime() <= RECENT_PRICE_CHANGE_WINDOW_MS;
            const shouldShowPriceDetails =
              perDozenPrice !== null || perTrayPrice !== null || latestPriceChange !== null;
            const latestPriceChangeLabel = latestPriceChange ? formatDateTime(latestPriceChange) : '';
            const latestMovement = latestMovementByClassification.get(card.classification_id) ?? null;
            const relevantTimestamps = [latestPriceChange, latestMovement].filter(
              (value): value is Date => Boolean(value),
            );
            const latestActivity =
              relevantTimestamps.length > 0
                ? new Date(
                    Math.max(
                      ...relevantTimestamps.map((timestamp) => timestamp.getTime()),
                    ),
                  )
                : null;
            const lastUpdatedLabel = latestActivity ? formatDateTime(latestActivity) : '';
            const thresholdForProgress =
              card.threshold_pcs && card.threshold_pcs > 0
                ? card.threshold_pcs
                : Math.max(card.qty_pcs, 1);
            const progressRatio = Math.min(card.qty_pcs / thresholdForProgress, 1);
            const stockStatus = (() => {
              if (card.qty_pcs === 0) {
                return {
                  key: 'out-of-stock' as const,
                  label: 'Out of stock',
                  badge: '🔴',
                  badgeClasses:
                    'inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-200',
                  containerClasses:
                    'border-red-500 bg-red-50/40 ring-1 ring-red-300 dark:border-red-500 dark:bg-red-900/30',
                };
              }
              if (card.is_low) {
                return {
                  key: 'low-stock' as const,
                  label: 'Low stock',
                  badge: '🟠',
                  badgeClasses:
                    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-200',
                  containerClasses:
                    'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300 dark:border-amber-500 dark:bg-amber-900/30',
                };
              }
              return {
                key: 'sufficient' as const,
                label: 'Sufficient stock',
                badge: '🟢',
                badgeClasses:
                  'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
                containerClasses: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
              };
            })();

            return (
              <div
                key={card.classification_id}
                className={`relative rounded border p-4 shadow-sm transition-colors ${
                  stockStatus.containerClasses
                } ${card.qty_pcs === 0 ? 'opacity-60' : ''}`}
              >
              {isRecentPriceChange && (
                <span className="absolute -right-2 -top-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                  Price updated
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center">
                  <img
                    src={card.color === 'WHITE' ? '/white-egg.png' : '/brown-egg.png'}
                    alt="egg"
                    className="h-12 w-12 mr-3"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {card.size.charAt(0)}
                        {card.size.slice(1).toLowerCase()} / {card.color.charAt(0)}
                        {card.color.slice(1).toLowerCase()}
                      </h3>
                      <span
                        className="text-lg"
                        role="img"
                        aria-label={stockStatus.label}
                        title={stockStatus.label}
                      >
                        {stockStatus.badge}
                      </span>
                      {stockStatus.key !== 'sufficient' && (
                        <span className={stockStatus.badgeClasses}>{stockStatus.label}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {card.qty_tray.toFixed(1)} trays • {card.qty_dozen.toFixed(1)} dozens
                    </p>
                    <p
                      className="text-sm font-semibold text-emerald-600 dark:text-emerald-300"
                    >
                      {card.qty_pcs.toLocaleString()} pcs
                    </p>
                  </div>
                </div>
              </div>
              {shouldShowPriceDetails && (
                <div
                  className={`mt-3 space-y-1 rounded-md border p-3 text-sm ${
                    isRecentPriceChange
                      ? 'border-blue-200 bg-blue-50/70 dark:border-blue-400/60 dark:bg-blue-900/40'
                      : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="cursor-help text-slate-600 dark:text-slate-300"
                        title={t('inventory.tooltips.perTray')}
                      >
                        {t('common.labels.perTray')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {formatCurrencyValue(perTrayPrice)}
                        </span>
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleQuickEditPricing(card.classification_id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-indigo-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300 dark:focus:ring-offset-slate-900"
                            title={t('inventory.actions.quickEditPricing')}
                          >
                            <QuickEditIcon className="h-4 w-4" />
                            <span className="sr-only">{t('inventory.actions.quickEditPricing')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="cursor-help text-slate-600 dark:text-slate-300"
                        title={t('inventory.tooltips.perDozen')}
                      >
                        {t('common.labels.perDozen')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {formatCurrencyValue(perDozenPrice)}
                        </span>
                        {user?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleQuickEditPricing(card.classification_id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-indigo-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300 dark:focus:ring-offset-slate-900"
                            title={t('inventory.actions.quickEditPricing')}
                          >
                            <QuickEditIcon className="h-4 w-4" />
                            <span className="sr-only">{t('inventory.actions.quickEditPricing')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {latestPriceChange && (
                    <div
                      className={`pt-1 text-xs ${
                        isRecentPriceChange ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {latestPriceChangeLabel
                        ? t('inventory.pricing.updated', { value: latestPriceChangeLabel })
                        : null}
                    </div>
                  )}
                </div>
              )}
              {card.stock_value !== null && (
                <div className="mt-3 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex-1">
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max(0, Math.min(progressRatio, 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {t('inventory.stockValueLabel', {
                      value: currencyFormatter.format(card.stock_value),
                    })}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span>
                  <span
                    className="cursor-help"
                    title={t('inventory.tooltips.threshold')}
                  >
                    {t('inventory.threshold.label')}
                  </span>{' '}
                  {card.threshold_pcs !== null
                    ? t('inventory.filters.pieces', {
                        value: card.threshold_pcs.toLocaleString(),
                      })
                    : t('inventory.threshold.notSet')}
                </span>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleQuickEditThreshold(card.classification_id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-indigo-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300 dark:focus:ring-offset-slate-900"
                    title={t('inventory.actions.quickEditThreshold')}
                  >
                    <QuickEditIcon className="h-4 w-4" />
                    <span className="sr-only">{t('inventory.actions.quickEditThreshold')}</span>
                  </button>
                )}
              </div>
              {user?.role === 'admin' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label
                    className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300"
                    htmlFor={`threshold-${card.classification_id}`}
                  >
                    {t('inventory.threshold.update')}
                  </label>
                  <input
                    id={`threshold-${card.classification_id}`}
                    type="number"
                    min={0}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={thresholdEdits[card.classification_id] ?? ''}
                    onChange={(e) => handleThresholdInputChange(card.classification_id, e.target.value)}
                    ref={(element) => {
                      if (element) {
                        thresholdInputRefs.current[card.classification_id] = element;
                      } else {
                        delete thresholdInputRefs.current[card.classification_id];
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveThreshold(card.classification_id)}
                    className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-100 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:focus:ring-offset-slate-900"
                    disabled={Boolean(thresholdSaving[card.classification_id])}
                  >
                    {thresholdSaving[card.classification_id]
                      ? t('common.actions.saving')
                      : t('common.actions.save')}
                  </button>
                </div>
              )}
              {lastUpdatedLabel && (
                <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                  {t('inventory.cards.lastUpdated', { value: lastUpdatedLabel })}
                </p>
              )}
            </div>
          );
        })
      )}
      </div>
      {/* Add Inventory Form */}
      <div className="mt-6">
        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventory.forms.addInventory')}</h2>
        <form className="flex flex-col items-center gap-2 sm:flex-row" onSubmit={handleAdd}>
          <label htmlFor="add-inventory-classification" className="sr-only">
            {t('common.labels.classification')}
          </label>
          <select
            id="add-inventory-classification"
            className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={selectedCls}
            onChange={(e) => setSelectedCls(Number(e.target.value))}
            required
          >
            <option value="" disabled>
              {t('inventory.forms.classificationPlaceholder')}
            </option>
            {classifications.map((c) => (
              <option key={c.id} value={c.id}>
                {c.size} / {c.color}
              </option>
            ))}
          </select>
          <label htmlFor="add-inventory-quantity" className="sr-only">
            {t('common.labels.quantity')}
          </label>
          <input
            id="add-inventory-quantity"
            type="number"
            className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            min={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value, 10))}
            placeholder={t('inventory.forms.quantityPlaceholder')}
            required
          />
          <label htmlFor="add-inventory-unit" className="sr-only">
            {t('common.labels.unit')}
          </label>
          <select
            id="add-inventory-unit"
            className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="TRAY">{t('common.labels.tray')}</option>
            <option value="DOZEN">{t('common.labels.dozen')}</option>
            <option value="PCS">{t('common.labels.pcs')}</option>
          </select>
          <button
            type="submit"
            className="rounded bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
          >
            {t('common.actions.addDraft')}
          </button>
        </form>
      </div>
      {user?.role === 'admin' && (
        <div className="mt-6">
          <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventory.overrides.title')}</h2>
          {pendingOverrides.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('inventory.overrides.none')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.invoice')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.customer')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.requested')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.available')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.driver')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.submitted')}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">
                      {t('inventory.overrides.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-800 dark:divide-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  {pendingOverrides.map((override) => {
                    const invoice = override.invoice;
                    const classification = override.classification;
                    const shortage = override.requested_qty_pcs - override.available_qty_pcs;
                    const submittedAt = formatDateTime(override.created_at);
                    return (
                      <tr key={override.id}>
                        <td className="px-3 py-2 text-sm">
                          #{override.invoice_id}
                          {invoice && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">₱{invoice.total_amount.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {invoice?.customer_name || t('common.messages.walkIn')}
                          {invoice?.customer_phone && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer_phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {override.requested_qty_pcs} pcs ({override.requested_unit.toLowerCase()})
                          {classification && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {classification.size} / {classification.color}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {override.available_qty_pcs} pcs
                          {shortage > 0 && (
                            <div className="text-xs text-red-500 dark:text-red-400">
                              {t('common.messages.shortage', { value: shortage })}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {invoice?.created_by_user?.name || invoice?.created_by_user?.username || `#${invoice?.created_by ?? ''}`}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {submittedAt}
                        </td>
                        <td className="space-x-2 px-3 py-2 text-right text-sm">
                          <button
                            type="button"
                            onClick={() => handleApproveOverride(override.invoice_id)}
                            className="rounded bg-green-600 px-3 py-1 text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
                          >
                            {t('common.actions.approve')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectOverride(override.invoice_id)}
                            className="rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
                          >
                            {t('common.actions.reject')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Movements List */}
      <div className="mt-6">
        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventory.movements.title')}</h2>
        <ul className="space-y-2">
          {movements.map((m) => {
            const createdLabel = formatDateTime(m.created_at) || t('common.notAvailable');
            return (
              <li
                key={m.id}
                className="flex flex-col rounded border border-slate-200 bg-white p-3 shadow-sm transition-colors sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('inventory.movements.entry', {
                      type: m.type,
                      qty: m.qty_entered,
                      unit: m.unit_entered,
                      classification: m.classification_id,
                    })}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {t('inventory.movements.status', { status: m.status, created: createdLabel })}
                  </p>
                </div>
                {user?.role === 'admin' && m.type === 'IN' && (
                  <div className="mt-2 flex gap-2 sm:mt-0">
                    {m.status === 'DRAFT' && (
                      <button
                        onClick={() => handleVerify(m.id)}
                        className="rounded bg-yellow-500 px-2 py-1 text-white transition hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
                      >
                        {t('common.actions.verify')}
                      </button>
                    )}
                    {m.status === 'VERIFIED' && (
                      <button
                        onClick={() => handleCommit(m.id)}
                        className="rounded bg-green-600 px-2 py-1 text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
                      >
                        {t('common.actions.commit')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default InventoryManagerPage;