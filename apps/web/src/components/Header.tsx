import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  type NavLinkProps,
} from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "../auth/AuthContext";

const underlineHover =
  "relative inline-block pb-1 transition-transform duration-200 " +
  "hover:scale-105 " +
  "after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:w-0 after:bg-accent " +
  "after:transition-all after:duration-200 hover:after:w-full";

// Properly typed className function for NavLink
const navLinkClass: NonNullable<NavLinkProps["className"]> = ({ isActive }) =>
  isActive
    ? `text-iron font-semibold ${underlineHover}`
    : `text-ink hover:text-iron ${underlineHover}`;

const Header: React.FC = () => {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === "/";
  const [open, setOpen] = useState(false);

  // auth
  const { customer, setCustomer } = useAuth();

  // desktop user menu
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // close mobile and user menus on route/hash change
    setOpen(false);
    setUserOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const homeAnchors = useMemo(
    () => [
      { href: "#services", label: "Services" },
      { href: "#whyus", label: "Why Us" },
      { href: "#contact", label: "Contact" },
    ],
    []
  );

  const buttonClass =
    "rounded-full px-6 py-3 text-sm font-extrabold text-paper transition bg-accent shadow-sm hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-85";

  const customerHref = customer ? "/customer" : "/customer/sign-in";

  async function handleSignOut() {
    try {
      await fetch("/api/customers/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network errors; still clear local state
    } finally {
      setCustomer(null);
      navigate("/", { replace: true });
    }
  }

  const initials =
    (customer?.name || customer?.email || "?")
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "?";

  return (
    <header className="w-full bg-paper shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="text-2xl font-bold text-[--color-graphite]">
          Ship Shape Sharpening
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-6 text-sm">
          {onHome &&
            homeAnchors.map((a) => {
              const isActive = hash === a.href;
              return (
                <a
                  key={a.href}
                  href={a.href}
                  className={
                    isActive
                      ? `text-iron font-semibold ${underlineHover}`
                      : `text-ink hover:text-iron ${underlineHover}`
                  }
                >
                  {a.label}
                </a>
              );
            })}

          {onHome && <span className="h-5 w-px bg-steel-200" />}

          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/pricing" className={navLinkClass}>
            Pricing
          </NavLink>

          {/* Customer / User */}
          {!customer ? (
            <NavLink to={customerHref} className={navLinkClass}>
              Customer
            </NavLink>
          ) : (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-steel-200 bg-white px-3 py-1.5 shadow-sm hover:shadow transition"
                aria-haspopup="menu"
                aria-expanded={userOpen}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-paper text-xs font-bold">
                  {initials}
                </span>
                <span className="text-ink font-medium max-w-[12ch] truncate">
                  {customer.name || customer.email}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 transition-transform ${
                    userOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>

              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-44 rounded-xl border border-steel-200 bg-white py-2 shadow-lg"
                >
                  <Link
                    to="/customer"
                    className="block px-3 py-2 text-sm text-ink hover:bg-steel-100"
                    onClick={() => setUserOpen(false)}
                    role="menuitem"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/customer/profile"
                    className="block px-3 py-2 text-sm text-ink hover:bg-steel-100"
                    onClick={() => setUserOpen(false)}
                    role="menuitem"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="mt-1 block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          <NavLink to="/admin" className={navLinkClass}>
            Admin
          </NavLink>

          {/* Book Now */}
          <a
            href="https://shipshapesharpening.com.au/book"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass}
          >
            Book Now
          </a>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-ink hover:text-iron hover:bg-steel-100 focus:outline-none focus:ring-2 focus:ring-accent"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown placeholder - keep your existing implementation here if you have it */}
    </header>
  );
};

export default Header;
