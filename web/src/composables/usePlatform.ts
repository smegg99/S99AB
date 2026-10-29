// web/src/composables/usePlatform.ts

import { onMounted, readonly, ref } from 'vue'
import { detectOS } from '../internal/platform'

export type OS = 'linux' | 'windows' | 'macos' | 'android' | 'ios' | 'other'

// Module level, so every caller gets the same answer.
const os = ref<OS>('other')
let detected = false

/** The visitor's OS, resolved on mount; "other" until then and during SSR. */
export function usePlatform() {
  onMounted(() => {
    if (detected || typeof navigator === 'undefined') return
    detected = true

    // userAgentData where it exists, the UA string otherwise.
    const uaData = (
      navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData
    os.value = detectOS(`${navigator.userAgent} ${uaData?.platform ?? ''}`)
  })

  return { os: readonly(os) }
}
