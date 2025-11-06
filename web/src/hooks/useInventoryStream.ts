import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'error'
  | 'closed';

export interface InventoryUpdateMessage<TSummary = unknown, TMovements = unknown, TPrices = unknown> {
  type: string;
  summary?: TSummary;
  movements?: TMovements;
  prices?: TPrices;
  [key: string]: unknown;
}

interface UseInventoryStreamOptions<TState, TMessage extends { type: string }> {
  token?: string | null;
  endpoint?: string;
  protocol?: 'ws' | 'sse';
  initialData: TState;
  merge: (current: TState, message: TMessage) => TState;
  enabled?: boolean;
  retryDelays?: number[];
}

interface UseInventoryStreamResult<TState> {
  data: TState;
  status: ConnectionStatus;
  error: string | null;
}

const DEFAULT_RETRY_DELAYS = [1000, 2000, 5000, 10000];

const resolveUrl = (endpoint: string, protocol: 'ws' | 'sse'): string => {
  if (/^https?:\/\//.test(endpoint) || /^wss?:\/\//.test(endpoint)) {
    return endpoint;
  }
  const { host, protocol: pageProtocol } = window.location;
  if (protocol === 'ws') {
    const wsProtocol = pageProtocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${host}${endpoint}`;
  }
  return `${pageProtocol}//${host}${endpoint}`;
};

export function useInventoryStream<TState, TMessage extends InventoryUpdateMessage>(
  options: UseInventoryStreamOptions<TState, TMessage>,
): UseInventoryStreamResult<TState> {
  const {
    token,
    endpoint = '/api/realtime/updates',
    protocol = 'ws',
    initialData,
    merge,
    enabled = true,
    retryDelays = DEFAULT_RETRY_DELAYS,
  } = options;

  const [data, setData] = useState<TState>(initialData);
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    token && enabled ? 'connecting' : 'idle',
  );
  const [error, setError] = useState<string | null>(null);

  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const shouldReconnectRef = useRef(true);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== undefined) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!token || !enabled) {
      setStatus('idle');
      setError(null);
      clearReconnectTimeout();
      return () => undefined;
    }

    let ws: WebSocket | null = null;
    let eventSource: EventSource | null = null;
    shouldReconnectRef.current = true;

    const handleMessage = (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as TMessage;
        if (!parsed || typeof parsed.type !== 'string') {
          return;
        }
        setData((current) => merge(current, parsed));
      } catch (parseErr) {
        console.error('Failed to parse realtime update', parseErr);
        setError('Failed to parse realtime update');
      }
    };

    const scheduleReconnect = () => {
      if (!shouldReconnectRef.current) {
        return;
      }
      const attempt = reconnectAttemptRef.current;
      const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
      reconnectAttemptRef.current += 1;
      setStatus('reconnecting');
      clearReconnectTimeout();
      reconnectTimeoutRef.current = window.setTimeout(connect, delay);
    };

    const handleClose = (evt?: Event | CloseEvent | ErrorEvent | Error) => {
      if (evt instanceof CloseEvent && evt.wasClean) {
        setStatus('closed');
        shouldReconnectRef.current = false;
        return;
      }
      setError('Lost connection to realtime updates');
      scheduleReconnect();
    };

    const connect = () => {
      setStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');
      setError(null);

      const url = resolveUrl(endpoint, protocol);

      if (protocol === 'sse') {
        eventSource = new EventSource(url, { withCredentials: true });
        eventSource.onopen = () => {
          reconnectAttemptRef.current = 0;
          setStatus('open');
          setError(null);
        };
        eventSource.onmessage = (event) => handleMessage(event.data);
        eventSource.onerror = (event) => {
          handleClose(event);
        };
      } else {
        ws = new WebSocket(url);
        ws.onopen = () => {
          reconnectAttemptRef.current = 0;
          setStatus('open');
          setError(null);
        };
        ws.onmessage = (event) => handleMessage(event.data);
        ws.onerror = () => {
          setError('Realtime connection error');
        };
        ws.onclose = (event) => {
          handleClose(event);
        };
      }
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimeout();
      if (ws) {
        ws.close();
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [
    token,
    enabled,
    endpoint,
    protocol,
    merge,
    retryDelays,
    clearReconnectTimeout,
  ]);

  const result = useMemo<UseInventoryStreamResult<TState>>(
    () => ({ data, status, error }),
    [data, status, error],
  );

  return result;
}

export default useInventoryStream;
