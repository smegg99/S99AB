<!-- web/src/components/state/CrashScreen.vue -->
<template>
  <!-- The whole window when the app cannot start, has crashed, hangs or was killed: the app's own frame,
       a heading bar, then what happened, the full report, which scrolls on its own, and the actions. -->
  <UiDesktopFrame
    fill
    class="s99ab-crash"
  >
    <div
      class="s99ab-crash__view"
      role="alert"
    >
      <header class="s99ab-crash__bar s99ab-slab">
        <h1 class="s99ab-crash__title">
          {{ texts.title }}
        </h1>
      </header>
      <UiPanel class="s99ab-crash__panel">
        <div class="s99ab-crash__lead">
          <div class="s99ab-crash__figure">
            <slot name="figure">
              <v-icon
                icon="mdi-alert-circle-outline"
                size="56"
                class="s99ab-crash__icon"
              />
            </slot>
          </div>
          <div class="s99ab-crash__words">
            <p class="s99ab-crash__text">
              {{ texts.message }}
            </p>
            <p
              v-if="report.file"
              class="s99ab-crash__file"
            >
              {{ fileLabel }}
            </p>
            <code
              v-if="report.error"
              class="s99ab-crash__error"
            >{{ report.error }}</code>
          </div>
        </div>
        <template v-if="report.text">
          <span class="s99ab-eyebrow">{{ detailsLabel }}</span>
          <pre class="s99ab-crash__report">{{ report.text }}</pre>
        </template>
        <div class="s99ab-dialog__actions">
          <v-btn
            v-for="action in side"
            :key="action.name"
            :disabled="busy !== '' && busy !== action.name"
            :loading="busy === action.name"
            @click="run(action)"
          >
            {{ action.label }}
          </v-btn>
          <span class="s99ab-dialog__spacer" />
          <v-btn
            v-for="action in main"
            :key="action.name"
            :color="action.primary ? 'accent' : undefined"
            :disabled="busy !== '' && busy !== action.name"
            :loading="busy === action.name"
            @click="run(action)"
          >
            {{ action.label }}
          </v-btn>
        </div>
      </UiPanel>
    </div>
    <template #status>
      <div class="s99ab-crash__status">
        <slot name="logo" />
        <span
          class="s99ab-crash__note"
          aria-live="polite"
          :title="status"
        >{{ status }}</span>
        <span
          v-if="report.version"
          class="s99ab-crash__version"
        >v{{ report.version }}</span>
      </div>
    </template>
  </UiDesktopFrame>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import UiDesktopFrame from '../shell/DesktopFrame.vue'
import UiPanel from '../primitives/Panel.vue'
import { useTranslate } from '../../composables/useTranslate'
import { crashTexts, type CrashScreenActions, type CrashScreenReport } from './crashScreen'

const { report, actions = {}, message } = defineProps<{
  report: CrashScreenReport
  actions?: CrashScreenActions
  /** Replaces the message the kind picks, for a failure the app can name better. */
  message?: string
}>()
// title is the window-title phrase, such as "not responding", for the app to put after its name.
const emit = defineEmits<{ title: [phrase: string] }>()

defineSlots<{ figure?: () => unknown, logo?: () => unknown }>()

const COPIED_MS = 1600

interface Action {
  name: string
  label: string
  primary?: boolean
  /** Resolves to the status line, '' for none. */
  run: () => Promise<string>
}

const t = useTranslate()
const fileLabel = computed(() => t('crash.file', 'File: {path}', { path: report.file ?? '' }))
const detailsLabel = computed(() => t('crash.details', 'Details'))
const busy = ref('')
const status = ref('')
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
onScopeDispose(() => clearTimeout(copiedTimer))

const texts = computed(() => crashTexts(t, report, message))
watch(() => texts.value.window, phrase => emit('title', phrase), { immediate: true })

async function copy(): Promise<string> {
  const done = actions.copy ? await actions.copy() : await browserCopy(report.text ?? '')
  if (!done) throw new Error('s99ab: the clipboard refused the report')
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, COPIED_MS)
  return ''
}

async function browserCopy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  }
  catch {
    return false
  }
}

// An action whose only result is that it worked.
function silent(fn: () => Promise<void>): () => Promise<string> {
  return async () => {
    await fn()
    return ''
  }
}

// The report's own actions, on the left; a hung app that still runs has none, since its report is not ready.
const side = computed<Action[]>(() => {
  const list: Action[] = []
  if (report.alive || !report.text) return list
  list.push({ name: 'copy', label: copied.value ? t('crash.copied', 'Copied') : t('crash.copy', 'Copy report'), run: copy })
  const { save } = actions
  if (save) list.push({ name: 'save', label: t('crash.save', 'Save report'), run: async () => saved(await save()) })
  if (actions.email && report.email) list.push({ name: 'email', label: t('crash.email', 'Email report'), run: silent(actions.email) })
  if (actions.openLogs && report.logs) list.push({ name: 'logs', label: t('crash.logs', 'Show log file'), run: silent(actions.openLogs) })
  return list
})

// What to do with the app, on the right, the way a dialog ends: dismiss, then the primary action.
const main = computed<Action[]>(() => {
  const list: Action[] = []
  if (report.alive) {
    if (actions.wait) list.push({ name: 'wait', label: t('crash.wait', 'Wait'), run: silent(actions.wait) })
    if (actions.kill) list.push({ name: 'kill', label: t('crash.kill', 'Close and report'), primary: true, run: silent(actions.kill) })
    return list
  }
  if (actions.close) list.push({ name: 'close', label: t('crash.close', 'Close'), run: silent(actions.close) })
  if (actions.restart) list.push({ name: 'restart', label: t('crash.restart', 'Restart'), primary: true, run: silent(actions.restart) })
  return list
})

function saved(path: string): string {
  return path ? t('crash.saved', 'Saved to {path}', { path }) : ''
}

// One action at a time; its result or failure replaces the status line.
async function run(action: Action) {
  busy.value = action.name
  status.value = ''
  try {
    status.value = await action.run()
  }
  catch (err) {
    status.value = t('crash.failed', 'That did not work: {error}', { error: err instanceof Error ? err.message : String(err) })
  }
  finally {
    busy.value = ''
  }
}
</script>
