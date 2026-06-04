import React, { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../state/AuthContext.jsx";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation();
  const { token: ctxToken, user: ctxUser } = useAuth();

  const token = useMemo(() => {
    return ctxToken || localStorage.getItem("token") || "";
  }, [ctxToken]);

  const user = useMemo(() => {
    if (ctxUser) return ctxUser;

    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
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
    return <Navigate to="/app" replace />;
  }

  return children;
}