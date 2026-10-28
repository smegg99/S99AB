// web/src/browser/input.ts

import { inBrowser } from './env'

// Whether the last press was a key, kept on the root as data-s99ab-keys: CSS rings by it and
// focus returns with a ring only after a key.
const KEYS = 'data-s99ab-keys'

/** Follows key and pointer presses on the window; returns the teardown. The input plugin calls it. */
export function installInputMode(): () => void {
  const root = document.documentElement
  const keyed = () => root.setAttribute(KEYS, '')
  const pointed = () => root.removeAttribute(KEYS)
  window.addEventListener('keydown', keyed, true)
  window.addEventListener('pointerdown', pointed, true)
  return () => {
    window.removeEventListener('keydown', keyed, true)
    window.removeEventListener('pointerdown', pointed, true)
    pointed()
  }
}

/** Whether the last press was a key, not a pointer. */
export function pressedByKey(): boolean {
  return inBrowser() && document.documentElement.hasAttribute(KEYS)
}

/** Whether typing in the target edits text, so a shortcut must leave the key alone. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())
}
