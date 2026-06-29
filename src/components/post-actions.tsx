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

  async function reportPost() {
    if (!signedIn) {
      window.location.href = loginUrl;
      return;
    }
    const reason = window.prompt("Briefly tell the screen owner why this post should be reviewed.");
    if (!reason?.trim()) return;
    setMessage("Sending report...");
    const response = await fetch("/api/public/post-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, reason: reason.trim() }),
    });
    const result = await response.json().catch(() => null);
    setMessage(response.ok ? "Report sent for review." : result?.error?.message ?? "Could not send report.");
  }

  return (
    <div className="post-actions">
      <button className="button secondary" type="button" onClick={toggleSaved}>
        {saved ? "Saved" : "Save post"}
      </button>
      <button className="button" type="button" onClick={sharePost}>Share</button>
      <button className="link-button muted" type="button" onClick={reportPost}>Report</button>
      {message && <span className="muted">{message}</span>}
    </div>
  );
}
