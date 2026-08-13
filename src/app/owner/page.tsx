import { OwnerOrganizationsTable } from "@/components/owner-organizations-table";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function OwnerPage() {
  const { data: organizations } = await getSupabaseAdmin()
    .from("organizations")
    .select("id,name,status,screen_license_quantity,billing_currency,created_at,screens(count)")
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Platform</p>
          <h1>Organizations</h1>
        </div>
      </header>
      <OwnerOrganizationsTable organizations={organizations ?? []} />
    </>
  );
}
