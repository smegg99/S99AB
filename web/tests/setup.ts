// web/tests/setup.ts

// Removes happy-dom's Element.prototype.animate (added in 20.13), so theme changes
// apply synchronously; theme-transition.spec.ts stubs what it needs.

if (typeof Element !== 'undefined' && 'animate' in Element.prototype) {
  delete (Element.prototype as { animate?: unknown }).animate
}
