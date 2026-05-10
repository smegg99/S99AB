<!-- web/src/components/shell/NavList.vue -->
<template>
  <v-list
    v-for="entry in keyedGroups"
    :key="entry.key"
    :aria-label="entry.group.label"
    class="nav__list"
    density="compact"
    nav
  >
    <v-list-subheader
      v-if="entry.group.label"
      class="s99ab-eyebrow nav__group"
    >
      {{ entry.group.label }}
    </v-list-subheader>

    <!-- `to` or `href`, never both: with both, Vuetify routes and the new tab
         never opens. A new-tab link is never `exact`. -->
    <v-list-item
      v-for="row in entry.rows"
      :key="row.key"
      :to="row.link!.newTab ? undefined : row.link!.to"
      :href="row.link!.newTab ? row.link!.to : undefined"
      :target="row.link!.newTab ? '_blank' : undefined"
      :rel="row.link!.newTab ? 'noopener' : undefined"
      :exact="row.link!.newTab ? undefined : row.link!.exact"
      :prepend-icon="row.link!.icon"
      :title="row.link!.label"
      :style="{ '--nav-depth': row.depth }"
      class="nav__row"
      @click="emit('navigate')"
    >
      <!-- Marks a link that leaves the page. -->
      <template
        v-if="row.link!.newTab"
        #append
      >
        <v-icon
          class="nav__away"
          icon="mdi-open-in-new"
        />
      </template>

      <template
        v-else-if="row.link!.badge !== undefined"
        #append
      >
        <v-chip size="x-small">
          {{ row.link!.badge }}
        </v-chip>
      </template>
    </v-list-item>
  </v-list>
</template>

<script setup lang="ts">
import type { NavGroup } from '../../types'
import { computed } from 'vue'
import { flattenNav } from '../../composables/shell/useNavTrail'

// The plain rail: grouped links down the side.
const { groups } = defineProps<{ groups: NavGroup[] }>()

const emit = defineEmits<{ navigate: [] }>()

// Keyed by group identity so reordering groups does not reuse the wrong list.
// Nesting uses the same flattener as UiNavTrail.
const keyedGroups = computed(() =>
  groups.map((group, i) => ({
    key: group.label ?? group.items[0]?.to ?? i,
    group,
    rows: flattenNav([{ items: group.items }]),
  })),
)
</script>
