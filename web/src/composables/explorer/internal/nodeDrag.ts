// web/src/composables/explorer/internal/nodeDrag.ts

import { inBrowser } from '../../../browser/env'
import type { ExplorerNode } from './tree'

/** Fraction of a folder tile's width at each side that reorders a dragged folder instead of nesting it. */
export const EDGE = 0.38

/** Replaces the drag image with a small pill holding a clone of the tile's icon element. */
export function setDragImage(event: DragEvent, node: ExplorerNode, carrying: number, many: string) {
  const transfer = event.dataTransfer
  if (!transfer || !inBrowser()) return

  const preview = document.createElement('div')
  preview.className = 's99ab-explorer-ghost'
  if (node.accent) preview.dataset.accent = node.accent

  const icon = (event.currentTarget as HTMLElement | null)?.querySelector(
    '.s99ab-tile__icon',
  )
  if (icon) preview.append(icon.cloneNode(true))

  const label = document.createElement('span')
  // A group shows its count instead of one name.
  label.textContent = carrying > 1 ? many : node.name
  preview.append(label)

  document.body.append(preview)
  transfer.setDragImage(preview, 16, 16)
  // The snapshot is synchronous; the node only has to outlive this frame.
  requestAnimationFrame(() => preview.remove())
}

export function pastHalf(event: DragEvent): boolean {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return event.clientX - rect.left > rect.width / 2
}

export function edgeOf(event: DragEvent): 'start' | 'centre' | 'end' {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  if (x < rect.width * EDGE) return 'start'
  if (x > rect.width * (1 - EDGE)) return 'end'
  return 'centre'
}
