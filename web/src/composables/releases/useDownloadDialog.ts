// web/src/composables/releases/useDownloadDialog.ts

import DownloadDialog from '../../components/releases/DownloadDialog.vue'
import { useDialog } from '../useDialog'
import { useTranslate } from '../useTranslate'

export interface DownloadDialogOptions {
  title?: string
  /** Where "all releases" points when there is nothing to show. */
  releasesUrl?: string
}

/** Opens the download card in a dialog; resolves when it closes. */
export function useDownloadDialog() {
  const { openDialog } = useDialog()
  const t = useTranslate()

  function openDownloads(options: DownloadDialogOptions = {}) {
    // Resolved here so the dialog always has an accessible name, also used as the title.
    const title = options.title || t('release.downloads', 'Downloads')
    return openDialog(
      DownloadDialog,
      { ...options, title },
      { width: 'md', label: title },
    )
  }

  return { openDownloads }
}
