# Frontend'i Kendi Hosting'inize Yükleme Rehberi

Bu rehber, frontend'i kendi hosting'inize yükleyip Render'daki backend'e bağlamanızı sağlar.

## 🎯 Avantajlar
- ✅ Hızlı test: GitHub push + Render deploy beklemeden test edebilirsiniz
- ✅ Kendi hosting'inizde kontrol
- ✅ Backend ve PostgreSQL Render'da kalır (güvenilir)

## 📋 Adımlar

### 1. Render Backend URL'inizi Bulun
Render dashboard'unuzdan backend servisinizin URL'ini kopyalayın. Örnek:
```
https://anonimsohbet-backend-xxxx.onrender.com
```

### 2. Frontend'i Build Edin

Terminal'de proje klasöründe:

```bash
cd client
npm run build
```

Bu işlem `client/build` klasörünü oluşturur/günceller.

### 3. API URL'ini Ayarlayın

Build öncesi API URL'ini ayarlamak için 2 seçenek var:

#### Seçenek A: .env Dosyası (Önerilen)
`client` klasöründe `.env.production` dosyası oluşturun:

```env
REACT_APP_API_URL=https://anonimsohbet-backend-xxxx.onrender.com
```

Sonra build edin:
```bash
cd client
npm run build
```

#### Seçenek B: Build Sırasında
```bash
cd client
set REACT_APP_API_URL=https://anonimsohbet-backend-xxxx.onrender.com && npm run build
```

**Windows PowerShell için:**
```powershell
cd client
$env:REACT_APP_API_URL="https://anonimsohbet-backend-xxxx.onrender.com"; npm run build
```

### 4. Build Dosyalarını Hosting'inize Yükleyin

`client/build` klasöründeki **TÜM DOSYALARI** hosting'inizin **public_html** (veya **www** veya **htdocs**) klasörüne yükleyin:

```
client/build/
├── _redirects          ← ÖNEMLİ! Mutlaka yükleyin
├── index.html
├── asset-manifest.json
└── static/
    ├── css/
    └── js/
```

**Önemli:** 
- `_redirects` dosyasını mutlaka yükleyin (client-side routing için)
- Tüm `static` klasörünü yükleyin
- Dosya yapısını koruyun

### 5. Hosting Ayarları

#### Hostinger için:
1. File Manager'dan `public_html` klasörüne gidin
2. `client/build` içindeki tüm dosyaları yükleyin
3. `.htaccess` dosyası oluşturun (eğer yoksa):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### 6. CORS Ayarları (Backend'de)

Render backend'inizde CORS'un hosting domain'inizi kabul ettiğinden emin olun. `server/server.js` dosyasında:

```javascript
const corsOptions = {
  origin: [
    'https://anonimsohbet-plji.onrender.com', // Render frontend
    'https://yourdomain.com', // Kendi hosting'iniz
    'http://localhost:3000' // Local test
  ],
  credentials: true
};
```

### 7. Test Edin

1. Kendi hosting URL'inizden siteyi açın
2. Console'da (F12) hata olup olmadığını kontrol edin
3. Login yapmayı deneyin
4. Socket bağlantısının çalıştığını kontrol edin

## 🔄 Güncelleme Süreci

Frontend'de değişiklik yaptığınızda:

1. Değişiklikleri yapın
2. `cd client && npm run build` çalıştırın
3. `client/build` içindeki dosyaları hosting'inize yükleyin
4. Test edin

**GitHub'a push yapmadan** direkt test edebilirsiniz! 🚀

## ⚠️ Önemli Notlar

- Backend ve PostgreSQL Render'da kalır
- Dosya upload'ları FTP üzerinden Hostinger'a gider (zaten ayarlı)
- Her build'de `REACT_APP_API_URL` doğru ayarlandığından emin olun
- `_redirects` dosyasını her zaman yükleyin

## 🐛 Sorun Giderme

**"Cannot GET /admin" hatası:**
- `.htaccess` dosyasını kontrol edin
- `_redirects` dosyasının yüklendiğinden emin olun

**API bağlantı hatası:**
- Console'da (F12) `REACT_APP_API_URL` değerini kontrol edin
- Backend CORS ayarlarını kontrol edin

**Socket bağlantı hatası:**
- Backend URL'inin doğru olduğundan emin olun
- HTTPS kullanıyorsanız backend de HTTPS olmalı












