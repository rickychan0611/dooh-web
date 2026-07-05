import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowFiles = [
  "src/app/account/login/page.tsx",
  "src/app/account/signup/page.tsx",
  "src/app/account/forgot-password/page.tsx",
  "src/app/account/reset-password/page.tsx",
  "src/app/account/profile/page.tsx",
  "src/app/account/my-posts/page.tsx",
  "src/app/account/saved/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/screens/page.tsx",
  "src/app/dashboard/screens/[id]/page.tsx",
  "src/app/dashboard/media/page.tsx",
  "src/app/dashboard/billing/page.tsx",
  "src/app/dashboard/team/page.tsx",
  "src/app/owner/page.tsx",
  "src/app/owner/organizations/[id]/page.tsx",
  "src/app/api/player/pairing-session/route.ts",
  "src/app/api/player/pairing-session/status/route.ts",
  "src/app/api/player/[screenCode]/content/route.ts",
  "src/app/api/player/[screenCode]/heartbeat/route.ts",
  "src/app/api/player/[screenCode]/playback-event/route.ts",
  "src/app/api/public/submit-message/route.ts",
  "src/app/api/account/saved-posts/route.ts",
  "src/app/api/account/posts/[id]/route.ts",
  "src/app/api/webhooks/stripe/route.ts",
];

describe("workflow coverage map", () => {
  it("keeps required user, admin, player, billing, and owner surfaces present", () => {
    const missing = workflowFiles.filter(
      (file) => !existsSync(join(process.cwd(), file)),
    );

    expect(missing).toEqual([]);
  });
});
