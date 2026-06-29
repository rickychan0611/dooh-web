import { Resend } from "resend";
import { getEnv } from "@/lib/env";

let resendClient: Resend | null = null;

function getResend() {
  const apiKey = getEnv().RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  idempotencyKey: string;
}) {
  const resend = getResend();
  if (!resend) return;
  const action =
    input.actionUrl && input.actionLabel
      ? `<p><a href="${input.actionUrl}" style="display:inline-block;padding:12px 18px;background:#172622;color:#b8f36b;border-radius:8px;text-decoration:none;font-weight:700">${input.actionLabel}</a></p>`
      : "";
  await resend.emails.send(
    {
      from: getEnv().EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#17201d"><h1>${input.heading}</h1><p style="line-height:1.6">${input.body}</p>${action}<p style="color:#66736f;font-size:13px">DOOH Community</p></div>`,
    },
    { headers: { "Idempotency-Key": input.idempotencyKey } },
  );
}
