<!-- web/src/components/explorer/ExplorerFolderDialog.vue -->
<template>
  <v-card>
    <v-card-title>{{ title }}</v-card-title>

    <v-card-text class="d-flex flex-column ga-4">
      <v-text-field
        v-model="draft"
        :label="nameLabel"
        :rules="rules"
        autofocus
        @keydown.enter="save"
      />

      <UiExplorerSwatches
        v-model="tint"
        :label="accentLabel"
        :options="accents"
        :default-label="defaultLabel"
      />

      <UiExplorerGlyphs
        v-if="fields.icon"
        v-model="glyph"
        :label="iconLabel"
        :options="config.folderIcons"
        :fallback="config.icons.folder"
        :default-label="defaultLabel"
      />

      <!-- The URL field beside a preview of what it resolves to. -->
      <div
        v-if="fields.image"
        class="d-flex ga-4 align-center"
      >
        <v-text-field
          v-model="picture"
          :label="imageLabel"
          clearable
          hide-details
          @keydown.enter="save"
        />
        <UiThumb
          v-if="picture"
          :src="picture"
          :alt="draft"
          size="56"
        />
      </div>
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn
        variant="text"
        @click="close()"
      >
        {{ cancelLabel }}
      </v-btn>
      <v-btn
        :disabled="!canSave"
        color="accent"
        @click="save"
      >
        {{ confirmLabel }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiExplorerGlyphs from './ExplorerGlyphs.vue'
import UiExplorerSwatches from './ExplorerSwatches.vue'
import UiThumb from '../primitives/Thumb.vue'
import { useDialog } from '../../composables/useDialog'
import { useExplorerConfig } from '../../composables/explorer/useExplorerConfig'
import type { ExplorerFolderDraft } from '../../composables/explorer/useExplorerFolders'
import { useTranslate } from '../../composables/useTranslate'

// Name, tint, and whichever of icon and image the app's folders have. Resolves
// a value and persists nothing, so it serves both create and rename.
const { name = '', accent = '', icon = '', image = '' } = defineProps<{
  title: string
  name?: string
  accent?: string
  icon?: string
  image?: string
}>()

const { close } = useDialog<ExplorerFolderDraft>()
const t = useTranslate()
const config = useExplorerConfig()

const draft = ref(name)
const tint = ref(accent)
const glyph = ref(icon)
const picture = ref(image)
const rules = [(v: string) => !!v.trim() || t('explorer.nameRequired', 'A name is required.')]

// '' first: the default tint is an explicit choice.
const accents = computed(() => ['', ...config.accents])
const fields = computed(() => config.folderFields)

// One rule for the confirm button and for Enter.
const canSave = computed(() => !!draft.value.trim())

const nameLabel = computed(() => t('explorer.folderName', 'Name'))
const accentLabel = computed(() => t('explorer.accent', 'Colour'))
const iconLabel = computed(() => t('explorer.folderIcon', 'Icon'))
const imageLabel = computed(() => t('explorer.folderImage', 'Image URL'))
const defaultLabel = computed(() => t('explorer.accentDefault', 'Default'))
const cancelLabel = computed(() => t('common.cancel', 'Cancel'))
const confirmLabel = computed(() => t('common.confirm', 'Confirm'))

/** Resolves only the fields that were shown, so absent columns are not blanked. */
function save() {
  if (!canSave.value) return
  close({
    name: draft.value.trim(),
    accent: tint.value,
    ...(fields.value.icon ? { icon: glyph.value } : {}),
    ...(fields.value.image ? { image: picture.value?.trim() ?? '' } : {}),
  })
}
</script>
