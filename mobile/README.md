# 📱 Anonim Sohbet - Mobil Uygulama

React Native (Expo) ile geliştirilmiş mobil sohbet uygulaması.

## 🚀 Kurulum

### 1. Expo CLI'yi global olarak yükleyin:

```bash
npm install -g expo-cli
```

veya

```bash
npm install -g @expo/cli
```

### 2. Bağımlılıkları yükleyin:

```bash
cd mobile
npm install
```

### 3. Backend sunucusunu çalıştırın:

Backend'in çalışıyor olması gerekiyor. `server` klasöründen:

```bash
cd ../server
npm run dev
```

## 📲 Çalıştırma

### Expo Go ile Test (Önerilen)

1. Telefonunuza **Expo Go** uygulamasını indirin:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Uygulamayı başlatın:
```bash
npm start
```

3. QR kodu Expo Go uygulamasıyla tarayın.

### Emülatör ile Test

**Android:**
```bash
npm run android
```

**iOS (sadece macOS):**
```bash
npm run ios
```

## ⚙️ Yapılandırma

### Backend URL Ayarlama

Gerçek cihazda test ederken, `App.js` ve `ChatRoom.js` dosyalarındaki `API_URL` değişkenini bilgisayarınızın IP adresi ile değiştirmeniz gerekir:

```javascript
// Local IP'nizi bulun (Windows: ipconfig, Mac/Linux: ifconfig)
const API_URL = 'http://192.168.1.XXX:5000'; // IP adresinizi buraya yazın
```

**Not:** Mobil cihaz ve bilgisayar aynı Wi-Fi ağında olmalıdır.

## 📝 Özellikler

- ✅ Gerçek zamanlı mesajlaşma
- ✅ Anonim kullanıcı desteği
- ✅ Yazıyor göstergesi
- ✅ Kullanıcı katılım/ayrılma bildirimleri
- ✅ Modern ve kullanıcı dostu arayüz
- ✅ iOS ve Android desteği

## 🏗️ Yapı

```
mobile/
├── App.js                 # Ana uygulama dosyası
├── src/
│   └── components/
│       ├── ChatRoom.js    # Sohbet ekranı
│       └── RoomJoin.js    # Oda oluşturma/katılma ekranı
└── package.json
```

## 🔧 Gereksinimler

- Node.js (v14 veya üzeri)
- Expo CLI
- iOS için: macOS ve Xcode (isteğe bağlı)
- Android için: Android Studio (isteğe bağlı)
