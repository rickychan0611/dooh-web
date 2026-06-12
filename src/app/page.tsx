import Link from "next/link";

export default function HomePage() {
  return (
    <main className="hero">
      <div>
        <p className="eyebrow">DOOH Interactive Screen Platform</p>
        <h1>Reliable screens. Local voices. One control room.</h1>
        <p className="hero-copy">
          Manage advertising playlists and community bulletin boards built to
          keep playing through reboots and unreliable Wi-Fi.
        </p>
        <div className="actions">
          <Link className="button" href="/screens">
            Find a screen
          </Link>
          <Link className="button secondary" href="/login">
            Admin dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
