"use client";

import { useMemo, useState } from "react";

const articles = [
  {
    title: "Create a screen",
    body: "Open Screens in the dashboard. Create a screen and choose whether it shows promotions, community posts, or both.",
  },
  {
    title: "Upload content",
    body: "Open Ads, upload an image or MP4/WebM video, then add it to the screen playlist.",
  },
  {
    title: "Connect the player",
    body: "Open the player on the TV or browser. In the screen Device tab, enter the six-digit code shown.",
  },
  {
    title: "Check screen health",
    body: "The Device tab shows last heartbeat, app version, current item, free storage, and recent errors.",
  },
  {
    title: "Expired pairing code",
    body: "Pairing codes last ten minutes. Use the newest code currently visible on the player.",
  },
  {
    title: "Offline screen",
    body: "Confirm the device has internet access, reload the player, and check that the subscription and screen are active.",
  },
  {
    title: "Replace a TV or browser",
    body: "Pair the new player to the same screen. The previous player is revoked automatically.",
  },
  {
    title: "Scheduled content is missing",
    body: "Check that the playlist item is active and that its date, weekday, and daily time schedule currently match.",
  },
];

export function HelpSearch() {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return articles;
    return articles.filter((article) =>
      `${article.title} ${article.body}`.toLowerCase().includes(term),
    );
  }, [query]);

  return (
    <>
      <label className="help-search">
        Search help
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try pairing, offline, schedule..."
        />
      </label>
      <div className="faq help-results">
        {matches.map((article, index) => (
          <details key={article.title}>
            <summary>
              {index < 4 && !query ? `${index + 1}. ` : ""}
              {article.title}
            </summary>
            <p>{article.body}</p>
          </details>
        ))}
        {!matches.length && (
          <p className="muted help-empty">No matching article. Try a shorter search such as pairing, screen, or schedule.</p>
        )}
      </div>
    </>
  );
}
