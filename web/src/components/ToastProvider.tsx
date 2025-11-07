import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastIdCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    toastIdCounter += 1;
    const id = toastIdCounter;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const toneClasses = useMemo(
    () => ({
      info: 'border border-slate-200 bg-white/90 text-slate-900 shadow dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100',
      success:
        'border border-emerald-200 bg-emerald-50 text-emerald-900 shadow dark:border-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-100',
      error:
        'border border-red-200 bg-red-50 text-red-900 shadow dark:border-red-700 dark:bg-red-900/70 dark:text-red-100',
    }),
    [],
  );

  const contextValue = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[240px] rounded-lg px-4 py-3 transition-colors ${toneClasses[toast.tone]}`}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
