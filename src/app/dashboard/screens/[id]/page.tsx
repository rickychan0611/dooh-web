import Link from "next/link";
import { notFound } from "next/navigation";
import {
  assignAd,
  claimPlayer,
  revokeDevice,
  updateCommunitySettings,
  updateScreen,
} from "@/app/dashboard/actions";
import { PlaylistEditor } from "@/components/playlist-editor";
import { UploadMediaModal } from "@/components/upload-media-modal";
import { requireAdmin } from "@/lib/auth";
import { whenDevBypass } from "@/lib/dev-bypass";
import { withSignedAdUrl } from "@/lib/media";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const pairingMessages: Record<string, { text: string; danger?: boolean }> = {
  success: { text: "Player connected successfully." },
  invalid: { text: "That player code was not found.", danger: true },
  "invalid-format": { text: "Enter the eight-digit code shown by the player.", danger: true },
  expired: { text: "That player code expired. Use the new code displayed by the player.", danger: true },
  claimed: { text: "That player code has already been used.", danger: true },
  "rate-limited": { text: "Too many pairing attempts. Wait a few minutes and try again.", danger: true },
  "screen-inactive": { text: "This screen is inactive.", danger: true },
  failed: { text: "The player could not be connected.", danger: true },
};

export default async function ScreenDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pairing?: string; tab?: string }>;
}) {
  const { organizationId, organization } = await requireAdmin();
  const { id } = await params;
  const { pairing, tab = "connect" } = await searchParams;
  const screen = await whenDevBypass(null as any, async () => {
    const { data } = await getSupabaseAdmin()
      .from("screens")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();
    return data;
  });
  if (!screen) notFound();

  const [assignmentData, assetData, devices, messageSummary] = await whenDevBypass(
    [[] as any[], [] as any[], [] as any[], [] as any[]],
    async () => {
      const admin = getSupabaseAdmin();
      const results = await Promise.all([
        admin.from("screen_ads").select("*,ads!inner(*)").eq("screen_id", id).order("sort_order"),
        admin.from("ads").select("*").eq("organization_id", organizationId).eq("status", "active").order("title"),
        admin.from("screen_devices").select("*").eq("screen_id", id).order("created_at", { ascending: false }),
        admin.from("bulletin_messages").select("status").eq("screen_id", id).neq("status", "deleted"),
      ]);
      return [
        results[0].data ?? [],
        results[1].data ?? [],
        results[2].data ?? [],
        results[3].data ?? [],
      ];
    },
  );
  const assignments = await Promise.all(
    assignmentData.map(async (item: any) => ({
      ...item,
      ads: await withSignedAdUrl(item.ads),
    })),
  );
  const assets = await Promise.all(assetData.map(withSignedAdUrl));
  const pendingPosts = messageSummary.filter((message: any) => message.status === "pending").length;
  const activeDevice = devices.find((device: any) => !device.revoked_at);
  const online = screen.last_heartbeat_at && Date.now() - new Date(screen.last_heartbeat_at).getTime() < 300000;
  const tabs = [
    ["connect", "Connect"],
    ["content", "Content"],
    ["community", `Community${pendingPosts ? ` (${pendingPosts})` : ""}`],
    ["settings", "Settings"],
  ];

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">{screen.screen_code} · {organization.timezone}</p><h1>{screen.name}</h1><p className="muted">{screen.location || "No location"} · {online ? "Online" : "Offline"}</p></div>
        <Link className="button secondary" href="/dashboard/screens">All screens</Link>
      </header>
      <nav className="tabs">{tabs.map(([value, label]) => <Link className={tab === value ? "active" : ""} href={`/dashboard/screens/${id}?tab=${value}`} key={value}>{label}</Link>)}</nav>

      {tab === "content" && <>
        <section className="panel compact-create-panel">
          <div className="panel-heading"><div><p className="eyebrow">Playlist</p><h2>Add media</h2></div><UploadMediaModal screenId={screen.id} /></div>
          <form action={assignAd} className="inline-form"><input type="hidden" name="screenId" value={screen.id} /><select name="adId" required><option value="">Choose an image or video</option>{assets.map((asset: any) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select><button className="button">Add to playlist</button></form>
        </section>
        <PlaylistEditor screenId={screen.id} initialItems={assignments.map((item: any) => ({
          adId: item.ads.id,
          title: item.ads.title,
          type: item.ads.type,
          previewUrl: item.ads.media_url,
          sortOrder: item.sort_order,
          duration: item.duration,
          defaultDuration: item.ads.duration,
          isActive: item.is_active,
          startsAt: item.starts_at,
          endsAt: item.ends_at,
          weekdays: item.weekdays ?? [0,1,2,3,4,5,6],
          startTime: item.start_time,
          endTime: item.end_time,
        }))} />
      </>}

      {tab === "community" && <div className="two-column">
        <section className="panel"><h2>Board settings</h2><form action={updateCommunitySettings} className="stack"><input type="hidden" name="id" value={screen.id} /><label>Who can join<select name="communityAccess" defaultValue={screen.community_access}><option value="disabled">Community board disabled</option><option value="open">Open account signup</option><option value="invite_only">Invite only</option></select></label><label>Publishing<select name="communityModeration" defaultValue={screen.community_moderation}><option value="approval_required">Staff approval required</option><option value="auto_publish">Publish automatically</option></select></label><label className="checkbox"><input type="checkbox" name="communityAttachmentsAllowed" defaultChecked={screen.community_attachments_allowed} /> Allow image and video attachments</label><label className="checkbox"><input type="checkbox" name="showQrCode" defaultChecked={screen.show_qr_code} /> Show board QR code</label><label className="checkbox"><input type="checkbox" name="publicDirectoryEnabled" defaultChecked={screen.public_directory_enabled} /> List this board publicly</label><button className="button">Save community settings</button></form></section>
        <section className="panel"><h2>Moderation</h2><p className="muted">{pendingPosts} post{pendingPosts === 1 ? "" : "s"} waiting for review.</p><div className="actions"><Link className="button" href={`/dashboard/messages?screen=${screen.id}`}>Manage posts</Link><Link className="button secondary" href="/dashboard/community">Manage members</Link></div></section>
      </div>}

      {tab === "connect" && <div className="two-column">
        <section className="panel"><h2>Connect a TV or browser</h2><p className="muted">Open the DOOH player, then enter its single-use eight-digit code. Connecting a new player replaces any previous player on this screen. With one screen license, only one screen can stay connected at a time.</p>{pairing && pairingMessages[pairing] && <p className={`notice ${pairingMessages[pairing].danger ? "danger" : "success"}`}>{pairingMessages[pairing].text}</p>}<form action={claimPlayer} className="inline-form"><input type="hidden" name="screenId" value={screen.id} /><input name="claimCode" inputMode="numeric" pattern="[0-9 ]{8,11}" maxLength={11} placeholder="1234 5678" required /><button className="button">Connect</button></form></section>
        <section className="panel"><h2>Screen health</h2>{activeDevice ? <div className="list"><div className="list-row"><div><strong>{online ? "Online" : "Offline"}</strong><p>Last heartbeat {screen.last_heartbeat_at ? new Date(screen.last_heartbeat_at).toLocaleString() : "never"}</p></div><span className={`badge ${online ? "success" : "warning"}`}>{activeDevice.app_version}</span></div><div className="list-row"><div><strong>Current item</strong><p>{activeDevice.current_item_id || "None reported"}</p></div></div><div className="list-row"><div><strong>Storage free</strong><p>{activeDevice.free_storage_mb ?? "Unknown"} MB</p></div></div><form action={revokeDevice}><input type="hidden" name="screenId" value={screen.id} /><input type="hidden" name="deviceId" value={activeDevice.id} /><button className="button danger">Revoke player</button></form></div> : <p className="muted">No player connected.</p>}</section>
      </div>}

      {tab === "settings" && <section className="panel"><h2>Screen settings</h2><form action={updateScreen} className="form-grid"><input type="hidden" name="id" value={screen.id} /><label>Name<input name="name" defaultValue={screen.name} required /></label><label>Location<input name="location" defaultValue={screen.location ?? ""} /></label><label>Mode<select name="mode" defaultValue={screen.mode}><option value="ad_only">Promotions only</option><option value="bulletin_only">Community only</option><option value="mixed_rotation">Promotions and community</option></select></label><label>Promotion block seconds<input name="adBlockSeconds" type="number" min="1" defaultValue={screen.ad_block_seconds} /></label><label>Community block seconds<input name="bulletinBlockSeconds" type="number" min="1" defaultValue={screen.bulletin_block_seconds} /></label><label className="checkbox"><input type="checkbox" name="showQrCode" defaultChecked={screen.show_qr_code} /> Show QR code</label><label className="checkbox"><input type="checkbox" name="publicDirectoryEnabled" defaultChecked={screen.public_directory_enabled} /> Public directory</label><label className="checkbox"><input type="checkbox" name="isActive" defaultChecked={screen.is_active} /> Active screen license</label><div className="form-action"><button className="button">Save settings</button></div></form></section>}
    </>
  );
}
