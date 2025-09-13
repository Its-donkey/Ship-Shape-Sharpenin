//apps/web/src/components/RequireAuth.tsx

// File: src/components/RequireAuth.tsx
import { Navigate, useLocation } from "react-router-dom";
import { type ReactNode } from "react";           // 👈 type-only import
import { useAuth } from "../auth/AuthContext"; // 👈 from your context folder

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { customer, loading } = useAuth();
  const signInPath = "/customer/sign-in"; // ensure this matches your route

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-600">
        Checking your session…
      </div>
    );
  }

  if (!customer) {
    return <Navigate to={signInPath} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
