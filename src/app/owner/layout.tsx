import Link from "next/link";
import type { ReactNode } from "react";
import { requirePlatformOwner } from "@/lib/auth";

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  await requirePlatformOwner();
  return (
    <div className="owner-shell">
      <header className="marketing-nav">
        <Link className="brand" href="/owner">DOOH Owner Console</Link>
        <nav><Link href="/owner">Organizations</Link><Link href="/dashboard">Customer dashboard</Link></nav>
      </header>
      <main className="owner-main">{children}</main>
    </div>
  );
}
