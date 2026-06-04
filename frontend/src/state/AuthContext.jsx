import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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

function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(readStoredUser);

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
      if (!nextToken || !nextUser) {
        throw new Error("Sesión inválida: falta token o usuario.");
      }

      setToken(nextToken);
      setUser(nextUser);
      saveSession(nextToken, nextUser);
    };

    const logout = () => {
      setToken("");
      setUser(null);
      clearSession();
    };

    const updateUser = (nextUser) => {
      setUser(nextUser);

      if (nextUser) {
        localStorage.setItem("user", JSON.stringify(nextUser));
      } else {
        localStorage.removeItem("user");
      }
    };

    const refreshUser = () => {
      const storedUser = readStoredUser();
      const storedToken = readStoredToken();

      setUser(storedUser);
      setToken(storedToken);

      return {
        user: storedUser,
        token: storedToken,
      };
    };

    return {
      token,
      user,
      isAuthed: Boolean(token),
      login,
      logout,
      updateUser,
      refreshUser,
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
