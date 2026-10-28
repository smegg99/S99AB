// web/src/theme/color.ts

/** The 0..255 channels of #rgb or #rrggbb, with or without the hash; null for anything else. */
export function hexChannels(value: string): [number, number, number] | null {
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())?.[1]
  if (!hex) return null
  const full = hex.length === 3 ? hex.replace(/./g, d => d + d) : hex
  return [0, 2, 4].map(i => Number.parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}
