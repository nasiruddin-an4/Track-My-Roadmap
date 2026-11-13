"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Action = { label: string; run: () => void };
type Show = (message: string, action?: Action) => void;

const ToastContext = createContext<Show>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ message: string; action?: Action; open: boolean }>({ message: "", open: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<Show>((message, action) => {
    setT({ message, action, open: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setT((x) => ({ ...x, open: false })), action ? 6000 : 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={"toast" + (t.open ? " show" : "")} role="status" aria-live="polite">
        <span>{t.message}</span>
        {t.action && (
          <button type="button" onClick={() => { setT((x) => ({ ...x, open: false })); t.action?.run(); }}>
            {t.action.label}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}
