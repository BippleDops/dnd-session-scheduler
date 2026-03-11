'use client';
import { useState, useCallback, createContext, useContext } from 'react';
import WoodButton from './WoodButton';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function useConfirm() { return useContext(ConfirmContext); }

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  const handleConfirm = () => { state?.resolve(true); setState(null); };
  const handleCancel = () => { state?.resolve(false); setState(null); };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[3500] flex items-center justify-center" onClick={handleCancel}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative parchment p-6 w-96 max-w-[90vw] rounded-lg shadow-2xl card-enter" onClick={e => e.stopPropagation()}>
            <h2 className="font-[var(--font-heading)] text-lg text-[var(--ink)] mb-2">
              {state.opts.title}
            </h2>
            <p className="text-sm text-[var(--ink-faded)] mb-5">
              {state.opts.message}
            </p>
            <div className="flex justify-end gap-2">
              <WoodButton variant="secondary" onClick={handleCancel}>
                {state.opts.cancelLabel || 'Cancel'}
              </WoodButton>
              <WoodButton
                variant={state.opts.variant === 'danger' ? 'danger' : 'primary'}
                onClick={handleConfirm}
              >
                {state.opts.confirmLabel || 'Confirm'}
              </WoodButton>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
