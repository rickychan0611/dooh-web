import Link from "next/link";
import type { ReactNode } from "react";
import { signOut, switchOrganization } from "@/app/login/actions";
import { requireOrganization } from "@/lib/auth";

const links = [
  ["/dashboard", "Overview"],
  ["/dashboard/screens", "Screens"],
  ["/dashboard/media", "Media"],
  ["/dashboard/community", "Community"],
  ["/dashboard/team", "Team"],
  ["/dashboard/billing", "Billing"],
  ["/dashboard/settings", "Settings"],
  ["/help", "Help"],
];

export async function AdminShell({ children }: { children: ReactNode }) {
  const context = await requireOrganization();
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          DOOH Community
          <span>{context.organization.name}</span>
        </Link>
        {context.memberships.length > 1 && (
          <form action={switchOrganization}>
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
        <nav>
          {links.map(([href, label]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="sidebar-signout">
          <button className="button secondary" type="submit">
            Sign out
          </button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
