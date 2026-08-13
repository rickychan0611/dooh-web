import Link from "next/link";
import type { ReactNode } from "react";
import {
  Building2,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { requirePlatformOwner } from "@/lib/auth";

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const user = await requirePlatformOwner();
  const userLabel = user.email ?? "Platform owner";
  const avatarLabel = userLabel.trim().charAt(0).toUpperCase() || "O";

  return (
    <div className="admin-shell owner-shell">
      <header className="admin-topbar owner-topbar">
        <Link href="/owner" className="admin-brand" aria-label="DOOH owner console home">
          <span className="admin-brand-mark">D</span>
          <span>DOOH</span>
        </Link>
        <Link href="/help" className="admin-search">
          <Search aria-hidden="true" />
          <span>Search help and resources</span>
          <kbd>?</kbd>
        </Link>
        <div className="admin-account" title={userLabel}>
          <span className="admin-account-name">Owner console</span>
          <span className="admin-avatar" aria-hidden="true">{avatarLabel}</span>
        </div>
      </header>
      <aside className="sidebar owner-sidebar">
        <div className="sidebar-workspace">
          <span className="sidebar-workspace-avatar" aria-hidden="true">
            <ShieldCheck />
          </span>
          <span>
            <strong>Platform admin</strong>
            <small>Owner console</small>
          </span>
        </div>
        <nav aria-label="Owner console navigation">
          <div className="sidebar-nav-group">
            <Link href="/owner" className="active">
              <Building2 aria-hidden="true" />
              <span>Organizations</span>
            </Link>
            <Link href="/dashboard">
              <LayoutDashboard aria-hidden="true" />
              <span>Customer dashboard</span>
            </Link>
          </div>
          <div className="sidebar-nav-group sidebar-nav-secondary">
            <Link href="/help">
              <CircleHelp aria-hidden="true" />
              <span>Help center</span>
            </Link>
          </div>
        </nav>
        <form action={signOut} className="sidebar-signout">
          <button className="sidebar-signout-button" type="submit">
            <LogOut aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </form>
      </aside>
      <main className="admin-main owner-main">{children}</main>
    </div>
  );
}
