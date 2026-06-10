// Archivo: frontend/src/services/api.js

export const API = (
  import.meta.env.VITE_API_URL || "http://localhost:3001/api"
).replace(/\/+$/, "");

const DEFAULT_TIMEOUT = 12000;

async function readBody(res) {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await res.text();
    return text ? { message: text } : null;
  } catch {
    return null;
  }
}

function buildHeaders(token, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function buildURL(path) {
  const cleanPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${path}`;

  return `${API}${cleanPath}`;
}

function notifyUnauthorized() {
  window.dispatchEvent(new Event("auth:logout"));
}

function createTimeoutSignal(timeout) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeout);

  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeoutId),
  };
}

function getErrorMessage(data, res) {
  return (
    data?.error ||
    data?.message ||
    `Error HTTP ${res.status} (${res.statusText || "request failed"})`
  );
}

export async function apiJSON(
  path,
  {
    token,
    method = "GET",
    body,
    headers: extraHeaders,
    onUnauthorized,
    timeout = DEFAULT_TIMEOUT,
    signal,
  } = {}
) {
  const timeoutController = createTimeoutSignal(timeout);

  const finalSignal = signal || timeoutController.signal;

  try {
    const res = await fetch(buildURL(path), {
      method,
      headers: buildHeaders(token, body, extraHeaders),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal: finalSignal,
    });

    const data = await readBody(res);

    /*
      401 = sesión inválida o token vencido.
      403 = normalmente significa "sin permisos", no necesariamente cerrar sesión.
    */
    if (res.status === 401) {
      notifyUnauthorized();

      if (typeof onUnauthorized === "function") {
        onUnauthorized();
      }
    }

    if (!res.ok) {
      throw new Error(getErrorMessage(data, res));
    }

    return data ?? {};
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Intenta nuevamente.");
    }

    if (error instanceof TypeError) {
      throw new Error(
        "No se pudo conectar con el servidor. Revisa que el backend esté activo."
      );
    }

    throw error;
  } finally {
    timeoutController.clear();
  }
}