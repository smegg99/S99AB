// web/src/browser/rect.ts

type Box = Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>

/** Whether the point lies in the box, edges included. */
export function inside(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
}

/** Whether two boxes share any point, edges included. */
export function overlaps(a: Box, b: Box): boolean {
  return a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom
}
