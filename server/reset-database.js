import fs from 'node:fs'
import { databasePath, db } from './database.js'

db.close()
for (const suffix of ['', '-shm', '-wal']) {
  const file = `${databasePath}${suffix}`
  if (fs.existsSync(file)) fs.rmSync(file)
}
console.log('Database dihapus. Jalankan aplikasi kembali untuk membuat seed baru.')
