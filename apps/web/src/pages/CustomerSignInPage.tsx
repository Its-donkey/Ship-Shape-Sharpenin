import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type FormState = {
  email: string;
  password: string;
  remember: boolean;
};

export default function CustomerSignInPage() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const prefillEmail = params.get("email") || "";
  const msg = params.get("msg");

  const [form, setForm] = useState<FormState>({
    email: prefillEmail,
    password: "",
    remember: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { setCustomer } = useAuth();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.email.trim() || !form.password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/customers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Sign in failed. Please try again.");
      }

      if (data.customer) {
        setCustomer(data.customer);
      }

      // Go back to the page they were trying to access, or /customer by default
      const from = (location.state as any)?.from?.pathname || "/customer";
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-extrabold tracking-tight">Customer Sign In</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Welcome back! Sign in to view quotes, bookings, and past sharpening jobs.
        </p>

        {msg === "account_created" && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Your account was created. Please sign in.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-800">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-400"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-800">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-400"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.remember}
                onChange={(e) => update("remember", e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Remember me for 30 days
            </label>

            <Link
              to="/customer/forgot"
              className="text-sm font-medium text-zinc-800 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-accent px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-95 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Don’t have an account?{" "}
          <Link to="/customer/register" className="font-medium text-zinc-800 hover:underline">
            Create one
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
