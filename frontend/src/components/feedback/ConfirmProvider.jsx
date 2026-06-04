import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/feedback.css";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }

    setDialog(null);
  }, []);

  const confirm = useCallback((options = {}) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }

    return new Promise((resolve) => {
      resolverRef.current = resolve;

      setDialog({
        title: "Confirmar acción",
        message: "Esta acción necesita confirmación.",
        confirmText: "Confirmar",
        cancelText: "Cancelar",
        tone: "danger",
        ...options,
      });
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dialog, close]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      {dialog && (
        <div className="confirmOverlay" onMouseDown={() => close(false)}>
          <section
            className="confirmDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={`confirmMark confirm-${dialog.tone}`} aria-hidden="true" />

            <div className="confirmBody">
              <h2 id="confirm-title">{dialog.title}</h2>
              <p id="confirm-message">{dialog.message}</p>
            </div>

            <div className="confirmActions">
              <button type="button" className="btn-ghost" onClick={() => close(false)}>
                {dialog.cancelText}
              </button>

              <button
                type="button"
                className={dialog.tone === "danger" ? "btn-del" : ""}
                onClick={() => close(true)}
              >
                {dialog.confirmText}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);

  if (!ctx) {
    throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  }

  return ctx.confirm;
}