'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

type SSEListener = (data: unknown) => void;

interface SSEContextType {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  subscribe: (event: string, handler: SSEListener) => () => void;
  presence: number;
}

const SSEContext = createContext<SSEContextType>({
  sessionId: null,
  setSessionId: () => {},
  subscribe: () => () => {},
  presence: 0,
});

export function useSSEContext() { return useContext(SSEContext); }

export function SSEProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [presence, setPresence] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const listenersRef = useRef<Map<string, Set<SSEListener>>>(new Map());

  // Subscribe to an SSE event type
  const subscribe = useCallback((event: string, handler: SSEListener) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);
    return () => { listenersRef.current.get(event)?.delete(handler); };
  }, []);

  // Manage SSE connection lifecycle
  useEffect(() => {
    if (!sessionId) {
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }

    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const es = new EventSource(`${base}/api/sse/${sessionId}`, { withCredentials: true });

    es.addEventListener('presence', (e: MessageEvent) => {
      try { setPresence(JSON.parse(e.data).count); } catch {}
    });

    // Proxy all events to registered listeners
    const proxyHandler = (eventType: string) => (e: MessageEvent) => {
      const handlers = listenersRef.current.get(eventType);
      if (!handlers) return;
      try {
        const data = JSON.parse(e.data);
        for (const handler of handlers) handler(data);
      } catch {}
    };

    const eventTypes = ['dice_roll', 'initiative_update', 'comment', 'connected'];
    const cleanups = eventTypes.map(type => {
      const handler = proxyHandler(type);
      es.addEventListener(type, handler as EventListener);
      return () => es.removeEventListener(type, handler as EventListener);
    });

    es.onerror = () => {
      es.close();
      // Reconnect after 3s
      setTimeout(() => {
        if (sessionId) setSessionId(prev => prev); // trigger reconnect
      }, 3000);
    };

    sourceRef.current = es;

    return () => {
      cleanups.forEach(c => c());
      es.close();
      sourceRef.current = null;
    };
  }, [sessionId]);

  return (
    <SSEContext.Provider value={{ sessionId, setSessionId, subscribe, presence }}>
      {children}
    </SSEContext.Provider>
  );
}
