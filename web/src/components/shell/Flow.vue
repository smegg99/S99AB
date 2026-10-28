<!-- web/src/components/shell/Flow.vue -->
<template>
  <div
    :class="{ 'flow--ground': ground }"
    class="flow"
    aria-hidden="true"
  >
    <canvas
      ref="canvas"
      :class="{ 'flow__canvas--ready': ready }"
      class="flow__canvas"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import type { NeatInstance } from '../../composables/appearance/internal/flow'
import { acquireSlot, groundConfig, groundShape, flowStops, loadNeat, releaseSlot, supportsWebgl } from '../../composables/appearance/internal/flow'
import { useMotion } from '../../composables/motion/useMotion'
import { motionLevel, resolveLevel } from '../../composables/motion/internal/motion'

/**
 * A moving WebGL gradient on one canvas, drawn over UiBackdrop, which stays as
 * the fallback. As the ground it shows through every .s99ab-glass surface; a
 * bounded instance is capped (see useFlow).
 */
const { ground = false } = defineProps<{
  /** Fixed and full-viewport instead of filling its container. */
  ground?: boolean
}>()

const theme = useTheme()
const motion = useMotion()
const canvas = ref<HTMLCanvasElement | null>(null)

const ready = ref(false)

let instance: NeatInstance | null = null
let held = false
let mounted = false
let build = 0
let watcher: MutationObserver | null = null

function yield_() {
  if (!held) return
  releaseSlot()
  held = false
}

function drop() {
  try {
    instance?.destroy()
  }
  catch {
    // Decorative; a failed teardown must not break the page.
  }
  instance = null
  ready.value = false
  yield_()
  scrub()
}

// 0.x appends an attribution link into the canvas parent, unreachable and
// announced by screen readers; removed here. 1.x watermarks in the canvas
// unless given s99ab.ground.licenseKey, and that is left alone.
function scrub() {
  canvas.value?.parentElement
    ?.querySelectorAll('a[data-n], a[href="https://neat.firecms.co"]')
    .forEach(link => link.remove())
}

// An observer, because 0.x re-adds the link after the build returns.
function watchForLinks() {
  const root = canvas.value?.parentElement
  if (!root || watcher) return

  watcher = new MutationObserver(scrub)
  watcher.observe(root, { childList: true, subtree: true })
}

async function start() {
  if (!mounted || !canvas.value) return

  // The layer's motion level as well as the OS preference: this is all movement.
  if (resolveLevel(motionLevel()) !== 'full') return
  if (!supportsWebgl()) return

  const id = ++build
  drop()

  if (!acquireSlot(ground)) return
  held = true

  const Neat = await loadNeat()

  // The import was awaited, so the theme or mount state may have changed.
  if (!Neat || !mounted || id !== build || !canvas.value) {
    yield_()
    return
  }

  const colors = theme.current.value.colors as Record<string, string>
  const dark = theme.current.value.dark
  const config = groundConfig()

  instance = new Neat({
    ref: canvas.value,

    // Every shader parameter comes from configuration, dark overrides applied.
    ...groundShape(dark),

    colors: flowStops(colors, dark).map(color => ({ color, enabled: true })),
    resolution: config.resolution,

    // Read by 1.x to remove its watermark; 0.x ignores it. Sent only when set.
    ...(config.licenseKey ? { licenseKey: config.licenseKey } : {}),

    backgroundColor: colors.bg ?? colors.background,
    backgroundAlpha: 1,

    // Off: the texture system draws grain over every plane.
    grainIntensity: 0,
  })

  scrub()
  ready.value = true
}

onMounted(() => {
  mounted = true
  watchForLinks()
  void start()
})

// Rebuild when the stop colours change. Watched by value, because a runtime
// accent changes the active theme's colours without changing its name.
watch(
  () => {
    const colors = theme.current.value.colors as Record<string, string>
    return [theme.global.name.value, colors.accent, colors.warning, colors.sunk, colors.bg].join()
  },
  () => {
    void start()
  },
)

// Rebuild when any shader parameter changes, since they are read once in
// start(). Coalesced, because a slider fires per pixel.
let queued: ReturnType<typeof setTimeout> | undefined

watch(
  () => {
    const config = groundConfig()
    return JSON.stringify([groundShape(theme.current.value.dark), config.resolution, config.colors])
  },
  () => {
    if (queued) clearTimeout(queued)
    queued = setTimeout(() => void start(), 120)
  },
)

/* Builds a shader when motion is turned back up. Watches `resolved`, which
   tracks matchMedia; a direct resolveLevel() call would not be reactive. */
watch(() => motion.resolved.value, (level) => {
  if (level === 'full') void start()
  else drop()
})

onBeforeUnmount(() => {
  mounted = false
  build += 1
  if (queued) clearTimeout(queued)
  watcher?.disconnect()
  watcher = null
  drop()
})
</script>

<style scoped>
/* Bounded by default: fills and is clipped by its holder, which must be positioned. */
.flow {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

/* The ground: fixed, under the page (v-main is lifted to 1 in AppShell), and
   attenuated so text on it stays readable. A bounded UiFlow keeps full strength. */
.flow--ground {
  position: fixed;
  opacity: var(--s99ab-flow-opacity);
}

.v-theme--dark .flow--ground {
  opacity: var(--s99ab-flow-opacity-dark);
}

/* Transparent until the shader draws, so a failed build leaves the backdrop.
   Positioned out of flow so the canvas's intrinsic 300x150 does not size the box. */
.flow__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 1.2s ease;
}

.flow__canvas--ready {
  opacity: 1;
}

/* Hides the canvas if the level drops to reduced after a build. */
:root[data-motion='reduced'] .flow__canvas,
:root[data-motion='off'] .flow__canvas {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion]) .flow__canvas,
  :root[data-motion='system'] .flow__canvas {
    transition: none;
  }
}
</style>
