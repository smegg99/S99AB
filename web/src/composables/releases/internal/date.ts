// web/src/composables/releases/internal/date.ts

/** A release timestamp in the user's locale, or '' when it cannot be parsed. */
export function formatReleaseDate(iso: string | undefined): string {
  if (!iso) return ''

  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}
