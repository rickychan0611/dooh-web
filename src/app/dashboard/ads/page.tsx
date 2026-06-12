import { uploadAd } from "@/app/dashboard/actions";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function AdsPage() {
  const { organizationId } = await requireAdmin();
  const { data: ads } = await getSupabaseAdmin().from("ads").select("*").eq("organization_id", organizationId).neq("status", "deleted").order("created_at", { ascending: false });
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Content</p><h1>Ads</h1></div></header>
      <section className="panel"><h2>Upload ad</h2>
        <form action={uploadAd} className="form-grid">
          <label>Title<input name="title" required /></label><label>Duration (seconds)<input name="duration" type="number" min="1" defaultValue="10" /></label>
          <label className="wide">Image or video<input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required /></label>
          <div className="form-action"><button className="button" type="submit">Upload</button></div>
        </form>
      </section>
      <section className="card-grid">{(ads ?? []).map((ad: any) => <article className="panel" key={ad.id}><span className="badge">{ad.type}</span><h2>{ad.title}</h2><p>{ad.duration}s · {Math.round((ad.file_size ?? 0) / 1024)} KB</p><a href={ad.media_url} target="_blank" rel="noreferrer">Preview media</a></article>)}</section>
    </>
  );
}
