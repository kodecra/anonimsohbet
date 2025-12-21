# 🚀 Hızlı Başlangıç Rehberi

## ⚠️ Önemli Not
Bu bir **Node.js uygulamasıdır**, PHP değil! XAMPP'in Apache'si ile çalışmaz. Node.js sunucusunu çalıştırmanız gerekir.

## 📋 Ön Gereksinimler

1. **Node.js Kurulu mu?** Kontrol edin:
   ```bash
   node --version
   ```
   Eğer kurulu değilse: https://nodejs.org/ adresinden indirin (LTS versiyonu önerilir)

2. **npm Kurulu mu?** (Node.js ile birlikte gelir):
   ```bash
   npm --version
   ```

## 🛠️ Kurulum ve Çalıştırma

### Adım 1: Bağımlılıkları Yükle

Proje klasöründe (anonimsohbet) terminal/PowerShell açın ve:

```bash
npm run install-all
```

Bu komut tüm klasörlerdeki (server, client, mobile) bağımlılıkları yükler.

**Veya manuel olarak:**

```bash
# Root dizinde
npm install

# Server için
cd server
npm install

# Client için (web)
cd ../client
npm install

# Root'a geri dön
cd ..
```

### Adım 2: Backend Sunucusunu Başlat

**Terminal 1** açın ve:

```bash
cd server
npm run dev
```

Backend `http://localhost:5000` adresinde çalışacak. Terminal'de şunu görmelisiniz:
```
Server çalışıyor: http://localhost:5000
Eşleşme sistemi aktif
```

### Adım 3: Web Uygulamasını Başlat

**Terminal 2** açın (yeni bir terminal/PowerShell penceresi) ve:

```bash
cd client
npm start
```

Birkaç saniye sonra tarayıcı otomatik açılacak ve `http://localhost:3000` adresinde uygulama çalışacak.

**Veya otomatik olarak (her iki terminal yerine):**

Root dizinde:

```bash
npm run dev
```

Bu komut hem backend hem frontend'i birlikte başlatır.

## ✅ Test Etme

1. Tarayıcıda `http://localhost:3000` açılacak
2. Profil oluşturma ekranı görünecek
3. Kullanıcı adı girip "Profili Oluştur" butonuna basın
4. Ana ekranda "🔍 Eşleşme Başlat" butonunu görürsünüz
5. İki farklı tarayıcı penceresi açarak (veya gizli mod) test edebilirsiniz

## 🐛 Sorun Giderme

### "npm komutu bulunamadı" hatası
- Node.js'in kurulu olduğundan emin olun
- Terminal'i yeniden başlatın
- Node.js'i PATH'e ekleyin

### "Port 5000 zaten kullanılıyor" hatası
- Başka bir uygulama 5000 portunu kullanıyor olabilir
- `server/server.js` dosyasında port numarasını değiştirebilirsiniz:
  ```javascript
  const PORT = process.env.PORT || 5001; // 5001'e değiştir
  ```
- Veya o portu kullanan uygulamayı kapatın

### "Port 3000 zaten kullanılıyor" hatası
- React uygulaması otomatik olarak başka bir port kullanacak (örn: 3001)
- Veya `client/package.json`'da port ayarını değiştirebilirsiniz

### Backend bağlantı hatası
- Backend sunucusunun çalıştığından emin olun (Terminal 1'de)
- `http://localhost:5000` adresini tarayıcıda açmayı deneyin (bir hata mesajı görebilirsiniz, normal)
- Firewall'ın 5000 portunu engellemediğinden emin olun

### Web uygulaması açılmıyor
- Terminal'de hata mesajı var mı kontrol edin
- `cd client` ile client klasöründe olduğunuzdan emin olun
- `npm start` komutunu çalıştırdığınızdan emin olun

## 📱 Mobil Test İçin

Mobil uygulamayı test etmek için:

1. `mobile/KURULUM.md` dosyasına bakın
2. Expo CLI'yi yükleyin: `npm install -g expo-cli`
3. `cd mobile` ve `npm install`
4. `npm start` ile başlatın
5. Telefonunuza Expo Go uygulamasını indirin ve QR kodu tarayın

**Önemli:** Mobil test için backend URL'sini bilgisayarınızın IP adresi ile değiştirmeniz gerekir (detaylar için `mobile/KURULUM.md` dosyasına bakın).

## 🎯 Hızlı Test Senaryosu

İki kullanıcı ile test etmek için:

1. **Terminal 1:** Backend'i başlat (`cd server && npm run dev`)
2. **Terminal 2:** Web uygulamasını başlat (`cd client && npm start`)
3. **Tarayıcı 1:** Normal pencere aç (`http://localhost:3000`)
4. **Tarayıcı 2:** Gizli mod aç (Ctrl+Shift+N) (`http://localhost:3000`)
5. Her ikisinde de profil oluştur
6. Her ikisinde de "Eşleşme Başlat" butonuna bas
7. İkisi eşleşecek, 30 saniye bekleyin
8. Her ikisinde de "Devam Et" butonuna basın
9. Sohbet başlayacak!

## 💡 İpuçları

- Backend ve Frontend'in **ayrı terminal pencerelerinde** çalıştığından emin olun
- Hata mesajlarını okuyun, çoğu zaman çözüm orada yazıyor
- Node.js versiyonunuzun güncel olduğundan emin olun (v14 veya üzeri)
- `node_modules` klasörünü silip tekrar `npm install` yapmak bazen sorunları çözer

