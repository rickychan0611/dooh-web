"use client";

import { BULLETIN_CATEGORIES } from "@dooh/shared";
import { useState } from "react";

export function SubmissionForm({
  screenCode,
  qrToken,
  defaultName = "",
  defaultContact = "",
}: {
  screenCode: string;
  qrToken?: string;
  defaultName?: string;
  defaultContact?: string;
}) {
  const [state, setState] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ kind: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setState({ kind: "loading" });
    const form = new FormData(formElement);
    form.set("screenCode", screenCode);
    form.set("agreement", String(form.get("agreement") === "on"));
    form.set(
      "showContactPublicly",
      String(form.get("showContactPublicly") === "on"),
    );
    if (qrToken) form.set("qrToken", qrToken);
    const response = await fetch("/api/public/submit-message", {
      method: "POST",
      body: form,
    });
    const result = await response.json();
    if (!response.ok) {
      setState({
        kind: "error",
        message: result.error?.message ?? "The message could not be submitted.",
      });
      return;
    }
    formElement.reset();
    setState({
      kind: "success",
      message: result.publishedImmediately
        ? "Your message is now live on the screen."
        : "Your message was received and is waiting for review.",
    });
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Category
        <select name="category" defaultValue="community">
          {BULLETIN_CATEGORIES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>Title<input name="title" required maxLength={80} /></label>
      <label>Full details<textarea name="body" required maxLength={2000} rows={8} /></label>
      <div className="form-grid">
        <label>Your name (optional)<input name="submitterName" maxLength={80} defaultValue={defaultName} /></label>
        <label>Contact (optional)<input name="submitterContact" maxLength={160} defaultValue={defaultContact} /></label>
      </div>
      <label className="checkbox"><input name="showContactPublicly" type="checkbox" />Show my contact on the public post detail page</label>
      <label>
        Photo or video (optional, maximum 20 MB)
        <input
          name="media"
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        />
      </label>
      <label className="checkbox agreement"><input name="agreement" type="checkbox" required />I have the right to submit this content. It does not contain offensive, private, illegal, or misleading material and may appear publicly.</label>
      <button className="button" type="submit" disabled={state.kind === "loading"}>{state.kind === "loading" ? "Posting..." : "Post message"}</button>
      {state.message && <p className={`notice ${state.kind === "success" ? "success" : "danger"}`}>{state.message}</p>}
    </form>
  );
}
