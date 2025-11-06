import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface InventoryCard {
  classification_id: number;
  size: string;
  color: string;
  qty_tray: number;
  qty_dozen: number;
  qty_pcs: number;
  unit_price: number | null;
}

export interface InventorySummary {
  timestamp: string;
  cards: InventoryCard[];
}

export interface InventoryMovement {
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

export interface InventoryPrice {
  id: number;
  classification_id: number;
  unit: string;
  price_per_unit: number;
  effective_from: string;
  effective_to: string | null;
}

interface InventoryUpdateMessage {
  type: 'inventory_update';
  summary?: InventorySummary;
  movements?: InventoryMovement[];
  prices?: InventoryPrice[];
}

type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface HydrationPayload {
  summary?: InventorySummary | null;
  movements?: InventoryMovement[];
  prices?: InventoryPrice[];
}

interface UseInventoryStreamOptions {
  token?: string | null;
  endpoint?: string;
  reconnectDelaysMs?: number[];
  autoReconnect?: boolean;
}

const DEFAULT_ENDPOINT = '/api/realtime/updates';
const DEFAULT_RECONNECT_DELAYS = [2000, 5000, 10000, 30000];

export const useInventoryStream = ({
  token,
  endpoint = DEFAULT_ENDPOINT,
  reconnectDelaysMs = DEFAULT_RECONNECT_DELAYS,
  autoReconnect = true,
}: UseInventoryStreamOptions) => {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [prices, setPrices] = useState<InventoryPrice[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const mergeSummary = useCallback((current: InventorySummary | null, incoming: InventorySummary) => {
    if (!current) {
      return incoming;
    }
    const cardMap = new Map<number, InventoryCard>();
    current.cards.forEach((card) => {
      cardMap.set(card.classification_id, card);
    });
    incoming.cards.forEach((card) => {
      cardMap.set(card.classification_id, { ...cardMap.get(card.classification_id), ...card });
    });
    const mergedCards = Array.from(cardMap.values()).sort((a, b) => a.classification_id - b.classification_id);
    return {
      timestamp: incoming.timestamp || current.timestamp,
      cards: mergedCards,
    };
  }, []);

  const mergeMovements = useCallback((current: InventoryMovement[], incoming: InventoryMovement[]) => {
    if (!current.length) {
      return incoming;
    }
    const movementMap = new Map<number, InventoryMovement>();
    current.forEach((movement) => movementMap.set(movement.id, movement));
    incoming.forEach((movement) => {
      movementMap.set(movement.id, { ...movementMap.get(movement.id), ...movement });
    });
    return Array.from(movementMap.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, []);

  const mergePrices = useCallback((current: InventoryPrice[], incoming: InventoryPrice[]) => {
    if (!current.length) {
      return incoming;
    }
    const priceMap = new Map<string, InventoryPrice>();
    current.forEach((price) => priceMap.set(`${price.classification_id}:${price.unit}`, price));
    incoming.forEach((price) => {
      priceMap.set(`${price.classification_id}:${price.unit}`, { ...priceMap.get(`${price.classification_id}:${price.unit}`), ...price });
    });
    return Array.from(priceMap.values()).sort((a, b) => {
      if (a.classification_id === b.classification_id) {
        return a.unit.localeCompare(b.unit);
      }
      return a.classification_id - b.classification_id;
    });
  }, []);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect) return;
    const delay = reconnectDelaysMs[Math.min(reconnectAttemptRef.current, reconnectDelaysMs.length - 1)];
    clearReconnectTimeout();
    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectAttemptRef.current += 1;
      connect();
    }, delay);
  }, [autoReconnect, reconnectDelaysMs]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const payload: InventoryUpdateMessage = JSON.parse(event.data);
        if (payload.type !== 'inventory_update') return;
        if (payload.summary) {
          setSummary((prev) => mergeSummary(prev, payload.summary!));
        }
        if (payload.movements) {
          setMovements((prev) => mergeMovements(prev, payload.movements!));
        }
        if (payload.prices) {
          setPrices((prev) => mergePrices(prev, payload.prices!));
        }
      } catch (error) {
        console.error('Failed to parse inventory stream payload', error);
      }
    },
    [mergeSummary, mergeMovements, mergePrices],
  );

  const connect = useCallback(() => {
    if (!token) return;
    clearReconnectTimeout();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnectionStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}${endpoint}`);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnectionStatus('open');
    };

    socket.onmessage = handleMessage;

    socket.onerror = () => {
      setConnectionStatus('error');
    };

    socket.onclose = () => {
      setConnectionStatus('closed');
      if (autoReconnect) {
        scheduleReconnect();
      }
    };
  }, [autoReconnect, endpoint, handleMessage, scheduleReconnect, token]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnectionStatus('closed');
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (!token) {
      disconnect();
      setSummary(null);
      setMovements([]);
      setPrices([]);
      return;
    }
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect, token]);

  const hydrate = useCallback(({ summary, movements, prices }: HydrationPayload) => {
    if (summary) {
      setSummary(summary);
    }
    if (movements) {
      setMovements(movements);
    }
    if (prices) {
      setPrices(prices);
    }
  }, []);

  return useMemo(
    () => ({
      summary,
      movements,
      prices,
      connectionStatus,
      hydrate,
      reconnect,
      disconnect,
    }),
    [connectionStatus, disconnect, hydrate, movements, prices, reconnect, summary],
  );
};

