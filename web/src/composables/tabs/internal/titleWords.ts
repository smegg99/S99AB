// web/src/composables/tabs/internal/titleWords.ts

/** A word of only punctuation or symbols, such as "-" or ":". */
const SEPARATOR = /^[\p{P}\p{S}]+$/u

/**
 * A tab title's words for UiTabStrip, so a cut title ends after a whole word ("Annual report ...").
 * A lone separator joins the next word with a no-break space; a trailing one joins the previous.
 */
export function titleWords(title: string): string[] {
  const out: string[] = []
  let held = ''
  for (const word of title.split(' ').filter(Boolean)) {
    if (SEPARATOR.test(word)) {
      held = held ? `${held}\u00a0${word}` : word
      continue
    }
    out.push(held ? `${held}\u00a0${word}` : word)
    held = ''
  }
  if (held && out.length) out[out.length - 1] = `${out[out.length - 1]}\u00a0${held}`
  else if (held) out.push(held)
  return out
}
