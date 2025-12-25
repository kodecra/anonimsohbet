# Hızlı Deploy Rehberi

## 🚀 Hızlı Yükleme (Sadece Değişen Dosyalar)

Her build'de genelde **sadece JS dosyası** değişir. CSS ve diğer dosyalar nadiren değişir.

### Adım 1: Build Yap
```bash
cd client
npm run build
```

### Adım 2: Sadece Değişen Dosyayı Yükle

Build sonrası konsolda göreceksiniz:
```
File sizes after gzip:
  365.38 kB  build\static\js\main.c664b83b.js  ← Bu dosya adı değişir
  35.75 kB   build\static\css\main.730c069e.css ← Bu genelde aynı kalır
```

**Sadece şunu yükle:**
- `static/js/main.XXXXX.js` (yeni hash ile)
- `static/js/main.XXXXX.js.map` (opsiyonel)

**Eski JS dosyasını sil:**
- `static/js/main.ESKI-HASH.js` (ör: main.b4d6d000.js)

### Örnek:
1. Build yaptınız → `main.c664b83b.js` oluştu
2. Hostinger File Manager → `public_html/static/js/` klasörüne gidin
3. Eski `main.*.js` dosyasını silin (ör: `main.b4d6d000.js`)
4. Yeni `main.c664b83b.js` dosyasını yükleyin
5. `main.c664b83b.js.map` dosyasını da yükleyin (opsiyonel)

## 📋 İlk Yükleme (Tüm Dosyalar)

İlk kez yüklüyorsanız veya büyük değişiklik yaptıysanız:

1. `client/build` klasöründeki **TÜM** dosyaları yükleyin
2. `.htaccess` dosyasını oluşturun (içeriği aşağıda)

## 🔄 Ne Zaman Tüm Dosyaları Yüklemeliyim?

- ✅ **Sadece JS yükle:** Kod değişiklikleri (çoğu durum)
- ✅ **Tüm dosyaları yükle:** CSS değiştiyse, yeni dosya eklendiyse, ilk yükleme

## 💡 İpucu

Hostinger File Manager'da:
- Eski JS dosyasını bulmak için: `static/js/` klasörüne bakın
- Yeni JS dosyasını bulmak için: Build sonrası konsoldaki dosya adına bakın

## ⚡ Daha Hızlı: Otomatik Script (İsteğe Bağlı)

Eğer FTP bilgilerinizi güvenli tutmak istiyorsanız, `client/deploy.js` scriptini kullanabilirsiniz:

1. `client/.env` dosyası oluşturun:
```
FTP_HOST=ftp.yourdomain.com
FTP_USER=your-username
FTP_PASSWORD=your-password
```

2. Scripti çalıştırın:
```bash
cd client
node deploy.js
```

**Not:** Bu script FTP bilgilerinizi gerektirir. Güvenlik için `.env` dosyasını `.gitignore`'a ekleyin!










