import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
      {screens.length > 0 && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-status">Status</th>
                <th>Name</th>
                <th>Location</th>
                <th>Screen ID</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {screens.map((screen: any) => {
                const online =
                  screen.last_heartbeat_at &&
                  Date.now() - new Date(screen.last_heartbeat_at).getTime() < 5 * 60_000;
                return (
                  <tr key={screen.id}>
                    <td>
                      <span className={`badge ${online ? "success" : ""}`}>
                        {online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/screens/${screen.id}`}
                        className="table-link"
                      >
                        {screen.name}
                        <ArrowUpRight aria-hidden />
                      </Link>
                    </td>
                    <td>{screen.location || "No location"}</td>
                    <td>
                      <code>{screen.screen_code}</code>
                    </td>
                    <td>{screen.mode.replaceAll("_", " ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
