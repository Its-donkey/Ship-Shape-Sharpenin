// apps/web/src/components/RequireAdmin.tsx
import { Navigate, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { customer, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-600">
        Checking your session…
      </div>
    );
  }

  if (!customer) {
    return <Navigate to="/customer/sign-in" replace state={{ from: location }} />;
  }

  if (!customer.is_admin) {
    return <Navigate to="/customer" replace />;
  }

  return <>{children}</>;
}

