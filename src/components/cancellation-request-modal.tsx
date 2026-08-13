"use client";

import { useRef } from "react";
import { submitRefundApplication } from "@/app/dashboard/billing/actions";

export function CancellationRequestModal({
  licenseChangeId,
}: {
  licenseChangeId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        className="link-button muted"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Cancel
      </button>
      <dialog ref={dialogRef} className="media-modal">
        <form action={submitRefundApplication} className="stack media-modal-form">
          <div className="media-modal-header">
            <h2>Cancellation requests</h2>
            <button
              className="button secondary compact-button"
              type="button"
              onClick={close}
            >
              Close
            </button>
          </div>
          <p className="muted">
            If a refund is approved, the extra licenses from that purchase are removed. Screens above the new limit are deactivated and those players disconnect.
          </p>
          <input type="hidden" name="licenseChangeId" value={licenseChangeId} />
          <label>
            Reason
            <textarea name="reason" placeholder="Why are you requesting this cancellation?" required />
          </label>
          <button className="button">Submit</button>
        </form>
      </dialog>
    </>
  );
}
