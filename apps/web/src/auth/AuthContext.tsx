// apps/web/src/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Customer = {
  id: number;
  email: string;
  name: string | null;
  created_at: string;

  // Optional profile fields
  company_name: string | null;
  trading_name: string | null;
  abn: string | null;
  delivery_addr: string | null;
  billing_addr: string | null;
  phone: string | null;
};

type AuthState = {
  customer: Customer | null;
  loading: boolean;
  setCustomer: (c: Customer | null) => void;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent duplicate network calls in React 18 Strict Mode during development.
  // (Strict Mode mounts, unmounts, and remounts components to surface side-effect bugs.)
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) {
      // Already fetched in this mount cycle (Strict Mode dev pass)
      return;
    }
    hasFetchedRef.current = true;

    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/customers/me", {
          method: "GET",
          credentials: "include", // send cookies through Vite proxy
          headers: { Accept: "application/json" },
          signal: ac.signal,
        });

        if (res.status === 401) {
          // Expected when not logged in yet
          setCustomer(null);
          return;
        }

        if (!res.ok) {
          // Log body once for easier debugging
          let body: unknown;
          try {
            body = await res.text();
          } catch {
            body = "<unreadable response>";
          }
          console.warn("[auth] /api/customers/me failed:", res.status, body);
          setCustomer(null);
          return;
        }

        // API may return either the object directly or { customer: {...} }
        const data = (await res.json()) as unknown;
        const maybeCustomer =
          data && typeof data === "object" && "customer" in (data as any)
            ? (data as any).customer
            : data;

        setCustomer((maybeCustomer ?? null) as Customer | null);
      } catch (err) {
        // Ignore aborts; surface other errors once
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[auth] fetch error:", err);
        }
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({ customer, loading, setCustomer }),
    [customer, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
