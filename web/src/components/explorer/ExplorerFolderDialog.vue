<!-- web/src/components/explorer/ExplorerFolderDialog.vue -->
<template>
  <UiDialogCard :title="title">
    <!-- Prevented, so WebKit does not also press the button that gets focus back. -->
    <v-text-field
      v-model="draft"
      :label="nameLabel"
      :rules="rules"
      autofocus
      @focus="pickName"
      @keydown.enter.prevent="save"
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

    <!-- The URL beside a preview of its image. -->
    <div
      v-if="fields.image"
      class="d-flex ga-4 align-center"
    >
      <v-text-field
        v-model="picture"
        :label="imageLabel"
        clearable
        hide-details
        @keydown.enter.prevent="save"
      />
      <UiThumb
        v-if="picture"
        :src="picture"
        :alt="draft"
        size="56"
      />
    </div>
    <template #actions>
      <v-btn
        variant="text"
        @click="close()"
      >
        {{ cancelLabel }}
      </v-btn>
      <!-- Flat, as in ConfirmDialog. -->
      <UiDisabledHint
        :reason="canSave ? '' : t('explorer.nameRequired', 'A name is required.')"
        :label="confirmLabel"
      >
        <v-btn
          :disabled="!canSave"
          color="accent"
          variant="flat"
          @click="save"
        >
          {{ confirmLabel }}
        </v-btn>
      </UiDisabledHint>
    </template>
  </UiDialogCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiExplorerGlyphs from './ExplorerGlyphs.vue'
import UiExplorerSwatches from './ExplorerSwatches.vue'
import UiDialogCard from '../overlay/DialogCard.vue'
import UiDisabledHint from '../primitives/DisabledHint.vue'
import UiThumb from '../primitives/Thumb.vue'
import { useDialog } from '../../composables/useDialog'
import { useExplorerConfig } from '../../composables/explorer/useExplorerConfig'
import type { ExplorerFolderDraft } from '../../composables/explorer/useExplorerFolders'
import { useTranslate } from '../../composables/useTranslate'

// Folder name, tint, and the app's optional icon and image; persists nothing, so it serves create and rename.
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
// Selects the old name on first focus only, so a later click still places the caret.
let picked = !name
function pickName(event: FocusEvent) {
  const input = event.target as HTMLInputElement | null
  if (picked || !input) return
  picked = true
  input.select()
}
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
