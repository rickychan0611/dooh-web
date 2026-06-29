import { z } from "zod";
import { bulletinCategorySchema } from "./bulletin-categories";

export const screenModeSchema = z.enum([
  "ad_only",
  "bulletin_only",
  "mixed_rotation",
]);
export type ScreenMode = z.infer<typeof screenModeSchema>;

export const adTypeSchema = z.enum(["image", "video"]);
export const bulletinStatusSchema = z.enum([
  "pending",
  "active",
  "rejected",
  "hidden",
  "deleted",
  "expired",
]);

export const playerAdSchema = z.object({
  id: z.uuid(),
  type: adTypeSchema,
  title: z.string(),
  mediaUrl: z.url(),
  duration: z.number().int().positive(),
  sortOrder: z.number().int().nonnegative(),
  checksum: z.string().min(1),
});

export const playerBulletinSchema = z.object({
  id: z.uuid(),
  title: z.string().max(80),
  body: z.string().max(2000),
  category: z.string(),
  postNumber: z.number().int().positive().nullable().default(null),
  duration: z.number().int().positive(),
  priority: z.number().int(),
});

export const playerManifestSchema = z.object({
  schemaVersion: z.literal(1),
  serviceStatus: z.enum(["active", "grace", "suspended"]).default("active"),
  screenId: z.uuid(),
  screenCode: z.string(),
  name: z.string(),
  mode: screenModeSchema,
  layout: z.literal("fullscreen_v1"),
  orientation: z.enum(["landscape", "portrait"]),
  contentVersion: z.number().int().nonnegative(),
  generatedAt: z.iso.datetime(),
  settings: z.object({
    showQrCode: z.boolean(),
    adBlockSeconds: z.number().int().positive(),
    bulletinBlockSeconds: z.number().int().positive(),
    defaultMessageDuration: z.number().int().positive(),
  }),
  ads: z.array(playerAdSchema),
  bulletin: z.object({
    qrCodeUrl: z.url().nullable(),
    messages: z.array(playerBulletinSchema),
  }),
});
export type PlayerManifest = z.infer<typeof playerManifestSchema>;

export const PAIRING_CODE_DIGITS = 8;
export const PAIRING_CODE_PATTERN = new RegExp(`^\\d{${PAIRING_CODE_DIGITS}}$`);
export const pairingClaimCodeSchema = z.string().regex(PAIRING_CODE_PATTERN);

export const createPairingSessionRequestSchema = z.object({
  deviceId: z.string().min(8).max(200),
  appVersion: z.string().min(1).max(40),
});

export const createPairingSessionResponseSchema = z.object({
  claimCode: pairingClaimCodeSchema,
  pollToken: z.string().min(32),
  expiresAt: z.iso.datetime(),
});

export const pairingSessionStatusRequestSchema = z.object({
  pollToken: z.string().min(32),
});

export const pairingSessionStatusResponseSchema = z.discriminatedUnion(
  "status",
  [
    z.object({
      status: z.literal("pending"),
      expiresAt: z.iso.datetime(),
    }),
    z.object({ status: z.literal("expired") }),
    z.object({
      status: z.literal("claimed"),
      screenId: z.uuid(),
      screenCode: z.string(),
      deviceToken: z.string().min(32),
    }),
  ],
);

export const adminClaimCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(pairingClaimCodeSchema);

export function formatClaimCode(value: string): string {
  const normalized = value.replace(/\D/g, "").slice(0, PAIRING_CODE_DIGITS);
  const splitAt = PAIRING_CODE_DIGITS / 2;
  return normalized.length > splitAt
    ? `${normalized.slice(0, splitAt)} ${normalized.slice(splitAt)}`
    : normalized;
}

export const pendingPairingSessionSchema = z.object({
  claimCode: pairingClaimCodeSchema,
  pollToken: z.string().min(32),
  expiresAt: z.iso.datetime(),
});

export const heartbeatRequestSchema = z.object({
  deviceId: z.string(),
  appVersion: z.string(),
  mode: screenModeSchema,
  layout: z.string(),
  contentVersion: z.number().int().nonnegative(),
  currentItemId: z.string().nullable(),
  freeStorageMb: z.number().nonnegative(),
  lastSyncAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
});

export const playerErrorRequestSchema = z.object({
  deviceId: z.string(),
  errorType: z.string().max(80),
  errorMessage: z.string().max(1000),
  details: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.iso.datetime(),
});

export const publicSubmissionSchema = z.object({
  screenCode: z.string().min(3).max(40),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(2000),
  category: bulletinCategorySchema,
  submitterName: z.string().trim().max(80).optional(),
  submitterContact: z.string().trim().max(160).optional(),
  showContactPublicly: z.boolean().default(false),
  agreement: z.literal(true),
  qrToken: z.string().optional(),
});

export type CreatePairingSessionRequest = z.infer<
  typeof createPairingSessionRequestSchema
>;
export type CreatePairingSessionResponse = z.infer<
  typeof createPairingSessionResponseSchema
>;
export type PairingSessionStatusResponse = z.infer<
  typeof pairingSessionStatusResponseSchema
>;
export type PendingPairingSession = z.infer<typeof pendingPairingSessionSchema>;
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;
export type PublicSubmission = z.infer<typeof publicSubmissionSchema>;

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export {
  BULLETIN_CATEGORIES,
  BULLETIN_CATEGORY_COLORS,
  BULLETIN_CATEGORY_VALUES,
  DEFAULT_BULLETIN_CATEGORY_COLOR,
  LEGACY_BULLETIN_CATEGORY_ALIASES,
  bulletinCategoryColor,
  bulletinCategorySchema,
  formatBulletinCategoryLabel,
  normalizeBulletinCategory,
} from "./bulletin-categories";
export type { BulletinCategory } from "./bulletin-categories";
