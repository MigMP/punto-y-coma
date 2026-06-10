// Archivo: frontend/src/components/routing/ProtectedRoute.jsx

import React, { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../state/AuthContext.jsx";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getDefaultPathByRole(role) {
  if (role === "alumno") return "/plan";
  if (role === "maestro") return "/capturar";
  if (role === "administrador") return "/admin";

  return "/app";
}

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation();
  const { token: ctxToken, user: ctxUser } = useAuth();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const user = useMemo(() => {
    return ctxUser || getStoredUser();
  }, [ctxUser]);

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!allowedRoles.length) {
    return children;
  }

  const role = user?.role;

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={getDefaultPathByRole(role)} replace />;
  }

  return children;
}