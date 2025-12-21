# 📱 Mobil Uygulama Kurulum Rehberi

## Hızlı Başlangıç

### 1. Expo CLI Kurulumu

```bash
npm install -g expo-cli
# veya
npm install -g @expo/cli
```

### 2. Bağımlılıkları Yükle

```bash
cd mobile
npm install
```

### 3. Backend Sunucusunu Başlat

Backend sunucusunun çalışıyor olması gerekiyor:

```bash
# Root dizinden
cd server
npm run dev
```

Backend `http://localhost:5000` adresinde çalışacak.

### 4. Mobil Uygulamayı Çalıştır

```bash
cd mobile
npm start
```

## 📲 Telefon ile Test Etme

### Expo Go Kullanımı (Önerilen)

1. **Telefonunuza Expo Go uygulamasını indirin:**
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Bilgisayar ve telefon aynı Wi-Fi ağında olmalı**

3. **Terminal'de çıkan QR kodu tarayın:**
   - iOS: Kamera uygulaması ile
   - Android: Expo Go uygulaması içinden

### ⚠️ Önemli: Backend URL Ayarlama

Telefonda test ederken, `App.js` ve `src/components/ChatRoom.js` dosyalarındaki `API_URL` değerini bilgisayarınızın **yerel IP adresi** ile değiştirmeniz gerekir.

#### IP Adresinizi Bulma:

**Windows:**
```bash
ipconfig
# "IPv4 Address" değerini bulun (örn: 192.168.1.100)
```

**macOS/Linux:**
```bash
ifconfig
# veya
ip addr show
```

#### URL'yi Güncelleme:

`App.js` ve `ChatRoom.js` dosyalarında:

```javascript
// ÖNCE (sadece bilgisayarda çalışır):
const API_URL = 'http://localhost:5000';

// SONRA (telefonda çalışır):
const API_URL = 'http://192.168.1.XXX:5000'; // IP adresinizi yazın
```

**Not:** Production'da gerçek bir domain kullanacaksınız.

## 🖥️ Emülatör ile Test

### Android Emülatör

1. Android Studio'yu kurun
2. Android emülatörü başlatın
3. Terminal'den:
```bash
npm run android
```

### iOS Simulator (sadece macOS)

1. Xcode'u kurun
2. Terminal'den:
```bash
npm run ios
```

## 🐛 Sorun Giderme

### Bağlantı Hatası

- ✅ Backend sunucusunun çalıştığından emin olun
- ✅ IP adresinin doğru olduğunu kontrol edin
- ✅ Bilgisayar ve telefon aynı Wi-Fi ağında mı kontrol edin
- ✅ Firewall'ın 5000 portunu engellemediğinden emin olun

### Expo Go QR Kod Tarama Sorunu

- ✅ Expo Go uygulamasının güncel olduğundan emin olun
- ✅ Aynı Wi-Fi ağında olduğunuzu kontrol edin
- ✅ Manuel olarak `exp://` URL'sini Expo Go içinden girebilirsiniz

## 📦 Production Build

### Android APK Oluşturma

```bash
expo build:android
```

### iOS IPA Oluşturma (sadece macOS)

```bash
expo build:ios
```

Detaylı bilgi: [Expo Documentation](https://docs.expo.dev/)
