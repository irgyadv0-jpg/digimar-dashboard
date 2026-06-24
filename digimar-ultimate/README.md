# DigiMar Dashboard v3 — dengan Shopee API

Dashboard performa digital marketing dengan integrasi Shopee Open Platform API.

---

## 🗂 Struktur Project

```
digimar-v3/
├── api/
│   ├── status.js              ← Cek status koneksi semua platform
│   └── shopee/
│       ├── auth.js            ← Generate URL login Shopee
│       ├── callback.js        ← Tangkap token setelah login
│       ├── refresh.js         ← Auto-refresh token sebelum expired
│       ├── orders.js          ← Ambil data order & GMV
│       └── ads.js             ← Ambil data spend iklan Shopee
├── public/
│   └── index.html             ← Dashboard utama
├── vercel.json                ← Config routing Vercel
├── package.json
├── .env.example               ← Template environment variables
└── README.md
```

---

## 🚀 Cara Deploy — Step by Step

### LANGKAH 1 — Install Node.js & Vercel CLI

Buka terminal, jalankan:

```bash
# Cek apakah Node.js sudah ada
node --version

# Kalau belum, download di: https://nodejs.org (pilih LTS)

# Install Vercel CLI
npm install -g vercel
```

### LANGKAH 2 — Upload project ini ke GitHub

1. Buka github.com → buat repo baru bernama `digimar-dashboard`
2. Upload SEMUA file dari folder ini (termasuk folder `api/` dan `public/`)
3. Pastikan struktur folder tetap sama

### LANGKAH 3 — Setup di Shopee Open Platform

1. Buka https://open.shopee.com → login dengan akun Shopee kamu
2. Buka **My Apps** → pilih app kamu
3. Catat **Partner ID** dan **Partner Key**
4. Di bagian **Redirect URL**, isi dengan:
   ```
   https://NAMA-APP-KAMU.vercel.app/api/shopee/callback
   ```
   (Ganti setelah dapat URL Vercel di langkah 4)

### LANGKAH 4 — Deploy ke Vercel

```bash
# Masuk ke folder project
cd digimar-v3

# Login ke Vercel (akan buka browser)
vercel login

# Deploy pertama kali
vercel

# Ikuti pertanyaannya:
# Set up and deploy? → Y
# Which scope? → pilih akun kamu
# Link to existing project? → N
# Project name? → digimar-dashboard (atau terserah)
# Directory? → tekan Enter (pakai current directory)
# Override settings? → N

# Vercel akan deploy dan kasih URL seperti:
# https://digimar-dashboard-xxx.vercel.app
```

### LANGKAH 5 — Set Environment Variables

```bash
# Set satu per satu di Vercel
vercel env add SHOPEE_PARTNER_ID
# → masukkan Partner ID kamu (angka)

vercel env add SHOPEE_PARTNER_KEY
# → masukkan Partner Key kamu (string panjang)

vercel env add SHOPEE_REDIRECT_URL
# → masukkan: https://digimar-dashboard-xxx.vercel.app/api/shopee/callback

vercel env add SECRET_KEY
# → generate dulu: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → paste hasilnya
```

### LANGKAH 6 — Deploy ulang dengan env variables

```bash
vercel --prod
```

### LANGKAH 7 — Update Redirect URL di Shopee

Kembali ke Shopee Open Platform → App Settings → update Redirect URL dengan URL Vercel final kamu.

### LANGKAH 8 — Hubungkan Shopee ke Dashboard

1. Buka dashboard kamu di browser
2. Klik tombol **"+ Hubungkan Shopee"** di topbar
3. Login dengan akun Shopee seller kamu
4. Authorize app
5. Otomatis kembali ke dashboard dengan status **"● Shopee Terhubung"**
6. Klik **"Sync Shopee"** untuk tarik data

---

## 🔄 Update Dashboard (kalau ada perubahan file)

```bash
# Di folder project
vercel --prod
```

Selesai! Vercel otomatis deploy versi terbaru.

---

## ❓ Troubleshooting

**"Token expired" terus muncul**
→ Klik badge Shopee di topbar untuk refresh manual, atau tunggu sistem auto-refresh

**Sync gagal dengan "range too large"**
→ Shopee API maksimal 15 hari per request. Pilih range tanggal lebih kecil.

**Shopee Ads tidak ada data**
→ Fitur Ads API di Shopee butuh minimal spend aktif. Kalau baru mulai beriklan, data muncul setelah ada transaksi iklan.

**"SHOPEE_PARTNER_ID belum diset"**
→ Jalankan `vercel env add SHOPEE_PARTNER_ID` lagi, lalu `vercel --prod`

---

## 📋 Channel yang Didukung

| Channel | Cara Integrasi | Status |
|---|---|---|
| Shopee Ads | API Otomatis | ✅ Ready |
| TikTok Shop | Upload CSV manual | ✅ Ready |
| TikTok Ads | API (butuh TikTok Business) | 🔜 Soon |
| Facebook/Meta Ads | API (butuh Meta Business) | 🔜 Soon |

---

*DigiMar Dashboard — dibuat dengan Claude AI*
