import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmissionForm } from "@/components/submission-form";
import { requirePublicUser } from "@/lib/public-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { serviceState } from "@/lib/entitlements";

export default async function SubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ screenCode: string }>;
  searchParams: Promise<{ qr?: string }>;
}) {
  const { screenCode } = await params;
  const { qr } = await searchParams;
  const returnTo = `/submit/${screenCode}${qr ? `?qr=${encodeURIComponent(qr)}` : ""}`;
  const user = await requirePublicUser(returnTo);
  const { data: screen } = await getSupabaseAdmin().from("screens").select("screen_code,name,location,community_access,organizations!inner(*)").eq("screen_code", screenCode.toUpperCase()).eq("is_active", true).single();
  if (!screen || screen.community_access === "disabled" || serviceState(screen.organizations) === "suspended") notFound();
  const { data: profile } = await getSupabaseAdmin()
    .from("user_profiles")
    .select("display_name,contact")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <main className="center-shell"><section className="panel submit-panel">
      <Link href="/screens">← All screens</Link><p className="eyebrow">{screen.location || screen.screen_code}</p><h1>Post to {screen.name}</h1>
      <p className="muted">{qr ? "You scanned the live screen. Valid on-location posts appear immediately." : "Online posts are sent to the screen operator for review."}</p>
      <SubmissionForm screenCode={screen.screen_code} qrToken={qr} defaultName={profile?.display_name ?? ""} defaultContact={profile?.contact ?? ""} />
    </section></main>
  );
}
