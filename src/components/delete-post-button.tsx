"use client";

import { useState } from "react";

export function DeletePostButton({ postId }: { postId: string }) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  async function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    const response = await fetch(`/api/account/posts/${postId}`, {
      method: "DELETE",
    });
    if (response.ok) window.location.reload();
    else setDeleting(false);
  }
  return (
    <button className="button danger" type="button" disabled={deleting} onClick={remove}>
      {deleting ? "Deleting..." : confirming ? "Confirm delete" : "Delete"}
    </button>
  );
}
