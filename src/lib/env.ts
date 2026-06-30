import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_PLAYER_APK_URL: z.union([z.url(), z.literal("")]).default(""),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PLATFORM_OWNER_EMAILS: z.string().default(""),
  TOKEN_PEPPER: z.string().min(24),
  PAIRING_TOKEN_ENCRYPTION_KEY: z.string().min(32),
  QR_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(""),
  STRIPE_PRICE_USD_MONTHLY: z.string().default(""),
  STRIPE_PRICE_USD_YEARLY: z.string().default(""),
  STRIPE_PRICE_CAD_MONTHLY: z.string().default(""),
  STRIPE_PRICE_CAD_YEARLY: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("DOOH Community <onboarding@resend.dev>"),
  CRON_SECRET: z.string().default(""),
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
      process.env.TOKEN_PEPPER &&
      process.env.PAIRING_TOKEN_ENCRYPTION_KEY,
  );
}

export function isDevAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && getEnv().DEV_AUTH_BYPASS;
}
