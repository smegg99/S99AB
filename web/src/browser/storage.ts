// web/src/browser/storage.ts

// localStorage that never throws: private mode, blocked storage and SSR read as empty and drop writes.

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  }
  catch {
    // Nothing to keep it in.
  }
}

export function eraseStored(key: string): void {
  try {
    localStorage.removeItem(key)
  }
  catch {
    // Nothing to remove it from.
  }
}
