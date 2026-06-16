"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastKind = "error" | "success" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastApi {
  show: (text: string, kind?: ToastKind) => void;
  error: (text: string) => void;
  success: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (text: string, kind: ToastKind = "info") => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, kind, text }]);
      setTimeout(() => remove(id), DURATION);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (text) => show(text, "error"),
      success: (text) => show(text, "success"),
      info: (text) => show(text, "info"),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-wrap" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.kind}`}
            role={t.kind === "error" ? "alert" : "status"}
            onClick={() => remove(t.id)}
          >
            <span className="toast-msg">{t.text}</span>
            <button
              className="toast-close"
              aria-label="ปิด"
              onClick={(e) => {
                e.stopPropagation();
                remove(t.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
