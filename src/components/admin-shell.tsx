import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut, Search } from "lucide-react";
import { signOut, switchOrganization } from "@/app/login/actions";
import { AdminNavigation } from "@/components/admin-navigation";
import { requireOrganization } from "@/lib/auth";

export async function AdminShell({ children }: { children: ReactNode }) {
  const context = await requireOrganization();
  const userLabel = context.user.email ?? context.organization.name;
  const avatarLabel = userLabel.trim().charAt(0).toUpperCase() || "D";

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link href="/dashboard" className="admin-brand" aria-label="DOOH dashboard home">
          <span className="admin-brand-mark">D</span>
          <span>DOOH</span>
        </Link>
        <Link href="/help" className="admin-search">
          <Search aria-hidden="true" />
          <span>Search help and resources</span>
          <kbd>?</kbd>
        </Link>
        <div className="admin-account" title={userLabel}>
          <span className="admin-account-name">{context.organization.name}</span>
          <span className="admin-avatar" aria-hidden="true">{avatarLabel}</span>
        </div>
      </header>
      <aside className="sidebar">
        <div className="sidebar-workspace">
          <span className="sidebar-workspace-avatar" aria-hidden="true">
            {context.organization.name.trim().charAt(0).toUpperCase() || "D"}
          </span>
          <span>
            <strong>{context.organization.name}</strong>
            <small>{context.role}</small>
          </span>
        </div>
        {context.memberships.length > 1 && (
          <form action={switchOrganization} className="workspace-switcher">
            <label>
              Workspace
              <select
                name="organizationId"
                defaultValue={context.organizationId}
              >
                {context.memberships.map((membership) => (
                  <option
                    key={membership.organization_id}
                    value={membership.organization_id}
                  >
                    {membership.organizations.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary compact-button" type="submit">
              Switch
            </button>
          </form>
        )}
        <AdminNavigation />
        <form action={signOut} className="sidebar-signout">
          <button className="sidebar-signout-button" type="submit">
            <LogOut aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
