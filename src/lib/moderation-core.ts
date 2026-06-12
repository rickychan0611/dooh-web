export function containsBlockedWord(
  title: string,
  body: string,
  blockedWords: string[],
): boolean {
  const content = `${title} ${body}`.toLowerCase();
  return blockedWords.some((word) => {
    const normalized = word.trim().toLowerCase();
    return normalized.length > 0 && content.includes(normalized);
  });
}
