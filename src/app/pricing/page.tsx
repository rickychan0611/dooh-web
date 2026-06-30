import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="legal-shell">
      <Link href="/" className="brand">DOOH Community</Link>
      <section className="pricing-hero"><p className="eyebrow">Simple pricing</p><h1>Everything you need, priced per screen.</h1><p className="hero-copy">Start with one screen and add more whenever your business is ready.</p></section>
      <section className="pricing-grid">
        <article className="panel pricing-card"><p className="eyebrow">United States</p><h2>US$6 <small>/ screen / month</small></h2><p>US$60 per screen annually.</p><Link className="button" href="/signup">Start 14 days free</Link></article>
        <article className="panel pricing-card featured"><p className="eyebrow">Canada</p><h2>CA$9 <small>/ screen / month</small></h2><p>CA$90 per screen annually.</p><Link className="button" href="/signup">Start 14 days free</Link></article>
      </section>
      <section className="marketing-section"><h2>Included with every screen</h2><div className="feature-grid"><article><h3>Unlimited staff roles</h3><p>Owner, admin, editor, and viewer access without per-seat billing.</p></article><article><h3>1 GB media storage</h3><p>Pooled storage for every paid screen license.</p></article><article><h3>Community board</h3><p>Moderation, member controls, public directories, and QR posting.</p></article><article><h3>Scheduling and health</h3><p>Weekly schedules, online status, pairing, caching, and error reporting.</p></article></div></section>
      <section className="panel"><h2>Frequently asked questions</h2><div className="faq"><details><summary>Do I need special hardware?</summary><p>Install our app on most Android TV sticks and TV boxes, or run it directly on a smart TV with a web browser.</p></details><details><summary>Can one code run two screens?</summary><p>No. Each screen license connects to exactly one active player. Pairing a replacement revokes the old player.</p></details><details><summary>What happens after the trial?</summary><p>Choose monthly or annual billing. If payment fails, screens keep running for a seven-day grace period.</p></details><details><summary>Can I turn off community posting?</summary><p>Yes. Each screen can disable it, allow open signup, or require invitations.</p></details></div></section>
    </main>
  );
}
