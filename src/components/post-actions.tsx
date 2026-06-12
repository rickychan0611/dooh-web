"use client";

import { useState } from "react";

export function PostActions({
  postId,
  initiallySaved,
  signedIn,
  loginUrl,
}: {
  postId: string;
  initiallySaved: boolean;
  signedIn: boolean;
  loginUrl: string;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [message, setMessage] = useState("");

  async function toggleSaved() {
    if (!signedIn) {
      window.location.href = loginUrl;
      return;
    }
    setMessage(saved ? "Removing..." : "Saving...");
    const response = await fetch("/api/account/saved-posts", {
      method: saved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    if (response.ok) {
      setSaved((current) => !current);
      setMessage("");
      return;
    }
    const result = await response.json().catch(() => null);
    setMessage(result?.error?.message ?? "Could not update saved posts.");
  }

  async function sharePost() {
    const shareData = { title: document.title, url: window.location.href };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setMessage("Link copied.");
  }

  return (
    <div className="post-actions">
      <button className="button secondary" type="button" onClick={toggleSaved}>
        {saved ? "Saved" : "Save post"}
      </button>
      <button className="button" type="button" onClick={sharePost}>Share</button>
      {message && <span className="muted">{message}</span>}
    </div>
  );
}
