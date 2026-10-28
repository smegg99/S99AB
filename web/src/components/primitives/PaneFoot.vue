<!-- web/src/components/primitives/PaneFoot.vue -->
<template>
  <!-- One line of totals and facts (`stats`), problems first, under a pane or a page's table.
       Plain facts shrink first; what still does not fit hides from the end and a "+N" counts it. -->
  <footer
    ref="foot"
    class="s99ab-foot"
    :class="{ 's99ab-foot--kept': keep }"
    role="status"
    v-on="tips.on"
    @mouseover="cut.on.mouseover"
    @mouseout="cut.on.mouseout"
    @pointerdown="cut.on.pointerdown"
  >
    <span
      v-for="(stat, at) in shown"
      :key="stat.key"
      class="s99ab-foot__stat"
      :class="[stat.tone ? `s99ab-foot__stat--${stat.tone}` : undefined, {
        's99ab-foot__stat--plain': !isProblem(stat),
        's99ab-foot__stat--last': at === lastPlain,
        's99ab-foot__stat--alone': shown.length === 1,
      }]"
      :style="shown.length > 1 && least[stat.key] ? { minWidth: `${least[stat.key]}px` } : undefined"
      :data-tip="stat.tip || undefined"
    ><UiWords :text="stat.text" /></span>
    <span
      v-if="fold"
      class="s99ab-foot__stat"
      :class="fold.tone ? `s99ab-foot__stat--${fold.tone}` : undefined"
      :data-tip="fold.tip"
    ><span aria-hidden="true">{{ fold.text }}</span><span class="d-sr-only">{{ fold.tip }}</span></span>
    <span
      ref="ruler"
      class="s99ab-foot__stat s99ab-foot__ruler"
      aria-hidden="true"
    />
    <v-tooltip
      v-if="tips.tip.value"
      :model-value="true"
      :activator="tips.tip.value.el"
      :text="tips.tip.value.text"
      location="top"
    />
    <v-tooltip
      v-if="cut.tip.value"
      :model-value="true"
      :activator="cut.tip.value.el"
      :text="cut.tip.value.text"
      location="top"
    />
  </footer>
</template>

<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { useCutText } from '../../composables/primitives/useCutText'
import { useTips } from '../../composables/primitives/useTips'
import { type FooterStat, statOrder } from '../../composables/primitives/internal/paneFoot'
import { factsShown, factStub, foldOf, isProblem } from '../../composables/primitives/internal/paneFoot'

const { stats = [], keep } = defineProps<{
  /** What the line says. */
  stats?: readonly FooterStat[]
  /** The line's room kept while it says nothing. */
  keep?: boolean
}>()

const tips = useTips()
// A fact cut short with no tip of its own says itself whole.
const cut = useCutText('.s99ab-foot__stat:not([data-tip])')
const ordered = computed(() => statOrder(stats))

const foot = useTemplateRef<HTMLElement>('foot')
const ruler = useTemplateRef<HTMLElement>('ruler')
/** How many facts at the end gave way whole, counted by the "+N". */
const folded = ref(0)
/** The least width of each plain fact, by its key: its first words and an ellipsis. */
const least = ref<Record<string, number>>({})
/** Where the facts that gave way start; never past the first, whatever the facts became since the last layout. */
const kept = computed(() => factsShown(ordered.value.length, folded.value))
const shown = computed(() => ordered.value.slice(0, kept.value))
const fold = computed(() => foldOf(ordered.value.slice(kept.value)))
/** The last plain fact shown, which shrinks before the others. */
const lastPlain = computed(() => shown.value.findLastIndex(stat => !isProblem(stat)))

/** Lays the line out: measures each plain fact's least width, then hides facts from the end while the line overflows. */
let run = 0
async function measure() {
  const id = ++run
  folded.value = 0
  await nextTick()
  const el = foot.value
  const probe = ruler.value
  if (id !== run || !el || !probe) return
  const widths: Record<string, number> = {}
  for (const stat of ordered.value) {
    if (isProblem(stat)) continue
    const stub = factStub(stat.text)
    probe.textContent = stub === stat.text.trim() ? stub : `${stub}…`
    widths[stat.key] = Math.ceil(probe.getBoundingClientRect().width)
  }
  probe.textContent = ''
  least.value = widths
  await nextTick()
  while (id === run && folded.value < ordered.value.length - 1 && el.scrollWidth > el.clientWidth) {
    folded.value++
    await nextTick()
  }
}

let observer: ResizeObserver | undefined
watch(foot, (el, was) => {
  observer ??= new ResizeObserver(() => void measure())
  if (was) observer.unobserve(was)
  if (el) observer.observe(el)
}, { flush: 'post' })
watch(() => ordered.value.map(stat => `${stat.key} ${stat.tone ?? ''} ${stat.text}`).join('|'), () => void measure())
onScopeDispose(() => observer?.disconnect())
</script>

<style scoped>
.s99ab-foot {
  display: flex;
  min-width: 0;
  flex: none;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  padding: 8px 0;
  border-top: 1px solid rgb(var(--v-theme-lineSoft));
  color: rgb(var(--v-theme-ink3));
  font-size: var(--s99ab-meta-size);
  line-height: 16px;
}

/* A kept line saying nothing stands as tall as one saying a line. */
.s99ab-foot--kept { min-height: calc(16px + 16px + 1px); }

.s99ab-foot__stat {
  min-width: 0;
  max-width: 100%;
  flex: none;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Plain facts shrink to their measured least width, the last one first; errors, warnings and "+N" do not shrink.
   The shared shrink priority keeps the earlier facts whole until the last one has given way. */
.s99ab-foot__stat--plain { flex-shrink: 1; }
.s99ab-foot__stat--last { flex-shrink: var(--s99ab-shrink-first); }
.s99ab-foot__stat--alone { flex-shrink: 1; }

/* Where a plain fact's least width is measured: out of the line, unseen. */
.s99ab-foot__ruler {
  position: absolute;
  max-width: none;
  visibility: hidden;
  pointer-events: none;
}

.s99ab-foot__stat--error { color: rgb(var(--v-theme-error)); font-weight: 600; }
.s99ab-foot__stat--warning { color: rgb(var(--v-theme-warning)); font-weight: 600; }
.s99ab-foot__stat--info { color: rgb(var(--v-theme-info)); }
.s99ab-foot__stat--ok { color: rgb(var(--v-theme-success)); }
</style>
