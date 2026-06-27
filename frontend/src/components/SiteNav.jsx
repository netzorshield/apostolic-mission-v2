import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import BrandLogo from "./BrandLogo";

const NAV_LINKS = [
  { to: "/login", label: "Sign In" },
  { to: "/enroll", label: "Enroll" },
];

function NavLink({ to, label, pathname, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`font-inter text-xs font-medium uppercase tracking-widest transition hover:text-iam-gold-light ${
        pathname === to ? "text-iam-gold" : "text-white/70"
      }`}
    >
      {label}
    </Link>
  );
}

export default function SiteNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const isHome = pathname === "/";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-white/5 backdrop-blur-md ${
        isHome ? "bg-black/25" : "bg-iam-bg/80 backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <BrandLogo to="/" />
        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} label={label} pathname={pathname} />
            ))}
          </nav>
          <button
            type="button"
            className="rounded-lg border border-white/10 p-2 text-white/80 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className={`border-t border-white/5 px-6 py-4 md:hidden ${isHome ? "bg-black/40" : "bg-iam-bg/95"}`}>
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                label={label}
                pathname={pathname}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
