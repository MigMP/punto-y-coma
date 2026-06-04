import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "../../styles/feedback.css";

const ToastContext = createContext(null);
const VALID_TYPES = ["success", "error", "warning", "info"];

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeType(type) {
  return VALID_TYPES.includes(type) ? type : "info";
}

function toastAllowed(type) {
  const enabled = localStorage.getItem("ajustes_toasts_enabled") !== "false";

  if (enabled) return true;

  return type === "error" || type === "warning";
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);

    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = "info", title = "Aviso", message = "", duration = 4200 }) => {
      const safeType = normalizeType(type);

      if (!toastAllowed(safeType)) {
        return null;
      }

      const id = createId();

      setToasts((current) =>
        [{ id, type: safeType, title, message }, ...current].slice(0, 4)
      );

      if (duration > 0) {
        const timer = window.setTimeout(() => dismissToast(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toastViewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.type}`} key={toast.id} role="status">
            <div className="toastIcon" aria-hidden="true" />

            <div className="toastContent">
              <strong>{toast.title}</strong>
              {toast.message && <p>{toast.message}</p>}
            </div>

            <button
              type="button"
              className="toastClose"
              onClick={() => dismissToast(toast.id)}
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }

  return ctx;
}