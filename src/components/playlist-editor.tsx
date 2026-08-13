"use client";

import { ArrowDown, ArrowUp, ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { savePlaylist, unassignAd } from "@/app/dashboard/actions";

type PlaylistItem = {
  adId: string;
  title: string;
  type: string;
  previewUrl: string;
  sortOrder: number;
  duration: number | null;
  defaultDuration: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  weekdays: number[];
  startTime: string | null;
  endTime: string | null;
  viewsToday?: number;
  viewsThisWeek?: number;
  viewsThisMonth?: number;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function scheduleSummary(item: PlaylistItem) {
  const parts: string[] = [];
  if (item.startsAt) parts.push(`Starts ${item.startsAt.slice(0, 10)}`);
  if (item.endsAt) parts.push(`Ends ${item.endsAt.slice(0, 10)}`);
  if (item.startTime || item.endTime) {
    parts.push(`${item.startTime?.slice(0, 5) || "Any time"}–${item.endTime?.slice(0, 5) || "Any time"}`);
  }
  if (item.weekdays.length < DAYS.length) {
    const activeDays = DAYS.filter((_, dayIndex) => item.weekdays.includes(dayIndex));
    parts.push(activeDays.length ? activeDays.join(", ") : "No active days");
  }
  return parts.length ? parts.join(" · ") : "No schedule limits";
}

export function PlaylistEditor({
  screenId,
  initialItems,
}: {
  screenId: string;
  initialItems: PlaylistItem[];
}) {
  const router = useRouter();
  const [pendingRemove, startRemoveTransition] = useTransition();
  const serverSnapshot = useMemo(
    () =>
      [...initialItems]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          ...item,
          weekdays: [...item.weekdays],
        })),
    [initialItems],
  );
  const serverKey = useMemo(
    () =>
      serverSnapshot
        .map(
          (item) =>
            `${item.adId}:${item.sortOrder}:${item.duration}:${item.isActive}`,
        )
        .join("|"),
    [serverSnapshot],
  );
  const [items, setItems] = useState(serverSnapshot);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setItems(serverSnapshot);
    setDirty(false);
  }, [serverKey, serverSnapshot]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(index: number, patch: Partial<PlaylistItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
    setDirty(true);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    setItems((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDirty(true);
  }

  function toggleDay(index: number, day: number) {
    const current = items[index].weekdays;
    update(index, {
      weekdays: current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    });
  }

  function resetItem(index: number, adId: string) {
    const original = initialItems.find((item) => item.adId === adId);
    if (original) update(index, { ...original, weekdays: [...original.weekdays] });
  }

  function discardChanges() {
    setItems(serverSnapshot);
    setDirty(false);
  }

  function removeItem(adId: string) {
    startRemoveTransition(async () => {
      setItems((current) => current.filter((item) => item.adId !== adId));
      setDirty(false);
      await unassignAd(screenId, adId);
      router.refresh();
    });
  }

  const payload = items.map((item, index) => ({
    adId: item.adId,
    sortOrder: index,
    duration: item.duration,
    isActive: item.isActive,
    startsAt: item.startsAt || null,
    endsAt: item.endsAt || null,
    weekdays: item.weekdays,
    startTime: item.startTime || null,
    endTime: item.endTime || null,
  }));

  if (!items.length) {
    return <p className="muted">No content assigned yet. Choose media above to begin.</p>;
  }

  return (
    <form action={savePlaylist} onSubmit={() => setDirty(false)}>
      <input type="hidden" name="screenId" value={screenId} />
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <div className="playlist-list">
        {items.map((item, index) => (
          <article className="playlist-row" key={item.adId}>
            <header className="playlist-card-header">
              <div className="playlist-media-summary">
                {item.type === "image" ? (
                  <img className="playlist-thumb" src={item.previewUrl} alt="" />
                ) : (
                  <video className="playlist-thumb" src={item.previewUrl} muted />
                )}
                <div
                  className="playlist-identity"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
                >
                  <div className="playlist-identity-copy" style={{ minWidth: 0 }}>
                    <span className="playlist-position">Playlist item {index + 1}</span>
                    <div className="playlist-title">
                      <strong>{item.title}</strong>
                      <span className="badge">{item.type}</span>
                    </div>
                  </div>
                  <div
                    className="playlist-duration"
                    aria-label={`Duration ${item.duration ?? item.defaultDuration} seconds`}
                    style={{
                      minWidth: 68,
                      paddingLeft: 16,
                      borderLeft: "1px solid #e3e3e3",
                      display: "grid",
                      justifyItems: "end",
                      alignContent: "center",
                      flex: "none",
                    }}
                  >
                    <span style={{ color: "#616161", fontSize: 10, lineHeight: "15px", fontWeight: 600 }}>Duration</span>
                    <strong style={{ color: "#1a1a1a", fontSize: 28, lineHeight: "30px", fontWeight: 750, letterSpacing: "-.04em" }}>
                      {item.duration ?? item.defaultDuration}
                      <small style={{ marginLeft: 2, color: "#4a4a4a", fontSize: 13, lineHeight: 1, fontWeight: 650, letterSpacing: 0 }}>s</small>
                    </strong>
                  </div>
                </div>
              </div>
              <div
                className="playlist-metrics"
                aria-label={`View performance for ${item.title}`}
              >
                <div><strong>{item.viewsToday ?? 0}</strong><span>Today's views</span></div>
                <div><strong>{item.viewsThisWeek ?? 0}</strong><span>This week's views</span></div>
                <div><strong>{item.viewsThisMonth ?? 0}</strong><span>This month's views</span></div>
              </div>
            </header>

            <details className="playlist-schedule-details">
              <summary className="playlist-schedule-summary">
                <span>
                  <strong>Playback schedule</strong>
                  <small>{scheduleSummary(item)}</small>
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="playlist-schedule-content">
                <p className="playlist-schedule-help">Leave dates or times empty to play without those limits.</p>
                <div className="playlist-fields">
                <label>
                  Duration (seconds)
                  <input
                    type="number"
                    min="1"
                    value={item.duration ?? item.defaultDuration}
                    onChange={(event) => update(index, { duration: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Start date
                  <input
                    type="datetime-local"
                    value={item.startsAt?.slice(0, 16) ?? ""}
                    onChange={(event) => update(index, { startsAt: event.target.value })}
                  />
                </label>
                <label>
                  End date
                  <input
                    type="datetime-local"
                    value={item.endsAt?.slice(0, 16) ?? ""}
                    onChange={(event) => update(index, { endsAt: event.target.value })}
                  />
                </label>
                <label>
                  Daily start
                  <input
                    type="time"
                    value={item.startTime?.slice(0, 5) ?? ""}
                    onChange={(event) => update(index, { startTime: event.target.value })}
                  />
                </label>
                <label>
                  Daily end
                  <input
                    type="time"
                    value={item.endTime?.slice(0, 5) ?? ""}
                    onChange={(event) => update(index, { endTime: event.target.value })}
                  />
                </label>
                </div>
                <div className="playlist-days-setting">
                  <span>Active days</span>
                  <div className="weekday-row">
                    {DAYS.map((day, dayIndex) => (
                      <label className="day-toggle" key={day}>
                        <input
                          type="checkbox"
                          checked={item.weekdays.includes(dayIndex)}
                          onChange={() => toggleDay(index, dayIndex)}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            <footer className="playlist-card-footer">
              <div className="playlist-order">
                <span>Position {index + 1} of {items.length}</span>
                <button
                  type="button"
                  aria-label={`Move ${item.title} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.title} down`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </button>
              </div>
              <div className="playlist-actions">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    onChange={(event) => update(index, { isActive: event.target.checked })}
                  />
                  Active
                </label>
                <button
                  className="button secondary compact-button"
                  type="button"
                  onClick={() => resetItem(index, item.adId)}
                >
                  <RotateCcw aria-hidden="true" />
                  Reset
                </button>
                <button
                  className="button danger compact-button"
                  type="button"
                  disabled={pendingRemove}
                  onClick={() => removeItem(item.adId)}
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </button>
              </div>
            </footer>
          </article>
        ))}
      </div>
      {dirty && (
        <div className="playlist-save-bar" role="region" aria-label="Unsaved playlist changes">
          <span>Unsaved playlist changes</span>
          <div>
            <button className="button secondary" type="button" onClick={discardChanges}>Discard</button>
            <button className="button" type="submit">Save playlist</button>
          </div>
        </div>
      )}
    </form>
  );
}
