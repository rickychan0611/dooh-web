export function parsePostNumberSearch(value?: string): number | null {
  const normalized = value?.trim().replace(/^#/, "");
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
