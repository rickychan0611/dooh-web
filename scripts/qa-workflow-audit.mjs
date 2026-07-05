import { existsSync } from "node:fs";
import { join } from "node:path";

const requiredSurfaces = {
  "public user account": [
    "src/app/account/login/page.tsx",
    "src/app/account/signup/page.tsx",
    "src/app/account/forgot-password/page.tsx",
    "src/app/account/reset-password/page.tsx",
    "src/app/account/profile/page.tsx",
    "src/app/account/my-posts/page.tsx",
    "src/app/account/saved/page.tsx",
  ],
  "organization admin": [
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/screens/page.tsx",
    "src/app/dashboard/screens/[id]/page.tsx",
    "src/app/dashboard/media/page.tsx",
    "src/app/dashboard/billing/page.tsx",
    "src/app/dashboard/team/page.tsx",
    "src/app/dashboard/settings/page.tsx",
  ],
  "player api": [
    "src/app/api/player/pairing-session/route.ts",
    "src/app/api/player/pairing-session/status/route.ts",
    "src/app/api/player/[screenCode]/content/route.ts",
    "src/app/api/player/[screenCode]/heartbeat/route.ts",
    "src/app/api/player/[screenCode]/qr-session/route.ts",
    "src/app/api/player/[screenCode]/playback-event/route.ts",
  ],
  "public posting api": [
    "src/app/api/public/screens/route.ts",
    "src/app/api/public/screens/[screenCode]/route.ts",
    "src/app/api/public/submit-message/route.ts",
    "src/app/api/public/post-reports/route.ts",
    "src/app/api/account/saved-posts/route.ts",
    "src/app/api/account/posts/[id]/route.ts",
  ],
  "platform owner": [
    "src/app/owner/page.tsx",
    "src/app/owner/organizations/[id]/page.tsx",
    "src/app/owner/organizations/[id]/actions.ts",
  ],
  billing: [
    "src/app/dashboard/billing/page.tsx",
    "src/app/dashboard/billing/actions.ts",
    "src/app/api/webhooks/stripe/route.ts",
  ],
};

const missing = Object.entries(requiredSurfaces).flatMap(([workflow, files]) =>
  files
    .filter((file) => !existsSync(join(process.cwd(), file)))
    .map((file) => ({ workflow, file })),
);

if (missing.length) {
  console.error("Missing workflow surfaces:");
  for (const item of missing) {
    console.error(`- ${item.workflow}: ${item.file}`);
  }
  process.exit(1);
}

console.log("Workflow surface audit passed.");
for (const [workflow, files] of Object.entries(requiredSurfaces)) {
  console.log(`- ${workflow}: ${files.length} files`);
}
