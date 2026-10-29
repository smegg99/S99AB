// web/src/composables/releases/internal/date.ts

/** A release timestamp as a long UTC date in locale, so server and client agree, or '' when it cannot be parsed. */
export function formatReleaseDate(iso: string | undefined, locale: string): string {
  if (!iso) return ''

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale || undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(date)
}
