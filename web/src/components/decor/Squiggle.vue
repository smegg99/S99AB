<!-- web/src/components/decor/Squiggle.vue -->
<script setup lang="ts">
import { computed } from 'vue'

// A drawn rule for under a section heading and between footer bands.
type Weight = 'line' | 'hair'

const PATHS: Record<Weight, string> = {
  line: 'M0 16C22 7 38 7 60 16C82 25 98 25 120 16C142 7 158 7 180 16C202 25 218 25 240 16C262 7 278 7 300 16C322 25 338 25 360 16C382 7 398 7 420 16C442 25 458 25 480 16C502 7 518 7 540 16C562 25 578 25 600 16C622 7 638 7 660 16C682 25 698 25 720 16C742 7 758 7 780 16C802 25 818 25 840 16C862 7 878 7 900 16C922 25 938 25 960 16C982 7 998 7 1020 16C1042 25 1058 25 1080 16C1102 7 1118 7 1140 16C1162 25 1178 25 1200 16C1222 7 1238 7 1260 16C1282 25 1298 25 1320 16C1342 7 1358 7 1380 16C1402 25 1418 25 1440 16',
  hair: 'M0 12C13 7 23 7 36 12C49 17 59 17 72 12C85 7 95 7 108 12C121 17 131 17 144 12C157 7 167 7 180 12C193 17 203 17 216 12C229 7 239 7 252 12C265 17 275 17 288 12C301 7 311 7 324 12C337 17 347 17 360 12C373 7 383 7 396 12C409 17 419 17 432 12C445 7 455 7 468 12C481 17 491 17 504 12C517 7 527 7 540 12C553 17 563 17 576 12C589 7 599 7 612 12C625 17 635 17 648 12C661 7 671 7 684 12C697 17 707 17 720 12C733 7 743 7 756 12C769 17 779 17 792 12C805 7 815 7 828 12C841 17 851 17 864 12C877 7 887 7 900 12C913 17 923 17 936 12C949 7 959 7 972 12C985 17 995 17 1008 12C1021 7 1031 7 1044 12C1057 17 1067 17 1080 12C1093 7 1103 7 1116 12C1129 17 1139 17 1152 12C1165 7 1175 7 1188 12C1201 17 1211 17 1224 12C1237 7 1247 7 1260 12C1273 17 1283 17 1296 12C1309 7 1319 7 1332 12C1345 17 1355 17 1368 12C1381 7 1391 7 1404 12C1417 17 1427 17 1440 12',
}

const { weight = 'line', height = 14 } = defineProps<{
  weight?: Weight
  height?: number
}>()

const d = computed(() => PATHS[weight])
const stroke = computed(() => (weight === 'line' ? 3 : 2))
</script>

<template>
  <svg
    class="squiggle"
    :style="{ height: `${height}px` }"
    viewBox="0 0 1440 32"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      :d="d"
      :stroke-width="stroke"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped lang="scss">
.squiggle {
  display: block;
  width: 100%;
}
</style>
