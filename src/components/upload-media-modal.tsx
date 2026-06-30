"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAd } from "@/app/dashboard/actions";

export function UploadMediaModal({ screenId }: { screenId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await uploadAd(formData);
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <>
      <button className="button secondary compact-button" type="button" onClick={open}>
        Upload media
      </button>
      <dialog ref={dialogRef} className="media-modal" onClose={() => setError(null)}>
        <form action={handleSubmit} className="stack media-modal-form">
          <div className="media-modal-header">
            <div>
              <p className="eyebrow">Upload</p>
              <h2>Add media to this screen</h2>
              <p className="muted">The file is saved to your library and added to this playlist.</p>
            </div>
            <button
              className="button secondary compact-button"
              type="button"
              onClick={close}
              disabled={pending}
            >
              Close
            </button>
          </div>
          <input type="hidden" name="screenId" value={screenId} />
          <label>
            Title
            <input name="title" required disabled={pending} />
          </label>
          <label>
            Duration (seconds)
            <input name="duration" type="number" min="1" defaultValue="10" disabled={pending} />
          </label>
          <label>
            Image or video
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              required
              disabled={pending}
            />
          </label>
          {error && <p className="notice danger">{error}</p>}
          <div className="actions">
            <button className="button" type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Upload and add"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
