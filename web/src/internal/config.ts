// web/src/internal/config.ts

/** A config patch: plain keys replace, the `K` maps take a partial that merges into them. */
export type ConfigPatch<T, K extends keyof T> = Partial<Omit<T, K>> & { [P in K]?: Partial<T[P]> }

/**
 * Applies a patch to a live config: plain keys are set, the `nested` maps are merged one level down so
 * a patch naming one entry keeps the rest, and undefined leaves a key alone.
 */
export function mergeConfig<T extends object, K extends keyof T>(target: T, patch: ConfigPatch<T, K>, nested: readonly K[]): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if ((nested as readonly PropertyKey[]).includes(key)) Object.assign(target[key as K] as object, value)
    else (target as Record<string, unknown>)[key] = value
  }
}
