import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Hash, MapPin } from "lucide-react";
import {
  claimPlayer,
  revokeDevice,
  updateCommunitySettings,
  updateScreen,
} from "@/app/dashboard/actions";
import { AddMediaToPlaylistModal } from "@/components/add-media-to-playlist-modal";
import { DeviceControlPanel } from "@/components/device-control-panel";
import { PlaylistEditor } from "@/components/playlist-editor";
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

function zonedDateParts(date: Date, timeZone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function zonedWallTimeToIso(
  timeZone: string,
  year: number,
  month: number,
  day: number,
) {
  const wallAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let instant = new Date(wallAsUtc);
  for (let index = 0; index < 2; index += 1) {
    const parts = zonedDateParts(instant, timeZone);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    instant = new Date(wallAsUtc - (asUtc - instant.getTime()));
  }
  return instant.toISOString();
}

function viewPeriodStarts(timeZone: string) {
  const parts = zonedDateParts(new Date(), timeZone);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const daysFromMonday: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const monday = new Date(Date.UTC(year, month - 1, day));
  monday.setUTCDate(monday.getUTCDate() - (daysFromMonday[parts.weekday] ?? 0));
  return {
    startOfDay: zonedWallTimeToIso(timeZone, year, month, day),
    startOfWeek: zonedWallTimeToIso(
      timeZone,
      monday.getUTCFullYear(),
      monday.getUTCMonth() + 1,
      monday.getUTCDate(),
    ),
    startOfMonth: zonedWallTimeToIso(timeZone, year, month, 1),
  };
}

function countViewsSince(
  rows: Array<{ ad_id: string; occurred_at: string }>,
  sinceIso: string,
) {
  const since = new Date(sinceIso).getTime();
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (new Date(row.occurred_at).getTime() < since) continue;
    counts.set(row.ad_id, (counts.get(row.ad_id) ?? 0) + 1);
  }
  return counts;
}

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

  const viewPeriods = viewPeriodStarts(organization.timezone);
  const viewFetchSince =
    new Date(viewPeriods.startOfWeek) < new Date(viewPeriods.startOfMonth)
      ? viewPeriods.startOfWeek
      : viewPeriods.startOfMonth;
  const [assignmentData, assetData, devices, messageSummary, cecCommands, monthViewRows] = await whenDevBypass(
    [[] as any[], [] as any[], [] as any[], [] as any[], [] as any[], [] as any[]],
    async () => {
      const admin = getSupabaseAdmin();
      const results = await Promise.all([
        admin.from("screen_ads").select("*,ads!inner(*)").eq("screen_id", id).order("sort_order"),
        admin.from("ads").select("*").eq("organization_id", organizationId).eq("status", "active").order("title"),
        admin.from("screen_devices").select("*").eq("screen_id", id).order("created_at", { ascending: false }),
        admin.from("bulletin_messages").select("status").eq("screen_id", id).neq("status", "deleted"),
        admin.from("screen_device_commands").select("command,status,completed_at").eq("screen_id", id).eq("status", "succeeded").in("command", ["cec_turn_on", "cec_turn_off", "cec_active_source", "cec_activate_player"]).order("completed_at", { ascending: false }).limit(12),
        admin.from("ad_playback_events").select("ad_id,occurred_at").eq("screen_id", id).eq("event_type", "completed").gte("occurred_at", viewFetchSince),
      ]);
      return [
        results[0].data ?? [],
        results[1].data ?? [],
        results[2].data ?? [],
        results[3].data ?? [],
        results[4].data ?? [],
        results[5].data ?? [],
      ];
    },
  );
  const todayCounts = countViewsSince(monthViewRows ?? [], viewPeriods.startOfDay);
  const weekCounts = countViewsSince(monthViewRows ?? [], viewPeriods.startOfWeek);
  const monthCounts = countViewsSince(monthViewRows ?? [], viewPeriods.startOfMonth);
  const viewCounts = new Map<string, { viewsToday: number; viewsThisWeek: number; viewsThisMonth: number }>();
  for (const adId of new Set([...todayCounts.keys(), ...weekCounts.keys(), ...monthCounts.keys()])) {
    viewCounts.set(adId, {
      viewsToday: todayCounts.get(adId) ?? 0,
      viewsThisWeek: weekCounts.get(adId) ?? 0,
      viewsThisMonth: monthCounts.get(adId) ?? 0,
    });
  }
  const assignments = await Promise.all(
    assignmentData.map(async (item: any) => ({
      ...item,
      ads: await withSignedAdUrl(item.ads),
    })),
  );
  const assets = await Promise.all(assetData.map(withSignedAdUrl));
  const assignedAdIds = new Set(assignments.map((item: any) => item.ads.id));
  const pendingPosts = messageSummary.filter((message: any) => message.status === "pending").length;
  const activeDevice = devices.find((device: any) => !device.revoked_at);
  const latestPowerCommand = cecCommands.find((command: any) => ["cec_turn_on", "cec_turn_off", "cec_activate_player"].includes(command.command));
  const latestInputCommand = cecCommands.find((command: any) => ["cec_active_source", "cec_activate_player"].includes(command.command));
  const tvStatus = latestPowerCommand
    ? (latestPowerCommand.command === "cec_turn_off" ? "Off (last commanded)" : "On (last commanded)")
    : "Unknown";
  const channelStatus = latestInputCommand ? "Player HDMI selected" : "Unknown";
  const online = screen.last_heartbeat_at && Date.now() - new Date(screen.last_heartbeat_at).getTime() < 300000;
  const tabs = [
    ["connect", "Connect"],
    ["content", "Content"],
    ["settings", "Settings"],
  ];

  return (
    <>
      <header className="page-header screen-detail-header">
        <div className="screen-detail-heading">
          <Link className="button secondary compact-button screen-back-link" href="/dashboard/screens">
            <ArrowLeft aria-hidden="true" size={14} />
            Screens
          </Link>
          <div className="actions screen-detail-title-row">
            <h1>{screen.name}</h1>
            <span className={`badge ${online ? "success" : "warning"} screen-status-badge ${online ? "online" : "offline"}`}>
              {online ? "Online" : "Offline"}
            </span>
          </div>
          <div className="message-meta screen-detail-meta" aria-label="Screen details">
            <span className="badge screen-meta-item"><MapPin aria-hidden="true" size={13} /><strong>Location:</strong> {screen.location || "No location"}</span>
            <span className="badge screen-meta-item"><Hash aria-hidden="true" size={13} /><strong>Screen ID:</strong> {screen.screen_code}</span>
            <span className="badge screen-meta-item"><Clock3 aria-hidden="true" size={13} /><strong>Timezone:</strong> {organization.timezone}</span>
          </div>
        </div>
      </header>
      <nav className="tabs">{tabs.map(([value, label]) => <Link className={tab === value ? "active" : ""} href={`/dashboard/screens/${id}?tab=${value}`} key={value}>{label}</Link>)}</nav>

      {tab === "content" && <>
        <section className="playlist-content-header">
          <h2>Playlist</h2>
          <AddMediaToPlaylistModal
            screenId={screen.id}
            assets={assets.map((asset: any) => ({
              id: asset.id,
              title: asset.title,
              type: asset.type,
              previewUrl: asset.media_url,
              isAssigned: assignedAdIds.has(asset.id),
            }))}
          />
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
          ...(viewCounts.get(item.ads.id) ?? {}),
        }))} />
      </>}

      {tab === "community" && <div className="two-column">
        <section className="panel"><h2>Board settings</h2><form action={updateCommunitySettings} className="stack"><input type="hidden" name="id" value={screen.id} /><label>Who can join<select name="communityAccess" defaultValue={screen.community_access}><option value="disabled">Community board disabled</option><option value="open">Open account signup</option><option value="invite_only">Invite only</option></select></label><label>Publishing<select name="communityModeration" defaultValue={screen.community_moderation}><option value="approval_required">Staff approval required</option><option value="auto_publish">Publish automatically</option></select></label><label className="checkbox"><input type="checkbox" name="communityAttachmentsAllowed" defaultChecked={screen.community_attachments_allowed} /> Allow image and video attachments</label><label className="checkbox"><input type="checkbox" name="showQrCode" defaultChecked={screen.show_qr_code} /> Show board QR code</label><label className="checkbox"><input type="checkbox" name="publicDirectoryEnabled" defaultChecked={screen.public_directory_enabled} /> List this board publicly</label><button className="button">Save community settings</button></form></section>
        <section className="panel"><h2>Moderation</h2><p className="muted">{pendingPosts} post{pendingPosts === 1 ? "" : "s"} waiting for review.</p><div className="actions"><Link className="button" href={`/dashboard/messages?screen=${screen.id}`}>Manage posts</Link><Link className="button secondary" href="/dashboard/community">Manage members</Link></div></section>
      </div>}

      {tab === "connect" && <>
        <div className="two-column">
          <section className="panel"><h2>Connect a TV or browser</h2><p className="muted">Open the DOOH player, then enter its single-use eight-digit code. Connecting a new player replaces any previous player on this screen. With one screen license, only one screen can stay connected at a time.</p>{pairing && pairingMessages[pairing] && <p className={`notice ${pairingMessages[pairing].danger ? "danger" : "success"}`}>{pairingMessages[pairing].text}</p>}<form action={claimPlayer} className="inline-form"><input type="hidden" name="screenId" value={screen.id} /><input name="claimCode" inputMode="numeric" pattern="[0-9 ]{8,11}" maxLength={11} placeholder="1234 5678" required /><button className="button">Connect</button></form></section>
          <section className="panel"><h2>Screen health</h2>{activeDevice ? <><div className="list"><div className="list-row"><div><strong>{online ? "Online" : "Offline"}</strong><p>Last heartbeat {screen.last_heartbeat_at ? new Date(screen.last_heartbeat_at).toLocaleString() : "never"}</p></div><span className={`badge ${online ? "success" : "warning"}`}>{activeDevice.app_version}</span></div><div className="list-row"><div><strong>Current item</strong><p>{activeDevice.current_item_id || "None reported"}</p></div></div><div className="list-row"><div><strong>Storage free</strong><p>{activeDevice.free_storage_mb ?? "Unknown"} MB</p></div></div></div><form action={revokeDevice} className="revoke-player-form"><input type="hidden" name="screenId" value={screen.id} /><input type="hidden" name="deviceId" value={activeDevice.id} /><button className="button danger">Revoke player</button></form></> : <p className="muted">No player connected.</p>}</section>
        </div>
        <DeviceControlPanel
          screenId={screen.id}
          hasActiveDevice={Boolean(activeDevice)}
          online={Boolean(online)}
          keepActiveEnabled={Boolean(screen.cec_keep_active_enabled)}
          tvStatus={tvStatus}
          channelStatus={channelStatus}
        />
      </>}

      {tab === "settings" && <section className="panel"><h2>Screen settings</h2><form action={updateScreen} className="form-grid"><input type="hidden" name="id" value={screen.id} /><label>Name<input name="name" defaultValue={screen.name} required /></label><label>Location<input name="location" defaultValue={screen.location ?? ""} /></label><div className="form-action"><button className="button">Save settings</button></div></form></section>}
    </>
  );
}
