<!-- web/src/components/overlay/DialogHost.vue -->
<template>
  <v-dialog
    v-for="entry in entries"
    :key="entry.id"
    :model-value="entry.open"
    :aria-label="entry.opts.label"
    :persistent="entry.opts.persistent || entry.held"
    :max-width="widthOf(entry.opts.width)"
    scrollable
    @update:model-value="onBackdrop(entry)"
  >
    <DialogSlot :entry="entry" />
  </v-dialog>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import DialogSlot from './dialogSlot'
import {
  type DialogEntry,
  type DialogWidth,
  closeAllDialogs,
  closeDialog,
  dialogEntries as entries,
} from '../../composables/useDialog'
import { DIALOG_WIDTHS } from '../../theme'

// Mount once in app.vue, above every layout, or dialogs open twice. Reads the
// raw stack: readonly() changes the Component type so h() rejects it.

// The stack outlives the host, so close all dialogs to settle their promises.
onUnmounted(() => closeAllDialogs())

function widthOf(width?: DialogWidth) {
  return DIALOG_WIDTHS[width ?? 'md']
}

// Backdrop and escape arrive as model-value false; Vuetify suppresses both for
// a persistent dialog.
function onBackdrop(entry: DialogEntry) {
  closeDialog(entry.id)
}
</script>
