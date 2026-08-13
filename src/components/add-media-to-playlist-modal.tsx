"use client";

import { Check, Maximize2, Plus, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignAds } from "@/app/dashboard/actions";
import { UploadMediaModal } from "@/components/upload-media-modal";

type MediaAsset = {
  id: string;
  title: string;
  type: string;
  previewUrl: string;
  isAssigned: boolean;
};

export function AddMediaToPlaylistModal({
  screenId,
  assets,
}: {
  screenId: string;
  assets: MediaAsset[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const availableAssets = assets.filter((asset) => !asset.isAssigned);

  function open() {
    setError(null);
    setPreview(null);
    setSelectedIds([]);
    dialogRef.current?.showModal();
  }

  function close() {
    if (pending) return;
    setPreview(null);
    dialogRef.current?.close();
  }

  function toggle(assetId: string) {
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  function addSelected() {
    if (!selectedIds.length) return;
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("screenId", screenId);
        selectedIds.forEach((id) => formData.append("adIds", id));
        await assignAds(formData);
        dialogRef.current?.close();
        setSelectedIds([]);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Media could not be added.");
      }
    });
  }

  return (
    <>
      <button className="button" type="button" onClick={open}>
        <Plus aria-hidden="true" />
        Add media to playlist
      </button>
      <dialog
        ref={dialogRef}
        className="media-picker-modal"
        onClose={() => {
          setPreview(null);
          setError(null);
        }}
      >
        <div className="media-picker-shell">
          <header className="media-picker-header">
            <div>
              <p className="eyebrow">Media library</p>
              <h2>Add media to playlist</h2>
              <p>Choose one or more items, then add them together.</p>
            </div>
            <button
              className="media-picker-close"
              type="button"
              aria-label="Close media picker"
              onClick={close}
              disabled={pending}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className="media-picker-toolbar">
            <span>{availableAssets.length} available</span>
            <UploadMediaModal
              screenId={screenId}
              buttonLabel="Upload new media"
              title="Upload and add media"
              description="The file will be saved to your library and added to this playlist."
              submitLabel="Upload and add"
            />
          </div>

          {preview && (
            <div className="media-picker-lightbox" role="dialog" aria-label={`Preview ${preview.title}`}>
              <div className="media-picker-lightbox-header">
                <strong>{preview.title}</strong>
                <button type="button" onClick={() => setPreview(null)} aria-label="Close preview">
                  <X aria-hidden="true" />
                </button>
              </div>
              {preview.type === "image" ? (
                <img src={preview.previewUrl} alt={preview.title} />
              ) : (
                <video src={preview.previewUrl} controls autoPlay />
              )}
            </div>
          )}

          <div className="media-picker-grid">
            {availableAssets.map((asset) => {
              const selected = selectedIds.includes(asset.id);
              return (
                <article className={`media-picker-card${selected ? " selected" : ""}`} key={asset.id}>
                  <label className="media-picker-select">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(asset.id)}
                    />
                    <span aria-hidden="true"><Check /></span>
                    <span className="sr-only">Select {asset.title}</span>
                  </label>
                  <button
                    className="media-picker-thumbnail"
                    type="button"
                    onClick={() => setPreview(asset)}
                    aria-label={`Enlarge ${asset.title}`}
                  >
                    {asset.type === "image" ? (
                      <img src={asset.previewUrl} alt="" />
                    ) : (
                      <video src={asset.previewUrl} muted />
                    )}
                    <span><Maximize2 aria-hidden="true" /></span>
                  </button>
                  <button
                    className="media-picker-card-label"
                    type="button"
                    onClick={() => toggle(asset.id)}
                  >
                    <strong>{asset.title}</strong>
                    <span>{asset.type}</span>
                  </button>
                </article>
              );
            })}
            {!availableAssets.length && (
              <div className="media-picker-empty">
                <strong>Everything is already in this playlist</strong>
                <p>Upload new media to add another item.</p>
              </div>
            )}
          </div>

          {error && <p className="notice danger media-picker-error">{error}</p>}
          <footer className="media-picker-footer">
            <span>{selectedIds.length} selected</span>
            <div>
              <button className="button secondary" type="button" onClick={close} disabled={pending}>Cancel</button>
              <button className="button" type="button" onClick={addSelected} disabled={!selectedIds.length || pending}>
                {pending ? "Adding…" : `Add ${selectedIds.length || ""} to playlist`}
              </button>
            </div>
          </footer>
        </div>
      </dialog>
    </>
  );
}
