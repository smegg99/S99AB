<!-- web/src/components/shortcut/ShortcutHelp.vue -->
<template>
  <UiDialogCard :title="title">
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
        <!-- The rail's eyebrow style; Vuetify's subheader blends into the rows at this density. -->
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
    <template #actions>
      <v-btn
        variant="text"
        @click="close()"
      >
        {{ closeLabel }}
      </v-btn>
    </template>
  </UiDialogCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiKbd from './Kbd.vue'
import UiDialogCard from '../overlay/DialogCard.vue'
import UiEmptyState from '../state/EmptyState.vue'
import { useDialog } from '../../composables/useDialog'
import { useShortcutRegistry } from '../../composables/useShortcut'
import { useTranslate } from '../../composables/useTranslate'

interface Row { id: string, keys: string, title: string }
interface Group { key: string, title: string, items: Row[] }

const { active } = useShortcutRegistry()
const { close } = useDialog()
const t = useTranslate()

// One group per registry id prefix, named by the app or by the prefix.
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
