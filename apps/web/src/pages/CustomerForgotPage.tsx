import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function CustomerForgotPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await fetch("/api/customers/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      // even on error, show the same message to avoid account enumeration
      setSubmitted(true);
    }
  }

  return (
    <>
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight">Forgot Password</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Enter your email and we’ll send a reset link if an account exists.
          </p>

          {submitted ? (
            <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              If an account exists for <strong>{email}</strong>, you’ll receive reset instructions shortly.
            </div>
          ) : (
            <>
              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-full px-6 py-3 text-sm font-extrabold text-white transition bg-accent shadow-sm hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-85"
                >
                  Send reset link
                </button>
              </form>
            </>
          )}

          <div className="mt-6 border-t pt-6 text-sm">
            <Link to="/customer/sign-in" className="font-semibold text-accent hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
