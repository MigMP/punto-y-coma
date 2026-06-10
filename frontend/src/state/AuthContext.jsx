// Archivo: frontend/src/state/AuthContext.jsx

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  return {
    ...user,
    email: String(user.email || "").trim().toLowerCase(),
    role: String(user.role || "").trim().toLowerCase(),
    nombre: String(user.nombre || user.name || "").trim(),
  };
}

function saveSession(token, user) {
  const safeToken = String(token || "").trim();
  const safeUser = normalizeUser(user);

  if (!safeToken || !safeUser?.email || !safeUser?.role) {
    throw new Error("Sesión inválida: falta token, correo o rol.");
  }

  localStorage.setItem("token", safeToken);
  localStorage.setItem("user", JSON.stringify(safeUser));

  return {
    token: safeToken,
    user: safeUser,
  };
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(() => normalizeUser(readStoredUser()));

  useEffect(() => {
    const handleLogout = () => {
      setToken("");
      setUser(null);
      clearSession();
    };

    window.addEventListener("auth:logout", handleLogout);

    return () => {
      window.removeEventListener("auth:logout", handleLogout);
    };
  }, []);

  const value = useMemo(() => {
    const login = ({ token: nextToken, user: nextUser }) => {
      const session = saveSession(nextToken, nextUser);

      setToken(session.token);
      setUser(session.user);

      return session;
    };

    const logout = () => {
      setToken("");
      setUser(null);
      clearSession();

      window.dispatchEvent(new Event("auth:session-cleared"));
    };

    const updateUser = (nextUser) => {
      const safeUser = normalizeUser(nextUser);

      setUser(safeUser);

      if (safeUser) {
        localStorage.setItem("user", JSON.stringify(safeUser));
      } else {
        localStorage.removeItem("user");
      }

      return safeUser;
    };

    const refreshUser = () => {
      const storedUser = normalizeUser(readStoredUser());
      const storedToken = readStoredToken();

      setUser(storedUser);
      setToken(storedToken);

      return {
        user: storedUser,
        token: storedToken,
      };
    };

    const hasRole = (roles = []) => {
      if (!user?.role) return false;

      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      return allowedRoles.includes(user.role);
    };

    return {
      token,
      user,
      role: user?.role || "",
      isAuthed: Boolean(token),
      login,
      logout,
      updateUser,
      refreshUser,
      hasRole,
    };
  }, [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}