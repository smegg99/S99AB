// web/src/composables/releases/useUpdatePrompts.ts
import { type Component, onMounted, onScopeDispose } from 'vue'
import UiUpdateDialog, { type UpdateChoice } from '../../components/releases/UpdateDialog.vue'
import UiReleaseNotesDialog from '../../components/releases/ReleaseNotesDialog.vue'
import { closeDialog, dialogEntries, type DialogOptions, openDialog } from '../../internal/dialog'
import { useLocale, useTranslate } from '../useTranslate'

export interface UpdatePromptSource {
  state: (locale: string) => Promise<{
    current: string
    update?: { version: string }
    notes?: { version: string, text: string, lang: string }
  }>
  ignore: (version: string) => Promise<void>
  notesShown: () => Promise<void>
  download: () => Promise<void>
  onAvailable: (callback: (release: { version: string }) => void) => () => void
}

export function useUpdatePrompts(source: UpdatePromptSource): void {
  const locale = useLocale()
  const t = useTranslate()
  const updates = new Set<string>()
  const notes = new Set<string>()
  let pending = false
  let busy = false
  let disposed = false
  let unsubscribe: (() => void) | undefined
  let dialogId: number | undefined
  const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible'

  function show<T>(component: Component, props: Record<string, unknown>, options: DialogOptions) {
    const result = openDialog<T>(component, props, options)
    dialogId = dialogEntries.at(-1)?.id
    return result.finally(() => {
      dialogId = undefined
    })
  }

  async function drain() {
    if (busy || disposed || !visible()) return
    busy = true
    try {
      while (pending && !disposed && visible()) {
        pending = false
        try {
          const requestedLocale = locale.value
          const state = await source.state(requestedLocale)
          if (disposed) return
          if (!visible() || requestedLocale !== locale.value) {
            pending = true
            continue
          }
          if (state.notes && !notes.has(state.notes.version)) {
            const entry = state.notes
            notes.add(entry.version)
            await show(UiReleaseNotesDialog, { version: entry.version, notes: entry.text, notesLocale: entry.lang }, {
              width: 'md', label: t('release.notesTitle', 'What\'s new in {version}', { version: entry.version }),
            })
            await source.notesShown().catch(() => undefined)
            pending = true
            continue
          }
          if (state.update && !updates.has(state.update.version)) {
            const version = state.update.version
            updates.add(version)
            const choice = await show<UpdateChoice>(UiUpdateDialog, { current: state.current, latest: version }, {
              width: 'sm', label: t('release.updateTitle', 'A newer version is available'),
            })
            if (disposed) return
            if (choice === 'ignore') await source.ignore(version)
            if (choice === 'download') await source.download()
          }
        }
        catch {
          continue
        }
      }
    }
    finally {
      busy = false
    }
  }

  function queue() {
    if (disposed) return
    pending = true
    void drain()
  }

  function subscribe() {
    try {
      return source.onAvailable(queue)
    }
    catch {
      return undefined
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', queue)
    unsubscribe = subscribe()
    queue()
  })
  onScopeDispose(() => {
    disposed = true
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', queue)
    if (dialogId !== undefined) closeDialog(dialogId)
    try {
      unsubscribe?.()
    }
    catch {
      return
    }
  })
}
