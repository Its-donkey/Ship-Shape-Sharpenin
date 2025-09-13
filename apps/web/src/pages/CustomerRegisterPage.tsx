//apps/web/src/pages/CustomerRegisterPage.tsx

import React, { useRef, useState, useEffect } from "react";
import { abnIsValid, formatAbn, normalizeAbn, validateFirstName, validateLastName, validateEmail, validatePassword } from "@shipshape/validation";
import { Link, useNavigate } from "react-router-dom";

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  accountType: "personal" | "business";
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
    firstName: "",
    lastName: "",
    email: "",
    accountType: "personal",
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
  const [abrLoading, setAbrLoading] = useState(false);
  const [abrError, setAbrError] = useState<string | null>(null);
  const lastAbnRef = useRef<string | null>(null);
  const [lockedFromAbr, setLockedFromAbr] = useState<{ companyName: boolean; tradingName: boolean }>({
    companyName: false,
    tradingName: false,
  });
  const [abrBusinessNames, setAbrBusinessNames] = useState<string[]>([]);

  // Derived ABN state for inline UI feedback
  const abnDigits = normalizeAbn(form.abn).length;
  const abnInsufficient = abnDigits > 0 && abnDigits < 11; // show hint until full 11 digits
  const abnValid = !!form.abn && abnIsValid(form.abn);
  const isBusiness = form.accountType === "business";
  const abnProvided = abnDigits > 0;

  // Derived per-field validity for green highlight
  const firstNameValid = !validateFirstName(form.firstName);
  const lastNameValid = !validateLastName(form.lastName);
  const emailValid = !validateEmail(form.email || "");
  const passwordValid = !validatePassword(form.password || "");
  const confirmValid = !!form.confirm && form.confirm === form.password && passwordValid;
  const phoneValid = !form.phone || /^[\d\s()+-]{6,}$/.test(form.phone);

  // On valid ABN, fetch ABR details once per ABN and populate fields
  useEffect(() => {
    const digits = normalizeAbn(form.abn);
    if (!isBusiness) return;
    if (!abnValid) return;
    if (!/^\d{11}$/.test(digits)) return;
    if (lastAbnRef.current === digits) return;

    let cancelled = false;
    setAbrError(null);
    setAbrLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/abr/abn/${digits}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.message || "ABR lookup failed");
        if (cancelled) return;
        lastAbnRef.current = digits;

        const entityName: string | undefined = data?.entityName || undefined;
        const businessNames: string[] = Array.isArray(data?.businessNames)
          ? (data.businessNames as string[]).filter((n) => typeof n === "string" && n.trim().length > 0)
          : [];
        const firstBusinessName: string | undefined = businessNames[0];
        setForm((f) => ({
          ...f,
          companyName: entityName ?? f.companyName,
          tradingName: firstBusinessName ?? f.tradingName,
        }));
        setLockedFromAbr((l) => ({
          companyName: l.companyName || !!entityName,
          tradingName: l.tradingName || !!firstBusinessName,
        }));
        setAbrBusinessNames(businessNames);
      } catch (e: any) {
        if (!cancelled) setAbrError(e?.message || "ABR lookup failed");
      } finally {
        if (!cancelled) setAbrLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.abn, abnValid]);

  function update<K extends keyof RegisterForm>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let value = e.target.value;
      if (key === "abn") {
        const formatted = formatAbn(value);
        const newDigits = normalizeAbn(formatted);
        const prevDigits = normalizeAbn(form.abn);
        if (newDigits !== prevDigits) {
          // ABN changed: clear ABR-derived fields and unlock editing
          lastAbnRef.current = null;
          setAbrBusinessNames([]);
          setLockedFromAbr({ companyName: false, tradingName: false });
          setAbrError(null);
          setForm((f) => ({
            ...f,
            abn: formatted,
            companyName: "",
            tradingName: "",
          }));
          return;
        }
        value = formatted;
      }
      if ((key === "companyName" && lockedFromAbr.companyName) || (key === "tradingName" && lockedFromAbr.tradingName)) {
        return;
      }
      setForm((f) => ({
        ...f,
        [key]: value,
        ...(billingSame && key === "deliveryAddress" ? { billingAddress: value } : {}),
      }));
    };
  }

  function validate(): string | null {
    const firstErr = validateFirstName(form.firstName);
    if (firstErr) return firstErr;
    const lastErr = validateLastName(form.lastName);
    if (lastErr) return lastErr;
    if (!form.email.trim() || !form.password.trim()) return "Please enter your email and password.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    if (form.abn && !abnIsValid(form.abn)) return "Please enter a valid ABN (11 digits).";
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
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          password: form.password,

          companyName: form.companyName,
          tradingName: form.tradingName,
          abn: form.abn ? normalizeAbn(form.abn) : "",
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
          {/* Account type selection (moved to top) */}
          <div>
            <span className="block text-sm font-semibold">Account Type</span>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="accountType"
                  value="personal"
                  checked={form.accountType === "personal"}
                  onChange={() => setForm((f) => ({ ...f, accountType: "personal" }))}
                />
                Personal
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="accountType"
                  value="business"
                  checked={form.accountType === "business"}
                  onChange={() => setForm((f) => ({ ...f, accountType: "business" }))}
                />
                Business
              </label>
            </div>
          </div>

          {/* Contact */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-semibold">First name</label>
            <input id="firstName" type="text" className={`${inputCls} ${firstNameValid ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`} placeholder="Your first name" value={form.firstName} onChange={update("firstName")} required />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-semibold">Last name</label>
            <input id="lastName" type="text" className={`${inputCls} ${lastNameValid ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`} placeholder="Your last name" value={form.lastName} onChange={update("lastName")} required />
          </div>

          {/* Phone above Email */}
          <div>
            <label htmlFor="phone" className="block text-sm font-semibold">Phone</label>
            <input id="phone" type="tel" autoComplete="tel" className={`${inputCls} ${phoneValid && form.phone ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`} placeholder="e.g. 04xx xxx xxx" value={form.phone} onChange={update("phone")} />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold">Email</label>
            <input id="email" type="email" autoComplete="email" className={`${inputCls} ${emailValid ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`} placeholder="you@example.com" value={form.email} onChange={update("email")} />
          </div>

          

          {/* ABN just under Email (business only) */}
          {isBusiness && (
            <div>
              <label htmlFor="abn" className="block text-sm font-semibold">ABN</label>
              <input
                id="abn"
                type="text"
                inputMode="numeric"
                maxLength={14} // XX XXX XXX XXX
                className={`${inputCls} ${abnValid ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`}
                placeholder="11 digits"
                value={form.abn}
                onChange={update("abn")}
              />
              {abnInsufficient && (
                <p className="mt-1 text-xs text-red-600">Insufficient digits</p>
              )}
              {abrLoading && !abnInsufficient && (
                <p className="mt-1 text-xs text-zinc-500">Looking up ABR…</p>
              )}
              {!!abrError && (
                <p className="mt-1 text-xs text-red-600">{abrError}</p>
              )}
            </div>
          )}

          {/* Company (business only) */}
          {isBusiness && (
            <div>
              <label htmlFor="companyName" className="block text-sm font-semibold">Company Name</label>
              <input id="companyName" type="text" className={`${inputCls} ${form.companyName ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`} placeholder="Registered company name" value={form.companyName} onChange={update("companyName")} disabled={lockedFromAbr.companyName || !abnProvided} />
              {!abnProvided && (
                <p className="mt-1 text-xs text-zinc-500">Enter an ABN to enable this field</p>
              )}
              {lockedFromAbr.companyName && (
                <p className="mt-1 text-xs text-zinc-500">Auto-filled from ABR</p>
              )}
            </div>
          )}

          {isBusiness && (
            <div>
              <label htmlFor="tradingName" className="block text-sm font-semibold">Trading Name</label>
              {abrBusinessNames.length > 0 ? (
                <select
                  id="tradingName"
                  className={`${inputCls} ${form.tradingName ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`}
                  value={form.tradingName}
                  onChange={(e) => setForm((f) => ({ ...f, tradingName: e.target.value }))}
                  disabled={!abnProvided}
                >
                  {abrBusinessNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="tradingName"
                  type="text"
                  className={`${inputCls} ${form.tradingName ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`}
                  placeholder="Trading/as name"
                  value={form.tradingName}
                  onChange={update("tradingName")}
                  disabled={lockedFromAbr.tradingName || !abnProvided}
                />
              )}
              {!abnProvided && (
                <p className="mt-1 text-xs text-zinc-500">Enter an ABN to enable this field</p>
              )}
              {lockedFromAbr.tradingName && abrBusinessNames.length === 0 && (
                <p className="mt-1 text-xs text-zinc-500">Auto-filled from ABR</p>
              )}
            </div>
          )}

          {/* Addresses */}
          <div>
            <label htmlFor="deliveryAddress" className="block text-sm font-semibold">Delivery Address</label>
            <textarea id="deliveryAddress" className={inputCls} rows={2} placeholder="Street, Suburb, State, Postcode" value={form.deliveryAddress} onChange={update("deliveryAddress")} />
          </div>

          {isBusiness && (
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
          )}

          {isBusiness && (
            <div>
              <label htmlFor="billingAddress" className="block text-sm font-semibold">Billing Address</label>
              <textarea id="billingAddress" className={inputCls} rows={2} placeholder="Street, Suburb, State, Postcode" value={form.billingAddress} onChange={update("billingAddress")} />
            </div>
          )}

          {/* Phone moved above Email */}

          {/* Passwords */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold">Password</label>
            <input id="password" type="password" autoComplete="new-password" className={`${inputCls} ${passwordValid ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`} placeholder="••••••••" value={form.password} onChange={update("password")} />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-semibold">Confirm Password</label>
            <input id="confirm" type="password" autoComplete="new-password" className={`${inputCls} ${confirmValid ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50" : ""}`} placeholder="••••••••" value={form.confirm} onChange={update("confirm")} />
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
