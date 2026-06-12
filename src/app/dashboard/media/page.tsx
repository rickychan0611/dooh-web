import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function MediaPage() {
  const { organizationId } = await requireAdmin();
  const { data: ads } = await getSupabaseAdmin().from("ads").select("id,title,type,media_url,file_size,mime_type,screen_ads(count)").eq("organization_id", organizationId).neq("status", "deleted").order("created_at", { ascending: false });
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Storage</p><h1>Media library</h1></div></header>
      <section className="panel table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Usage</th><th>File</th></tr></thead><tbody>
        {(ads ?? []).map((ad: any) => <tr key={ad.id}><td>{ad.title}</td><td>{ad.mime_type ?? ad.type}</td><td>{Math.round((ad.file_size ?? 0) / 1024)} KB</td><td>{ad.screen_ads?.[0]?.count ?? 0} screens</td><td><a href={ad.media_url} target="_blank" rel="noreferrer">Open</a></td></tr>)}
      </tbody></table></section>
    </>
  );
}
