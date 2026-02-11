import { useEffect, useRef, useCallback } from 'react';

type SSEHandler = (data: unknown) => void;

export function useSSE(sessionId: string | null, handlers: Record<string, SSEHandler>) {
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!sessionId) return;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const es = new EventSource(`${base}/api/sse/${sessionId}`, { withCredentials: true });

    for (const [event, handler] of Object.entries(handlers)) {
      es.addEventListener(event, (e: MessageEvent) => {
        try { handler(JSON.parse(e.data)); } catch { /* ignore parse errors */ }
      });
    }

    es.onerror = () => {
      es.close();
      // Reconnect after 3s
      setTimeout(connect, 3000);
    };

    sourceRef.current = es;
  }, [sessionId, handlers]);

  useEffect(() => {
    connect();
    return () => { sourceRef.current?.close(); };
  }, [connect]);

  return sourceRef;
}

