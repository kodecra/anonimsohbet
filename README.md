# 🎭 Anonim Sohbet Uygulaması

Gerçek zamanlı anonim sohbet uygulaması. Web (React) ve Mobil (React Native/Expo) uygulamaları ve Node.js/Socket.io backend'i ile geliştirilmiştir.

## 🚀 Özellikler

- ✅ Gerçek zamanlı mesajlaşma (WebSocket)
- ✅ Anonim kullanıcı eşleşme sistemi
- ✅ Profil oluşturma (kullanıcı adı, yaş, biyografi, ilgi alanları)
- ✅ Otomatik eşleşme (2 kullanıcı ile)
- ✅ 30 saniyelik tanışma süresi
- ✅ Devam/Çıkış karar mekanizması
- ✅ Profil görünürlüğü (her iki taraf devam derse)
- ✅ Yazıyor göstergesi
- ✅ Modern ve responsive UI (Web & Mobil)
- ✅ Cross-platform mobil uygulama (iOS & Android)

## 📋 Gereksinimler

- Node.js (v14 veya üzeri)
- npm veya yarn

## 🛠️ Kurulum

### Tüm bağımlılıkları yükle

```bash
npm run install-all
```

### Veya manuel olarak:

```bash
# Root dizinde
npm install

# Server dizininde
cd server
npm install

# Client dizininde (Web)
cd ../client
npm install

# Mobile dizininde (Mobil - İsteğe bağlı)
cd ../mobile
npm install
```

## ▶️ Çalıştırma

### Hem backend hem frontend'i birlikte çalıştır:

```bash
npm run dev
```

### Veya ayrı ayrı:

**Backend (Terminal 1):**
```bash
cd server
npm run dev
```

**Frontend (Terminal 2):**
```bash
cd client
npm start
```

Uygulama şu adreslerde çalışacak:
- Frontend (Web): http://localhost:3000
- Backend: http://localhost:5000

## 📱 Mobil Uygulama

React Native (Expo) ile geliştirilmiş mobil uygulama mevcuttur.

### Kurulum:

1. **Expo CLI'yi yükleyin:**
```bash
npm install -g expo-cli
```

2. **Mobil bağımlılıkları yükleyin:**
```bash
cd mobile
npm install
```

3. **Mobil uygulamayı çalıştırın:**
```bash
npm start
# veya root dizinden: npm run mobile
```

4. **Expo Go uygulamasını telefonunuza indirin ve QR kodu tarayın**

Detaylı bilgi için: [mobile/README.md](mobile/README.md)

## 🗂️ Proje Yapısı

```
anonimsohbet/
├── server/           # Backend (Node.js + Express + Socket.io)
│   ├── server.js
│   └── package.json
├── client/           # Frontend Web (React)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatRoom.js
│   │   │   └── RoomJoin.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── mobile/           # Frontend Mobil (React Native/Expo)
│   ├── src/
│   │   └── components/
│   │       ├── ChatRoom.js
│   │       └── RoomJoin.js
│   ├── App.js
│   └── package.json
└── package.json      # Root package.json
```

## 🎨 Teknolojiler

- **Backend:** Node.js, Express, Socket.io
- **Frontend Web:** React 18, Socket.io-client
- **Frontend Mobil:** React Native, Expo, Socket.io-client
- **Styling:** CSS3 (Web), StyleSheet (Mobil)

## 📝 Lisans

MIT
