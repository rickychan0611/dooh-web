import Link from "next/link";
import { CreateScreenPanel } from "@/components/create-screen-panel";
import { requireAdmin } from "@/lib/auth";
import { whenDevBypass } from "@/lib/dev-bypass";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const errorMessages: Record<string, string> = {
  "invalid-screen-code":
    "Screen ID must be 3-40 characters using only letters, numbers, underscores, or hyphens. Example: LOBBY_02.",
  "duplicate-screen-code": "That Screen ID already exists. Choose a unique ID.",
  "missing-name": "Screen name is required.",
  "license-limit":
    "All screen licenses are in use. Add a license or deactivate another screen.",
};

export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; create?: string }>;
}) {
  const { error, create } = await searchParams;
  const { organizationId, role } = await requireAdmin();
  const screens = await whenDevBypass([] as any[], async () => {
    const { data } = await getSupabaseAdmin()
      .from("screens")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");
    return data ?? [];
  });

  return (
    <>
      <CreateScreenPanel
        defaultOpen={create === "1" || screens.length === 0}
        canCreate={role !== "viewer"}
        errorMessage={
          error
            ? errorMessages[error] ?? "The screen could not be created."
            : undefined
        }
      />
      {!screens.length && (
        <section className="panel empty-state">
          <h2>No screens yet</h2>
          <p className="muted">
            {role === "viewer"
              ? "Ask an admin on your team to create the first screen."
              : "Click Create screen above to add your first TV or browser player."}
          </p>
        </section>
      )}
      <div className="card-grid">
        {(screens).map((screen: any) => {
          const online = screen.last_heartbeat_at && Date.now() - new Date(screen.last_heartbeat_at).getTime() < 5 * 60_000;
          return (
            <Link className="panel screen-card" href={`/dashboard/screens/${screen.id}`} key={screen.id}>
              <span className={`badge ${online ? "success" : ""}`}>{online ? "Online" : "Offline"}</span>
              <h2>{screen.name}</h2><p>{screen.location || "No location"}</p>
              <code>{screen.screen_code}</code><span>{screen.mode.replaceAll("_", " ")}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
