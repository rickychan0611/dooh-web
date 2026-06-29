import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function signedAdUrl(path: string, expiresIn = 60 * 60 * 24) {
  const { data, error } = await getSupabaseAdmin()
    .storage.from("ad-media")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function withSignedAdUrl<T extends { media_path: string }>(
  asset: T,
) {
  return { ...asset, media_url: await signedAdUrl(asset.media_path) };
}
