// web/src/composables/usePlatform.ts

import { onMounted, readonly, ref } from 'vue'

export type OS = 'linux' | 'windows' | 'macos' | 'other'

// Module level, so every caller gets the same answer.
const os = ref<OS>('other')
let detected = false

/**
 * Reads the OS from the user agent. Handhelds first (an iPhone matches /mac/),
 * macOS before Windows ("darwin" contains "win").
 */
export function detectOS(ua: string): OS {
  const s = ua.toLowerCase()
  if (/iphone|ipad|ipod|android/.test(s)) return 'other'
  if (/darwin|macos|mac os|macintosh|mac/.test(s)) return 'macos'
  if (/windows|win/.test(s)) return 'windows'
  if (/linux|x11|cros/.test(s)) return 'linux'
  return 'other'
}

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
