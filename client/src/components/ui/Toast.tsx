'use client';
import { useState, useCallback, useRef, createContext, useContext } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: number; message: string; type: ToastType }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType) => void }>({ toast: () => {} });

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextIdRef.current;
    setToasts(prev => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const colors = { success: 'bg-green-800', error: 'bg-red-800', warning: 'bg-amber-700', info: 'bg-blue-800' };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-5 right-5 z-[2000] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`${colors[t.type]} text-white px-5 py-3 rounded-lg shadow-lg text-sm max-w-sm animate-[slideIn_0.3s_ease]`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

