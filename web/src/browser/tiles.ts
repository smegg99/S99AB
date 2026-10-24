// web/src/browser/tiles.ts
import type { Ref } from 'vue'

/** The Explorer tile an event happened in, if any. */
export function tileOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('.s99ab-tile') : null
}

/** Resolves with an Explorer tile once drawn, or null after `patience` ms. */
export function whenTile(root: HTMLElement, id: string, patience = 3000): Promise<HTMLElement | null> {
  const find = () => root.querySelector<HTMLElement>(`[data-s99ab-tile="${CSS.escape(id)}"]`)
  const now = find()
  if (now) return Promise.resolve(now)
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const tile = find()
      if (tile) done(tile)
    })
    const timer = setTimeout(() => done(null), patience)
    function done(tile: HTMLElement | null) {
      observer.disconnect()
      clearTimeout(timer)
      resolve(tile)
    }
    observer.observe(root, { childList: true, subtree: true })
  })
}

/** Middle click opens the tile in a new tab and suppresses the webview's autoscroll. Bind with v-on on an Explorer grid. */
export function middleClick(open: (id: string) => void) {
  return {
    mousedown(event: MouseEvent) {
      if (event.button === 1 && tileOf(event.target)) event.preventDefault()
    },
    auxclick(event: MouseEvent) {
      const id = event.button === 1 ? tileOf(event.target)?.getAttribute('data-s99ab-tile') : null
      if (id) open(id)
    },
  }
}

/** Shift+click toggles one tile instead of the layer's range pick. Bind as a capturing click handler on an Explorer grid. */
export function shiftPick(picked: Ref<string[]>) {
  return (event: MouseEvent) => {
    if (!event.shiftKey) return
    const id = tileOf(event.target)?.getAttribute('data-s99ab-tile')
    if (!id) return
    event.stopPropagation()
    event.preventDefault()
    picked.value = picked.value.includes(id) ? picked.value.filter(p => p !== id) : [...picked.value, id]
  }
}
