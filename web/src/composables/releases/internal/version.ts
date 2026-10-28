// web/src/composables/releases/internal/version.ts

/**
 * Compares release tags: optional leading v, numeric parts, prereleases below
 * their release. Returns <0, 0 or >0; unparseable input compares equal.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (raw: string) => {
    const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+](.*))?$/.exec(raw.trim())
    if (!m) return null
    return {
      nums: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)],
      pre: m[4] ?? '',
    }
  }

  const left = parse(a)
  const right = parse(b)
  if (!left || !right) return 0

  for (let i = 0; i < 3; i++) {
    if (left.nums[i]! !== right.nums[i]!) return left.nums[i]! - right.nums[i]!
  }
  if (left.pre === right.pre) return 0
  // A prerelease is behind the plain version; two prereleases compare as text.
  if (!left.pre) return 1
  if (!right.pre) return -1
  return left.pre < right.pre ? -1 : 1
}
