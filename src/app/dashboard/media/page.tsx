import {
  deleteAd,
  duplicateAd,
} from "@/app/dashboard/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { MediaScreenAssignForm } from "@/components/media-screen-assign-form";
import { UploadMediaModal } from "@/components/upload-media-modal";
import { requireAdmin } from "@/lib/auth";
import { whenDevBypass } from "@/lib/dev-bypass";
import { withSignedAdUrl } from "@/lib/media";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function MediaPage() {
  const { organizationId } = await requireAdmin();
  const [data, screens, viewRows] = await whenDevBypass([[] as any[], [] as any[], [] as any[]], async () => {
    const admin = getSupabaseAdmin();
    const [{ data: ads }, { data: screenRows }, { data: views }] = await Promise.all([
      admin
        .from("ads")
        .select("id,title,type,media_path,file_size,mime_type,duration,screen_ads(screen_id)")
        .eq("organization_id", organizationId)
        .neq("status", "deleted")
        .order("created_at", { ascending: false }),
      admin
        .from("screens")
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name"),
      admin
        .from("ad_playback_view_counts")
        .select("ad_id,total_views,views_7d,views_30d")
        .eq("organization_id", organizationId),
    ]);
    return [ads ?? [], screenRows ?? [], views ?? []];
  });
  const ads = await Promise.all(data.map(withSignedAdUrl));
  const viewCounts = new Map<string, { total: number; seven: number; thirty: number }>();
  for (const row of viewRows ?? []) {
    const current = viewCounts.get(row.ad_id) ?? { total: 0, seven: 0, thirty: 0 };
    current.total += Number(row.total_views ?? 0);
    current.seven += Number(row.views_7d ?? 0);
    current.thirty += Number(row.views_30d ?? 0);
    viewCounts.set(row.ad_id, current);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Media library</h1>
        </div>
        <UploadMediaModal />
      </header>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Preview</th>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Usage</th>
              <th>Views</th>
              <th>Assign to screens</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(ads ?? []).map((ad: any) => {
              const views = viewCounts.get(ad.id) ?? { total: 0, seven: 0, thirty: 0 };
              return (
              <tr key={ad.id}>
                <td>
                  <a
                    className="media-table-thumb-link"
                    href={ad.media_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Preview ${ad.title}`}
                  >
                    {ad.type === "image" ? (
                      <img
                        className="media-table-thumb"
                        src={ad.media_url}
                        alt={ad.title}
                        loading="lazy"
                      />
                    ) : (
                      <video
                        className="media-table-thumb"
                        src={ad.media_url}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </a>
                </td>
                <td>{ad.title}</td>
                <td>{ad.mime_type ?? ad.type}</td>
                <td>{Math.round((ad.file_size ?? 0) / 1024)} KB</td>
                <td>{ad.screen_ads?.length ?? 0} screens</td>
                <td>{views.total} total<br /><span className="muted">{views.seven} 7d · {views.thirty} 30d</span></td>
                <td>
                  <MediaScreenAssignForm
                    adId={ad.id}
                    screens={screens ?? []}
                    assignedScreenIds={(ad.screen_ads ?? []).map(
                      (assignment: { screen_id: string }) => assignment.screen_id,
                    )}
                  />
                </td>
                <td className="media-table-actions-cell">
                  <div className="media-table-actions">
                    <form action={duplicateAd}>
                      <input type="hidden" name="adId" value={ad.id} />
                      <button className="button secondary compact-button">Duplicate</button>
                    </form>
                    <form action={deleteAd}>
                      <input type="hidden" name="adId" value={ad.id} />
                      <ConfirmSubmitButton
                        className="button danger compact-button"
                        message={`Delete "${ad.title}"? It will be removed from all playlists.`}
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </section>
    </>
  );
}
