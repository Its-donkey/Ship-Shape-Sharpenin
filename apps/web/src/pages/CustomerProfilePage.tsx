// /src/pages/CustomerProfilePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

type ProfileForm = {
  name: string | null;
  companyName: string | null;
  tradingName: string | null;
  abn: string | null;
  deliveryAddress: string | null;
  billingAddress: string | null;
  phone: string | null;
};

export default function CustomerProfilePage() {
  const { customer, setCustomer } = useAuth();
  const [form, setForm] = useState<ProfileForm>({
    name: null,
    companyName: null,
    tradingName: null,
    abn: null,
    deliveryAddress: null,
    billingAddress: null,
    phone: null,
  });
  const [billingSame, setBillingSame] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const inputCls =
    "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent";

  // Seed form from auth customer on first load or when auth changes
  useEffect(() => {
    if (!customer) return;
    setForm({
      name: customer.name,
      companyName: customer.company_name,
      tradingName: customer.trading_name,
      abn: customer.abn,
      deliveryAddress: customer.delivery_addr,
      billingAddress: customer.billing_addr,
      phone: customer.phone,
    });
  }, [customer?.id]); // only when user switches

  // Keep billing in sync if checkbox is on
  function update<K extends keyof ProfileForm>(key: K) {
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
    const abnDigits = (form.abn ?? "").replace(/\s+/g, "");
    if (form.abn && !/^\d{11}$/.test(abnDigits)) return "ABN should be 11 digits.";
    if (form.phone && !/^[\d\s()+-]{6,}$/.test(form.phone)) return "Please provide a valid phone number.";
    return null;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/customers/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          companyName: form.companyName,
          tradingName: form.tradingName,
          abn: form.abn,
          deliveryAddress: form.deliveryAddress,
          billingAddress: form.billingAddress,
          phone: form.phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to save profile.");
      }
      setCustomer(data.customer);
      setOkMsg("Saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!customer) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm">
          <h1 className="text-xl font-bold">Profile</h1>
          <p className="text-sm mt-2 text-zinc-600">You need to sign in to view your profile.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold tracking-tight">Your Profile</h1>
        <p className="mt-1 text-sm text-zinc-600">Manage your account and business details.</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {okMsg && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {okMsg}
          </div>
        )}

        <form onSubmit={save} className="mt-6 grid grid-cols-1 gap-5">
          {/* Contact */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold">Name</label>
            <input id="name" type="text" className={inputCls} value={form.name ?? ""} onChange={update("name")} />
          </div>

          <div>
            <label className="block text-sm font-semibold">Email</label>
            <input className={inputCls} value={customer.email} disabled />
            <p className="mt-1 text-xs text-zinc-500">Email can’t be changed here.</p>
          </div>

          {/* Company */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-semibold">Company Name</label>
            <input id="companyName" type="text" className={inputCls} value={form.companyName ?? ""} onChange={update("companyName")} />
          </div>

          <div>
            <label htmlFor="tradingName" className="block text-sm font-semibold">Trading Name</label>
            <input id="tradingName" type="text" className={inputCls} value={form.tradingName ?? ""} onChange={update("tradingName")} />
          </div>

          <div>
            <label htmlFor="abn" className="block text-sm font-semibold">ABN</label>
            <input id="abn" inputMode="numeric" className={inputCls} placeholder="11 digits" value={form.abn ?? ""} onChange={update("abn")} />
          </div>

          {/* Addresses */}
          <div>
            <label htmlFor="deliveryAddress" className="block text-sm font-semibold">Delivery Address</label>
            <textarea id="deliveryAddress" rows={2} className={inputCls} value={form.deliveryAddress ?? ""} onChange={update("deliveryAddress")} />
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
            <textarea id="billingAddress" rows={2} className={inputCls} value={form.billingAddress ?? ""} onChange={update("billingAddress")} />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-semibold">Phone</label>
            <input id="phone" type="tel" autoComplete="tel" className={inputCls} value={form.phone ?? ""} onChange={update("phone")} />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full px-6 py-3 text-sm font-extrabold text-white transition bg-accent shadow-sm hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-85 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
