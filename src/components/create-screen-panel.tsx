"use client";

import { useState } from "react";
import { createScreen } from "@/app/dashboard/actions";

export function CreateScreenPanel({
  errorMessage,
  defaultOpen = false,
  canCreate = true,
}: {
  errorMessage?: string;
  defaultOpen?: boolean;
  canCreate?: boolean;
}) {
  const [openPanel, setOpenPanel] = useState(defaultOpen || Boolean(errorMessage));

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Fleet</p>
          <h1>Screens</h1>
        </div>
        {canCreate && (
          <button className="button" type="button" onClick={() => setOpenPanel(true)}>
            Create screen
          </button>
        )}
      </header>
      {canCreate && openPanel && (
        <section className="panel compact-create-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">New device</p>
              <h2>Create screen</h2>
            </div>
            <button
              className="button secondary compact-button"
              type="button"
              onClick={() => setOpenPanel(false)}
            >
              Cancel
            </button>
          </div>
          {errorMessage && (
            <p className="notice danger">{errorMessage}</p>
          )}
          <form action={createScreen} className="compact-form-grid">
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Screen ID
              <input
                name="screenCode"
                required
                pattern="[A-Za-z0-9_-]{3,40}"
                placeholder="LOBBY_02"
              />
            </label>
            <label>
              Location
              <input name="location" />
            </label>
            <label>
              Mode
              <select name="mode">
                <option value="ad_only">Ad only</option>
                <option value="bulletin_only">Bulletin only</option>
                <option value="mixed_rotation">Mixed rotation</option>
              </select>
            </label>
            <div className="compact-form-action">
              <button className="button" type="submit">
                Create screen
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
