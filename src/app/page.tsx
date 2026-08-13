import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { CalendarClock, Cloud, Download, LayoutGrid, Monitor } from "lucide-react";
import { HeroStackSlider } from "@/components/hero-stack-slider";
import { MarketingNav } from "@/components/marketing-nav";
import { getMarketingNavState } from "@/lib/auth";

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

const highlights = [
  {
    icon: Cloud,
    title: "Cloud-based Control",
    copy: "Update your screens in real time from your phone or desktop. Push them live in seconds.",
  },
  {
    icon: CalendarClock,
    title: "Smart Scheduling",
    copy: "Set content to run on specific days or times. Automate your morning, lunch, and evening promotions.",
  },
  {
    icon: LayoutGrid,
    title: "Multi-Screen Sync",
    copy: "Manage 1 or 1,000 screens from a single interface. Group them by department or physical location.",
  },
];

export default async function HomePage() {
  const navState = await getMarketingNavState();
  const slides = getSlideImages();
  const apkDownloadUrl = process.env.NEXT_PUBLIC_PLAYER_APK_URL || "/downloads/player.apk";
  const apkIsExternal = apkDownloadUrl.startsWith("http");
  const webPlayerUrl = process.env.NEXT_PUBLIC_WEB_PLAYER_URL || "https://dooh-player.netlify.app/";
  return (
    <main>
      <MarketingNav navState={navState} />
      <section className="marketing-hero">
        <div className="hero-content">
          <p className="eyebrow">Digital signage plus community</p>
          <h1>
            Turn any TV into digital signage.
            <span className="hero-accent">Easily.</span>
          </h1>
          <p className="hero-copy">Upload images and videos, schedule promotions in seconds, and optionally give your customers a moderated community board.</p>
          <div className="actions">
            {!navState.isLoggedIn && (
              <Link className="button hero-action-button" href="/signup">Start 14 days free</Link>
            )}
            {navState.showDashboard && (
              <Link className="button hero-action-button" href="/dashboard">Dashboard</Link>
            )}
            {navState.showOwnerConsole && (
              <Link className="button secondary hero-action-button" href="/owner">Admin panel</Link>
            )}
          </div>
          {!navState.isLoggedIn && (
            <p className="microcopy">No credit card · $9 per screen / month · Cancel anytime</p>
          )}
          <div className="player-actions">
            <a
              className="player-action-button hero-action-button"
              href={webPlayerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="player-action-icon" aria-hidden>
                <Monitor size={15} strokeWidth={2} />
              </span>
              Web Player
            </a>
            <a
              className="player-action-button hero-action-button"
              href={apkDownloadUrl}
              {...(apkIsExternal ? { target: "_blank", rel: "noopener noreferrer" } : { download: true })}
            >
              <span className="player-action-icon" aria-hidden>
                <Download size={15} strokeWidth={2} />
              </span>
              Download APK
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <HeroStackSlider images={slides} />
        </div>
      </section>
      <section className="marketing-tagline">
        <h2>Simple screen control for any place with a TV.</h2>
        <p>Built for local businesses, schools, churches, community centres, clinics, gyms, offices, apartment lobbies, and any place with a screen in a common area. Easily show announcements, promotions, schedules, menus, events, reminders, and community messages without complicated setup.</p>
      </section>
      <section className="highlight-cards">
        <div className="highlight-grid">
          {highlights.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="highlight-card">
              <div className="highlight-icon" aria-hidden="true">
                <Icon strokeWidth={1.5} />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="marketing-section" id="features">
        <p className="eyebrow">Everything in one plan</p><h2>Easy for anyone to update. Reliable enough to run all day.</h2>
        <div className="feature-grid">
          <article className="panel"><h3>Fast playlist control</h3><p>Reorder content, change duration, pause items, and edit schedules from one table.</p></article>
          <article className="panel"><h3>Images and video</h3><p>Keep a reusable media library and assign the same promotion to multiple screens.</p></article>
          <article className="panel"><h3>Offline playback</h3><p>Players cache your media locally so screens keep running during brief network outages.</p></article>
          <article className="panel"><h3>Community board</h3><p>Use open signup, invite-only access, approval, auto-publishing, and trusted members.</p></article>
          <article className="panel"><h3>Simple pairing</h3><p>Open the player on a TV or browser and enter one six-digit code. No networking expertise needed.</p></article>
          <article className="panel"><h3>Screen health</h3><p>See online status, last sync, current content, free storage, and recent errors.</p></article>
        </div>
      </section>
      <section className="marketing-section" id="how">
        <p className="eyebrow">Live in minutes</p><h2>Three steps from blank TV to live promotion.</h2>
        <div className="steps"><article><span>1</span><h3>Create a screen</h3><p>Name it and choose promotions, community posts, or both.</p></article><article><span>2</span><h3>Add your content</h3><p>Upload media, set the order and schedule, then switch items on.</p></article><article><span>3</span><h3>Enter the code</h3><p>Pair one browser or TV player and watch the screen update.</p></article></div>
      </section>
      <section className="marketing-section pricing-callout">
        <div><p className="eyebrow">Simple pricing</p><h2>One price per screen.</h2><p>$9 per screen each month. No discounts, no extra-screen tiers.</p></div>
        <div className="actions">
          {!navState.isLoggedIn ? (
            <>
              <Link className="button" href="/signup">Start free trial</Link>
              <Link className="button secondary" href="/pricing">View pricing</Link>
            </>
          ) : (
            <>
              {navState.showDashboard && (
                <Link className="button" href="/dashboard">Dashboard</Link>
              )}
              {navState.showOwnerConsole && (
                <Link className="button secondary" href="/owner">Admin panel</Link>
              )}
            </>
          )}
        </div>
      </section>
      <footer className="marketing-footer"><Link href="/">DOOH Community</Link><nav><Link href="/pricing">Pricing</Link><Link href="/help">Help</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/acceptable-use">Acceptable use</Link></nav></footer>
    </main>
  );
}
