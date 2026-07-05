// Copies the MediaPipe wasm runtime out of the installed npm package into
// public/wasm so we serve it ourselves. This guarantees the wasm binaries
// always match the installed @mediapipe/tasks-vision JS API version —
// loading them from a CDN with a hardcoded version string is exactly how
// they drift apart (404s / MIME errors). Runs automatically via predev/prebuild.
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const dest = join(root, 'public', 'wasm')

mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('copied MediaPipe wasm -> public/wasm')
