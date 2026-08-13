import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { HelpSearch } from "@/components/help-search";

export default function HelpPage() {
  return (
    <main className="help-page">
      <header className="help-topbar">
        <Link href="/" className="help-brand" aria-label="DOOH home">
          <span className="help-brand-mark">D</span>
          <span>DOOH</span>
          <span className="help-brand-divider" aria-hidden="true" />
          <span className="help-brand-section">Help Center</span>
        </Link>
        <Link href="/dashboard" className="help-dashboard-link">
          <LayoutDashboard aria-hidden="true" />
          <span>Dashboard</span>
        </Link>
      </header>
      <div className="help-shell">
        <section className="help-hero">
          <p className="eyebrow">Help Center</p>
          <h1>How can we help?</h1>
          <p>Find quick answers for screens, content, pairing, and playback.</p>
        </section>
        <HelpSearch />
      </div>
    </main>
  );
}
