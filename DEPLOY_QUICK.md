# Render.com Hızlı Deployment

## 1. GitHub'a Kod Yükleme

Terminal'de proje klasöründe şunları çalıştırın:

```bash
# Git repository başlat
git init

# Tüm dosyaları ekle
git add .

# Commit yap
git commit -m "Initial commit - Anonim Sohbet App"

# GitHub repository URL'inizi ekleyin (kendi kullanıcı adınızla değiştirin)
git remote add origin https://github.com/KULLANICI_ADINIZ/anonimsohbet.git

# GitHub'a push et
git branch -M main
git push -u origin main
```

**Not:** GitHub'da repository'yi önce oluşturmayı unutmayın!

## 2. Render'da Backend Deploy

1. Render dashboard'da **"New"** → **"Web Service"** seçin
2. **"Connect GitHub"** butonuna tıklayın ve repository'nizi seçin
3. **Ayarlar:**
   - **Name:** `anonimsohbet-backend`
   - **Region:** `Frankfurt` (veya size en yakın)
   - **Branch:** `main`
   - **Root Directory:** `server` ⚠️ **ÇOK ÖNEMLİ!**
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`

4. **Environment Variables** sekmesine gidin ve ekleyin:
   ```
   NODE_ENV = production
   PORT = 10000
   JWT_SECRET = anonim-sohbet-secret-key-2024-xyz123
   SUPERADMIN_EMAIL = admin@admin.com
   ```

5. **"Create Web Service"** butonuna tıklayın

6. Deploy tamamlandığında backend URL'inizi alın (örn: `https://anonimsohbet-backend.onrender.com`)

## 3. Render'da Frontend Deploy

1. Render dashboard'da **"New"** → **"Static Site"** seçin
2. Aynı GitHub repository'nizi seçin
3. **Ayarlar:**
   - **Name:** `anonimsohbet-frontend`
   - **Branch:** `main`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `build`
   - **Node Version:** `18` (veya `20`)

4. **Environment Variables** sekmesine gidin ve ekleyin:
   ```
   REACT_APP_API_URL = https://anonimsohbet-backend.onrender.com
   ```
   ⚠️ **Backend URL'inizi yukarıdaki adımdan aldığınız URL ile değiştirin!**

5. **"Create Static Site"** butonuna tıklayın

6. Deploy tamamlandığında frontend URL'inizi alın (örn: `https://anonimsohbet-frontend.onrender.com`)

## 4. Test

Frontend URL'inizi tarayıcıda açın ve test edin!

## Önemli Notlar

- **Free tier'de:** 15 dakika kullanılmazsa uyku moduna geçer, ilk istek 30-60 saniye sürebilir
- **Socket.io:** Render'da çalışır, ekstra ayar gerekmez
- **CORS:** Backend'de zaten ayarlı
- **Port:** Render otomatik olarak PORT environment variable kullanır

## Sorun Olursa

Render dashboard'da **"Logs"** sekmesinden hata mesajlarını kontrol edin.

