// web/tests/cutText.spec.ts
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cutWords, isCut, useCutText, wordsRoom } from '../src/composables/primitives/useCutText'

/** An element as far as the tooltip asks: what selectors it matches, its widths, its words, what holds it. */
interface Stub {
  matches: string[]
  scrollWidth: number
  clientWidth: number
  textContent: string
  parent: Stub | null
  closest: (selector: string) => Stub | null
  contains: (other: unknown) => boolean
}

function stub(matches: string[], text: string, widths: { scroll: number, client: number }, parent: Stub | null = null): Stub {
  const el: Stub = {
    matches,
    scrollWidth: widths.scroll,
    clientWidth: widths.client,
    textContent: text,
    parent,
    // The browser's closest: this element or the nearest one holding it that matches any selector of the list.
    closest(selector: string) {
      const wanted = selector.split(',').map(each => each.trim())
      for (let at: Stub | null = el; at; at = at.parent) {
        if (at.matches.some(each => wanted.includes(each))) return at
      }
      return null
    },
    contains: other => other === el,
  }
  return el
}

const over = (target: Stub, buttons = 0) => ({ target, buttons, relatedTarget: null }) as unknown as MouseEvent

/** Compare's numbers table (tabs/compare/Diff.vue): its row labels and the rules version's words. */
const SELECTOR = '.diff__name, .diff__table th'

describe('a cut text\'s tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // No field here: the tooltip reads an input's value, any other element's words.
    vi.stubGlobal('HTMLInputElement', class { value = '' })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function setup() {
    const scope = effectScope()
    const cut = scope.run(() => useCutText(SELECTOR))!
    return { cut, scope }
  }

  it('says a cut row label whole, a teacher\'s rating in Compare at 1024px', () => {
    const { cut, scope } = setup()
    const label = stub(['.diff__table th'], ' Rating: Małgorzata Dąbrowska ', { scroll: 180, client: 140 })
    cut.on.mouseover(over(label))
    vi.runAllTimers()
    expect(cut.tip.value).toEqual({ el: label, text: 'Rating: Małgorzata Dąbrowska' })
    scope.stop()
  })

  it('says nothing for a label that fits, nor for one that holds a cut name, whose own tooltip it is', () => {
    const { cut, scope } = setup()
    cut.on.mouseover(over(stub(['.diff__table th'], 'Errors', { scroll: 40, client: 140 })))
    vi.runAllTimers()
    expect(cut.tip.value).toBeNull()
    const row = stub(['.diff__table th'], 'Rules Main file, version 12', { scroll: 200, client: 200 })
    const name = stub(['.diff__name'], 'Main file, version 12', { scroll: 160, client: 90 }, row)
    cut.on.mouseover(over(stub([], 'Rules', { scroll: 30, client: 30 }, row)))
    vi.runAllTimers()
    expect(cut.tip.value).toBeNull()
    cut.on.mouseover(over(name))
    vi.runAllTimers()
    expect(cut.tip.value?.el).toBe(name)
    scope.stop()
  })

  it('opens none while a button is held, and a press or leaving the text hides it', () => {
    const { cut, scope } = setup()
    const label = stub(['.diff__table th'], 'Rating: Małgorzata Dąbrowska', { scroll: 180, client: 140 })
    cut.on.mouseover(over(label, 1))
    vi.runAllTimers()
    expect(cut.tip.value).toBeNull()
    cut.on.mouseover(over(label))
    vi.runAllTimers()
    cut.on.pointerdown()
    expect(cut.tip.value).toBeNull()
    cut.on.mouseover(over(stub(['.diff__table th'], 'Rating: Jan Zieliński-Kowalski', { scroll: 190, client: 140 })))
    vi.runAllTimers()
    expect(cut.tip.value).not.toBeNull()
    cut.on.mouseout(over(cut.tip.value!.el as unknown as Stub))
    expect(cut.tip.value).toBeNull()
    scope.stop()
  })
})

// A line cut short ends after a whole word: each word a box of its own
// (components/tabs/Jobs.vue, workbench/Activity.vue, workbench/PlanFoot.vue).
describe('a line\'s words', () => {
  it('splits at spaces, a no-break space keeping a number with its unit, and drops the empty', () => {
    expect(cutWords('Zadany czas przekracza limit węzła: 15\u00a0min.')).toEqual(['Zadany', 'czas', 'przekracza', 'limit', 'węzła:', '15\u00a0min.'])
    expect(cutWords(' No timetable  was found. ')).toEqual(['No', 'timetable', 'was', 'found.'])
    expect(cutWords('')).toEqual([])
  })

  it('joined again with a space each, reads as the whole line the tooltip says', () => {
    const line = 'This school cannot be scheduled with these rules.'
    expect(cutWords(line).join(' ')).toBe(line)
  })
})

describe('what counts as cut', () => {
  it('is a line wider than its box', () => {
    expect(isCut({ scrollWidth: 300, clientWidth: 120, scrollHeight: 18, clientHeight: 18 })).toBe(true)
    expect(isCut({ scrollWidth: 120, clientWidth: 120, scrollHeight: 18, clientHeight: 18 })).toBe(false)
  })
  it('is, for text that may take several lines, more lines than its box shows', () => {
    expect(isCut({ scrollWidth: 120, clientWidth: 120, scrollHeight: 54, clientHeight: 36, dataset: { lines: '2' } })).toBe(true)
    expect(isCut({ scrollWidth: 120, clientWidth: 120, scrollHeight: 36, clientHeight: 36, dataset: { lines: '2' } })).toBe(false)
  })
  it('is never a one-line text a little taller than its box, as a word box on its baseline can make it', () => {
    expect(isCut({ scrollWidth: 120, clientWidth: 120, scrollHeight: 21, clientHeight: 18, dataset: {} })).toBe(false)
  })
})

// A box sized by its word boxes can come out a fraction narrower than they are, letting the ellipsis take a word.
describe('the room a line of word boxes takes', () => {
  it('is their measured width rounded up, and a pixel more', () => {
    expect(wordsRoom(56.2)).toBe(58)
    expect(wordsRoom(56.9)).toBe(58)
    expect(wordsRoom(57)).toBe(58)
  })
})
