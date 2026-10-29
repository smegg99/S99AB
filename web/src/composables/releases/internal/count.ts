// web/src/composables/releases/internal/count.ts

/** 1234 as "1.2K", or "1,2 tys." in Polish. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale || undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
