// web/src/composables/primitives/internal/paneFoot.ts
// Pure logic of a pane footer: how far a fact shrinks before it folds into the "+N", and what the "+N" says.

/** An error or a warning: not shrunk while another fact can fold, and folded only whole. */
export function isProblem(stat: Pick<FooterStat, 'tone'>): boolean {
  return stat.tone === 'error' || stat.tone === 'warning'
}

/** The least of a plain fact shown before an ellipsis: its first words up to three characters, so no cut word or bare letter. */
export function factStub(text: string): string {
  let stub = ''
  for (const word of text.trim().split(/\s+/)) {
    stub = stub ? `${stub} ${word}` : word
    if (stub.length >= 3) break
  }
  return stub
}

/** What the "+N" says: how many facts folded, their worst tone (none when all are plain) and their words for its tooltip. */
export interface FootFold {
  text: string
  tone?: 'error' | 'warning'
  tip: string
}

/** The "+N" for the folded facts, in the footer's order; null when none folded. */
export function foldOf(stats: readonly FooterStat[]): FootFold | null {
  if (!stats.length) return null
  const tone = stats.some(stat => stat.tone === 'error') ? 'error' : stats.some(stat => stat.tone === 'warning') ? 'warning' : undefined
  return { text: `+${stats.length}`, tone, tip: stats.map(stat => stat.text).join('; ') }
}

/** How many facts stay shown after `folded` went into the "+N": at least the first, so a refusal is always shown. */
export function factsShown(total: number, folded: number): number {
  return total - Math.min(folded, Math.max(total - 1, 0))
}

// ---- pane footer --------------------------------------------------------------

/** One fact in a pane's footer, with its tone. */
export interface FooterStat {
  key: string
  text: string
  /** error and warning for problems, info for a note, ok when all is well; ink3 by default. */
  tone?: 'error' | 'warning' | 'info' | 'ok'
  /** The whole words, when `text` is short. */
  tip?: string
}

/** The footer's facts, problems first (errors, then warnings), each group keeping its order. */
export function statOrder(stats: readonly FooterStat[]): FooterStat[] {
  const rank = (stat: FooterStat) => (stat.tone === 'error' ? 0 : stat.tone === 'warning' ? 1 : 2)
  return [...stats].sort((a, b) => rank(a) - rank(b))
}
