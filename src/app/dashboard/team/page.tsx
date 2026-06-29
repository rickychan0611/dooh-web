import { requireManager } from "@/lib/auth";
import { whenDevBypass } from "@/lib/dev-bypass";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { inviteStaff, removeStaff, updateStaffRole } from "./actions";

export default async function TeamPage() {
  const { organizationId } = await requireManager();
  const rows = await whenDevBypass([] as any[], async () => {
    const admin = getSupabaseAdmin();
    const { data: memberships } = await admin
      .from("admin_users")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at");
    return Promise.all(
      (memberships ?? []).map(async (membership: any) => {
        const { data } = await admin.auth.admin.getUserById(membership.user_id);
        return { ...membership, email: data.user?.email ?? membership.user_id };
      }),
    );
  });
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Access</p><h1>Team</h1></div></header>
      <section className="panel">
        <h2>Invite staff</h2>
        <form action={inviteStaff} className="inline-form">
          <input name="email" type="email" placeholder="manager@example.com" required />
          <select name="role" defaultValue="editor"><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
          <button className="button">Send invitation</button>
        </form>
      </section>
      <section className="panel table-wrap">
        <table><thead><tr><th>Email</th><th>Role</th><th>Actions</th></tr></thead><tbody>
          {rows.map((member: any) => <tr key={member.user_id}><td>{member.email}</td><td><span className="badge">{member.role}</span></td><td>
            {member.role !== "owner" && <div className="actions">
              <form action={updateStaffRole} className="inline-form"><input type="hidden" name="userId" value={member.user_id} /><select name="role" defaultValue={member.role}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className="button secondary compact-button">Save</button></form>
              <form action={removeStaff}><input type="hidden" name="userId" value={member.user_id} /><button className="button danger compact-button">Remove</button></form>
            </div>}
          </td></tr>)}
        </tbody></table>
      </section>
    </>
  );
}
