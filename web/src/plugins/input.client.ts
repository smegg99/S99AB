// web/src/plugins/input.client.ts
/// <reference types="vite/client" />
import { defineNuxtPlugin } from 'nuxt/app'
import { listSearch } from '../browser/listSearch'
import { focusStart } from '../browser/focus'

export default defineNuxtPlugin(() => {
  const start = focusStart()
  const search = listSearch()
  const root = document.documentElement
  const keyed = () => root.setAttribute('data-s99ab-keys', '')
  const pointed = () => root.removeAttribute('data-s99ab-keys')
  window.addEventListener('mousedown', start.mousedown, true)
  window.addEventListener('focusin', start.focusin, true)
  window.addEventListener('keydown', start.keydown, true)
  window.addEventListener('keydown', keyed, true)
  window.addEventListener('pointerdown', pointed, true)
  window.addEventListener('mousedown', search.mousedown, true)
  window.addEventListener('focusin', search.focusin, true)
  window.addEventListener('mouseup', search.mouseup, true)
  window.addEventListener('keydown', search.keydown, true)
  for (const name of ['dragend', 'pointercancel', 'blur'] as const) window.addEventListener(name, search.lost, true)
  if (import.meta.hot) import.meta.hot.dispose(() => {
    window.removeEventListener('mousedown', start.mousedown, true)
    window.removeEventListener('focusin', start.focusin, true)
    window.removeEventListener('keydown', start.keydown, true)
    window.removeEventListener('keydown', keyed, true)
    window.removeEventListener('pointerdown', pointed, true)
    window.removeEventListener('mousedown', search.mousedown, true)
    window.removeEventListener('focusin', search.focusin, true)
    window.removeEventListener('mouseup', search.mouseup, true)
    window.removeEventListener('keydown', search.keydown, true)
    for (const name of ['dragend', 'pointercancel', 'blur'] as const) window.removeEventListener(name, search.lost, true)
    pointed()
  })
})
