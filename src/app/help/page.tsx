import Link from "next/link";
import { HelpSearch } from "@/components/help-search";

export default function HelpPage() {
  return (
    <main className="legal-shell">
      <Link href="/" className="brand">DOOH Community Help</Link>
      <section className="pricing-hero">
        <p className="eyebrow">Self-service support</p>
        <h1>Get a screen online quickly.</h1>
      </section>
      <HelpSearch />
    </main>
  );
}
