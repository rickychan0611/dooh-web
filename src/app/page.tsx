import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { HeroStackSlider } from "@/components/hero-stack-slider";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);

function getSlideImages(): string[] {
  try {
    const slidesDir = path.join(process.cwd(), "public", "slides");
    return fs
      .readdirSync(slidesDir)
      .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((file) => `/slides/${file}`);
  } catch {
    return [];
  }
}

const industries = [
  ["Bubble tea and cafés", "Promote seasonal drinks, combos, events, and customer notices."],
  ["Restaurants and food courts", "Update menus, specials, pickup instructions, and local promotions."],
  ["Salons and clinics", "Share services, openings, health notices, and community updates."],
  ["Shared spaces", "Mix professional promotions with a moderated local community board."],
];

export default function HomePage() {
  const slides = getSlideImages();
  return (
    <main>
      <header className="marketing-nav">
        <Link href="/" className="brand">DOOH Community<span>Screen software for businesses / communities</span></Link>
        <nav><a href="#features">Features</a><a href="#how">How it works</a><Link href="/pricing">Pricing</Link><Link href="/help">Help</Link></nav>
        <div className="actions"><Link className="button secondary compact-button" href="/login">Sign in</Link><Link className="button compact-button" href="/signup">Start free</Link></div>
      </header>
      <section className="marketing-hero">
        <div className="hero-content">
          <p className="eyebrow">Digital signage plus community</p>
          <h1>Turn any screen into a manageable digital sign.</h1>
          <p className="hero-copy">Upload images and videos, schedule promotions in seconds, and optionally give your customers a moderated community board.</p>
          <div className="actions"><Link className="button" href="/signup">Start 14 days free</Link><a className="button secondary" href="#how">See how it works</a></div>
          <p className="microcopy">No credit card · One screen included · Cancel anytime</p>
        </div>
        <div className="hero-visual">
          <HeroStackSlider images={slides} />
        </div>
      </section>
      <section className="logo-strip"><span>Built for</span><strong>cafés</strong><strong>restaurants</strong><strong>salons</strong><strong>clinics</strong><strong>food courts</strong></section>
      <section className="marketing-section" id="features">
        <p className="eyebrow">Everything in one plan</p><h2>Friendly enough for the front counter. Reliable enough to leave running.</h2>
        <div className="feature-grid">
          <article className="panel"><h3>Fast playlist control</h3><p>Reorder content, change duration, pause items, and edit schedules from one table.</p></article>
          <article className="panel"><h3>Images and video</h3><p>Keep a reusable media library and assign the same promotion to multiple screens.</p></article>
          <article className="panel"><h3>Real scheduling</h3><p>Choose dates, weekdays, and daily hours in your business timezone.</p></article>
          <article className="panel"><h3>Community board</h3><p>Use open signup, invite-only access, approval, auto-publishing, and trusted members.</p></article>
          <article className="panel"><h3>Simple pairing</h3><p>Open the player on a TV or browser and enter one six-digit code. No networking expertise needed.</p></article>
          <article className="panel"><h3>Screen health</h3><p>See online status, last sync, current content, free storage, and recent errors.</p></article>
        </div>
      </section>
      <section className="marketing-section" id="how">
        <p className="eyebrow">Live in minutes</p><h2>Three steps from blank TV to live promotion.</h2>
        <div className="steps"><article><span>1</span><h3>Create a screen</h3><p>Name it and choose promotions, community posts, or both.</p></article><article><span>2</span><h3>Add your content</h3><p>Upload media, set the order and schedule, then switch items on.</p></article><article><span>3</span><h3>Enter the code</h3><p>Pair one browser or TV player and watch the screen update.</p></article></div>
      </section>
      <section className="marketing-section">
        <p className="eyebrow">Made for local business</p>
        <div className="industry-grid">{industries.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>
      <section className="marketing-section pricing-callout">
        <div><p className="eyebrow">Simple pricing</p><h2>One complete plan. Pay only for active screens.</h2><p>US$6 or CA$9 per screen each month. Annual billing includes two months free.</p></div>
        <div className="actions"><Link className="button" href="/signup">Start free trial</Link><Link className="button secondary" href="/pricing">View pricing</Link></div>
      </section>
      <footer className="marketing-footer"><Link href="/">DOOH Community</Link><nav><Link href="/pricing">Pricing</Link><Link href="/help">Help</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/acceptable-use">Acceptable use</Link></nav></footer>
    </main>
  );
}
