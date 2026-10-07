/**
 * Formats a memory string (e.g. "4.2" -> "4.2 MB", "4.2 MB" -> "4.2 MB")
 */
export function formatMemory(mem?: string): string {
  if (!mem) return '';
  const trimmed = mem.trim();
  if (
    trimmed.toLowerCase().endsWith('mb') ||
    trimmed.toLowerCase().endsWith('kb') ||
    trimmed.toLowerCase().endsWith('gb') ||
    trimmed.toLowerCase().endsWith('b')
  ) {
    return trimmed;
  }
  return `${trimmed} MB`;
}
