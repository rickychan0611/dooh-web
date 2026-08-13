"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { createScreen } from "@/app/dashboard/actions";

function FieldTip({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`field-tip${open ? " open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="field-tip-button"
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      >
        <CircleHelp aria-hidden="true" size={14} />
      </button>
      {open && (
        <span className="field-tip-bubble" role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}

export function CreateScreenPanel({
  errorMessage,
  defaultOpen = false,
  canCreate = true,
  canBuyLicenses = false,
  licensedScreens = 1,
  activeScreens = 0,
}: {
  errorMessage?: string;
  defaultOpen?: boolean;
  canCreate?: boolean;
  canBuyLicenses?: boolean;
  licensedScreens?: number;
  activeScreens?: number;
}) {
  const atCapacity = activeScreens >= licensedScreens;
  const [openPanel, setOpenPanel] = useState(
    (defaultOpen && !atCapacity) || Boolean(errorMessage),
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Fleet</p>
          <h1>Screens</h1>
          <p className="muted">
            {activeScreens} of {licensedScreens} licenses in use
            {canBuyLicenses && (
              <>
                {" "}
                <Link
                  className="text-link"
                  href="/dashboard/billing?action=add-licenses"
                >
                  (buy more licenses)
                </Link>
              </>
            )}
          </p>
        </div>
        {canCreate && (
          <button
            className="button"
            type="button"
            onClick={() => setOpenPanel(true)}
          >
            Create screen
          </button>
        )}
      </header>
      {canCreate && openPanel && atCapacity && (
        <section className="panel compact-create-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">License limit</p>
              <h2>All licenses are in use</h2>
            </div>
            <button
              className="button secondary compact-button"
              type="button"
              onClick={() => setOpenPanel(false)}
            >
              Close
            </button>
          </div>
          {errorMessage && <p className="notice danger">{errorMessage}</p>}
          <p className="muted">
            Buy more licenses to add another screen, or deactivate a screen in its Settings tab to free a slot.
          </p>
          {canBuyLicenses ? (
            <Link className="button" href="/dashboard/billing?action=add-licenses">
              Buy licenses
            </Link>
          ) : (
            <p className="muted">Ask an owner or admin to buy more licenses.</p>
          )}
        </section>
      )}
      {canCreate && openPanel && !atCapacity && (
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
              Screen name
              <input name="name" required />
            </label>
            <div className="compact-field">
              <span className="field-label-row">
                <label htmlFor="create-screen-code">Screen ID</label>
                <FieldTip label="Screen ID">
                  A unique code for this screen. Use 3–40 letters, numbers, underscores, or hyphens. It cannot be changed after the screen is created.
                </FieldTip>
              </span>
              <input
                id="create-screen-code"
                name="screenCode"
                required
                pattern="[A-Za-z0-9_-]{3,40}"
              />
            </div>
            <label>
              Location
              <input name="location" />
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
