// web/tests/paneFoot.spec.ts
import { describe, expect, it } from 'vitest'
import { factsShown, factStub, foldOf, isProblem } from '../src/composables/primitives/internal/paneFoot'

describe('a pane footer\'s facts', () => {
  it('keeps errors and warnings whole, and lets the rest give way', () => {
    expect(isProblem({ tone: 'error' })).toBe(true)
    expect(isProblem({ tone: 'warning' })).toBe(true)
    expect(isProblem({ tone: 'info' })).toBe(false)
    expect(isProblem({ tone: 'ok' })).toBe(false)
    expect(isProblem({})).toBe(false)
  })

  it('shrinks a plain fact only down to a whole word of three characters or more', () => {
    expect(factStub('Bez liczby uczniów: j3')).toBe('Bez')
    expect(factStub('W planie: 4 z 4 godz.')).toBe('W planie:')
    expect(factStub('37 godz. w tygodniu, 27 na ucznia')).toBe('37 godz.')
    expect(factStub('Pn 6, Wt 6, Śr 5')).toBe('Pn 6,')
    expect(factStub('Per student: Rok 4: 2')).toBe('Per')
  })

  it('keeps a short fact whole, so it gives way only whole', () => {
    expect(factStub('1 ostrzeżenie')).toBe('1 ostrzeżenie')
    expect(factStub('  74 h a week ')).toBe('74 h')
    expect(factStub('ok')).toBe('ok')
  })
})

describe('the "+N" for the facts that gave way', () => {
  it('is not there while every fact shows', () => {
    expect(foldOf([])).toBeNull()
  })

  it('counts them in the worst tone among them, their words in its tooltip', () => {
    expect(foldOf([{ key: 'hours', text: '37 h a week' }])).toEqual({ text: '+1', tone: undefined, tip: '37 h a week' })
    expect(foldOf([
      { key: 'unplaced', text: '6 lessons not placed in the timetable', tone: 'warning' },
      { key: 'hours', text: '37 h a week' },
    ])).toEqual({ text: '+2', tone: 'warning', tip: '6 lessons not placed in the timetable; 37 h a week' })
    expect(foldOf([
      { key: 'errors', text: '1 error', tone: 'error', tip: 'Fiz 1a: no teacher' },
      { key: 'warnings', text: '1 warning', tone: 'warning' },
    ])).toEqual({ text: '+2', tone: 'error', tip: '1 error; 1 warning' })
  })
})

it('retains the first fact even when every later fact overflows', () => {
  expect(factsShown(3, 9)).toBe(1)
  expect(factsShown(3, 0)).toBe(3)
  expect(factsShown(0, 1)).toBe(0)
})
