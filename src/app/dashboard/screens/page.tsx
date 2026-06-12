import Link from "next/link";
import { CreateScreenPanel } from "@/components/create-screen-panel";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const errorMessages: Record<string, string> = {
  "invalid-screen-code":
    "Screen ID must be 3-40 characters using only letters, numbers, underscores, or hyphens. Example: LOBBY_02.",
  "duplicate-screen-code": "That Screen ID already exists. Choose a unique ID.",
  "missing-name": "Screen name is required.",
};

export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { organizationId } = await requireAdmin();
  const { data: screens } = await getSupabaseAdmin()
    .from("screens")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");

  return (
    <>
      <CreateScreenPanel
        errorMessage={
          error
            ? errorMessages[error] ?? "The screen could not be created."
            : undefined
        }
      />
      <div className="card-grid">
        {(screens ?? []).map((screen: any) => {
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
