// web/tests/setup.ts

// Removes happy-dom's Element.prototype.animate (added in 20.13), so theme changes
// apply synchronously; theme-transition.spec.ts stubs what it needs.

if (typeof Element !== 'undefined' && 'animate' in Element.prototype) {
  delete (Element.prototype as { animate?: unknown }).animate
}

// Ignores the AbortError happy-dom raises at teardown for requests still in
// flight. Any other unhandled rejection still fails the run.
process.on('unhandledRejection', (reason) => {
  const aborted = reason instanceof Error
    && reason.name === 'AbortError'
    && reason.constructor.name === 'DOMException'
  if (aborted) return
  throw reason
})
