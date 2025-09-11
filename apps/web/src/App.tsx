import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, useEffect, Suspense } from "react";
import Header from "./components/Header";
import { AuthProvider } from "./auth/AuthContext";

// Lazy-load pages for better initial load
const HomePage = lazy(() => import("./pages/HomePage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const CustomerSignInPage = lazy(() => import("./pages/CustomerSignInPage"));
const CustomerDashboardPage = lazy(
  () => import("./pages/CustomerDashboardPage")
);
const CustomerRegisterPage = lazy(() => import("./pages/CustomerRegisterPage"));
const CustomerForgotPage = lazy(() => import("./pages/CustomerForgotPage"));
const CustomerProfilePage = lazy(() => import("./pages/CustomerProfilePage"));
const RequireAuth = lazy(() => import("./components/RequireAuth"));
const MGISPricingPage = lazy(() => import("./pages/MGISPricingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Optional: scroll to top on route change (basic) */
function ScrollToTop() {
  useEffect(() => {
    // default behavior: let hash links scroll to anchors; otherwise, top
    if (!location.hash)
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  });
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Header />
        <ScrollToTop />
        <Suspense
          fallback={
            <div className="p-8 text-center text-sm text-zinc-600">
              Loading…
            </div>
          }
        >
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/not-found" element={<NotFound />} />

            {/* Customer public */}
            <Route path="/customer/sign-in" element={<CustomerSignInPage />} />
            <Route
              path="/customer/register"
              element={<CustomerRegisterPage />}
            />
            <Route path="/customer/forgot" element={<CustomerForgotPage />} />
            <Route path="/mgis-pricing" element={<MGISPricingPage />} />
            <Route path="/admin" element={<AdminPage />} />

            {/* Customer private */}
            <Route
              path="/customer"
              element={
                <RequireAuth>
                  <CustomerDashboardPage />
                </RequireAuth>
              }
            />

            <Route
              path="/customer/profile"
              element={
                <RequireAuth>
                  <CustomerProfilePage />
                </RequireAuth>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
