import { requireEditor } from "@/lib/auth";
import { whenDevBypass } from "@/lib/dev-bypass";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { updateCommunityMember } from "./actions";

export default async function CommunityPage() {
  const { organizationId } = await requireEditor();
  const rows = await whenDevBypass([] as any[], async () => {
    const admin = getSupabaseAdmin();
    const { data: members } = await admin
      .from("community_members")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    return Promise.all(
      (members ?? []).map(async (member: any) => {
        const [{ data: profile }, auth] = await Promise.all([
          admin.from("user_profiles").select("display_name,contact").eq("user_id", member.user_id).maybeSingle(),
          admin.auth.admin.getUserById(member.user_id),
        ]);
        return { ...member, ...profile, email: auth.data.user?.email ?? member.user_id };
      }),
    );
  });
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Community</p><h1>Members</h1></div></header>
      <section className="panel table-wrap"><table><thead><tr><th>Member</th><th>Contact</th><th>Status</th><th>Manage</th></tr></thead><tbody>
        {rows.map((member: any) => <tr key={member.user_id}><td><strong>{member.display_name || member.email}</strong><p className="muted">{member.email}</p></td><td>{member.contact || "Not provided"}</td><td><span className={`badge ${member.status === "trusted" ? "success" : member.status === "suspended" || member.status === "banned" ? "warning" : ""}`}>{member.status}</span></td><td>
          <form action={updateCommunityMember} className="inline-form"><input type="hidden" name="userId" value={member.user_id} /><select name="status" defaultValue={member.status}><option value="active">Active</option><option value="trusted">Trusted auto-publisher</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select><button className="button secondary compact-button">Save</button></form>
        </td></tr>)}
      </tbody></table></section>
    </>
  );
}
