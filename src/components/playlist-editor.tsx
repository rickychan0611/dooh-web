"use client";

import { useEffect, useState } from "react";
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
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PlaylistEditor({
  screenId,
  initialItems,
}: {
  screenId: string;
  initialItems: PlaylistItem[];
}) {
  const [items, setItems] = useState(
    [...initialItems].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [dirty, setDirty] = useState(false);

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
          <article
            className="playlist-row"
            draggable
            key={item.adId}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => move(Number(event.dataTransfer.getData("text/plain")), index)}
          >
            <div className="playlist-order">
              <button type="button" aria-label={`Move ${item.title} up`} onClick={() => move(index, index - 1)}>↑</button>
              <strong>{index + 1}</strong>
              <button type="button" aria-label={`Move ${item.title} down`} onClick={() => move(index, index + 1)}>↓</button>
            </div>
            {item.type === "image" ? <img className="playlist-thumb" src={item.previewUrl} alt="" /> : <video className="playlist-thumb" src={item.previewUrl} muted />}
            <div className="playlist-main">
              <div className="playlist-title"><strong>{item.title}</strong><span className="badge">{item.type}</span></div>
              <div className="playlist-fields">
                <label>Seconds<input type="number" min="1" value={item.duration ?? item.defaultDuration} onChange={(event) => update(index, { duration: Number(event.target.value) })} /></label>
                <label>Start date<input type="datetime-local" value={item.startsAt?.slice(0, 16) ?? ""} onChange={(event) => update(index, { startsAt: event.target.value })} /></label>
                <label>End date<input type="datetime-local" value={item.endsAt?.slice(0, 16) ?? ""} onChange={(event) => update(index, { endsAt: event.target.value })} /></label>
                <label>Daily start<input type="time" value={item.startTime?.slice(0, 5) ?? ""} onChange={(event) => update(index, { startTime: event.target.value })} /></label>
                <label>Daily end<input type="time" value={item.endTime?.slice(0, 5) ?? ""} onChange={(event) => update(index, { endTime: event.target.value })} /></label>
              </div>
              <div className="weekday-row">
                {DAYS.map((day, dayIndex) => <label className="day-toggle" key={day}><input type="checkbox" checked={item.weekdays.includes(dayIndex)} onChange={() => toggleDay(index, dayIndex)} />{day}</label>)}
              </div>
            </div>
            <div className="playlist-actions">
              <label className="checkbox"><input type="checkbox" checked={item.isActive} onChange={(event) => update(index, { isActive: event.target.checked })} /> Active</label>
              <button className="button secondary compact-button" type="button" onClick={() => update(index, { ...initialItems.find((initial) => initial.adId === item.adId) })}>Reset</button>
              <button
                className="button danger compact-button"
                type="submit"
                formAction={unassignAd.bind(null, screenId, item.adId)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="sticky-save">
        <span>{dirty ? "Unsaved playlist changes" : "Playlist is saved"}</span>
        <button className="button" type="submit" disabled={!dirty}>Save playlist</button>
      </div>
    </form>
  );
}
