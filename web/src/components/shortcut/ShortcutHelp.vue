<!-- web/src/components/shortcut/ShortcutHelp.vue -->
<template>
  <v-card>
    <v-card-title>{{ title }}</v-card-title>

    <v-card-text>
      <UiEmptyState
        v-if="!groups.length"
        :title="noneTitle"
      />

      <v-list
        v-else
        density="compact"
      >
        <template
          v-for="group in groups"
          :key="group.key"
        >
          <!-- The eyebrow, as on the rail's group labels; Vuetify's subheader
               is indistinguishable from the bindings at this density. -->
          <v-list-subheader class="s99ab-eyebrow">
            {{ group.title }}
          </v-list-subheader>

          <v-list-item
            v-for="item in group.items"
            :key="item.id"
            :title="item.title"
          >
            <template #append>
              <UiKbd :keys="item.keys" />
            </template>
          </v-list-item>
        </template>
      </v-list>
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn @click="close()">
        {{ closeLabel }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiKbd from './Kbd.vue'
import UiEmptyState from '../state/EmptyState.vue'
import { useDialog } from '../../composables/useDialog'
import { useShortcutRegistry } from '../../composables/useShortcut'
import { useTranslate } from '../../composables/useTranslate'

interface Row { id: string, keys: string, title: string }
interface Group { key: string, title: string, items: Row[] }

const { active } = useShortcutRegistry()
const { close } = useDialog()
const t = useTranslate()

// Display-ready groups. A group is a registry id prefix, named by the app or
// falling back to the prefix itself.
const groups = computed<Group[]>(() => {
  const byKey = new Map<string, Group>()

  for (const item of active.value) {
    let group = byKey.get(item.group)
    if (!group) {
      group = { key: item.group, title: t(`shortcut.group.${item.group}`, item.group), items: [] }
      byKey.set(item.group, group)
    }
    group.items.push({ id: item.id, keys: item.keys, title: t(item.label, item.id) })
  }
  return [...byKey.values()]
})

const title = computed(() => t('shortcut.title', 'Keyboard shortcuts'))
const noneTitle = computed(() => t('shortcut.none', 'No shortcuts on this screen'))
const closeLabel = computed(() => t('common.close', 'Close'))
</script>
