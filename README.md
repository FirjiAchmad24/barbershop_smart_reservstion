# Pangkas Rambut Anda

Implementasi full-stack desktop dari desain Figma **Barbershop Prototype Andry**. Frontend menggunakan React + Vite, API menggunakan Express, dan data persisten disimpan pada SQLite.

## Menjalankan aplikasi

Persyaratan: Node.js 22 atau lebih baru.

```bash
npm install
npm run dev
```

- Website: `http://localhost:5173`
- API: `http://127.0.0.1:3001`
- Database dibuat otomatis di `server/data/barbershop.db`.

## Akun demo

| Peran | Email | Password |
|---|---|---|
| Pelanggan | `pelanggan@email.com` | `12345678` |
| Admin | `admin@barbershop.com` | `admin123` |
| Barber | `budi@barbershop.com` | `barber123` |

Pelanggan baru juga dapat mendaftar melalui tombol **Daftar member**.

## Fitur full-stack

- Autentikasi cookie `httpOnly`, password hash bcrypt, rate limiting, dan otorisasi per role.
- Registrasi dan pengelolaan profil pelanggan.
- Layanan, barber, shift, harga, dan member dari database.
- Pengecekan ketersediaan serta benturan durasi slot secara real-time.
- Reservasi persisten, nomor antrian otomatis, pembatalan, dan riwayat.
- Perhitungan skor SAW di server berdasarkan member, layanan, dan ketepatan waktu.
- Bobot SAW sesuai laporan: C1 status member `0,40`, C2 jenis layanan `0,35`, dan C3 ketepatan waktu `0,25`.
- Nilai kriteria mentah `1–3`, normalisasi benefit terhadap nilai maksimum alternatif aktif, serta tie-breaker waktu reservasi.
- Check-in aktual untuk menentukan C3: tepat waktu `3`, terlambat maksimal 15 menit `2`, dan lebih dari 15 menit `1`.
- Sinkronisasi antrian pelanggan, admin, dan barber melalui Server-Sent Events.
- Waitlist digital yang otomatis dikonversi saat slot tersedia akibat pembatalan atau no-show.
- Notifikasi in-app persisten dan integrasi webhook WhatsApp opsional.
- Tampilan responsif desktop dan mobile yang mengikuti struktur artboard Figma.
- Pembaruan status pelayanan dan promosi otomatis antrian berikutnya.
- Rating layanan serta pembaruan rata-rata rating barber.
- CRUD data master, laporan dinamis, dan ekspor CSV.

## Konfigurasi

Salin `.env.example` menjadi `.env` bila perlu mengubah konfigurasi. Untuk production, `JWT_SECRET` wajib diisi dengan nilai acak yang panjang.

```env
PORT=3001
JWT_SECRET=ganti-dengan-secret-acak-yang-panjang
DATABASE_PATH=./server/data/barbershop.db
NODE_ENV=development
WHATSAPP_WEBHOOK_URL=
WHATSAPP_WEBHOOK_TOKEN=
```

Reset database ke data demo:

```bash
npm run db:reset
```

Pastikan server berhenti ketika menjalankan reset.

Pengujian otomatis metode SAW berdasarkan contoh A1–A4 pada laporan:

```bash
npm test
```

## Production

```bash
npm run build
npm start
```

Dalam mode `NODE_ENV=production`, Express menyajikan hasil build dari folder `dist`.

## Port dan troubleshooting

- Gunakan `http://localhost:5173` untuk membuka website saat development.
- `http://127.0.0.1:3001` adalah backend dan sekarang menampilkan halaman status API.
- Selalu jalankan `npm run dev`, bukan hanya `npm run dev:web`, agar frontend dan API hidup bersama.
- Satu pesan `ECONNRESET` dapat muncul ketika backend sengaja direstart. Jika muncul berulang, hentikan proses dengan `Ctrl+C`, lalu jalankan kembali `npm run dev`.
- Mode watch backend tersedia terpisah melalui `npm run dev:server:watch`; setiap restart pada mode ini akan menutup koneksi SSE sesaat dan frontend akan menyambung kembali otomatis.
