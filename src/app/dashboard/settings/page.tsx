import { updateSettings } from "@/app/dashboard/actions";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function SettingsPage() {
  const { organizationId } = await requireAdmin();
  const { data: settings } = await getSupabaseAdmin().from("organization_settings").select("*").eq("organization_id", organizationId).single();
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Policy</p><h1>Settings</h1></div></header>
      <section className="panel"><form action={updateSettings} className="form-grid">
        <label>Default message duration<input name="defaultMessageDuration" type="number" min="5" max="120" defaultValue={settings?.default_message_duration ?? 12} /></label>
        <label>Posts per submitter<input name="perSubmitterLimit" type="number" min="1" defaultValue={settings?.per_submitter_limit ?? 3} /></label>
        <label>Submitter window (minutes)<input name="perSubmitterWindowMinutes" type="number" min="1" defaultValue={settings?.per_submitter_window_minutes ?? 10} /></label>
        <label>Posts per screen/hour<input name="perScreenHourLimit" type="number" min="1" defaultValue={settings?.per_screen_hour_limit ?? 10} /></label>
        <label className="wide">Blocked words, comma separated<textarea name="blockedWords" defaultValue={(settings?.blocked_words ?? []).join(", ")} /></label>
        <div className="form-action"><button className="button" type="submit">Save settings</button></div>
      </form></section>
    </>
  );
}
