// web/src/internal/platform.ts

import type { OS } from '../composables/usePlatform'

/**
 * Reads the OS from the user agent. Handhelds first (an iPhone matches /mac/),
 * macOS before Windows ("darwin" contains "win").
 */
export function detectOS(ua: string): OS {
  const s = ua.toLowerCase()
  if (/android/.test(s)) return 'android'
  if (/iphone|ipad|ipod/.test(s)) return 'ios'
  if (/darwin|macos|mac os|macintosh|mac/.test(s)) return 'macos'
  if (/windows|win/.test(s)) return 'windows'
  if (/linux|x11|cros/.test(s)) return 'linux'
  return 'other'
}
