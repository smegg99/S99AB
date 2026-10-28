// web/src/composables/shell/internal/anchors.ts

/** Same-page anchor ids among `tos`, in drawn order (`/theme#type` counts, `/textures` does not). */
export function anchorsIn(tos: string[], path: string): string[] {
  const ids: string[] = []

  for (const to of tos) {
    const cut = to.indexOf('#')
    if (cut < 0) continue
    if (to.slice(0, cut) !== path) continue

    const id = to.slice(cut + 1)
    if (id && !ids.includes(id)) ids.push(id)
  }

  return ids
}
