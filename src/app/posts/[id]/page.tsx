import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function LegacyPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: post } = await getSupabaseAdmin()
    .from("bulletin_messages")
    .select("post_number,screens!inner(screen_code)")
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();
  redirect(`/screens/${post.screens.screen_code}/posts/${post.post_number}`);
}
