//apps/web/src/pages/CustomerDashboardPage.tsx

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchMe } from "../lib/me";

export default function CustomerDashboardPage() {
  const [me, setMe] = useState<{ id: number; email: string; name?: string; is_admin?: boolean } | null>(null);
  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const who = await fetchMe();
      if (!who) {
        navigate("/customer/sign-in");
        return;
      }
      setMe(who as any);
      // Show admin popup on login
      if ((who as any)?.is_admin) {
        setShowAdminPopup(true);
      }
    })();
  }, [navigate]);

  return (
    <>
      {showAdminPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-2">Admin</h2>
            <p className="text-sm text-zinc-700">Welcome back — you have admin access.</p>
            <div className="mt-4 flex justify-end gap-2">
              <a
                href="/admin"
                className="rounded-full px-4 py-2 text-xs font-bold text-white bg-accent hover:brightness-110"
                onClick={() => setShowAdminPopup(false)}
              >
                Go to Admin
              </a>
              <button
                className="rounded-full px-4 py-2 text-xs font-bold text-zinc-800 bg-zinc-200 hover:brightness-110"
                onClick={() => setShowAdminPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {me ? `Welcome, ${me.name || me.email}` : "Loading…"}
          </h1>

          <div className="flex items-center gap-3">
            <Link
              to="/customer/profile"
              className="rounded-full px-4 py-2 text-xs font-bold text-white transition bg-accent shadow-sm hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-85"
            >
              Profile
            </Link>
            <form
              method="post"
              onSubmit={async (e) => {
                e.preventDefault();
                await fetch("/api/customers/logout", { method: "POST", credentials: "include" });
                window.location.href = "/customer/sign-in";
              }}
            >
              <button className="rounded-full px-4 py-2 text-xs font-bold text-white transition bg-accent shadow-sm hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-85">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <p className="mt-1 text-sm text-zinc-600">
          From here you’ll be able to see your quotes, bookings, and job history.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Link
            to="#"
            className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm transition hover:scale-[1.01] hover:shadow-md"
          >
            <h2 className="font-bold">Quotes</h2>
            <p className="mt-2 text-sm text-zinc-600">View and approve quotes we’ve sent you.</p>
          </Link>

          <Link
            to="#"
            className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm transition hover:scale-[1.01] hover:shadow-md"
          >
            <h2 className="font-bold">Bookings</h2>
            <p className="mt-2 text-sm text-zinc-600">Check upcoming bookings and request changes.</p>
          </Link>

          <Link
            to="#"
            className="rounded-2xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm transition hover:scale-[1.01] hover:shadow-md"
          >
            <h2 className="font-bold">Job History</h2>
            <p className="mt-2 text-sm text-zinc-600">Browse your past sharpening jobs and invoices.</p>
          </Link>
        </div>
      </main>
    </>
  );
}
