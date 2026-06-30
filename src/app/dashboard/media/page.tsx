import {
  assignAdToScreens,
  deleteAd,
  duplicateAd,
  uploadAd,
} from "@/app/dashboard/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireAdmin } from "@/lib/auth";
import { whenDevBypass } from "@/lib/dev-bypass";
import { withSignedAdUrl } from "@/lib/media";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function MediaPage() {
  const { organizationId } = await requireAdmin();
  const [data, screens] = await whenDevBypass([[] as any[], [] as any[]], async () => {
    const admin = getSupabaseAdmin();
    const [{ data: ads }, { data: screenRows }] = await Promise.all([
      admin
        .from("ads")
        .select("id,title,type,media_path,file_size,mime_type,duration,screen_ads(count)")
        .eq("organization_id", organizationId)
        .neq("status", "deleted")
        .order("created_at", { ascending: false }),
      admin
        .from("screens")
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name"),
    ]);
    return [ads ?? [], screenRows ?? []];
  });
  const ads = await Promise.all(data.map(withSignedAdUrl));

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Media library</h1>
        </div>
      </header>
      <section className="panel ads-upload-panel">
        <h2>Upload media</h2>
        <form action={uploadAd} className="form-grid ads-upload-form">
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Duration (seconds)
            <input name="duration" type="number" min="1" defaultValue="10" />
          </label>
          <label className="wide">
            Image or video
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              required
            />
          </label>
          <div className="form-action">
            <button className="button" type="submit">
              Upload
            </button>
          </div>
        </form>
      </section>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Preview</th>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Usage</th>
              <th>Assign to screens</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(ads ?? []).map((ad: any) => (
              <tr key={ad.id}>
                <td>
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
                </td>
                <td>{ad.title}</td>
                <td>{ad.mime_type ?? ad.type}</td>
                <td>{Math.round((ad.file_size ?? 0) / 1024)} KB</td>
                <td>{ad.screen_ads?.[0]?.count ?? 0} screens</td>
                <td>
                  <form action={assignAdToScreens} className="media-assign-form">
                    <input type="hidden" name="adId" value={ad.id} />
                    <div className="media-screen-options">
                      {(screens ?? []).map((screen: any) => (
                        <label className="checkbox" key={screen.id}>
                          <input type="checkbox" name="screenIds" value={screen.id} />
                          {screen.name}
                        </label>
                      ))}
                    </div>
                    <button className="button secondary compact-button">Assign selected</button>
                  </form>
                </td>
                <td>
                  <div className="actions">
                    <a
                      className="button secondary compact-button"
                      href={ad.media_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Preview
                    </a>
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
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
