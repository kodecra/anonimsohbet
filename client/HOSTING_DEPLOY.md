# Hosting'e Deploy Etme Rehberi

## 1. Build Yapın
```bash
cd client
npm install
npm run build
```

## 2. Hosting'e Yüklenecek Dosyalar

Build işlemi tamamlandıktan sonra `client/build/` klasöründeki **TÜM DOSYALARI** hosting'inizin **public_html** (veya root) klasörüne yükleyin:

### Yüklenecek Dosyalar:
- ✅ `index.html` (ana sayfa)
- ✅ `static/` klasörü (tüm içeriğiyle birlikte)
  - `static/css/` (tüm CSS dosyaları)
  - `static/js/` (tüm JS dosyaları)
  - `static/media/` (varsa, resimler vs.)
- ✅ `_redirects` dosyası (varsa, Netlify için)
- ✅ `.htaccess` dosyası (varsa, Apache için)

### Önemli Notlar:
1. **Tüm klasör yapısını koruyun** - Dosyaları doğrudan root'a yükleyin, build klasörünü yüklemeyin
2. **index.html** root dizinde olmalı
3. **static/** klasörü root dizinde olmalı
4. Backend URL'ini kontrol edin - `.env` dosyasında `REACT_APP_API_URL` değişkenini ayarlayın

### Örnek Yapı:
```
public_html/
├── index.html
├── static/
│   ├── css/
│   │   └── main.xxxxx.css
│   └── js/
│       └── main.xxxxx.js
├── _redirects (varsa)
└── .htaccess (varsa)
```

## 3. Environment Variables (Opsiyonel)

Eğer backend URL'i farklıysa, build öncesi `.env` dosyası oluşturun:
```
REACT_APP_API_URL=https://anonimsohbet-backend.onrender.com
```

Sonra tekrar build yapın:
```bash
npm run build
```

## 4. FTP ile Yükleme

FileZilla veya benzeri FTP client kullanarak:
1. `client/build/` klasöründeki TÜM dosyaları seçin
2. Hosting'inizin `public_html` klasörüne yükleyin
3. Klasör yapısını koruyun

## 5. Kontrol

Yükleme sonrası:
- https://yourdomain.com adresine gidin
- Uygulama açılmalı
- Console'da hata olmamalı
