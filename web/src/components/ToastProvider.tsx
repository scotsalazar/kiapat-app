import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'info' | 'success' | 'error';

interface ToastOptions {
  message: string;
  type?: ToastType;
}

interface Toast extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const typeClassMap: Record<ToastType, string> = {
  info: 'bg-gray-900',
  success: 'bg-green-600',
  error: 'bg-red-600',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    if (!options.message) {
      return;
    }
    const id = Date.now() + Math.random();
    const toast: Toast = { id, type: 'info', ...options };
    setToasts((prev) => [...prev, toast]);
    window.setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`text-sm text-white px-4 py-3 rounded shadow ${typeClassMap[toast.type ?? 'info']}`}
            role="alert"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
