# TikTakTuk Frontend

Aplikasi frontend TikTakTuk berbasis React + Vite untuk simulasi manajemen event, venue, dashboard per role, autentikasi, profile, dan validasi form berbasis constraint SQL.

## Tech Stack

- React
- Vite
- React Router
- Lucide React
- Mock API Layer (tanpa backend real)

## Prasyarat

Pastikan sudah terpasang:

- Node.js LTS (disarankan versi 20+)
- npm

Cek versi:

```bash
node -v
npm -v
```

## Setup Proyek

1. Clone repository:

```bash
git clone https://github.com/prasetyasurya-ui/TikTakTuk.git
cd TikTakTuk
```

2. Checkout branch kerja:

```bash
git checkout tk03
```

3. Install dependencies:

```bash
npm install
```

4. Jalankan development server:

```bash
npm run dev
```

5. Buka URL lokal dari output terminal (umumnya `http://localhost:5173`).

## Build Production

Build aplikasi:

```bash
npm run build
```

Preview hasil build:

```bash
npm run preview
```

## Akun Dummy Login

Data login dummy bersumber dari `src/data/dummyData.json`.

Contoh akun:

- Admin: `admin_utama` / `pass_admin`
- Organizer: `org_musik_indo` / `pass_org1`
- Customer: `budi_santoso` / `pass_cust1`

## Struktur Folder Utama

```text
src/
  components/        # reusable UI/navigation/profile components
  data/              # dummy seed data hasil konversi SQL
  pages/             # halaman per fitur dan role
  services/
    core/            # mock db, mock server, api client
    api/             # domain API wrappers (auth, event, venue, profile, dashboard)
  utils/             # helper validasi form
```

## Catatan Pengembangan

- Validasi frontend sudah diselaraskan dengan constraint SQL (panjang kolom, required, dan aturan numeric).
- State database mock disimpan di localStorage browser.
- Jika ingin reset data mock, hapus key localStorage berikut:
  - `tiktaktuk_mock_db_v1`
  - `isLoggedIn`, `userId`, `userRole`, `userName`, `username`

## Script yang Tersedia

- `npm run dev` - menjalankan app mode development
- `npm run build` - build production
- `npm run preview` - preview hasil build

## Deploy

### Backend ke Koyeb

1. Buat app baru di Koyeb dari repository ini.
2. Set build command ke `npm install`.
3. Set run command ke `npm start`.
4. Tambahkan environment variables:
  - `DATABASE_URL` = connection string PostgreSQL
  - `JWT_SECRET` = secret untuk token login
  - `CORS_ORIGIN` = URL frontend Vercel, misalnya `https://namafrontend.vercel.app`
5. Pastikan Koyeb memakai port dari environment `PORT` yang disediakan platform.

### Frontend ke Vercel

1. Import repository yang sama ke Vercel.
2. Set build command ke `npm run build`.
3. Set output directory ke `dist`.
4. Tambahkan environment variables:
  - `VITE_API_URL` = URL backend Koyeb, misalnya `https://namabackend.koyeb.app/api`
  - `VITE_USE_MOCK` = `false` kalau ingin pakai backend real
5. Deploy ulang setiap kali backend URL berubah.

Catatan: frontend saat ini masih punya beberapa endpoint mock yang belum sepenuhnya sama dengan backend Express. Kalau setelah deploy ada halaman yang error, berarti endpoint frontend-nya masih perlu diselaraskan ke backend nyata.
