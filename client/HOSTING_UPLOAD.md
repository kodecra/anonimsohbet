# Hosting'e Dosya Yükleme Rehberi (Node.js Yok)

## ⚠️ ÖNEMLİ: Hosting'inizde Node.js yoksa, sadece BUILD edilmiş statik dosyaları yüklemeniz gerekiyor!

---

## 📋 ADIM 1: Build Yapın

Önce React uygulamasını build edin:

```bash
cd /Users/oguzhan/Desktop/anonimsohbet-backend/client
npm install
npm run build
```

Build işlemi tamamlandıktan sonra `client/build/` klasörü oluşacak.

---

## 📁 ADIM 2: Hosting'e Yüklenecek Dosyalar

Build işlemi tamamlandıktan sonra **`client/build/` klasöründeki TÜM DOSYALARI** hosting'inizin **public_html** (veya root) klasörüne yükleyin.

### ✅ Yüklenecek Dosyalar:

```
build/
├── index.html          ← Ana sayfa (MUTLAKA yükleyin)
├── static/            ← Tüm klasörü yükleyin
│   ├── css/           ← Tüm CSS dosyaları
│   │   ├── main.xxxxx.css
│   │   └── main.xxxxx.css.map
│   ├── js/            ← Tüm JavaScript dosyaları
│   │   ├── main.xxxxx.js
│   │   ├── main.xxxxx.js.map
│   │   └── main.xxxxx.js.LICENSE.txt
│   └── media/         ← Varsa, resimler vs.
├── _redirects         ← Varsa (Netlify için)
├── .htaccess         ← Varsa (Apache için)
└── asset-manifest.json ← Varsa
```

### 📝 Örnek Yükleme Yapısı:

Hosting'inizde şu yapı olmalı:

```
public_html/ (veya root dizin)
├── index.html
├── static/
│   ├── css/
│   │   └── main.730c069e.css
│   └── js/
│       └── main.355f0dec.js
├── _redirects (varsa)
└── .htaccess (varsa)
```

---

## 🔧 ADIM 3: Backend URL Ayarlama

Build öncesi backend URL'ini ayarlayın:

1. `client/` klasöründe `.env` dosyası oluşturun:
```bash
cd /Users/oguzhan/Desktop/anonimsohbet-backend/client
```

2. `.env` dosyasına şunu ekleyin:
```
REACT_APP_API_URL=https://anonimsohbet-backend.onrender.com
```

3. Tekrar build yapın:
```bash
npm run build
```

---

## 📤 ADIM 4: FTP ile Yükleme

### FileZilla veya benzeri FTP client kullanarak:

1. **FileZilla'yı açın**
2. **Hosting bilgilerinizi girin:**
   - Host: ftp.yourdomain.com (veya hosting'inizin verdiği FTP adresi)
   - Username: FTP kullanıcı adınız
   - Password: FTP şifreniz
   - Port: 21 (veya hosting'inizin belirttiği port)

3. **Bağlanın**

4. **Sol tarafta (Local):**
   - `client/build/` klasörüne gidin
   - **TÜM DOSYALARI** seçin (Ctrl+A veya Cmd+A)

5. **Sağ tarafta (Remote):**
   - `public_html` klasörüne gidin (veya root dizin)

6. **Yükleyin:**
   - Seçili dosyaları sağa sürükleyin veya sağ tıklayıp "Upload" seçin
   - ⚠️ **ÖNEMLİ:** Klasör yapısını koruyun! `static/` klasörü de yüklenmeli

---

## ✅ ADIM 5: Kontrol

Yükleme sonrası:

1. **Tarayıcıda sitenizi açın:** https://yourdomain.com
2. **Developer Console'u açın:** F12 veya Cmd+Option+I
3. **Kontrol edin:**
   - ✅ Sayfa açılıyor mu?
   - ✅ Console'da hata var mı?
   - ✅ Backend'e bağlanıyor mu? (Network sekmesinde API istekleri görünmeli)

---

## 🚨 SIK YAPILAN HATALAR:

1. ❌ **Build klasörünü yüklemek** → Build klasörünü değil, İÇİNDEKİ dosyaları yükleyin
2. ❌ **Sadece index.html yüklemek** → `static/` klasörü de gerekli!
3. ❌ **Klasör yapısını bozmak** → `static/css/` ve `static/js/` klasörleri korunmalı
4. ❌ **Backend URL'ini ayarlamamak** → `.env` dosyası oluşturmayı unutmayın

---

## 📝 Özet:

1. ✅ `npm run build` yapın
2. ✅ `client/build/` klasöründeki **TÜM DOSYALARI** seçin
3. ✅ FTP ile `public_html` klasörüne yükleyin
4. ✅ Klasör yapısını koruyun
5. ✅ Backend URL'ini `.env` dosyasında ayarlayın

---

## 🔗 Backend URL:

Backend'iniz Render.com'da çalışıyorsa:
```
REACT_APP_API_URL=https://anonimsohbet-backend.onrender.com
```

Bu URL'yi `.env` dosyasına eklemeyi unutmayın!




