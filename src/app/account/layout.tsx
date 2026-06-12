import type { ReactNode } from "react";
import Link from "next/link";
import { PublicAccountNav } from "@/components/public-account-nav";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <main className="public-shell account-shell">
      <header className="public-header">
        <Link href="/screens" className="brand">DOOH<span>Community Boards</span></Link>
        <PublicAccountNav />
      </header>
      {children}
    </main>
  );
}
