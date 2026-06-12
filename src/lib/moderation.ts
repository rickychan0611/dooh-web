import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { contentHash, fingerprint, hashToken } from "@/lib/security";
export { containsBlockedWord } from "./moderation-core";

export async function verifyQrToken(screenId: string, token?: string) {
  if (!token) return false;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("qr_sessions")
    .select("id")
    .eq("screen_id", screenId)
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

export async function enforceSubmissionLimits(input: {
  screenId: string;
  rawFingerprint: string;
  title: string;
  body: string;
  perSubmitterLimit: number;
  perSubmitterWindowMinutes: number;
  perScreenHourLimit: number;
}) {
  const admin = getSupabaseAdmin();
  const submitterFingerprint = fingerprint(input.rawFingerprint);
  const duplicateHash = contentHash(input.title, input.body);
  const submitterSince = new Date(
    Date.now() - input.perSubmitterWindowMinutes * 60_000,
  ).toISOString();
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const duplicateSince = new Date(Date.now() - 10 * 60_000).toISOString();

  const [submitterCount, screenCount, duplicate] = await Promise.all([
    admin
      .from("submission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("screen_id", input.screenId)
      .eq("fingerprint", submitterFingerprint)
      .gte("created_at", submitterSince),
    admin
      .from("submission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("screen_id", input.screenId)
      .gte("created_at", hourAgo),
    admin
      .from("submission_attempts")
      .select("id")
      .eq("screen_id", input.screenId)
      .eq("content_hash", duplicateHash)
      .gte("created_at", duplicateSince)
      .limit(1),
  ]);

  if ((submitterCount.count ?? 0) >= input.perSubmitterLimit) {
    throw new Error("SUBMITTER_RATE_LIMIT");
  }
  if ((screenCount.count ?? 0) >= input.perScreenHourLimit) {
    throw new Error("SCREEN_RATE_LIMIT");
  }
  if (duplicate.data?.length) throw new Error("DUPLICATE_SUBMISSION");

  await admin.from("submission_attempts").insert({
    screen_id: input.screenId,
    fingerprint: submitterFingerprint,
    content_hash: duplicateHash,
  });

  return submitterFingerprint;
}
