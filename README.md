# RuteMu

Aplikasi web pemantauan rute dan pergerakan kendaraan secara *real-time* dengan peta interaktif.

<p align="left">
  <img src="https://img.shields.io/badge/JavaScript-18181B?style=flat-square&logo=javascript&logoColor=F7DF1E" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Express-18181B?style=flat-square&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/HTML5-18181B?style=flat-square&logo=html5&logoColor=E34F26" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS-18181B?style=flat-square&logo=css&logoColor=38BDF8" alt="CSS" />
</p>

---

## Preview

<img src="./screenshot-mobile-final.png" alt="RuteMu Mobile Preview" width="320" />

---

## Fitur Utama

- Pemantauan lokasi dan rute kendaraan secara *real-time* di atas peta interaktif.
- Antarmuka responsif bertema gelap yang dioptimalkan untuk tampilan desktop dan mobile.
- Backend API & penyimpanan data rute menggunakan Express dan MongoDB.

---

## Menjalankan Secara Lokal

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Konfigurasi environment (`.env`)**
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017
   MONGO_DB=rute_mu
   ```

3. **Jalankan server**
   ```bash
   npm start
   ```
   Aplikasi berjalan di `http://localhost:3000`.