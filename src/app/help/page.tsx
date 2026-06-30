import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { HelpSearch } from "@/components/help-search";

export default function HelpPage() {
  return (
    <main className="legal-shell help-page">
      <header className="help-header">
        <BackLink />
        <Link href="/" className="brand">DOOH Community Help</Link>
      </header>
      <section className="pricing-hero">
        <p className="eyebrow">Self-service support</p>
        <h1>Get a screen online quickly.</h1>
      </section>
      <HelpSearch />
    </main>
  );
}
