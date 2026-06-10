// Archivo: frontend/src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./app/App.jsx";
import { AuthProvider } from "./state/AuthContext.jsx";
import { ToastProvider } from "./components/feedback/ToastProvider.jsx";
import { ConfirmProvider } from "./components/feedback/ConfirmProvider.jsx";
import { initTheme } from "./utils/theme.js";

import "./styles/global.css";

initTheme();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el elemento root en index.html.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);