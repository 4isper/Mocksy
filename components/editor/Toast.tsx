"use client";

import { useEffect, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = String(++toastId);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

export function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "success" && <span aria-hidden="true">✓</span>}
          {t.type === "error" && <span aria-hidden="true">✕</span>}
          {t.type === "info" && <span aria-hidden="true">ℹ</span>}
          {t.message}
          <button
            type="button"
            className="btn-icon tooltip"
            onClick={() => onRemove(t.id)}
            aria-label="Close notification"
            data-tooltip="Close"
            style={{ marginLeft: 8, opacity: 0.6 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}