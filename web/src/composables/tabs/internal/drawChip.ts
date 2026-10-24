// web/src/composables/tabs/internal/drawChip.ts

/**
 * Draws a dragged tab's pill from its computed style to a base64 PNG at `scale`, for
 * the desktop drag image outside the window. Null without a 2D canvas.
 */
export function drawChip(pill: HTMLElement, scale: number): string | null {
  const box = pill.getBoundingClientRect()
  if (!box.width || !box.height) return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(box.width * scale)
  canvas.height = Math.ceil(box.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(scale, scale)

  const style = getComputedStyle(pill)
  const line = parseFloat(style.borderTopWidth) || 0
  const radius = Math.min(parseFloat(style.borderTopLeftRadius) || 0, box.height / 2)
  rounded(ctx, line / 2, line / 2, box.width - line, box.height - line, Math.max(radius - line / 2, 0))
  ctx.fillStyle = style.backgroundColor
  ctx.fill()
  if (line) {
    ctx.lineWidth = line
    ctx.strokeStyle = style.borderTopColor
    ctx.stroke()
  }

  ctx.textBaseline = 'middle'
  for (const child of Array.from(pill.children)) {
    const at = child.getBoundingClientRect()
    if (!at.width) continue
    const own = getComputedStyle(child)
    const glyph = getComputedStyle(child, '::before')
    const icon = glyph.content && glyph.content !== 'none' && glyph.content !== 'normal'
    const font = icon ? glyph : own
    ctx.font = `${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${font.fontFamily}`
    ctx.fillStyle = own.color
    const x = at.left - box.left
    const y = at.top - box.top + at.height / 2
    if (icon) {
      ctx.textAlign = 'center'
      ctx.fillText(unquote(glyph.content), x + at.width / 2, y)
    }
    else {
      ctx.textAlign = 'left'
      ctx.fillText(fit(ctx, child.textContent?.trim() ?? '', at.width), x, y)
    }
  }
  const url = canvas.toDataURL('image/png')
  const comma = url.indexOf(',')
  return url.startsWith('data:image/png') && comma > 0 ? url.slice(comma + 1) : null
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** CSS content is a quoted string: "\F0214" comes back as the quoted glyph. */
function unquote(content: string) {
  return content.replace(/^["']|["']$/g, '')
}

/** The text cut with an ellipsis to the width its box shows, as text-overflow does. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text
  const ellipsis = '…'
  let end = text.length
  while (end > 0 && ctx.measureText(text.slice(0, end) + ellipsis).width > width) end--
  return text.slice(0, end).trimEnd() + ellipsis
}
