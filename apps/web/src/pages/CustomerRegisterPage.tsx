import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  confirm: string;

  companyName: string;
  tradingName: string;
  abn: string;
  deliveryAddress: string;
  billingAddress: string;
  phone: string;
};

export default function CustomerRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>({
    name: "",
    email: "",
    password: "",
    confirm: "",

    companyName: "",
    tradingName: "",
    abn: "",
    deliveryAddress: "",
    billingAddress: "",
    phone: "",
  });
  const [billingSame, setBillingSame] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof RegisterForm>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((f) => ({
        ...f,
        [key]: value,
        ...(billingSame && key === "deliveryAddress" ? { billingAddress: value } : {}),
      }));
    };
  }

  function validate(): string | null {
    if (!form.email.trim() || !form.password.trim()) return "Please enter your email and password.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    if (form.abn && !/^\d{11}$/.test(form.abn.replace(/\s/g, ""))) return "ABN should be 11 digits (no spaces).";
    if (form.phone && !/^[\d\s()+-]{6,}$/.test(form.phone)) return "Please enter a valid phone number.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) return setError(v);

    try {
      setSubmitting(true);
      const res = await fetch("/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,

          companyName: form.companyName,
          tradingName: form.tradingName,
          abn: form.abn,
          deliveryAddress: form.deliveryAddress,
          billingAddress: form.billingAddress,
          phone: form.phone,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Registration failed. Please try again.");
      }

      const params = new URLSearchParams({ email: form.email, msg: "account_created" });
      navigate(`/customer/sign-in?${params.toString()}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent";

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold tracking-tight">Create an Account</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Register to view quotes, bookings, and your job history.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Contact */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold">Name (optional)</label>
            <input id="name" type="text" className={inputCls} placeholder="Your name" value={form.name} onChange={update("name")} />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold">Email</label>
            <input id="email" type="email" autoComplete="email" className={inputCls} placeholder="you@example.com" value={form.email} onChange={update("email")} />
          </div>

          {/* Company */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-semibold">Company Name</label>
            <input id="companyName" type="text" className={inputCls} placeholder="Registered company name" value={form.companyName} onChange={update("companyName")} />
          </div>

          <div>
            <label htmlFor="tradingName" className="block text-sm font-semibold">Trading Name</label>
            <input id="tradingName" type="text" className={inputCls} placeholder="Trading/as name" value={form.tradingName} onChange={update("tradingName")} />
          </div>

          <div>
            <label htmlFor="abn" className="block text-sm font-semibold">ABN</label>
            <input id="abn" type="text" inputMode="numeric" className={inputCls} placeholder="11 digits" value={form.abn} onChange={update("abn")} />
          </div>

          {/* Addresses */}
          <div>
            <label htmlFor="deliveryAddress" className="block text-sm font-semibold">Delivery Address</label>
            <textarea id="deliveryAddress" className={inputCls} rows={2} placeholder="Street, Suburb, State, Postcode" value={form.deliveryAddress} onChange={update("deliveryAddress")} />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="billingSame"
              type="checkbox"
              checked={billingSame}
              onChange={(e) => {
                const same = e.target.checked;
                setBillingSame(same);
                if (same) setForm((f) => ({ ...f, billingAddress: f.deliveryAddress }));
              }}
            />
            <label htmlFor="billingSame" className="text-sm">Billing address same as delivery</label>
          </div>

          <div>
            <label htmlFor="billingAddress" className="block text-sm font-semibold">Billing Address</label>
            <textarea id="billingAddress" className={inputCls} rows={2} placeholder="Street, Suburb, State, Postcode" value={form.billingAddress} onChange={update("billingAddress")} />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-semibold">Phone</label>
            <input id="phone" type="tel" autoComplete="tel" className={inputCls} placeholder="e.g. 04xx xxx xxx" value={form.phone} onChange={update("phone")} />
          </div>

          {/* Passwords */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold">Password</label>
            <input id="password" type="password" autoComplete="new-password" className={inputCls} placeholder="••••••••" value={form.password} onChange={update("password")} />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-semibold">Confirm Password</label>
            <input id="confirm" type="password" autoComplete="new-password" className={inputCls} placeholder="••••••••" value={form.confirm} onChange={update("confirm")} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full px-6 py-3 text-sm font-extrabold text-white transition bg-accent shadow-sm hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-85 disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 border-t pt-6 text-sm">
          Already have an account?{" "}
          <Link to="/customer/sign-in" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
