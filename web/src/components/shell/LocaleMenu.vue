<!-- web/src/components/shell/LocaleMenu.vue -->
<template>
  <v-menu>
    <template #activator="{ props: activator }">
      <v-btn
        v-bind="activator"
        :aria-label="label"
        variant="text"
        size="small"
      >
        <v-tooltip
          :text="label"
          activator="parent"
          location="bottom"
        />
        <v-icon
          icon="mdi-translate"
          start
        />
        <span class="lang__code">{{ code }}</span>
      </v-btn>
    </template>

    <v-list
      :selected="selected"
      density="compact"
      selectable
      mandatory
    >
      <v-list-item
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :title="option.title"
        @click="choose(option.value)"
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import type { LocaleOption } from '../../types'

// A two-letter button opening a menu. Each name is written in its own language,
// supplied by the app.
defineProps<{ options: LocaleOption[] }>()

const model = defineModel<string>({ required: true })

const t = useTranslate()
const label = computed(() => t('common.language', 'Language'))

// The code, so the button's width does not change with the selection.
const code = computed(() => model.value.slice(0, 2).toUpperCase())

// A selection model gives items role="option" and aria-selected. `mandatory`
// because the binding is one-way: clicking the current language would clear it.
const selected = computed(() => [model.value])

function choose(value: string) {
  model.value = value
}
</script>

<style scoped>
/* The eyebrow's tracked capitals from the same variables, without its ink3 and
   display: block, since this label sits inline and takes the button's colour. */
.lang__code {
  font-size: var(--s99ab-label-size);
  font-weight: 700;
  letter-spacing: var(--s99ab-label-track);
}
</style>
