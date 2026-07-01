import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

try {
  process.loadEnvFile(path.join(rootDir, '.env'))
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}
