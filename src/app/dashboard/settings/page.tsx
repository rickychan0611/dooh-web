import { updateSettings } from "@/app/dashboard/actions";
import { requireAdmin } from "@/lib/auth";

export default async function SettingsPage() {
  const { organization } = await requireAdmin();
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Policy</p><h1>Settings</h1></div></header>
      <section className="panel"><form action={updateSettings} className="form-grid">
        <label>Business timezone<select name="timezone" defaultValue={organization.timezone}><option value="America/Vancouver">Pacific</option><option value="America/Edmonton">Mountain</option><option value="America/Winnipeg">Central</option><option value="America/Toronto">Eastern</option><option value="America/Halifax">Atlantic</option></select></label>
        <div className="form-action"><button className="button" type="submit">Save settings</button></div>
      </form></section>
    </>
  );
}
