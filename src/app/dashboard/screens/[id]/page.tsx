import Link from "next/link";
import { notFound } from "next/navigation";
import {
  assignAd, claimPlayer, revokeDevice, unassignAd, updateScreen,
} from "@/app/dashboard/actions";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const pairingMessages: Record<string, { text: string; danger?: boolean }> = {
  success: { text: "Player connected successfully." },
  invalid: { text: "That player code was not found.", danger: true },
  "invalid-format": { text: "Enter the six-digit code shown by the player.", danger: true },
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
  searchParams: Promise<{ pairing?: string }>;
}) {
  const { organizationId } = await requireAdmin();
  const { id } = await params;
  const { pairing } = await searchParams;
  const admin = getSupabaseAdmin();
  const [{ data: screen }, { data: assignments }, { data: allAds }, { data: devices }] = await Promise.all([
    admin.from("screens").select("*").eq("id", id).eq("organization_id", organizationId).single(),
    admin.from("screen_ads").select("sort_order, ads(*)").eq("screen_id", id).order("sort_order"),
    admin.from("ads").select("id,title,type").eq("status", "active").order("title"),
    admin.from("screen_devices").select("*").eq("screen_id", id).order("created_at", { ascending: false }),
  ]);
  if (!screen) notFound();

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">{screen.screen_code}</p><h1>{screen.name}</h1></div>
        <div className="actions">
          <Link className="button secondary" href={`/dashboard/messages?screen=${screen.id}`}>Manage messages</Link>
        </div>
      </header>
      <section className="panel">
        <h2>Player configuration</h2>
        <form action={updateScreen} className="form-grid">
          <input type="hidden" name="id" value={screen.id} />
          <label>Name<input name="name" defaultValue={screen.name} required /></label>
          <label>Location<input name="location" defaultValue={screen.location ?? ""} /></label>
          <label>Mode<select name="mode" defaultValue={screen.mode}><option value="ad_only">Ad only</option><option value="bulletin_only">Bulletin only</option><option value="mixed_rotation">Mixed rotation</option></select></label>
          <label>Ad block seconds<input name="adBlockSeconds" type="number" min="1" defaultValue={screen.ad_block_seconds} /></label>
          <label>Bulletin block seconds<input name="bulletinBlockSeconds" type="number" min="1" defaultValue={screen.bulletin_block_seconds} /></label>
          <label className="checkbox"><input type="checkbox" name="showQrCode" defaultChecked={screen.show_qr_code} /> Show QR code</label>
          <label className="checkbox"><input type="checkbox" name="publicDirectoryEnabled" defaultChecked={screen.public_directory_enabled} /> Public directory</label>
          <div className="form-action"><button className="button" type="submit">Save configuration</button></div>
        </form>
      </section>
      <div className="two-column">
        <section className="panel">
          <h2>Playlist</h2>
          <form action={assignAd} className="inline-form">
            <input type="hidden" name="screenId" value={screen.id} />
            <select name="adId" required><option value="">Choose ad</option>{(allAds ?? []).map((ad: any) => <option key={ad.id} value={ad.id}>{ad.title}</option>)}</select>
            <input name="sortOrder" type="number" min="0" defaultValue="0" aria-label="Sort order" />
            <button className="button" type="submit">Assign</button>
          </form>
          <div className="list">{(assignments ?? []).map((item: any) => (
            <div className="list-row" key={item.ads.id}><div><strong>{item.ads.title}</strong><p>{item.ads.type} · order {item.sort_order}</p></div>
              <form action={unassignAd}><input type="hidden" name="screenId" value={screen.id} /><input type="hidden" name="adId" value={item.ads.id} /><button className="button danger" type="submit">Remove</button></form>
            </div>
          ))}</div>
        </section>
        <section className="panel">
          <h2>Pairing and devices</h2>
          <p className="muted">Enter the six-digit code displayed on the player.</p>
          {pairing && pairingMessages[pairing] && <p className={`notice ${pairingMessages[pairing].danger ? "danger" : "success"}`}>{pairingMessages[pairing].text}</p>}
          <form action={claimPlayer} className="inline-form">
            <input type="hidden" name="screenId" value={screen.id} />
            <input name="claimCode" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="123 456" required />
            <button className="button secondary" type="submit">Connect player</button>
          </form>
          <div className="list">{(devices ?? []).map((device: any) => (
            <div className="list-row" key={device.id}><div><strong>{device.device_id}</strong><p>{device.app_version} · {device.revoked_at ? "Revoked" : "Active"}</p></div>
              {!device.revoked_at && <form action={revokeDevice}><input type="hidden" name="screenId" value={screen.id} /><input type="hidden" name="deviceId" value={device.id} /><button className="button danger" type="submit">Revoke</button></form>}
            </div>
          ))}</div>
        </section>
      </div>
    </>
  );
}
