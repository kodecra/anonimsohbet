# Render.com Deployment Rehberi

## Backend Deployment (Web Service)

### Adım 1: GitHub Repository Oluştur
1. GitHub'a gidin (github.com)
2. Yeni bir repository oluşturun (örn: `anonimsohbet`)
3. Kodunuzu push edin:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/KULLANICI_ADINIZ/anonimsohbet.git
   git push -u origin main
   ```

### Adım 2: Render'da Web Service Oluştur
1. Render dashboard'da "New" → "Web Service" seçin
2. GitHub repository'nizi bağlayın
3. Ayarlar:
   - **Name:** `anonimsohbet-backend`
   - **Region:** Closest to you (örn: Frankfurt)
   - **Branch:** `main` (veya `master`)
   - **Root Directory:** `server` (ÖNEMLİ!)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`

### Adım 3: Environment Variables Ekleyin
Render'da "Environment" sekmesine gidin ve şunları ekleyin:
- `NODE_ENV` = `production`
- `PORT` = `10000` (Render otomatik PORT env var kullanır, ama yine de ekleyin)
- `JWT_SECRET` = (rastgele bir string, örn: `anonim-sohbet-secret-key-2024`)
- `SUPERADMIN_EMAIL` = `admin@admin.com`

### Adım 4: Deploy
1. "Create Web Service" butonuna tıklayın
2. Deploy işlemi başlayacak (5-10 dakika sürebilir)
3. Deploy tamamlandığında bir URL alacaksınız (örn: `https://anonimsohbet-backend.onrender.com`)

## Frontend Deployment (Static Site)

### Adım 1: Frontend Build
```bash
cd client
npm run build
```

### Adım 2: Render'da Static Site Oluştur
1. Render dashboard'da "New" → "Static Site" seçin
2. GitHub repository'nizi bağlayın (aynı repo veya farklı bir repo)
3. Ayarlar:
   - **Name:** `anonimsohbet-frontend`
   - **Branch:** `main`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `build`

### Adım 3: Environment Variables (Frontend)
Frontend için bir `.env.production` dosyası oluşturun veya Render'da environment variable ekleyin:
- `REACT_APP_API_URL` = Backend URL'iniz (örn: `https://anonimsohbet-backend.onrender.com`)

### Adım 4: Deploy
1. "Create Static Site" butonuna tıklayın
2. Deploy tamamlandığında bir URL alacaksınız (örn: `https://anonimsohbet-frontend.onrender.com`)

## Önemli Notlar

1. **Backend URL'ini Frontend'de Güncelleyin:**
   - `client/src/App.js` dosyasında `API_URL` değişkenini Render backend URL'iniz ile değiştirin
   - Veya environment variable kullanın: `REACT_APP_API_URL`

2. **CORS Ayarları:**
   - Backend'de CORS zaten `*` olarak ayarlı, sorun olmamalı

3. **Socket.io:**
   - Render'da Socket.io çalışır, ekstra ayar gerekmez

4. **Free Tier Limitleri:**
   - 15 dakika kullanılmazsa uyku moduna geçer
   - İlk istek 30-60 saniye sürebilir (cold start)
   - Aylık 750 saat ücretsiz

## Sorun Giderme

- Deploy başarısız olursa: Logları kontrol edin (Render dashboard'da "Logs" sekmesi)
- Socket.io bağlantı hatası: Backend URL'inin doğru olduğundan emin olun
- CORS hatası: Backend'de CORS ayarlarını kontrol edin

