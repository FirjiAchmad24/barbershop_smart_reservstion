import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const processes = [
  spawn(process.execPath, ['--watch', '--no-warnings', 'server/index.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { cwd: root, stdio: 'inherit' }),
]

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of processes) child.kill()
  setTimeout(() => process.exit(code), 150)
}

for (const child of processes) {
  child.on('exit', (code, signal) => {
    if (!stopping && signal !== 'SIGTERM') stop(code || 1)
  })
  child.on('error', (error) => {
    console.error('Gagal menjalankan proses development:', error.message)
    stop(1)
  })
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
