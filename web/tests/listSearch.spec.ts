// web/tests/listSearch.spec.ts
import { describe, expect, it } from 'vitest'
import { listSearch } from '../src/browser/listSearch'

interface Fake {
  tagName: string
  selected: number
  ownerDocument: { activeElement: Fake | null }
  closest: (selector: string) => Fake | null
  select: () => void
}

const doc: { activeElement: Fake | null } = { activeElement: null }

function field(tagName = 'INPUT', list = true): Fake {
  const self: Fake = {
    tagName,
    selected: 0,
    ownerDocument: doc,
    closest: selector => (list && selector.includes('.v-autocomplete') ? self : null),
    select: () => self.selected++,
  }
  return self
}

const focusIn = (target: Fake) => ({ target }) as unknown as FocusEvent

/** The search with its deferred runs held until `flush`. */
function setup() {
  const queue: (() => void)[] = []
  const search = listSearch(run => queue.push(run))
  return { search, flush: () => queue.splice(0).forEach(run => run()) }
}

// Typing into a clicked list field must replace its value, not append to it.
describe('a list field taking the focus', () => {
  it('selects its value once the press that gave the focus comes up, so typing replaces it', () => {
    const { search, flush } = setup()
    const teacher = field()
    doc.activeElement = teacher
    search.mousedown()
    search.focusin(focusIn(teacher))
    expect(teacher.selected).toBe(0)
    search.mouseup()
    flush()
    expect(teacher.selected).toBe(1)
  })

  // A press released out of sight (a native drag, outside the window) never comes up.
  it('selects its value at once on the keyboard\'s focus after a press whose button never came up', () => {
    const { search } = setup()
    const teacher = field()
    search.mousedown()
    search.lost()
    search.focusin(focusIn(teacher))
    expect(teacher.selected).toBe(1)

    const subject = field()
    search.mousedown()
    search.keydown({ key: 'Shift' })
    search.focusin(focusIn(subject))
    expect(subject.selected).toBe(0)
    search.keydown({ key: 'Tab' })
    search.focusin(focusIn(subject))
    expect(subject.selected).toBe(1)
  })

  it('selects its value at once when the keyboard brings the focus', () => {
    const { search } = setup()
    const subject = field()
    search.focusin(focusIn(subject))
    expect(subject.selected).toBe(1)
  })

  it('leaves a second press in a focused field, a field the focus has left and other fields alone', () => {
    const { search, flush } = setup()
    const teacher = field()
    doc.activeElement = teacher
    search.mousedown()
    search.mouseup()
    flush()
    expect(teacher.selected).toBe(0)

    search.mousedown()
    search.focusin(focusIn(teacher))
    doc.activeElement = null
    search.mouseup()
    flush()
    expect(teacher.selected).toBe(0)

    const name = field('INPUT', false)
    const button = field('BUTTON')
    search.focusin(focusIn(name))
    search.focusin(focusIn(button))
    expect(name.selected + button.selected).toBe(0)
  })
})
