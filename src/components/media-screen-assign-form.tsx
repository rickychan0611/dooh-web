"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignAdToScreen, unassignAd } from "@/app/dashboard/actions";

type Screen = { id: string; name: string };

export function MediaScreenAssignForm({
  adId,
  screens,
  assignedScreenIds,
}: {
  adId: string;
  screens: Screen[];
  assignedScreenIds: string[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState(() => new Set(assignedScreenIds));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setAssigned(new Set(assignedScreenIds));
  }, [assignedScreenIds]);

  function toggle(screenId: string, checked: boolean) {
    setError(null);
    setAssigned((current) => {
      const next = new Set(current);
      if (checked) next.add(screenId);
      else next.delete(screenId);
      return next;
    });
    startTransition(async () => {
      try {
        if (checked) await assignAdToScreen(adId, screenId);
        else await unassignAd(screenId, adId);
        router.refresh();
      } catch (err) {
        setAssigned(new Set(assignedScreenIds));
        setError(err instanceof Error ? err.message : "Could not update assignment.");
      }
    });
  }

  return (
    <div className="media-assign-form">
      <div className="media-screen-options">
        {screens.map((screen) => (
          <label className="checkbox" key={screen.id}>
            <input
              type="checkbox"
              checked={assigned.has(screen.id)}
              disabled={pending}
              onChange={(event) => toggle(screen.id, event.target.checked)}
            />
            {screen.name}
          </label>
        ))}
      </div>
      {error && <p className="notice danger">{error}</p>}
    </div>
  );
}
