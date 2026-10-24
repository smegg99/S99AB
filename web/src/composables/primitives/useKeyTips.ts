// web/src/composables/primitives/useKeyTips.ts
import { hasFocusRing } from '../../browser/focus'
import { inject, type InjectionKey, provide, shallowRef } from 'vue'

/**
 * A bar's key tooltips, one open at a time: hover opens, leave, press or click closes, keyboard focus opens.
 * None opens beside a disabled key's S99AB reason. Each key binds `on(id)`; its v-tooltip takes `shown(id)`.
 */
export function useKeyTips() {
  const open = shallowRef<string | null>(null)

  /** Whether S99AB's disabled-key tooltip is open, read from aria-describedby and Vuetify's `v-overlay--active`. */
  function reasonShown(host: Element | null): boolean {
    const tip = host?.getAttribute('aria-describedby')
    return !!tip && !!document.getElementById(tip)?.classList.contains('v-overlay--active')
  }

  /** Closes `id`'s tooltip, or whichever is open. */
  function close(id?: string) {
    if (id === undefined || open.value === id) open.value = null
  }

  function on(id: string) {
    return {
      // While a focused disabled key's S99AB reason is open, hovering another key opens no tooltip.
      pointerenter: (event: PointerEvent) => {
        if (event.buttons) return
        const focused = document.activeElement
        if (focused?.matches('.s99ab-disabled-hint--disabled:focus-visible') && reasonShown(focused)) return
        open.value = id
      },
      pointerleave: () => close(id),
      pointerdown: () => close(id),
      click: () => close(id),
      // A hovered disabled key's reason only S99AB can close, so the focused key's tooltip waits.
      focus: (event: FocusEvent) => {
        if (!hasFocusRing(event.target as HTMLElement | null)) return
        if (document.querySelector('.s99ab-disabled-hint--disabled:hover')) return
        open.value = id
      },
      // Closed after the focus lands: closing inside blur makes VOverlay return focus to the key and WebKit drops the move.
      blur: () => {
        setTimeout(() => close(id))
      },
    }
  }

  return { shown: (id: string) => open.value === id, on, close }
}

type KeyTips = ReturnType<typeof useKeyTips>
const KEY: InjectionKey<KeyTips> = Symbol('keyTips')

/** A bar's key tooltips, shared with the components inside it (the switcher), so one tooltip opens at a time across the whole bar. */
export function provideKeyTips(): KeyTips {
  const tips = useKeyTips()
  provide(KEY, tips)
  return tips
}

/** The bar's key tooltips when inside one, else this component's own. */
export function injectKeyTips(): KeyTips {
  return inject(KEY, null) ?? useKeyTips()
}
