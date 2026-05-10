// web/src/components/overlay/dialogSlot.ts

import { type Component, defineComponent, h, type PropType, provide } from 'vue'
import {
  DIALOG_CLOSE,
  type DialogEntry,
  closeDialog,
} from '../../composables/useDialog'

/**
 * Provides one entry's resolver to what it renders; provide() is per instance,
 * so each dialog in a v-for needs its own component. Kept out of the Nuxt
 * component scan by extensions: ['vue'] in nuxt.config.ts.
 */
export default defineComponent({
  name: 'S99abDialogSlot',
  props: {
    entry: { type: Object as PropType<DialogEntry>, required: true },
  },
  setup(props) {
    provide(DIALOG_CLOSE, (value?: unknown) => closeDialog(props.entry.id, value))
    return () => h(props.entry.component as Component, props.entry.props)
  },
})
