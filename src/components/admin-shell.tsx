import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";

const links = [
  ["/dashboard", "Overview"],
  ["/dashboard/screens", "Screens"],
  ["/dashboard/ads", "Ads"],
  ["/dashboard/media", "Media"],
  ["/dashboard/settings", "Settings"],
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          DOOH
          <span>Control Room</span>
        </Link>
        <nav>
          {links.map(([href, label]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button className="button secondary" type="submit">
            Sign out
          </button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
