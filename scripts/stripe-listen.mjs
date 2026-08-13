import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

if (!env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is missing from .env.local");
  process.exit(1);
}

function resolveStripeBin() {
  const localAppData =
    process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  const candidates = [
    process.env.STRIPE_CLI_PATH,
    join(localAppData, "Microsoft", "WinGet", "Links", "stripe.exe"),
  ].filter(Boolean);

  const wingetPackages = join(localAppData, "Microsoft", "WinGet", "Packages");
  if (existsSync(wingetPackages)) {
    for (const entry of readdirSync(wingetPackages)) {
      if (entry.toLowerCase().startsWith("stripe.stripecli")) {
        candidates.push(join(wingetPackages, entry, "stripe.exe"));
      }
    }
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  return process.platform === "win32" ? "stripe.exe" : "stripe";
}

const stripeBin = resolveStripeBin();
const child = spawn(
  stripeBin,
  [
    "listen",
    "--api-key",
    env.STRIPE_SECRET_KEY,
    "--forward-to",
    "localhost:3000/api/webhooks/stripe",
    "--events",
    [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
      "charge.refunded",
    ].join(","),
  ],
  { stdio: "inherit", shell: false },
);

child.on("error", (error) => {
  console.error(
    "Could not start Stripe CLI. Close and reopen this terminal, or install it with:",
  );
  console.error("  winget install --id Stripe.StripeCli");
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 1));
