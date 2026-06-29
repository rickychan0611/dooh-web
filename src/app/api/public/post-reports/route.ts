import { NextResponse } from "next/server";
import { getPublicUser } from "@/lib/public-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/authorization";

export async function POST(request: Request) {
  const user = await getPublicUser();
  if (!user) {
    return NextResponse.json(
      { error: { message: "Sign in to report a post." } },
      { status: 401 },
    );
  }
  const body = await request.json().catch(() => null);
  const postId = String(body?.postId ?? "");
  const reason = String(body?.reason ?? "").trim().slice(0, 500);
  if (!postId || !reason) {
    return NextResponse.json(
      { error: { message: "A post and reason are required." } },
      { status: 400 },
    );
  }
  const admin = getSupabaseAdmin();
  const { data: post } = await admin
    .from("bulletin_messages")
    .select("id,organization_id")
    .eq("id", postId)
    .eq("status", "active")
    .maybeSingle();
  if (!post) {
    return NextResponse.json(
      { error: { message: "This post is no longer available." } },
      { status: 404 },
    );
  }
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await admin
    .from("post_reports")
    .select("id")
    .eq("post_id", post.id)
    .eq("reporter_user_id", user.id)
    .gte("created_at", oneDayAgo)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true });
  }
  const { data: report, error } = await admin
    .from("post_reports")
    .insert({
      organization_id: post.organization_id,
      post_id: post.id,
      reporter_user_id: user.id,
      reason,
    })
    .select("id")
    .single();
  if (error) throw error;
  await writeAudit({
    organizationId: post.organization_id,
    actorUserId: user.id,
    action: "community.post_reported",
    targetType: "post_report",
    targetId: report.id,
    metadata: { postId: post.id },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
