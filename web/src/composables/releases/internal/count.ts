// web/src/composables/releases/internal/count.ts

// Compact notation starts here in English and Polish; above it the printed number is a fraction.
const COMPACT_FROM = 1000

/** 1234 as "1.2K", or "1,2 tys." in Polish. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale || undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** The number to select a plural form with: a compact fraction reads like zero ("1.2K stars"). */
export function pluralCount(value: number): number {
  return value < COMPACT_FROM ? value : 0
}
