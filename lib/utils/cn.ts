/** Joins class names, dropping falsy values — a minimal clsx substitute (no extra dependency). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
