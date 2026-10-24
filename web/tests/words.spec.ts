// web/tests/words.spec.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Words from '../src/components/primitives/Words.vue'

describe('whole-word truncation', () => {
  it('keeps the first word unboxed and the remaining words indivisible', () => {
    const wrapper = mount(Words, { props: { text: 'One two three' } })
    expect(wrapper.text()).toBe('One two three')
    expect(wrapper.findAll('.s99ab-words__word').map(word => word.text())).toEqual(['two', 'three'])
  })
  it('boxes every word when content precedes it', () => {
    const wrapper = mount(Words, { props: { text: 'One two' }, slots: { default: '<b>Prefix</b>' } })
    expect(wrapper.text()).toBe('Prefix One two')
    expect(wrapper.findAll('.s99ab-words__word').map(word => word.text())).toEqual(['One', 'two'])
  })
})
