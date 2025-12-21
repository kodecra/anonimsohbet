# FTP Upload Kurulum Rehberi

## Render.com'da Environment Variables Ekleme

1. Render dashboard'da backend servisinize gidin (`anonimsohbet-backend`)
2. **Environment** sekmesine tıklayın
3. Şu environment variable'ları ekleyin:

```
FTP_HOST = ftp.clinofy.com
FTP_USER = u230954858
FTP_PASSWORD = [FTP ŞİFRENİZ]
FTP_BASE_URL = https://clinofy.com
```

**Not:** `FTP_PASSWORD` değerini kendi FTP şifrenizle değiştirin. Bu bilgi Hostinger panelinden alınabilir.

## Hosting'de Uploads Klasörü Oluşturma

Hosting'inizde (Hostinger) FTP ile bağlanın ve `public_html` klasöründe `uploads` klasörünü oluşturun:

1. FTP client kullanarak hosting'e bağlanın (FileZilla, WinSCP vb.)
2. `public_html` klasörüne gidin
3. `uploads` klasörünü oluşturun
4. Klasör izinlerini `755` yapın (gerekirse)

## Deploy

1. Kodları GitHub'a push edin:
```bash
git add .
git commit -m "FTP upload entegrasyonu eklendi"
git push
```

2. Render otomatik olarak deploy edecek

## Test

Upload yaptığınızda dosyalar:
- Render'da geçici olarak kaydedilir
- FTP ile hosting'inize (`https://clinofy.com/uploads/`) yüklenir
- Render'daki geçici dosya silinir
- URL olarak hosting URL'i kullanılır (örn: `https://clinofy.com/uploads/filename.jpg`)

## Sorun Giderme

- **FTP bağlantı hatası:** FTP bilgilerini kontrol edin (host, user, password)
- **Dosya yüklenemiyor:** `uploads` klasörünün izinlerini kontrol edin (755 veya 777)
- **Fallback çalışıyor:** FTP hatası olursa dosyalar Render'da kalır (geçici), logları kontrol edin


