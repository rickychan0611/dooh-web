"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";

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
    title: "Buy screen licenses",
    body: "Open Billing to add licenses and pay in checkout. Creating a screen never charges a card. If every license is in use, buy more licenses or deactivate a screen in Settings.",
  },
  {
    title: "Cancel a subscription",
    body: "On Billing, choose Cancel subscription. Screens stay online until the paid period ends. After that, licenses expire and players disconnect. You can keep the subscription before that date.",
  },
  {
    title: "Refund a license purchase",
    body: "On Billing, apply for a refund within seven days of adding licenses. If a platform admin approves it, the money is returned and those extra licenses are removed. Screens above the new limit are deactivated and those players disconnect.",
  },
  {
    title: "Scheduled content is missing",
    body: "Check that the playlist item is active and that its date, weekday, and daily time schedule currently match.",
  },
];

export function HelpSearch() {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const matches = term
    ? articles.filter((article) =>
        `${article.title} ${article.body}`.toLowerCase().includes(term),
      )
    : articles;

  return (
    <>
      <div className="help-search-panel">
        <label className="help-search">
          <span>Search help articles</span>
          <span className="help-search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try pairing, offline, or schedule"
            />
          </span>
        </label>
      </div>
      <div className="help-content-heading">
        <div>
          <h2>{query ? "Search results" : "Popular topics"}</h2>
          <p>{query ? `Showing matches for “${query}”` : "Start with the most common setup and troubleshooting guides."}</p>
        </div>
        <span>{matches.length} {matches.length === 1 ? "article" : "articles"}</span>
      </div>
      <div className="faq help-results">
        {matches.map((article, index) => (
          <details key={article.title}>
            <summary>
              <span>
                {index < 4 && !query ? `${index + 1}. ` : ""}
                {article.title}
              </span>
              <ChevronDown aria-hidden="true" />
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
