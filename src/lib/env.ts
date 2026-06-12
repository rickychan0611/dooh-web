import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OWNER_ALLOWLIST_EMAIL: z.email(),
  TOKEN_PEPPER: z.string().min(24),
  PAIRING_TOKEN_ENCRYPTION_KEY: z.string().min(32),
  QR_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  DEV_AUTH_BYPASS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.OWNER_ALLOWLIST_EMAIL &&
      process.env.TOKEN_PEPPER &&
      process.env.PAIRING_TOKEN_ENCRYPTION_KEY,
  );
}

export function isDevAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && getEnv().DEV_AUTH_BYPASS;
}
