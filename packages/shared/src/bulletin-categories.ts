import { z } from "zod";

export const BULLETIN_CATEGORY_VALUES = [
  "community",
  "events",
  "jobs",
  "services",
  "tutoring",
  "classes",
  "buy_sell",
  "free_stuff",
  "lost_found",
  "housing",
  "parking",
  "roommates",
  "pets",
  "volunteers",
  "recommendations",
  "greetings",
  "announcements",
  "safety",
  "food",
  "kids",
  "seniors",
  "rides",
  "wanted",
  "for_rent",
  "for_hire",
] as const;

export type BulletinCategory = (typeof BULLETIN_CATEGORY_VALUES)[number];

export const bulletinCategorySchema = z.enum(BULLETIN_CATEGORY_VALUES);

export const BULLETIN_CATEGORIES: ReadonlyArray<{
  value: BulletinCategory;
  label: string;
  color: string;
}> = [
  { value: "community", label: "Community", color: "#fff4a8" },
  { value: "events", label: "Events", color: "#cfe8fb" },
  { value: "jobs", label: "Jobs", color: "#d4e4ff" },
  { value: "services", label: "Services", color: "#c8f0e0" },
  { value: "tutoring", label: "Tutoring", color: "#e8daf8" },
  { value: "classes", label: "Classes", color: "#b8e6f5" },
  { value: "buy_sell", label: "Buy & Sell", color: "#ffd9b3" },
  { value: "free_stuff", label: "Free Stuff", color: "#d6f3c9" },
  { value: "lost_found", label: "Lost & Found", color: "#ffe0b2" },
  { value: "housing", label: "Housing", color: "#f5d6c6" },
  { value: "parking", label: "Parking", color: "#d9dfe8" },
  { value: "roommates", label: "Roommates", color: "#f0c9e8" },
  { value: "pets", label: "Pets", color: "#ffe4a8" },
  { value: "volunteers", label: "Volunteers", color: "#c5ead6" },
  { value: "recommendations", label: "Recommendations", color: "#e5f4ff" },
  { value: "greetings", label: "Greetings", color: "#fcd5e5" },
  { value: "announcements", label: "Announcements", color: "#fff9c4" },
  { value: "safety", label: "Safety", color: "#ffcdd2" },
  { value: "food", label: "Food", color: "#ffecb3" },
  { value: "kids", label: "Kids", color: "#bbdefb" },
  { value: "seniors", label: "Seniors", color: "#d1c4e9" },
  { value: "rides", label: "Rides", color: "#b2dfdb" },
  { value: "wanted", label: "Wanted", color: "#f8bbd0" },
  { value: "for_rent", label: "For Rent", color: "#ffe082" },
  { value: "for_hire", label: "For Hire", color: "#e1bee7" },
];

export const BULLETIN_CATEGORY_COLORS = Object.fromEntries(
  BULLETIN_CATEGORIES.map(({ value, color }) => [value, color]),
) as Record<BulletinCategory, string>;

export const LEGACY_BULLETIN_CATEGORY_ALIASES: Record<string, BulletinCategory> =
  {
    event: "events",
    birthday: "greetings",
    notice: "announcements",
    promotion: "services",
  };

export const DEFAULT_BULLETIN_CATEGORY_COLOR = "#fff4a8";

export function normalizeBulletinCategory(category: string): string {
  return LEGACY_BULLETIN_CATEGORY_ALIASES[category] ?? category;
}

export function formatBulletinCategoryLabel(category: string): string {
  const normalized = normalizeBulletinCategory(category);
  const match = BULLETIN_CATEGORIES.find(({ value }) => value === normalized);
  if (match) return match.label;
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function bulletinCategoryColor(category: string): string {
  const normalized = normalizeBulletinCategory(category);
  return (
    BULLETIN_CATEGORY_COLORS[normalized as BulletinCategory] ??
    DEFAULT_BULLETIN_CATEGORY_COLOR
  );
}
