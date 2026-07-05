"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MarketingNavState } from "@/lib/auth";

const navLinks = [
  { href: "#features", label: "Features", anchor: true },
  { href: "#how", label: "How it works", anchor: true },
  { href: "/pricing", label: "Pricing", anchor: false },
  { href: "/help", label: "Help", anchor: false },
] as const;

function NavActions({
  navState,
  onNavigate,
}: {
  navState: MarketingNavState;
  onNavigate?: () => void;
}) {
  if (!navState.isLoggedIn) {
    return (
      <>
        <Link
          className="button secondary compact-button"
          href="/login"
          onClick={onNavigate}
        >
          Sign in
        </Link>
        <Link className="button compact-button" href="/signup" onClick={onNavigate}>
          Start free
        </Link>
      </>
    );
  }

  return (
    <>
      {navState.showDashboard && (
        <Link className="button compact-button" href="/dashboard" onClick={onNavigate}>
          Dashboard
        </Link>
      )}
      {navState.showOwnerConsole && (
        <Link
          className="button secondary compact-button"
          href="/owner"
          onClick={onNavigate}
        >
          Admin panel
        </Link>
      )}
      {!navState.showDashboard && !navState.showOwnerConsole && (
        <Link
          className="button compact-button"
          href="/account/profile"
          onClick={onNavigate}
        >
          My account
        </Link>
      )}
    </>
  );
}

export function MarketingNav({ navState }: { navState: MarketingNavState }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    if (!open) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <header className="marketing-nav">
        <Link href="/" className="brand" onClick={close}>
          DOOH Community<span>Screen software for businesses / communities</span>
        </Link>
        <nav className="marketing-nav-links" aria-label="Main">
          {navLinks.map(({ href, label, anchor }) =>
            anchor ? (
              <a key={href} href={href}>
                {label}
              </a>
            ) : (
              <Link key={href} href={href}>
                {label}
              </Link>
            ),
          )}
        </nav>
        <div className="marketing-nav-actions actions">
          <NavActions navState={navState} />
        </div>
        <button
          type="button"
          className="marketing-nav-toggle"
          aria-expanded={open}
          aria-controls="marketing-nav-panel"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </header>

      <div className={`marketing-nav-overlay${open ? " open" : ""}`} aria-hidden={!open}>
        <button
          type="button"
          className="marketing-nav-backdrop"
          aria-label="Close menu"
          onClick={close}
          tabIndex={open ? 0 : -1}
        />
        <aside
          id="marketing-nav-panel"
          className="marketing-nav-panel"
          aria-hidden={!open}
          inert={open ? undefined : true}
        >
          <nav aria-label="Main">
            {navLinks.map(({ href, label, anchor }) =>
              anchor ? (
                <a key={href} href={href} onClick={close}>
                  {label}
                </a>
              ) : (
                <Link key={href} href={href} onClick={close}>
                  {label}
                </Link>
              ),
            )}
          </nav>
          <div className="actions">
            <NavActions navState={navState} onNavigate={close} />
          </div>
        </aside>
      </div>
    </>
  );
}
