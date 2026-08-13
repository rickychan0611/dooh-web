"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { assignAd } from "@/app/dashboard/actions";

export function AssignToPlaylistForm({
  screenId,
  assets,
}: {
  screenId: string;
  assets: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="inline-form"
      action={(formData) => {
        startTransition(async () => {
          await assignAd(formData);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="screenId" value={screenId} />
      <select name="adId" required disabled={pending}>
        <option value="">Choose an image or video</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.title}
          </option>
        ))}
      </select>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to playlist"}
      </button>
    </form>
  );
}
