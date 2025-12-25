const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Veritabanı veya JSON dosyası kullanımı (DATABASE_URL varsa PostgreSQL, yoksa JSON)
const useDatabase = !!process.env.DATABASE_URL;

let saveUsers, loadUsers, saveAuth, loadAuth, saveMatches, loadMatches, saveVerifications, loadVerifications, initDatabase;
let saveNotification, loadNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadNotificationCount;
let saveComplaint, loadComplaints;
// Yeni: Active matches ve follow requests için
let saveActiveMatchDB, loadActiveMatchesDB, deleteActiveMatchDB;
let saveFollowRequestDB, loadFollowRequestsDB, deleteFollowRequestDB, updateFollowRequestStatusDB;
let deleteCompletedMatchDB;

if (useDatabase) {
  const db = require('./database');
  saveUsers = db.saveUsers;
  loadUsers = db.loadUsers;
  saveAuth = db.saveAuth;
  loadAuth = db.loadAuth;
  saveMatches = db.saveMatches;
  loadMatches = db.loadMatches;
  saveVerifications = db.saveVerifications;
  loadVerifications = db.loadVerifications;
  initDatabase = db.initDatabase;
  saveNotification = db.saveNotification;
  loadNotifications = db.loadNotifications;
  markNotificationAsRead = db.markNotificationAsRead;
  markAllNotificationsAsRead = db.markAllNotificationsAsRead;
  getUnreadNotificationCount = db.getUnreadNotificationCount;
  saveComplaint = db.saveComplaint;
  loadComplaints = db.loadComplaints;
  // Yeni fonksiyonlar
  saveActiveMatchDB = db.saveActiveMatch;
  loadActiveMatchesDB = db.loadActiveMatches;
  deleteActiveMatchDB = db.deleteActiveMatch;
  saveFollowRequestDB = db.saveFollowRequest;
  loadFollowRequestsDB = db.loadFollowRequests;
  deleteFollowRequestDB = db.deleteFollowRequest;
  updateFollowRequestStatusDB = db.updateFollowRequestStatus;
  deleteCompletedMatchDB = db.deleteCompletedMatch;
  console.log('✅ PostgreSQL kullanılıyor');
} else {
  const storage = require('./dataStorage');
  saveUsers = storage.saveUsers;
  loadUsers = storage.loadUsers;
  saveAuth = storage.saveAuth;
  loadAuth = storage.loadAuth;
  saveMatches = storage.saveMatches;
  loadMatches = storage.loadMatches;
  saveVerifications = storage.saveVerifications;
  loadVerifications = storage.loadVerifications;
  // JSON için basit bildirim fonksiyonları (geçici)
  saveNotification = async () => {};
  loadNotifications = async () => [];
  markNotificationAsRead = async () => {};
  markAllNotificationsAsRead = async () => {};
  getUnreadNotificationCount = async () => 0;
  // JSON için active matches ve follow requests (geçici - memory'de kalır)
  saveActiveMatchDB = async () => {};
  loadActiveMatchesDB = async () => new Map();
  deleteActiveMatchDB = async () => {};
  saveFollowRequestDB = async () => {};
  loadFollowRequestsDB = async () => new Map();
  deleteFollowRequestDB = async () => {};
  updateFollowRequestStatusDB = async () => {};
  deleteCompletedMatchDB = async () => {};
  console.log('⚠️ JSON dosyası kullanılıyor (DATABASE_URL bulunamadı - Render free tier için PostgreSQL kullanın!)');
}
const { uploadToFTP } = require('./ftpUpload');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'anonim-sohbet-secret-key-2024';

// Uploads klasörünü oluştur
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// CORS ayarları - Web ve Mobil için
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosya servisi (fotoğraflar için)
app.use('/uploads', express.static(uploadsDir));

// Veri yapıları - Kalıcı depolamadan yükle (async için Promise kullan)
let users, userAuth, completedMatches, userMatches, pendingVerifications;

const activeUsers = new Map(); // socketId -> user info (geçici - socket bağlantısı kesilince zaten sıfırlanmalı)
const matchingQueue = []; // Eşleşme bekleyen kullanıcılar (geçici - artık kullanılmayacak)
let activeMatches = new Map(); // matchId -> match info (ARTIK KALICI!)
let followRequests = new Map(); // requestId -> { fromUserId, toUserId, ... } (ARTIK KALICI!)

// Async yükleme (PostgreSQL için)
(async () => {
  try {
    users = await loadUsers(); // userId -> user profile
    userAuth = await loadAuth(); // email -> { userId, passwordHash }
    const matchesData = await loadMatches();
    completedMatches = matchesData.completedMatches;
    userMatches = matchesData.userMatches;
    pendingVerifications = await loadVerifications();
    
    // YENİ: Aktif eşleşmeleri ve follow request'leri de yükle
    if (useDatabase) {
      activeMatches = await loadActiveMatchesDB();
      followRequests = await loadFollowRequestsDB();
    }
    
    console.log('✅ Veriler yüklendi:', {
      users: users.size,
      auth: userAuth.size,
      completedMatches: completedMatches.size,
      userMatches: userMatches.size,
      verifications: pendingVerifications.size,
      activeMatches: activeMatches.size,
      followRequests: followRequests.size
    });
  } catch (error) {
    console.error('❌ Veri yükleme hatası:', error);
    // Fallback - boş Map'ler
    users = new Map();
    userAuth = new Map();
    completedMatches = new Map();
    userMatches = new Map();
    pendingVerifications = new Map();
    activeMatches = new Map();
    followRequests = new Map();
  }
})();

// Match silme helper function (veritabanına da kaydeder)
async function deleteActiveMatch(matchId) {
  activeMatches.delete(matchId);
  if (useDatabase) {
    await deleteActiveMatchDB(matchId);
  }
  console.log(`🗑️ Aktif eşleşme silindi: ${matchId}`);
}

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'admin@admin.com'; // Superadmin email
const SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME || 'oguzhancakar'; // Superadmin username

// Admin kontrolü helper fonksiyonu
function isAdmin(profile) {
  return profile.email === SUPERADMIN_EMAIL || profile.username === SUPERADMIN_USERNAME;
}

// Veritabanını başlat (eğer PostgreSQL kullanılıyorsa)
if (useDatabase && initDatabase) {
  initDatabase().catch(err => {
    console.error('❌ Veritabanı başlatma hatası:', err);
  });
}

// Verileri otomatik kaydet (her 30 saniyede bir)
setInterval(async () => {
  if (users && userAuth && completedMatches && userMatches && pendingVerifications) {
    await saveUsers(users);
    await saveAuth(userAuth);
    await saveMatches(completedMatches, userMatches);
    await saveVerifications(pendingVerifications);
    console.log('Veriler kaydedildi');
  }
}, 30000); // 30 saniye

// Uygulama kapanırken kaydet
process.on('SIGINT', async () => {
  if (users && userAuth && completedMatches && userMatches && pendingVerifications) {
    await saveUsers(users);
    await saveAuth(userAuth);
    await saveMatches(completedMatches, userMatches);
    await saveVerifications(pendingVerifications);
    console.log('Veriler kaydedildi, uygulama kapanıyor...');
  }
  process.exit(0);
});

// Kayıt ol
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email ve şifre gereklidir' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
  }

  // Email kontrolü
  if (userAuth.has(email.toLowerCase())) {
    return res.status(400).json({ error: 'Bu email zaten kayıtlı' });
  }

  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);

  userAuth.set(email.toLowerCase(), { userId, passwordHash });
  await saveAuth(userAuth); // Hemen kaydet

  // 7 haneli anonim numarası oluştur (1000000-9999999 arası)
  const anonymousNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
  
  const userProfile = {
    userId,
    email: email.toLowerCase(),
    username: email.split('@')[0], // Varsayılan kullanıcı adı
    anonymousNumber, // 7 haneli anonim numarası
    age: null,
    bio: '',
    interests: [],
    photos: [],
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  users.set(userId, userProfile);
  await saveUsers(users); // Hemen kaydet

  const token = jwt.sign({ userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });

  res.json({ 
    token,
    user: {
      userId,
      email: userProfile.email,
      username: userProfile.username
    }
  });
});

// Giriş yap
app.post('/api/login', async (req, res) => {
  const { email, username, phoneNumber, password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Şifre gereklidir' });
  }

  // Email, username veya phoneNumber'dan biri olmalı
  if (!email && !username && !phoneNumber) {
    return res.status(400).json({ error: 'Email, kullanıcı adı veya telefon numarası gereklidir' });
  }

  let userEmail = null;
  let userId = null;

  // Email ile login
  if (email) {
    userEmail = email.toLowerCase();
    const auth = userAuth.get(userEmail);
    if (!auth) {
      return res.status(401).json({ error: 'Email veya şifre hatalı' });
    }
    userId = auth.userId;
  } 
  // Username veya phoneNumber ile login
  else {
    console.log('🔍 Username/PhoneNumber ile login deneniyor:', { username, phoneNumber });
    // Users map'inde username veya phoneNumber'a göre ara
    let foundProfile = null;
    for (const [uid, profile] of users.entries()) {
      if (username && profile.username && profile.username.toLowerCase() === username.toLowerCase()) {
        console.log('✅ Username bulundu:', profile.username);
        foundProfile = profile;
        userId = uid;
        break;
      }
      if (phoneNumber && profile.phoneNumber === phoneNumber) {
        console.log('✅ PhoneNumber bulundu:', profile.phoneNumber);
        foundProfile = profile;
        userId = uid;
        break;
      }
    }

    if (!foundProfile) {
      console.log('❌ Kullanıcı bulunamadı');
      return res.status(401).json({ error: 'Kullanıcı adı/telefon veya şifre hatalı' });
    }

    console.log('🔍 userAuth\'da email aranıyor, userId:', userId);
    // userId'ye göre userAuth'dan email'i bul
    for (const [emailKey, auth] of userAuth.entries()) {
      if (auth.userId === userId) {
        userEmail = emailKey;
        console.log('✅ Email bulundu:', userEmail);
        break;
      }
    }

    if (!userEmail) {
      console.log('❌ userAuth\'da email bulunamadı');
      return res.status(401).json({ error: 'Kullanıcı adı/telefon veya şifre hatalı' });
    }
  }

  // Şifre kontrolü
  console.log('🔐 Şifre kontrol ediliyor, userEmail:', userEmail);
  const auth = userAuth.get(userEmail);
  if (!auth) {
    console.log('❌ userAuth bulunamadı');
    return res.status(401).json({ error: 'Email veya şifre hatalı' });
  }

  const isValidPassword = await bcrypt.compare(password, auth.passwordHash);
  console.log('🔐 Şifre kontrolü sonucu:', isValidPassword);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Email veya şifre hatalı' });
  }

  const profile = users.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }

  const token = jwt.sign({ userId, email: userEmail }, JWT_SECRET, { expiresIn: '7d' });

  res.json({ 
    token,
    user: {
      userId: profile.userId,
      email: profile.email,
      username: profile.username,
      verified: profile.verified
    },
    profile
  });
});

// Token doğrulama middleware
const authenticateToken = (req, res, next) => {
  // DELETE route'ları için özel log
  if (req.method === 'DELETE' && req.path.includes('/api/matches/')) {
    console.log('🔵 DELETE route authenticateToken middleware çalıştı:', req.path);
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz token' });
    }
    req.user = user;
    next();
  });
};

// Profil fotoğrafı yükleme (en fazla 5 fotoğraf)
app.post('/api/profile/photos', authenticateToken, upload.array('photos', 5), async (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Fotoğraf seçilmedi' });
  }

  // Mevcut fotoğrafları kontrol et (max 5)
  const currentPhotos = profile.photos || [];
  
  // Dosyaları FTP ile hosting'e yükle
  const newPhotos = await Promise.all(req.files.map(async (file) => {
    const localFilePath = path.join(uploadsDir, file.filename);
    const remoteFilePath = `/uploads/${file.filename}`;
    
    try {
      // FTP ile yükle
      const fileUrl = await uploadToFTP(localFilePath, remoteFilePath);
      
      // Local dosyayı sil (artık hosting'de var)
      fs.unlinkSync(localFilePath);
      
      return {
        id: uuidv4(),
        url: fileUrl, // Hosting URL'i
        filename: file.filename,
        uploadedAt: new Date()
      };
    } catch (error) {
      console.error('FTP upload error:', error);
      // FTP hatası olursa local URL kullan (fallback)
      return {
        id: uuidv4(),
        url: `/uploads/${file.filename}`, // Local URL (fallback)
        filename: file.filename,
        uploadedAt: new Date()
      };
    }
  }));

  const allPhotos = [...currentPhotos, ...newPhotos].slice(0, 5); // En fazla 5 fotoğraf

  // Fotoğraf değiştiğinde verified durumunu kaldır (fake fotoğraf önlemi)
  const wasVerified = profile.verified;
  
  const updatedProfile = {
    ...profile,
    photos: allPhotos,
    verified: false, // Fotoğraf değişince onay kaldırılır
    updatedAt: new Date()
  };

  users.set(userId, updatedProfile);
  await saveUsers(users); // Hemen kaydet
  
  const responseMessage = wasVerified 
    ? `${req.files.length} fotoğraf yüklendi. Profil onayınız kaldırıldı, tekrar doğrulama yapmanız gerekmektedir.`
    : `${req.files.length} fotoğraf yüklendi`;
    
  res.json({ profile: updatedProfile, message: responseMessage, verificationRemoved: wasVerified });
});

// Poz doğrulama yükleme (çoklu fotoğraf)
app.post('/api/profile/verify-poses', authenticateToken, upload.fields([
  { name: 'pose_1', maxCount: 1 },
  { name: 'pose_2', maxCount: 1 },
  { name: 'pose_3', maxCount: 1 },
  { name: 'pose_4', maxCount: 1 },
  { name: 'pose_5', maxCount: 1 }
]), async (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }

  if (profile.verified) {
    return res.status(400).json({ error: 'Profil zaten onaylanmış' });
  }

  // Tüm poz dosyalarını topla ve FTP ile yükle
  const poseImages = [];
  const poseIds = [];
  
  // pose_1, pose_2, etc. dosyalarını işle
  for (const key of Object.keys(req.files)) {
    if (req.files[key] && req.files[key][0]) {
      const file = req.files[key][0];
      const poseId = parseInt(key.replace('pose_', ''));
      const localFilePath = path.join(uploadsDir, file.filename);
      const remoteFilePath = `/uploads/${file.filename}`;
      
      try {
        // FTP ile yükle
        const fileUrl = await uploadToFTP(localFilePath, remoteFilePath);
        // Local dosyayı sil
        fs.unlinkSync(localFilePath);
        
        poseImages.push({
          url: fileUrl, // Hosting URL'i
          filename: file.filename,
          poseId: poseId
        });
      } catch (error) {
        console.error('FTP upload error:', error);
        // FTP hatası olursa local URL kullan (fallback)
        poseImages.push({
          url: `/uploads/${file.filename}`, // Local URL (fallback)
          filename: file.filename,
          poseId: poseId
        });
      }
      poseIds.push(poseId);
    }
  }

  if (poseImages.length === 0) {
    return res.status(400).json({ error: 'Fotoğraflar yüklenemedi' });
  }

  // Poz ID'leri sırala (doğru sırayı korumak için)
  poseImages.sort((a, b) => a.poseId - b.poseId);
  poseIds.sort((a, b) => a - b);

  pendingVerifications.set(userId, {
    userId,
    poses: poseIds,
    poseImages: poseImages,
    submittedAt: new Date(),
    status: 'pending'
  });
  await saveVerifications(pendingVerifications);

  res.json({ 
    message: 'Poz doğrulama fotoğrafları yüklendi. İnceleme sonrası onaylanacaktır.',
    verification: pendingVerifications.get(userId)
  });
});

// Selfie doğrulama yükleme (eski sistem - geriye dönük uyumluluk için)
app.post('/api/profile/verify-selfie', authenticateToken, upload.single('selfie'), async (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Selfie seçilmedi' });
  }

  // Eğer zaten onaylıysa
  if (profile.verified) {
    return res.status(400).json({ error: 'Profil zaten onaylanmış' });
  }

  // FTP ile hosting'e yükle
  const localFilePath = path.join(uploadsDir, req.file.filename);
  const remoteFilePath = `/uploads/${req.file.filename}`;
  
  let selfieUrl;
  try {
    // FTP ile yükle
    selfieUrl = await uploadToFTP(localFilePath, remoteFilePath);
    // Local dosyayı sil
    fs.unlinkSync(localFilePath);
  } catch (error) {
    console.error('FTP upload error:', error);
    // FTP hatası olursa local URL kullan (fallback)
    selfieUrl = `/uploads/${req.file.filename}`;
  }

  // Bekleyen doğrulama varsa onu güncelle, yoksa yeni oluştur
  pendingVerifications.set(userId, {
    userId,
    selfieUrl: selfieUrl,
    filename: req.file.filename,
    submittedAt: new Date(),
    status: 'pending'
  });
  await saveVerifications(pendingVerifications); // Hemen kaydet

  res.json({ 
    message: 'Selfie yüklendi. İnceleme sonrası onaylanacaktır.',
    verification: pendingVerifications.get(userId)
  });
});

// Profil fotoğrafı silme
app.delete('/api/profile/photos/:photoId', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }

  const photos = profile.photos || [];
  const photoIndex = photos.findIndex(p => p.id === req.params.photoId);
  
  if (photoIndex === -1) {
    return res.status(404).json({ error: 'Fotoğraf bulunamadı' });
  }

  // Dosyayı sil
  const photo = photos[photoIndex];
  const filePath = path.join(uploadsDir, photo.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Fotoğrafı listeden çıkar
  photos.splice(photoIndex, 1);

  // Fotoğraf değiştiğinde verified durumunu kaldır (fake fotoğraf önlemi)
  const wasVerified = profile.verified;
  
  const updatedProfile = {
    ...profile,
    photos: photos,
    verified: false, // Fotoğraf değişince onay kaldırılır
    updatedAt: new Date()
  };

  users.set(userId, updatedProfile);
  await saveUsers(users); // Hemen kaydet
  
  const responseMessage = wasVerified 
    ? 'Fotoğraf silindi. Profil onayınız kaldırıldı, tekrar doğrulama yapmanız gerekmektedir.'
    : 'Fotoğraf silindi';
    
  res.json({ profile: updatedProfile, message: responseMessage, verificationRemoved: wasVerified });
});

// Profil oluşturma/güncelleme (artık authenticated)
app.post('/api/profile', authenticateToken, async (req, res) => {
  const { username, age, bio, interests, anonymousNumber } = req.body;
  const userId = req.user.userId;
  
  let existingProfile = users.get(userId);
  if (!existingProfile) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  // Eğer anonim numarası yoksa otomatik oluştur (eski kullanıcılar için)
  if (!existingProfile.anonymousNumber) {
    let newAnonymousNumber;
    let attempts = 0;
    do {
      newAnonymousNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
      attempts++;
      
      // Başka bir kullanıcı bu numarayı kullanıyor mu kontrol et
      let isUnique = true;
      for (const [uid, profile] of users.entries()) {
        if (uid !== userId && profile.anonymousNumber === newAnonymousNumber) {
          isUnique = false;
          break;
        }
      }
      
      if (isUnique) break;
      
      if (attempts > 100) {
        newAnonymousNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
        break;
      }
    } while (true);

    existingProfile = {
      ...existingProfile,
      anonymousNumber: newAnonymousNumber,
      updatedAt: new Date()
    };
    users.set(userId, existingProfile);
    await saveUsers(users);
    console.log(`Eski kullanıcıya anonim numarası verildi (profil güncelleme): ${userId} -> ${newAnonymousNumber}`);
  }

  // Anonim numarası değiştirme kontrolü
  let newAnonymousNumber = existingProfile.anonymousNumber;
  if (anonymousNumber && anonymousNumber !== existingProfile.anonymousNumber) {
    // 7 haneli olmalı ve sadece rakam olmalı
    if (!/^\d{7}$/.test(anonymousNumber)) {
      return res.status(400).json({ error: 'Anonim numarası 7 haneli olmalıdır' });
    }
    
    // Başka bir kullanıcı bu numarayı kullanıyor mu kontrol et
    for (const [uid, profile] of users.entries()) {
      if (uid !== userId && profile.anonymousNumber === anonymousNumber) {
        return res.status(400).json({ error: 'Bu anonim numarası zaten kullanılıyor' });
      }
    }
    
    newAnonymousNumber = anonymousNumber;
  }

  const userProfile = {
    ...existingProfile,
    username: username || existingProfile.username,
    age: age !== undefined ? age : existingProfile.age,
    bio: bio !== undefined ? bio : existingProfile.bio,
    interests: interests || existingProfile.interests,
    anonymousNumber: newAnonymousNumber,
    updatedAt: new Date()
  };

  users.set(userId, userProfile);
  await saveUsers(users); // Hemen kaydet
  res.json({ profile: userProfile });
});

// Anonim numarası sıfırlama
app.post('/api/profile/reset-anonymous-number', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const existingProfile = users.get(userId);
  
  if (!existingProfile) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  // Yeni 7 haneli anonim numarası oluştur (1000000-9999999 arası)
  let newAnonymousNumber;
  let attempts = 0;
  do {
    newAnonymousNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
    attempts++;
    
    // Başka bir kullanıcı bu numarayı kullanıyor mu kontrol et
    let isUnique = true;
    for (const [uid, profile] of users.entries()) {
      if (uid !== userId && profile.anonymousNumber === newAnonymousNumber) {
        isUnique = false;
        break;
      }
    }
    
    if (isUnique) break;
    
    // 100 deneme sonrası hata ver
    if (attempts > 100) {
      return res.status(500).json({ error: 'Benzersiz anonim numarası oluşturulamadı. Lütfen tekrar deneyin.' });
    }
  } while (true);

  // Profili güncelle
  const userProfile = {
    ...existingProfile,
    anonymousNumber: newAnonymousNumber,
    updatedAt: new Date()
  };

  users.set(userId, userProfile);
  await saveUsers(users);

  // Tüm aktif eşleşmelerde anonim numarasını güncelle
  for (const [matchId, match] of activeMatches.entries()) {
    if (match.user1.userId === userId) {
      match.user1.anonymousId = newAnonymousNumber;
      activeMatches.set(matchId, match);
      if (useDatabase) await saveActiveMatchDB(matchId, match);
    } else if (match.user2.userId === userId) {
      match.user2.anonymousId = newAnonymousNumber;
      activeMatches.set(matchId, match);
      if (useDatabase) await saveActiveMatchDB(matchId, match);
    }
  }

  // Tüm pending request'lerde anonim numarasını güncelle
  for (const [requestId, request] of followRequests.entries()) {
    if (request.fromUserId === userId || request.toUserId === userId) {
      // Request'te anonim numarası saklamıyoruz, sadece match'lerde güncelliyoruz
      // Çünkü request'lerde matchId var, o match'te zaten güncellendi
    }
  }

  // Socket ile tüm bağlı kullanıcılara bildir (eşleşmeler tabında güncellensin)
  io.emit('anonymous-number-updated', {
    userId: userId,
    newAnonymousNumber: newAnonymousNumber
  });

  console.log(`Anonim numarası sıfırlandı: ${userId} -> ${newAnonymousNumber}`);

  res.json({ 
    profile: userProfile,
    message: 'Anonim numaranız sıfırlandı',
    newAnonymousNumber: newAnonymousNumber
  });
});

// Profil getirme (kendi profili - authenticated)
app.get('/api/profile', authenticateToken, async (req, res) => {
  let profile = users.get(req.user.userId);
  if (!profile) {
    // Veritabanından yüklemeyi dene
    console.log('⚠️ Profil memory\'de bulunamadı, veritabanından yükleniyor:', req.user.userId);
    if (useDatabase && loadUsers) {
      await loadUsers();
      profile = users.get(req.user.userId);
    }
    
    if (!profile) {
      console.error('❌ Profil veritabanında da bulunamadı:', req.user.userId);
      return res.status(404).json({ error: 'Profil bulunamadı. Lütfen tekrar giriş yapın.' });
    }
  }
  
  // Eğer anonim numarası yoksa otomatik oluştur (eski kullanıcılar için)
  if (!profile.anonymousNumber) {
    let newAnonymousNumber;
    let attempts = 0;
    do {
      newAnonymousNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
      attempts++;
      
      // Başka bir kullanıcı bu numarayı kullanıyor mu kontrol et
      let isUnique = true;
      for (const [uid, p] of users.entries()) {
        if (uid !== req.user.userId && p.anonymousNumber === newAnonymousNumber) {
          isUnique = false;
          break;
        }
      }
      
      if (isUnique) break;
      
      // 100 deneme sonrası hata ver
      if (attempts > 100) {
        console.error('Benzersiz anonim numarası oluşturulamadı:', req.user.userId);
        newAnonymousNumber = Math.floor(1000000 + Math.random() * 9000000).toString(); // Son çare
        break;
      }
    } while (true);

    // Profili güncelle
    profile = {
      ...profile,
      anonymousNumber: newAnonymousNumber,
      updatedAt: new Date()
    };
    
    users.set(req.user.userId, profile);
    await saveUsers(users);
    
    console.log(`Eski kullanıcıya anonim numarası verildi: ${req.user.userId} -> ${newAnonymousNumber}`);
  }
  
  res.json({ profile });
});

// Profil getirme (public - userId ile)
app.get('/api/profile/:userId', (req, res) => {
  const profile = users.get(req.params.userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }
  // Hassas bilgileri gizle
  const publicProfile = {
    userId: profile.userId,
    username: profile.username,
    age: profile.age,
    bio: profile.bio,
    interests: profile.interests,
    photos: profile.photos,
    verified: profile.verified
  };
  res.json({ profile: publicProfile });
});

// Superadmin - Bekleyen doğrulamaları getir
app.get('/api/admin/pending-verifications', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  // Superadmin kontrolü (email veya username ile)
  if (!isAdmin(profile)) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }

  const pending = Array.from(pendingVerifications.entries())
    .filter(([uid, verification]) => verification.status === 'pending')
    .map(([uid, verification]) => {
      const userProfile = users.get(uid);
      return {
        userId: uid,
        username: userProfile?.username || 'Bilinmeyen',
        email: userProfile?.email || '',
        selfieUrl: verification.selfieUrl, // Eski sistem için
        poseImages: verification.poseImages || [], // Yeni sistem için
        poses: verification.poses || [], // Poz ID'leri
        submittedAt: verification.submittedAt
      };
    });

  res.json({ verifications: pending });
});

// Superadmin - Doğrulama onayla/reddet
app.post('/api/admin/verify-user', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  const { targetUserId, action } = req.body; // action: 'approve' or 'reject'
  
  // Superadmin kontrolü (email veya username ile)
  if (!isAdmin(profile)) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }

  if (!targetUserId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Geçersiz parametreler' });
  }

  // Önce memory'den kontrol et, yoksa veritabanından yükle
  let verification = pendingVerifications.get(targetUserId);
  if (!verification && useDatabase) {
    // Veritabanından yükle
    const db = require('./database');
    const result = await db.pool.query(
      'SELECT * FROM verifications WHERE user_id = $1 AND status = $2',
      [targetUserId, 'pending']
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      verification = {
        userId: row.user_id,
        status: row.status,
        poses: row.poses || [],
        poseImages: row.pose_images || [],
        selfieUrl: row.selfie_url,
        filename: row.filename,
        submittedAt: row.submitted_at
      };
      // Memory'e de ekle
      pendingVerifications.set(targetUserId, verification);
    }
  }

  const targetProfile = users.get(targetUserId);
  if (!targetProfile) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  if (action === 'approve') {
    targetProfile.verified = true;
    users.set(targetUserId, targetProfile);
    await saveUsers(users); // Hemen kaydet
    
    // Eğer verification varsa güncelle
    if (verification) {
      verification.status = 'approved';
      pendingVerifications.set(targetUserId, verification);
      await saveVerifications(pendingVerifications);
    }
    
    res.json({ message: 'Kullanıcı onaylandı', verified: true });
  } else {
    // Reject - verification varsa güncelle
    if (verification) {
      verification.status = 'rejected';
      pendingVerifications.set(targetUserId, verification);
      // Selfie dosyasını sil
      if (verification.filename) {
        const filePath = path.join(uploadsDir, verification.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      await saveVerifications(pendingVerifications);
    }
    
    // Kullanıcının verified durumunu false yap
    targetProfile.verified = false;
    users.set(targetUserId, targetProfile);
    await saveUsers(users);
    
    res.json({ message: 'Doğrulama reddedildi' });
  }
});

// Admin - Tüm kullanıcıları getir
app.get('/api/admin/users', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  if (!isAdmin(profile)) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }

  const { sortBy = 'createdAt', order = 'desc' } = req.query;
  
  const usersList = Array.from(users.values()).map(user => ({
    userId: user.userId,
    username: user.username,
    email: user.email,
    anonymousNumber: user.anonymousNumber,
    verified: user.verified,
    createdAt: user.createdAt,
    profileViews: user.profileViews || 0
  }));

  // Sıralama
  usersList.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  res.json({ users: usersList });
});

// Admin - Şikayetleri getir
app.get('/api/admin/complaints', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  if (!isAdmin(profile)) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }

  try {
    const { status } = req.query;
    const complaints = useDatabase 
      ? await loadComplaints(status || null)
      : [];
    res.json({ complaints });
  } catch (error) {
    console.error('Şikayet yükleme hatası:', error);
    res.status(500).json({ error: 'Şikayetler yüklenemedi' });
  }
});

// Admin - Önceki eşleşmeleri temizle (hiçbir kullanıcının listesinde olmayan eşleşmeleri sil)
app.post('/api/admin/cleanup-matches', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  if (!isAdmin(profile)) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }

  try {
    // Tüm kullanıcıların match listelerini topla
    const allUserMatchIds = new Set();
    for (const [uid, matchIds] of userMatches.entries()) {
      matchIds.forEach(matchId => allUserMatchIds.add(matchId));
    }
    
    // Active matches'leri de ekle
    for (const [matchId, match] of activeMatches.entries()) {
      allUserMatchIds.add(matchId);
    }
    
    // Follow requests'leri de ekle
    for (const [requestId, request] of followRequests.entries()) {
      if (request.matchId) {
        allUserMatchIds.add(request.matchId);
      }
    }
    
    // Hiçbir kullanıcının listesinde olmayan eşleşmeleri bul ve sil
    let deletedCount = 0;
    const matchesToDelete = [];
    
    for (const [matchId, match] of completedMatches.entries()) {
      if (!allUserMatchIds.has(matchId)) {
        matchesToDelete.push(matchId);
        deletedCount++;
      }
    }
    
    // Eşleşmeleri sil
    for (const matchId of matchesToDelete) {
      completedMatches.delete(matchId);
    }
    
    // Veritabanına kaydet
    await saveMatches(completedMatches, userMatches);
    
    console.log(`✅ ${deletedCount} adet kullanılmayan eşleşme temizlendi`);
    
    res.json({ 
      success: true, 
      message: `${deletedCount} adet kullanılmayan eşleşme temizlendi`,
      deletedCount 
    });
  } catch (error) {
    console.error('Eşleşme temizleme hatası:', error);
    res.status(500).json({ error: 'Eşleşmeler temizlenemedi' });
  }
});

// Mesaj için resim yükleme
app.post('/api/messages/upload-media', authenticateToken, upload.single('media'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya yüklenemedi' });
  }
  
  // FTP ile hosting'e yükle
  const localFilePath = path.join(uploadsDir, req.file.filename);
  const remoteFilePath = `/uploads/${req.file.filename}`;
  
  let mediaUrl;
  try {
    // FTP ile yükle
    mediaUrl = await uploadToFTP(localFilePath, remoteFilePath);
    // Local dosyayı sil
    fs.unlinkSync(localFilePath);
  } catch (error) {
    console.error('FTP upload error:', error);
    // FTP hatası olursa local URL kullan (fallback)
    mediaUrl = `/uploads/${req.file.filename}`;
  }
  
  res.json({ 
    mediaUrl: mediaUrl,
    mediaType: req.file.mimetype.startsWith('image/') ? 'image' : 'file'
  });
});

// Kullanıcı engelleme
app.post('/api/users/block', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { targetUserId } = req.body;
  
  const profile = users.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }

  if (!profile.blockedUsers) profile.blockedUsers = [];
  if (!profile.blockedUsers.includes(targetUserId)) {
    profile.blockedUsers.push(targetUserId);
    users.set(userId, profile);
    await saveUsers(users);
  }
  
  res.json({ message: 'Kullanıcı engellendi', blockedUsers: profile.blockedUsers });
});

// Kullanıcı engelini kaldırma
app.post('/api/users/unblock', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { targetUserId } = req.body;
  
  const profile = users.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }

  if (profile.blockedUsers) {
    profile.blockedUsers = profile.blockedUsers.filter(id => id !== targetUserId);
    users.set(userId, profile);
    await saveUsers(users);
  }
  
  res.json({ message: 'Kullanıcı engeli kaldırıldı', blockedUsers: profile.blockedUsers });
});

// Kullanıcı şikayet etme
app.post('/api/users/report', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { targetUserId, reason } = req.body;
  
  if (!targetUserId || !reason) {
    return res.status(400).json({ error: 'Kullanıcı ID ve sebep gereklidir' });
  }

  if (userId === targetUserId) {
    return res.status(400).json({ error: 'Kendinize şikayet edemezsiniz' });
  }

  try {
    const complaintId = uuidv4();
    
    if (useDatabase && saveComplaint) {
      await saveComplaint({
        complaintId,
        reporterId: userId,
        targetUserId,
        reason,
        status: 'pending'
      });
      console.log('✅ Şikayet veritabanına kaydedildi:', complaintId);
    } else {
      console.log('⚠️ Şikayet kaydedilemedi (veritabanı yok):', {
        complaintId,
        reporterId: userId,
        targetUserId,
        reason,
        timestamp: new Date()
      });
    }
    
    res.json({ message: 'Şikayet kaydedildi, incelenecektir' });
  } catch (error) {
    console.error('Şikayet kaydetme hatası:', error);
    res.status(500).json({ error: 'Şikayet kaydedilemedi' });
  }
});

// İstatistikler
app.get('/api/statistics', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const matchIds = userMatches.get(userId) || [];
  
  let totalMessages = 0;
  let activeChats = 0;
  let profileViews = 0;
  
  matchIds.forEach(matchId => {
    const match = completedMatches.get(matchId);
    if (match) {
      totalMessages += (match.messages || []).length;
      if (match.lastMessageAt && new Date() - new Date(match.lastMessageAt) < 7 * 24 * 60 * 60 * 1000) {
        activeChats++;
      }
    }
  });
  
  const profile = users.get(userId);
  profileViews = (profile && profile.profileViews) || 0;
  
  res.json({
    totalMessages,
    activeChats,
    totalMatches: matchIds.length,
    profileViews
  });
});

// Profil görüntülenme sayısını artır
app.post('/api/profile/view', authenticateToken, async (req, res) => {
  const { targetUserId } = req.body;
  const profile = users.get(targetUserId);
  
  if (profile) {
    if (!profile.profileViews) profile.profileViews = 0;
    profile.profileViews++;
    users.set(targetUserId, profile);
    await saveUsers(users);
  }
  
  res.json({ success: true });
});

// Bildirim ayarları
// Notifications endpoint'leri
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await loadNotifications(userId);
    res.json({ notifications });
  } catch (error) {
    console.error('Bildirim yükleme hatası:', error);
    res.status(500).json({ error: 'Bildirimler yüklenemedi' });
  }
});

app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const unreadCount = await getUnreadNotificationCount(userId);
    res.json({ unreadCount });
  } catch (error) {
    console.error('Okunmamış bildirim sayısı hatası:', error);
    res.json({ unreadCount: 0 });
  }
});

app.post('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;
    await markNotificationAsRead(notificationId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Bildirim okundu işaretleme hatası:', error);
    res.status(500).json({ error: 'Bildirim işaretlenemedi' });
  }
});

// Tüm bildirimleri okundu olarak işaretle
app.post('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await markAllNotificationsAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Tüm bildirimleri okundu işaretleme hatası:', error);
    res.status(500).json({ error: 'Bildirimler işaretlenemedi' });
  }
});

app.get('/api/notifications/settings', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  res.json({
    soundEnabled: (profile && profile.notificationSettings && profile.notificationSettings.soundEnabled) !== false,
    browserEnabled: (profile && profile.notificationSettings && profile.notificationSettings.browserEnabled) !== false,
    messageEnabled: (profile && profile.notificationSettings && profile.notificationSettings.messageEnabled) !== false
  });
});

// Completed match'ten çıkma (eşleşmeyi silme) - GET'den ÖNCE olmalı!
app.delete('/api/matches/:matchId', authenticateToken, async (req, res) => {
  console.log('🔴🔴🔴 DELETE /api/matches/:matchId route çalıştı!');
  console.log('🔴 Request params:', req.params);
  console.log('🔴 Request user:', req.user);
  const userId = req.user.userId;
  const matchId = req.params.matchId;
  
  console.log(`Eşleşme silme isteği: ${matchId}, Kullanıcı: ${userId}`);
  
  // Önce completedMatches'te ara
  let match = completedMatches.get(matchId);
  
  // Bulunamazsa activeMatches'te ara (henüz tamamlanmamış ama listede görünen)
  if (!match) {
    match = activeMatches.get(matchId);
    console.log(`Completed match'te bulunamadı, activeMatches'te aranıyor: ${matchId}`);
  }
  
  if (!match) {
    console.log(`Match bulunamadı: ${matchId}`);
    // Match bulunamadı ama kullanıcının listesinden çıkar
    const userMatchIds = userMatches.get(userId) || [];
    const filteredMatchIds = userMatchIds.filter(id => id !== matchId);
    userMatches.set(userId, filteredMatchIds);
    await saveMatches(completedMatches, userMatches);
    return res.json({ success: true, message: 'Eşleşme listeden çıkarıldı' });
  }
  
  // Kullanıcının bu eşleşmede olup olmadığını kontrol et - esnek yapı kontrolü
  const user1Id = match.user1?.userId || match.user1?.user?.userId || (typeof match.user1 === 'string' ? match.user1 : null);
  const user2Id = match.user2?.userId || match.user2?.user?.userId || (typeof match.user2 === 'string' ? match.user2 : null);
  
  console.log(`Match kullanıcıları: user1Id=${user1Id}, user2Id=${user2Id}, currentUserId=${userId}`);
  
  if (user1Id !== userId && user2Id !== userId) {
    return res.status(403).json({ error: 'Bu eşleşmede değilsiniz' });
  }
  
  // Eşleşmeyi tamamen sil (her iki kullanıcının listesinden de çıkar)
  const userMatchIds = userMatches.get(userId) || [];
  const filteredMatchIds = userMatchIds.filter(id => id !== matchId);
  userMatches.set(userId, filteredMatchIds);
  
  // Partner'ın listesinden de çıkar
  const partnerId = user1Id === userId ? user2Id : user1Id;
  if (partnerId) {
    const partnerMatchIds = userMatches.get(partnerId) || [];
    const filteredPartnerMatchIds = partnerMatchIds.filter(id => id !== matchId);
    userMatches.set(partnerId, filteredPartnerMatchIds);
  }
  
  // Eşleşmeyi tamamen sil (completedMatches'ten ve veritabanından)
  completedMatches.delete(matchId);
  if (useDatabase) {
    await deleteCompletedMatchDB(matchId);
  }
  
  // Active match ise sil ve kullanıcıların activeUsers'dan matchId'sini temizle
  if (activeMatches.has(matchId)) {
    await deleteActiveMatch(matchId);
    // Her iki kullanıcının da activeUsers'dan matchId'sini temizle
    for (const [socketId, userInfo] of activeUsers.entries()) {
      if ((userInfo.userId === userId || userInfo.userId === partnerId) && userInfo.matchId === matchId) {
        userInfo.matchId = null;
        userInfo.inMatch = false;
        activeUsers.set(socketId, userInfo);
      }
    }
  }
  
  // Follow request'leri de temizle (eğer bu matchId ile ilgili ise)
  for (const [requestId, request] of followRequests.entries()) {
    if (request.matchId === matchId) {
      followRequests.delete(requestId);
      if (useDatabase) deleteFollowRequestDB(requestId);
    }
  }
  
  await saveMatches(completedMatches, userMatches);
  
  console.log(`Eşleşme tamamen silindi: ${matchId} (Kullanıcı: ${userId})`);
  
  // Her iki kullanıcıya da matches-updated event'i gönder
  const user1SocketIds = [];
  const user2SocketIds = [];
  
  for (const [socketId, userInfo] of activeUsers.entries()) {
    if (userInfo.userId === userId) {
      user1SocketIds.push(socketId);
    }
    if (partnerId && userInfo.userId === partnerId) {
      user2SocketIds.push(socketId);
    }
  }
  
  // Kullanıcıya bildir
  user1SocketIds.forEach(socketId => {
    io.to(socketId).emit('matches-updated');
  });
  
  // Partner'a da bildir (eğer varsa)
  if (partnerId) {
    user2SocketIds.forEach(socketId => {
      io.to(socketId).emit('matches-updated');
    });
  }
  
  res.json({ success: true, message: 'Eşleşmeden çıkıldı' });
});

app.post('/api/notifications/settings', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }
  
  if (!profile.notificationSettings) profile.notificationSettings = {};
  profile.notificationSettings = {
    ...profile.notificationSettings,
    ...req.body
  };
  
  users.set(userId, profile);
  saveUsers(users);
  
  res.json({ settings: profile.notificationSettings });
});

// Kullanıcının eşleşmelerini getir
app.get('/api/matches', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const matchIds = userMatches.get(userId) || [];
  
  // Aktif eşleşmeleri de ekle (anonim eşleşmeler)
  const activeMatchIds = [];
  for (const [matchId, match] of activeMatches.entries()) {
    if (match.user1.userId === userId || match.user2.userId === userId) {
      activeMatchIds.push(matchId);
    }
  }
  
  // Bekleyen follow request'leri de ekle (pending istekler)
  const pendingRequestMatches = [];
  for (const [requestId, request] of followRequests.entries()) {
    if (request.status === 'pending') {
      // Kullanıcı isteği gönderdi (fromUserId) veya aldı (toUserId)
      if (request.fromUserId === userId || request.toUserId === userId) {
        const partnerId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
        const partnerProfile = users.get(partnerId);
        const currentUserProfile = users.get(userId);
        
        // Partner'ın anonim numarasını bul
        const partnerAnonymousNumber = partnerProfile?.anonymousNumber || '0000000';
        const currentUserAnonymousNumber = currentUserProfile?.anonymousNumber || '0000000';
        
        // İsteği gönderen kullanıcı için partner'ın numarasını göster
        // İsteği alan kullanıcı için kendi numarasını göster (çünkü karşı taraf anonim)
        const displayAnonymousNumber = request.fromUserId === userId 
          ? partnerAnonymousNumber 
          : currentUserAnonymousNumber;
        
        // request.matchId varsa onu kullan, yoksa request-{requestId} formatını kullan
        const displayMatchId = request.matchId || `request-${requestId}`;
        
        pendingRequestMatches.push({
          matchId: displayMatchId, // Gerçek matchId veya request-{requestId}
          partner: {
            userId: null,
            username: `Anonim-${displayAnonymousNumber}`,
            photos: [],
            verified: false,
            isAnonymous: true
          },
          lastMessage: null,
          lastMessageAt: request.createdAt || new Date(),
          messageCount: 0,
          startedAt: request.createdAt || new Date(),
          isActiveMatch: false,
          isPendingRequest: true,
          requestId: requestId,
          requestStatus: request.fromUserId === userId ? 'sent' : 'received'
        });
      }
    }
  }
  
  const allMatchIds = [...new Set([...matchIds, ...activeMatchIds])];
  
  const matches = allMatchIds.map(matchId => {
    // Önce activeMatches'te ara
    let match = activeMatches.get(matchId);
    let isActiveMatch = true;
    
    // Bulunamazsa completedMatches'te ara
    if (!match) {
      match = completedMatches.get(matchId);
      isActiveMatch = false;
    }
    
    if (!match) return null;

    // Partner bilgisini bul
    const partner = match.user1.userId === userId ? match.user2 : match.user1;
    const currentUser = match.user1.userId === userId ? match.user1 : match.user2;
    
    // Aktif eşleşmeler HER ZAMAN anonim olmalı (kabul edilene kadar)
    if (isActiveMatch) {
      // Partner'ın anonim numarasını bul
      const partnerProfile = users.get(partner.userId);
      const partnerAnonymousNumber = partnerProfile?.anonymousNumber || partner.anonymousId || '0000000';
      
      return {
        matchId: match.id,
        partner: {
          userId: null,
          username: `Anonim-${partnerAnonymousNumber}`,
          photos: [],
          verified: false,
          isAnonymous: true
        },
        lastMessage: match.messages.length > 0 ? match.messages[match.messages.length - 1] : null,
        lastMessageAt: match.messages.length > 0 
          ? match.messages[match.messages.length - 1].timestamp 
          : match.startedAt,
        messageCount: match.messages.length,
        startedAt: match.startedAt,
        isActiveMatch: true
      };
    }
    
    // Completed match veya partner profile var
    // Partner bilgisi eksikse users Map'inden al
    let partnerInfo = partner.profile || partner;
    if (!partnerInfo || !partnerInfo.username) {
      const partnerProfile = users.get(partner.userId);
      if (partnerProfile) {
        partnerInfo = {
          userId: partnerProfile.userId,
          username: partnerProfile.username,
          firstName: partnerProfile.firstName,
          lastName: partnerProfile.lastName,
          photos: partnerProfile.photos || [],
          verified: partnerProfile.verified || false
        };
      } else {
        // Partner bulunamadı, anonim numarası göster
        const partnerAnonymousNumber = partner.anonymousId || '0000000';
        return {
          matchId: match.id,
          partner: {
            userId: null,
            username: `Anonim-${partnerAnonymousNumber}`,
            photos: [],
            verified: false,
            isAnonymous: true
          },
          lastMessage: match.messages.length > 0 ? match.messages[match.messages.length - 1] : null,
          lastMessageAt: match.lastMessageAt,
          messageCount: match.messages.length,
          startedAt: match.startedAt,
          isActiveMatch: false
        };
      }
    }
    
    return {
      matchId: match.id,
      partner: {
        userId: partnerInfo.userId || partner.userId,
        username: partnerInfo.username || partner.username,
        firstName: partnerInfo.firstName,
        lastName: partnerInfo.lastName,
        photos: partnerInfo.photos || [],
        verified: partnerInfo.verified || false
      },
      lastMessage: match.messages.length > 0 ? match.messages[match.messages.length - 1] : null,
      lastMessageAt: match.lastMessageAt,
      messageCount: match.messages.length,
      startedAt: match.startedAt,
      isActiveMatch: false
    };
  }).filter(m => m !== null);
  
  // Her match için pending follow request var mı kontrol et ve flag ekle
  for (const match of matches) {
    // Bu matchId için pending follow request var mı?
    for (const [requestId, request] of followRequests.entries()) {
      if (request.status === 'pending' && request.matchId === match.matchId) {
        // Bu match için pending request var
        if (request.fromUserId === userId || request.toUserId === userId) {
          match.isPendingRequest = true;
          match.requestId = requestId;
          match.requestStatus = request.fromUserId === userId ? 'sent' : 'received';
          
          // Partner bilgisini anonim yap (henüz kabul edilmemiş)
          const partnerId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
          const partnerProfile = users.get(partnerId);
          const partnerAnonymousNumber = partnerProfile?.anonymousNumber || '0000000';
          
          match.partner = {
            userId: null,
            username: `Anonim-${partnerAnonymousNumber}`,
            photos: [],
            verified: false,
            isAnonymous: true
          };
          break;
        }
      }
    }
  }
  
  // Pending request'leri de ekle (duplicate kontrolü ile)
  // Zaten matches'te olan matchId'leri al
  const existingMatchIds = new Set(matches.map(m => m.matchId));
  
  // Sadece duplicate olmayan pending request'leri ekle
  const uniquePendingRequests = pendingRequestMatches.filter(pr => !existingMatchIds.has(pr.matchId));
  
  const allMatches = [...matches, ...uniquePendingRequests];
  
  // Sıralama: En son mesaj/istek alanı üstte
  allMatches.sort((a, b) => {
    const dateA = new Date(b.lastMessageAt || b.startedAt);
    const dateB = new Date(a.lastMessageAt || a.startedAt);
    return dateA - dateB;
  });

  res.json({ matches: allMatches });
});

// Belirli bir eşleşmenin detaylarını getir - DELETE'den SONRA olmalı!
app.get('/api/matches/:matchId', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const requestedMatchId = req.params.matchId;
  
  console.log(`🔍 /api/matches/:matchId çağrıldı: matchId=${requestedMatchId}, userId=${userId}`);
  console.log(`   activeMatches size: ${activeMatches.size}`);
  console.log(`   activeMatches keys:`, Array.from(activeMatches.keys()));
  
  // Önce activeMatches'te ara, bulamazsan completedMatches'te ara
  let match = activeMatches.get(requestedMatchId);
  let isActiveMatch = false;
  let actualMatchId = requestedMatchId;
  
  if (match) {
    isActiveMatch = true;
    console.log(`✅ Match activeMatches'te bulundu: ${requestedMatchId}`);
  } else {
    match = completedMatches.get(requestedMatchId);
    if (match) {
      console.log(`✅ Match completedMatches'te bulundu: ${requestedMatchId}`);
    }
  }

  if (!match) {
    console.log('⚠️ Match bulunamadı (direct lookup):', requestedMatchId);
    console.log('   Active matches:', Array.from(activeMatches.keys()));
    console.log('   Completed matches:', Array.from(completedMatches.keys()));
    console.log('   Request userId:', userId);
    
    // Önce userId ile activeMatches'te ara
    for (const [mid, m] of activeMatches.entries()) {
      const mUser1Id = m.user1?.userId || m.user1?.user?.userId;
      const mUser2Id = m.user2?.userId || m.user2?.user?.userId;
      console.log(`   Checking match ${mid}: user1=${mUser1Id}, user2=${mUser2Id}`);
      if (mUser1Id === userId || mUser2Id === userId) {
        match = m;
        actualMatchId = mid;
        console.log(`✅ Kullanıcının aktif eşleşmesi bulundu (userId ile): ${actualMatchId}`);
        // activeUsers'daki tüm socket.id'lerini güncelle
        for (const [socketId, userInfo] of activeUsers.entries()) {
          if (userInfo.userId === userId) {
            userInfo.matchId = actualMatchId;
            userInfo.inMatch = true;
            activeUsers.set(socketId, userInfo);
          }
        }
        isActiveMatch = true;
        break;
      }
    }
    
    // Hala bulunamazsa, kullanıcının aktif eşleşmesini kontrol et
    if (!match) {
      console.log('   activeUsers kontrol ediliyor...');
      for (const [socketId, userInfo] of activeUsers.entries()) {
        if (userInfo.userId === userId && userInfo.matchId) {
          console.log(`   User active socket: ${socketId}, matchId: ${userInfo.matchId}`);
          // Doğru matchId ile tekrar ara
          match = activeMatches.get(userInfo.matchId);
          if (!match) {
            match = completedMatches.get(userInfo.matchId);
          }
          if (match) {
            actualMatchId = userInfo.matchId;
            console.log(`✅ Kullanıcının aktif eşleşmesi bulundu: ${actualMatchId}`);
            isActiveMatch = activeMatches.has(actualMatchId);
            break;
          }
        }
      }
    }
    
    if (!match) {
      console.log(`❌ Match bulunamadı: ${requestedMatchId}, userId: ${userId}`);
      return res.status(404).json({ error: 'Eşleşme bulunamadı' });
    }
  }
  
  console.log(`✅ Match bulundu: ${actualMatchId}, isActiveMatch: ${isActiveMatch}`);

  // Kullanıcının bu eşleşmede olup olmadığını kontrol et
  const matchUser1Id = match.user1?.userId || match.user1?.user?.userId;
  const matchUser2Id = match.user2?.userId || match.user2?.user?.userId;
  
  if (matchUser1Id !== userId && matchUser2Id !== userId) {
    return res.status(403).json({ error: 'Bu eşleşmeye erişim yetkiniz yok' });
  }

  const partner = matchUser1Id === userId ? match.user2 : match.user1;
  
  let partnerInfo = null;
  let partnerAnonymousId = null;
  
  // Partner'ın anonim numarasını al
  const partnerUserProfile = users.get(partner.userId);
  partnerAnonymousId = partnerUserProfile?.anonymousNumber || partner.anonymousId || null;
  
  if (!isActiveMatch) {
    // Completed match - partner bilgisini göster
    const partnerProfile = users.get(partner.userId);
    
    // activeMatches'te partner.profile var, completedMatches'te partner direkt profile olabilir
    const partnerData = partnerProfile || partner.profile || partner;
    
    partnerInfo = {
      userId: partner.userId,
      username: partnerData.username || (partnerData.profile && partnerData.profile.username),
      age: partnerData.age || (partnerData.profile && partnerData.profile.age),
      bio: partnerData.bio || (partnerData.profile && partnerData.profile.bio),
      interests: partnerData.interests || (partnerData.profile && partnerData.profile.interests) || [],
      photos: partnerData.photos || (partnerData.profile && partnerData.profile.photos) || [],
      verified: partnerData.verified || (partnerData.profile && partnerData.profile.verified) || false
    };
  }
  
  // Follow request durumunu kontrol et
  let pendingFollowRequest = null;
  for (const [requestId, request] of followRequests.entries()) {
    if (request.matchId === actualMatchId && request.status === 'pending') {
      pendingFollowRequest = {
        requestId: requestId,
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        isReceived: request.toUserId === userId, // Kullanıcıya gelen istek mi?
        isSent: request.fromUserId === userId,   // Kullanıcının gönderdiği istek mi?
        createdAt: request.createdAt
      };
      break;
    }
  }
  
  res.json({
    match: {
      matchId: actualMatchId || match.id || requestedMatchId,
      partner: partnerInfo,  // Aktif eşleşmede null, completed'de partner bilgisi
      partnerAnonymousId: partnerAnonymousId, // Partner'ın anonim numarası
      messages: match.messages || [],
      startedAt: match.startedAt ? (match.startedAt instanceof Date ? match.startedAt.getTime() : match.startedAt) : null,
      pendingFollowRequest: pendingFollowRequest // Bekleyen istek bilgisi
    }
  });
});

// Match için okunmamış mesaj sayısı
app.get('/api/matches/:matchId/unread-count', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const matchId = req.params.matchId;
  
  // Önce activeMatches'te ara, bulamazsan completedMatches'te ara
  let match = activeMatches.get(matchId);
  if (!match) {
    match = completedMatches.get(matchId);
  }

  if (!match) {
    return res.json({ count: 0 });
  }
  
  // Kullanıcının bu eşleşmede olup olmadığını kontrol et
  const matchUser1Id = match.user1?.userId || match.user1?.user?.userId;
  const matchUser2Id = match.user2?.userId || match.user2?.user?.userId;
  
  if (matchUser1Id !== userId && matchUser2Id !== userId) {
    return res.json({ count: 0 });
  }

  // Okunmamış mesaj sayısını hesapla (basit versiyon - son mesajın kullanıcıya ait olup olmadığına bak)
  let unreadCount = 0;
  if (match.messages && match.messages.length > 0) {
    const lastMessage = match.messages[match.messages.length - 1];
    // Eğer son mesaj kullanıcıya ait değilse ve okunmamışsa say
    if (lastMessage.userId !== userId && !lastMessage.read) {
      // Son mesajdan geriye doğru say
      for (let i = match.messages.length - 1; i >= 0; i--) {
        const msg = match.messages[i];
        if (msg.userId === userId) break; // Kendi mesajına gelince dur
        if (!msg.read) unreadCount++;
      }
    }
  }
  
  res.json({ count: unreadCount });
});

// Mesajları okundu olarak işaretle
app.post('/api/matches/:matchId/mark-read', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const matchId = req.params.matchId;
  
  // Önce activeMatches'te ara, bulamazsan completedMatches'te ara
  let match = activeMatches.get(matchId);
  let isActiveMatch = !!match;
  if (!match) {
    match = completedMatches.get(matchId);
  }

  if (!match) {
    return res.json({ success: false, message: 'Match bulunamadı' });
  }
  
  // Kullanıcının bu eşleşmede olup olmadığını kontrol et
  const matchUser1Id = match.user1?.userId || match.user1?.user?.userId;
  const matchUser2Id = match.user2?.userId || match.user2?.user?.userId;
  
  if (matchUser1Id !== userId && matchUser2Id !== userId) {
    return res.json({ success: false, message: 'Bu eşleşmeye erişim yetkiniz yok' });
  }

  // Karşı taraftan gelen tüm mesajları okundu olarak işaretle
  let markedCount = 0;
  if (match.messages && match.messages.length > 0) {
    for (let i = 0; i < match.messages.length; i++) {
      if (match.messages[i].userId !== userId && !match.messages[i].read) {
        match.messages[i].read = true;
        match.messages[i].readAt = new Date().toISOString();
        markedCount++;
      }
    }
  }
  
  // Değişiklikleri kaydet
  if (markedCount > 0) {
    if (isActiveMatch) {
      activeMatches.set(matchId, match);
      if (useDatabase) await saveActiveMatchDB(matchId, match);
    } else {
      completedMatches.set(matchId, match);
      await saveMatches(completedMatches, userMatches);
    }
  }
  
  res.json({ success: true, markedCount });
});

// Socket.io bağlantıları
io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);

  // Kullanıcı profili ile bağlanıyor
  socket.on('set-profile', async (data) => {
    const { userId, matchId } = data;
    
    if (!userId) {
      console.error('❌ set-profile: userId verilmemiş');
      socket.emit('error', { message: 'Kullanıcı ID bulunamadı. Lütfen tekrar giriş yapın.' });
      return;
    }
    
    let profile = users.get(userId);
    
    if (!profile) {
      console.error('❌ set-profile: Profil memory\'de bulunamadı, veritabanından yükleniyor:', userId);
      // Veritabanından yüklemeyi dene
      if (useDatabase && loadUsers) {
        try {
          await loadUsers();
          profile = users.get(userId);
          if (profile) {
            console.log('✅ Profil veritabanından yüklendi:', userId);
          }
        } catch (error) {
          console.error('❌ Veritabanından yükleme hatası:', error);
        }
      }
      
      if (!profile) {
        console.error('❌ set-profile: Profil bulunamadı, userId:', userId);
        console.error('   Mevcut kullanıcılar:', Array.from(users.keys()));
        socket.emit('error', { message: 'Profil bulunamadı. Lütfen sayfayı yenileyin veya tekrar giriş yapın.' });
        return;
      }
    }

    let currentMatchId = matchId || null;
    
    // Eğer matchId verilmişse, match'teki socketId'yi güncelle
    if (matchId) {
      // Önce activeMatches'te ara
      let match = activeMatches.get(matchId);
      let isCompletedMatch = false;
      
      // activeMatches'te yoksa completedMatches'te ara
      if (!match) {
        match = completedMatches.get(matchId);
        isCompletedMatch = true;
      }
      
      if (match) {
        const u1Id = match.user1?.userId || match.user1?.user?.userId;
        const u2Id = match.user2?.userId || match.user2?.user?.userId;
        
        if (u1Id === userId) {
          if (match.user1) match.user1.socketId = socket.id;
          console.log('🔄 set-profile: user1 socketId güncellendi:', { 
            userId, 
            newSocketId: socket.id,
            matchId,
            isCompletedMatch
          });
        } else if (u2Id === userId) {
          if (match.user2) match.user2.socketId = socket.id;
          console.log('🔄 set-profile: user2 socketId güncellendi:', { 
            userId, 
            newSocketId: socket.id,
            matchId,
            isCompletedMatch
          });
        }
        
        currentMatchId = matchId;
      }
    } else {
      // Aktif eşleşme var mı kontrol et
      for (const [mid, match] of activeMatches.entries()) {
        if (match.user1.userId === userId || match.user2.userId === userId) {
          if (match.user1.userId === userId) {
            match.user1.socketId = socket.id;
          } else {
            match.user2.socketId = socket.id;
          }
          
          // Bekleyen continue request'leri kontrol et ve güncelle
          for (const [requestId, request] of followRequests.entries()) {
            if (request.matchId === mid && request.status === 'pending') {
              // Bu kullanıcıya gönderilen request var mı?
              if (request.toUserId === userId) {
                request.toSocketId = socket.id;
                followRequests.set(requestId, request);
                if (useDatabase) saveFollowRequestDB(requestId, request);
                // Request'i bildir
                socket.emit('continue-request-received', {
                  requestId,
                  matchId: mid,
                  message: 'Karşı taraf devam etmek istiyor'
                });
                console.log(`✅ Bekleyen continue request bildirildi: ${requestId} -> ${userId}`);
              }
              // Bu kullanıcının gönderdiği request var mı? Partner socketId'yi güncelle
              else if (request.fromUserId === userId && request.toSocketId === null) {
                // Partner'ın socketId'sini bul
                const partnerUserId = request.toUserId;
                for (const [sId, user] of activeUsers.entries()) {
                  if (user.userId === partnerUserId && io.sockets.sockets.has(sId)) {
                    request.toSocketId = sId;
                    followRequests.set(requestId, request);
                    if (useDatabase) saveFollowRequestDB(requestId, request);
                    // Partner'a bildir
                    io.to(sId).emit('continue-request-received', {
                      requestId,
                      matchId: mid,
                      message: 'Karşı taraf devam etmek istiyor'
                    });
                    console.log(`✅ Bekleyen continue request partner'a bildirildi: ${requestId} -> ${partnerUserId}`);
                    break;
                  }
                }
              }
            }
          }
          currentMatchId = mid;
          break;
        }
      }
    }

    activeUsers.set(socket.id, {
      socketId: socket.id,
      userId: userId,
      profile: profile,
      inMatch: currentMatchId !== null,
      matchId: currentMatchId
    });

    socket.emit('profile-set', { profile });
    console.log(`Kullanıcı profil ile bağlandı: ${profile.username} (${socket.id}), MatchId: ${currentMatchId}`);
  });

  // Eşleşme başlatma
  socket.on('start-matching', async (data) => {
    console.log('start-matching event alındı, socket.id:', socket.id, 'data:', data);
    console.log('Aktif kullanıcılar:', Array.from(activeUsers.keys()));
    
    let userInfo = activeUsers.get(socket.id);
    
    // Eğer kullanıcı activeUsers'da yoksa, userId ile bul
    if (!userInfo) {
      if (data && data.userId) {
        console.log('⚠️ start-matching: Kullanıcı bulunamadı, userId ile aranıyor:', data.userId);
        const profile = users.get(data.userId);
        if (profile) {
          userInfo = {
            socketId: socket.id,
            userId: data.userId,
            profile: profile,
            inMatch: false,
            matchId: null
          };
          activeUsers.set(socket.id, userInfo);
          console.log('✅ start-matching: Kullanıcı otomatik eklendi:', userInfo.userId);
        }
      }
      
      if (!userInfo) {
        console.log('❌ start-matching: Kullanıcı bulunamadı, aktif kullanıcı sayısı:', activeUsers.size);
        socket.emit('error', { message: 'Lütfen önce profil oluşturun' });
        return;
      }
    }
    
    console.log('✅ start-matching: Kullanıcı bulundu:', userInfo.profile.username);
    
    // Kullanıcının filtreleri
    const genderFilter = data.filterGender || data.genderFilter || null; // 'male', 'female', veya null (hepsi)
    console.log(`   Cinsiyet filtresi: ${genderFilter || 'hepsi'}`);

    // Kullanıcı mevcut eşleşmede olsa bile yeni eşleşme başlatabilir
    // Kuyruğa ekle (filtreleriyle birlikte)
    if (!matchingQueue.find(u => u.socketId === socket.id)) {
      matchingQueue.push({
        socketId: socket.id,
        userId: userInfo.userId,
        profile: userInfo.profile,
        genderFilter: genderFilter // Kullanıcının istediği cinsiyet
      });
      socket.emit('matching-started', { message: 'Eşleşme aranıyor...' });
      console.log(`${userInfo.profile.username} eşleşme kuyruğuna eklendi (cinsiyet filtresi: ${genderFilter || 'hepsi'})`);
    }

    // Eşleşme kontrolü - filtrelere uygun eşleşme ara
    const currentUser = matchingQueue.find(u => u.socketId === socket.id);
    if (!currentUser) return;
    
    // Uygun eşleşme adayını bul
    let matchedUserIndex = -1;
    for (let i = 0; i < matchingQueue.length; i++) {
      const candidate = matchingQueue[i];
      
      // Kendisiyle eşleşme yapma
      if (candidate.socketId === socket.id) continue;
      
      // Cinsiyet filtresi kontrolü (ZORUNLU)
      const candidateGender = candidate.profile && candidate.profile.gender;
      const currentUserGender = currentUser.profile && currentUser.profile.gender;
      
      // Kullanıcının filtresi var mı ve aday uygun mu?
      if (genderFilter && candidateGender !== genderFilter) {
        console.log('   ❌ ' + (candidate.profile && candidate.profile.username) + ' cinsiyet uyumsuz: ' + candidateGender + ' != ' + genderFilter);
        continue;
      }
      
      // Adayın filtresi var mı ve mevcut kullanıcı uygun mu?
      if (candidate.genderFilter && currentUserGender !== candidate.genderFilter) {
        console.log('   ❌ ' + (candidate.profile && candidate.profile.username) + ' bizi istemiyor: ' + currentUserGender + ' != ' + candidate.genderFilter);
        continue;
      }
      
      // Uygun eşleşme bulundu!
      matchedUserIndex = i;
      console.log('   ✅ Uygun eşleşme bulundu: ' + (candidate.profile && candidate.profile.username));
      break;
    }
    
    // Uygun eşleşme yoksa bekle
    if (matchedUserIndex === -1) {
      console.log(`   ⏳ ${userInfo.profile.username} için uygun eşleşme bulunamadı, bekleniyor...`);
      return;
    }
    
    // Eşleşme yap
    const currentUserIndex = matchingQueue.findIndex(u => u.socketId === socket.id);
    const user1 = matchingQueue.splice(Math.max(currentUserIndex, matchedUserIndex), 1)[0];
    const user2 = matchingQueue.splice(Math.min(currentUserIndex, matchedUserIndex), 1)[0];

      const matchId = uuidv4();
      // Her kullanıcının profilindeki anonim numarasını kullan
      const user1Profile = users.get(user1.userId);
      const user2Profile = users.get(user2.userId);
      const user1AnonymousId = user1Profile?.anonymousNumber || Math.floor(1000000 + Math.random() * 9000000).toString();
      const user2AnonymousId = user2Profile?.anonymousNumber || Math.floor(1000000 + Math.random() * 9000000).toString();
      
      // Match yapısını netleştir - user1 ve user2'de userId ve socketId olmalı
      const match = {
        id: matchId,
        user1: {
          socketId: user1.socketId,
          userId: user1.userId,
          profile: user1.profile,
          anonymousId: user1AnonymousId
        },
        user2: {
          socketId: user2.socketId,
          userId: user2.userId,
          profile: user2.profile,
          anonymousId: user2AnonymousId
        },
        startedAt: new Date(),
        messages: []
      };

      activeMatches.set(matchId, match);
      // Veritabanına kaydet
      if (useDatabase) await saveActiveMatchDB(matchId, match);
      console.log('✅✅✅ MATCH OLUŞTURULDU:', matchId);
      console.log('   user1:', { userId: user1.userId, socketId: user1.socketId, username: user1.profile && user1.profile.username });
      console.log('   user2:', { userId: user2.userId, socketId: user2.socketId, username: user2.profile && user2.profile.username });
      console.log('   activeMatches size:', activeMatches.size);
      console.log('   activeMatches keys:', Array.from(activeMatches.keys()));
      // Match'in gerçekten kaydedildiğini doğrula
      const verifyMatch = activeMatches.get(matchId);
      if (verifyMatch) {
        console.log('   ✅ Match activeMatches\'e başarıyla kaydedildi (DB\'ye de)');
      } else {
        console.log('   ❌ HATA: Match activeMatches\'e kaydedilemedi!');
      }
      
      // Socket bağlantılarını kontrol et
      const user1SocketExists = io.sockets.sockets.has(user1.socketId);
      const user2SocketExists = io.sockets.sockets.has(user2.socketId);
      console.log('   🔌 Socket kontrolü:', { 
        user1SocketExists, 
        user2SocketExists,
        user1SocketId: user1.socketId,
        user2SocketId: user2.socketId
      });

      // Her iki kullanıcıyı da eşleşmeye bağla
      let user1Info = activeUsers.get(user1.socketId);
      let user2Info = activeUsers.get(user2.socketId);

      // Eğer userInfo bulunamazsa, userId ile tüm activeUsers'da ara
      if (!user1Info) {
        for (const [socketId, info] of activeUsers.entries()) {
          if (info.userId === user1.userId) {
            user1Info = info;
            // Socket.id'yi güncelle
            user1Info.socketId = user1.socketId;
            activeUsers.set(user1.socketId, user1Info);
            // Eski socket.id'yi sil (eğer farklıysa)
            if (socketId !== user1.socketId) {
              activeUsers.delete(socketId);
            }
            break;
          }
        }
        // Hala bulunamazsa, yeni oluştur
        if (!user1Info) {
          user1Info = {
            socketId: user1.socketId,
            userId: user1.userId,
            profile: user1.profile,
            inMatch: true,
            matchId: matchId
          };
          activeUsers.set(user1.socketId, user1Info);
        }
      }

      if (!user2Info) {
        for (const [socketId, info] of activeUsers.entries()) {
          if (info.userId === user2.userId) {
            user2Info = info;
            // Socket.id'yi güncelle
            user2Info.socketId = user2.socketId;
            activeUsers.set(user2.socketId, user2Info);
            // Eski socket.id'yi sil (eğer farklıysa)
            if (socketId !== user2.socketId) {
              activeUsers.delete(socketId);
            }
            break;
          }
        }
        // Hala bulunamazsa, yeni oluştur
        if (!user2Info) {
          user2Info = {
            socketId: user2.socketId,
            userId: user2.userId,
            profile: user2.profile,
            inMatch: true,
            matchId: matchId
          };
          activeUsers.set(user2.socketId, user2Info);
        }
      }

      // MatchId'yi set et
      user1Info.inMatch = true;
      user1Info.matchId = matchId;
      user2Info.inMatch = true;
      user2Info.matchId = matchId;
      
      // Tüm socket.id'lerini güncelle (aynı userId'ye sahip tüm bağlantılar)
      for (const [socketId, info] of activeUsers.entries()) {
        if (info.userId === user1.userId) {
          info.matchId = matchId;
          info.inMatch = true;
          activeUsers.set(socketId, info);
        }
        if (info.userId === user2.userId) {
          info.matchId = matchId;
          info.inMatch = true;
          activeUsers.set(socketId, info);
        }
      }
      
      console.log(`✅ User1 matchId set edildi: ${user1Info.userId} -> ${matchId}`);
      console.log(`✅ User2 matchId set edildi: ${user2Info.userId} -> ${matchId}`);

      // Her iki kullanıcıya eşleşme bildirimi gönder (anonim)
      io.to(user1.socketId).emit('match-found', {
        matchId: matchId,
        message: 'Birisiyle eşleştiniz!',
        userAnonymousId: user1AnonymousId,
        partnerAnonymousId: user2AnonymousId
      });

      io.to(user2.socketId).emit('match-found', {
        matchId: matchId,
        message: 'Birisiyle eşleştiniz!',
        userAnonymousId: user2AnonymousId,
        partnerAnonymousId: user1AnonymousId
      });

      console.log(`Eşleşme oluşturuldu: ${matchId} - ${user1.profile.username} & ${user2.profile.username}`);
    }
  });

  // Eşleşmeden çıkma
  socket.on('stop-matching', () => {
    const userInfo = activeUsers.get(socket.id);
    if (!userInfo) return;

    // Kuyruktan çıkar
    const queueIndex = matchingQueue.findIndex(u => u.socketId === socket.id);
    if (queueIndex !== -1) {
      matchingQueue.splice(queueIndex, 1);
      socket.emit('matching-stopped', { message: 'Eşleşme iptal edildi' });
      console.log(`${userInfo.profile.username} eşleşme kuyruğundan çıkarıldı`);
    }
  });

  // Devam etmek istiyorum isteği gönderme (anonim eşleşmede)
  socket.on('continue-request', async (data) => {
    let { matchId } = data;
    
    console.log(`🔵 continue-request event alındı: matchId=${matchId}, socketId=${socket.id}`);
    console.log(`   activeMatches size: ${activeMatches.size}`);
    console.log(`   activeMatches keys:`, Array.from(activeMatches.keys()));
    
    // Kullanıcıyı bul (socket.id ile)
    let userInfo = activeUsers.get(socket.id);
    
    // Eğer userInfo yoksa, socket.id ile aktif kullanıcıları kontrol et
    if (!userInfo) {
      // Socket.id ile aktif kullanıcıları ara
      for (const [sid, info] of activeUsers.entries()) {
        if (sid === socket.id) {
          userInfo = info;
          break;
        }
      }
    }
    
    // Eğer hala userInfo yoksa, matchId'den kullanıcıyı bulmaya çalış
    if (!userInfo && matchId) {
      // Match'teki kullanıcılardan birini bul
      let match = activeMatches.get(matchId);
      if (!match) {
        match = completedMatches.get(matchId);
      }
      
      if (match) {
        // Match'teki kullanıcılardan birini bul (socket.id ile eşleşen)
        const isUser1 = match.user1?.socketId === socket.id;
        const isUser2 = match.user2?.socketId === socket.id;
        
        if (isUser1 || isUser2) {
          const userId = isUser1 ? match.user1.userId : match.user2.userId;
          const profile = users.get(userId);
          
          if (profile) {
            userInfo = {
              socketId: socket.id,
              userId: userId,
              profile: profile,
              inMatch: true,
              matchId: matchId
            };
            activeUsers.set(socket.id, userInfo);
          }
        }
      }
    }
    
    // Eğer hala userInfo yoksa, aktif eşleşmelerde kullanıcıyı ara
    if (!userInfo) {
      for (const [mid, m] of activeMatches.entries()) {
        if (m.user1?.userId && m.user2?.userId) {
          // Socket.id ile eşleşen kullanıcıyı bul
          const isUser1 = m.user1.socketId === socket.id;
          const isUser2 = m.user2.socketId === socket.id;
          
          if (isUser1 || isUser2) {
            const userId = isUser1 ? m.user1.userId : m.user2.userId;
            const profile = users.get(userId);
            
            if (profile) {
              userInfo = {
                socketId: socket.id,
                userId: userId,
                profile: profile,
                inMatch: true,
                matchId: mid
              };
              activeUsers.set(socket.id, userInfo);
              // matchId'yi güncelle
              matchId = mid;
              break;
            }
          }
        }
      }
    }
    
    if (!userInfo) {
      console.log(`   ❌ Kullanıcı bulunamadı: socketId=${socket.id}`);
      socket.emit('error', { message: 'Kullanıcı bilgisi bulunamadı. Lütfen sayfayı yenileyin.' });
      return;
    }
    
    // Eğer matchId yoksa, kullanıcının aktif eşleşmesini kullan
    if (!matchId && userInfo.matchId) {
      matchId = userInfo.matchId;
      console.log(`   ⚠️ matchId yok, kullanıcının aktif eşleşmesi kullanılıyor: ${matchId}`);
    }
    
    if (!matchId) {
      console.log(`   ❌ matchId bulunamadı`);
      socket.emit('error', { message: 'Eşleşme bulunamadı. Lütfen yeni bir eşleşme başlatın.' });
      return;
    }
    
    // Önce match'i bul (activeMatches'te)
    let match = activeMatches.get(matchId);
    
    // Bulunamazsa completedMatches'te ara (eski eşleşmeler için)
    if (!match) {
      match = completedMatches.get(matchId);
      console.log(`   Match activeMatches'te bulunamadı, completedMatches'te aranıyor...`);
    }
    
    // Hala bulunamazsa, kullanıcının aktif eşleşmesini kullan
    if (!match && userInfo.matchId) {
      console.log(`   ⚠️ matchId ile match bulunamadı, kullanıcının aktif eşleşmesi deneniyor: ${userInfo.matchId}`);
      match = activeMatches.get(userInfo.matchId);
      if (!match) {
        match = completedMatches.get(userInfo.matchId);
      }
      if (match) {
        matchId = userInfo.matchId;
        console.log(`   ✅ Kullanıcının aktif eşleşmesi bulundu: ${matchId}`);
      }
    }
    
    // Hala bulunamazsa, kullanıcının userId'si ile aktif eşleşmelerde ara
    if (!match) {
      console.log(`   ⚠️ matchId ile match bulunamadı, aktif eşleşmelerde userId ile aranıyor: ${userInfo.userId}`);
      for (const [mid, m] of activeMatches.entries()) {
        const mUser1Id = m.user1?.userId || m.user1?.user?.userId;
        const mUser2Id = m.user2?.userId || m.user2?.user?.userId;
        if (mUser1Id === userInfo.userId || mUser2Id === userInfo.userId) {
          match = m;
          matchId = mid;
          console.log(`   ✅ Kullanıcının aktif eşleşmesi bulundu (userId ile): ${matchId}`);
          // userInfo'yu güncelle
          userInfo.matchId = matchId;
          userInfo.inMatch = true;
          activeUsers.set(socket.id, userInfo);
          // Tüm socket.id'lerini güncelle (aynı userId'ye sahip tüm bağlantılar)
          for (const [sid, info] of activeUsers.entries()) {
            if (info.userId === userInfo.userId) {
              info.matchId = matchId;
              info.inMatch = true;
              activeUsers.set(sid, info);
            }
          }
          break;
        }
      }
    }
    
    // Hala bulunamazsa, socket.id ile aktif eşleşmelerde ara
    if (!match) {
      console.log(`   ⚠️ userId ile match bulunamadı, socket.id ile aktif eşleşmelerde aranıyor: ${socket.id}`);
      for (const [mid, m] of activeMatches.entries()) {
        const mUser1SocketId = m.user1?.socketId || m.user1?.user?.socketId;
        const mUser2SocketId = m.user2?.socketId || m.user2?.user?.socketId;
        if (mUser1SocketId === socket.id || mUser2SocketId === socket.id) {
          match = m;
          matchId = mid;
          console.log(`   ✅ Kullanıcının aktif eşleşmesi bulundu (socket.id ile): ${matchId}`);
          // userInfo'yu güncelle
          userInfo.matchId = matchId;
          userInfo.inMatch = true;
          activeUsers.set(socket.id, userInfo);
          break;
        }
      }
    }
    
    if (!match) {
      console.log(`   ❌ Match bulunamadı: matchId=${matchId}, userId=${userInfo.userId}, socketId=${socket.id}`);
      console.log(`   activeMatches keys:`, Array.from(activeMatches.keys()));
      console.log(`   activeMatches details:`, Array.from(activeMatches.entries()).map(([id, m]) => ({
        id,
        user1: { userId: m.user1?.userId || m.user1?.user?.userId, socketId: m.user1?.socketId || m.user1?.user?.socketId },
        user2: { userId: m.user2?.userId || m.user2?.user?.userId, socketId: m.user2?.socketId || m.user2?.user?.socketId }
      })));
      console.log(`   completedMatches keys:`, Array.from(completedMatches.keys()));
      socket.emit('error', { message: 'Eşleşme bulunamadı. Lütfen yeni bir eşleşme başlatın.' });
      return;
    }
    
    console.log(`   ✅ Match bulundu: ${matchId}`);
    
    // Kullanıcının bu match'te olup olmadığını kontrol et
    const matchUser1Id = match.user1?.userId || match.user1?.user?.userId;
    const matchUser2Id = match.user2?.userId || match.user2?.user?.userId;
    
    if (matchUser1Id !== userInfo.userId && matchUser2Id !== userInfo.userId) {
      console.log(`   ❌ Kullanıcı bu match'te değil: userId=${userInfo.userId}, match.user1=${matchUser1Id}, match.user2=${matchUser2Id}`);
      socket.emit('error', { message: 'Bu eşleşmeye erişim yetkiniz yok' });
      return;
    }

    // Hangi kullanıcı olduğunu belirle (matchUser1Id ve matchUser2Id zaten yukarıda tanımlı)
    const isUser1 = matchUser1Id === userInfo.userId;
    let partnerSocketId = isUser1 ? (match.user2?.socketId || match.user2?.user?.socketId) : (match.user1?.socketId || match.user1?.user?.socketId);
    const partnerUserId = isUser1 ? matchUser2Id : matchUser1Id;

    console.log(`   Kullanıcı bilgisi: isUser1=${isUser1}, partnerUserId=${partnerUserId}, partnerSocketId=${partnerSocketId}`);

    // Eğer partner socketId yoksa veya socket bağlı değilse, activeUsers'dan bul
    if (!partnerSocketId || !io.sockets.sockets.has(partnerSocketId)) {
      console.log(`   ⚠️ Partner socketId bulunamadı veya bağlı değil, activeUsers'da aranıyor: ${partnerUserId}`);
      for (const [socketId, user] of activeUsers.entries()) {
        if (user.userId === partnerUserId && io.sockets.sockets.has(socketId)) {
          partnerSocketId = socketId;
          // Match'teki socketId'yi güncelle (sadece activeMatches'te ise)
          if (activeMatches.has(matchId)) {
            if (isUser1) {
              match.user2.socketId = socketId;
            } else {
              match.user1.socketId = socketId;
            }
            activeMatches.set(matchId, match);
            if (useDatabase) saveActiveMatchDB(matchId, match);
          }
          console.log(`   ✅ Partner socketId güncellendi: ${partnerSocketId}`);
          break;
        }
      }
    }

    // Zaten bekleyen bir istek var mı kontrol et
    for (const [requestId, request] of followRequests.entries()) {
      if (request.matchId === matchId && request.status === 'pending' && request.fromUserId === userInfo.userId) {
        socket.emit('error', { message: 'Zaten bir devam isteği gönderdiniz' });
        return;
      }
    }

    const requestId = uuidv4();
    const request = {
      requestId,
      matchId,
      fromUserId: userInfo.userId,
      toUserId: partnerUserId,
      fromSocketId: socket.id,
      toSocketId: partnerSocketId,
      status: 'pending',
      createdAt: new Date()
    };

    followRequests.set(requestId, request);
    // Veritabanına kaydet
    if (useDatabase) await saveFollowRequestDB(requestId, request);

    // Partner çevrimiçiyse bildir, değilse sadece request'i kaydet
    if (partnerSocketId && io.sockets.sockets.has(partnerSocketId)) {
      // Karşı tarafa bildir
      io.to(partnerSocketId).emit('continue-request-received', {
        requestId,
        matchId,
        message: 'Karşı taraf devam etmek istiyor'
      });
      
      socket.emit('continue-request-sent', {
        requestId,
        matchId,
        message: 'Devam isteği gönderildi'
      });
      
      console.log(`✅ Devam isteği gönderildi (partner çevrimiçi): ${matchId} - ${userInfo.userId}`);
    } else {
      // Partner çevrimdışı, request kaydedildi
      socket.emit('continue-request-sent', {
        requestId,
        matchId,
        message: 'Devam isteği kaydedildi. Partner giriş yaptığında bildirim alacak.'
      });
      
      console.log(`⚠️ Devam isteği kaydedildi (partner çevrimdışı): ${matchId} - ${userInfo.userId}`);
    }
  });

  // Devam isteğini kabul etme
  socket.on('accept-continue-request', async (data) => {
    let { matchId } = data;
    let userInfo = activeUsers.get(socket.id);
    
    // Eğer userInfo yoksa, socket.id ile aktif kullanıcıları kontrol et
    if (!userInfo) {
      for (const [sid, info] of activeUsers.entries()) {
        if (sid === socket.id) {
          userInfo = info;
          break;
        }
      }
    }
    
    // Eğer matchId yoksa, kullanıcının aktif eşleşmesini kullan
    if (!matchId && userInfo?.matchId) {
      matchId = userInfo.matchId;
    }
    
    if (!userInfo) {
      socket.emit('error', { message: 'Kullanıcı bilgisi bulunamadı' });
      return;
    }
    
    if (!matchId) {
      socket.emit('error', { message: 'Eşleşme bulunamadı' });
      return;
    }

    // Önce activeMatches'te ara
    let match = activeMatches.get(matchId);
    
    // Bulunamazsa completedMatches'te ara
    if (!match) {
      match = completedMatches.get(matchId);
    }
    
    // Hala bulunamazsa, kullanıcının aktif eşleşmesini kullan
    if (!match && userInfo.matchId) {
      match = activeMatches.get(userInfo.matchId);
      if (!match) {
        match = completedMatches.get(userInfo.matchId);
      }
      if (match) {
        matchId = userInfo.matchId;
      }
    }
    
    if (!match) {
      console.log(`❌ accept-continue-request: Match bulunamadı: matchId=${matchId}, userId=${userInfo.userId}`);
      socket.emit('error', { message: 'Eşleşme bulunamadı' });
      return;
    }
    
    // Kullanıcının bu match'te olup olmadığını kontrol et
    const matchUser1Id = match.user1?.userId || match.user1?.user?.userId;
    const matchUser2Id = match.user2?.userId || match.user2?.user?.userId;
    
    if (matchUser1Id !== userInfo.userId && matchUser2Id !== userInfo.userId) {
      socket.emit('error', { message: 'Bu eşleşmeye erişim yetkiniz yok' });
      return;
    }

    // Bekleyen devam isteğini bul (matchId ile veya kullanıcının userId'si ile)
    let request = null;
    for (const [requestId, req] of followRequests.entries()) {
      if (req.status === 'pending') {
        // matchId ile eşleşen veya kullanıcının userId'si ile eşleşen request'i bul
        if (req.matchId === matchId || req.toUserId === userInfo.userId) {
          request = req;
          // matchId'yi güncelle
          if (req.matchId !== matchId) {
            matchId = req.matchId;
            // Match'i tekrar bul
            match = activeMatches.get(matchId);
            if (!match) {
              match = completedMatches.get(matchId);
            }
            if (!match) {
              socket.emit('error', { message: 'Eşleşme bulunamadı' });
              return;
            }
          }
          break;
        }
      }
    }

    if (!request) {
      console.log(`❌ accept-continue-request: Devam isteği bulunamadı: matchId=${matchId}, userId=${userInfo.userId}`);
      console.log(`   followRequests:`, Array.from(followRequests.entries()).map(([id, r]) => ({ id, matchId: r.matchId, fromUserId: r.fromUserId, toUserId: r.toUserId, status: r.status })));
      socket.emit('error', { message: 'Devam isteği bulunamadı' });
      return;
    }

    if (request.toUserId !== userInfo.userId) {
      socket.emit('error', { message: 'Bu devam isteği size ait değil' });
      return;
    }

    // İsteği kabul et
    request.status = 'accepted';
    followRequests.set(request.requestId, request);
    if (useDatabase) await updateFollowRequestStatusDB(request.requestId, 'accepted');

    const user1Profile = users.get(match.user1.userId);
    const user2Profile = users.get(match.user2.userId);

    // Eşleşmeyi kalıcı olarak kaydet
    const completedMatch = {
      id: matchId,
      user1: {
        userId: match.user1.userId,
        username: user1Profile.username,
        profile: user1Profile
      },
      user2: {
        userId: match.user2.userId,
        username: user2Profile.username,
        profile: user2Profile
      },
      startedAt: match.startedAt,
      completedAt: new Date(),
      messages: [...match.messages],
      lastMessageAt: match.messages.length > 0 
        ? match.messages[match.messages.length - 1].timestamp 
        : match.startedAt
    };

    completedMatches.set(matchId, completedMatch);

    if (!userMatches.has(match.user1.userId)) {
      userMatches.set(match.user1.userId, []);
    }
    if (!userMatches.has(match.user2.userId)) {
      userMatches.set(match.user2.userId, []);
    }
    userMatches.get(match.user1.userId).push(matchId);
    userMatches.get(match.user2.userId).push(matchId);
    await saveMatches(completedMatches, userMatches);

    // Bildirim gönder: İsteği gönderen kullanıcıya (fromUserId) bildirim gönder
    // İsteği kabul eden kişinin (userInfo) profili gösterilmeli
    const accepterProfile = userInfo.profile;
    const notificationId = uuidv4();
    await saveNotification({
      notificationId,
      userId: request.fromUserId,
      type: 'continue-request-accepted',
      title: 'Eşleşme İsteği Kabul Edildi',
      message: `${accepterProfile.firstName} ${accepterProfile.lastName} eşleşme isteğinizi kabul etti.`,
      matchId: matchId,
      fromUserId: request.toUserId
    });

    // Eğer kullanıcı çevrimiçi değilse, bildirim veritabanında kalacak ve sonra gösterilecek
    // Çevrimiçiyse socket ile bildirim gönder
    if (io.sockets.sockets.has(request.fromSocketId)) {
      io.to(request.fromSocketId).emit('notification', {
        id: notificationId,
        type: 'continue-request-accepted',
        title: 'Eşleşme İsteği Kabul Edildi',
        message: `${accepterProfile.firstName} ${accepterProfile.lastName} eşleşme isteğinizi kabul etti.`,
        matchId: matchId
      });
    }

    // Aktif eşleşmeden sil (artık completed)
    activeMatches.delete(matchId);
    if (useDatabase) await deleteActiveMatchDB(matchId);
    
    // Follow request'i sil
    followRequests.delete(request.requestId);
    if (useDatabase) await deleteFollowRequestDB(request.requestId);

    // Her iki kullanıcıya da eşleşme onaylandı bildirimi gönder
    io.to(match.user1.socketId).emit('match-continued', {
      matchId: matchId,
      partnerProfile: user2Profile,
      message: 'Eşleşme onaylandı! Artık birbirinizin profillerini görebilirsiniz.'
    });

    io.to(match.user2.socketId).emit('match-continued', {
      matchId: matchId,
      partnerProfile: user1Profile,
      message: 'Eşleşme onaylandı! Artık birbirinizin profillerini görebilirsiniz.'
    });
    
    // Her iki kullanıcıya da matches-updated event'i gönder
    io.to(match.user1.socketId).emit('matches-updated');
    io.to(match.user2.socketId).emit('matches-updated');

    console.log(`Devam isteği kabul edildi: ${matchId}`);
  });

  // Devam isteğini reddetme
  socket.on('reject-continue-request', async (data) => {
    const { matchId } = data;
    const userInfo = activeUsers.get(socket.id);
    
    if (!userInfo) {
      socket.emit('error', { message: 'Kullanıcı bilgisi bulunamadı' });
      return;
    }

    // Bekleyen devam isteğini bul
    let request = null;
    let requestKey = null;
    for (const [requestId, req] of followRequests.entries()) {
      if (req.matchId === matchId && req.status === 'pending') {
        request = req;
        requestKey = requestId;
        break;
      }
    }

    if (!request) {
      socket.emit('error', { message: 'Devam isteği bulunamadı' });
      return;
    }

    // Kullanıcının bu isteğe yanıt verme yetkisi var mı?
    if (request.toUserId !== userInfo.userId) {
      socket.emit('error', { message: 'Bu devam isteği size ait değil' });
      return;
    }

    // İsteği reddet ve sil
    request.status = 'rejected';
    followRequests.delete(requestKey); // Map'ten tamamen sil
    if (useDatabase) {
      await updateFollowRequestStatusDB(request.requestId, 'rejected');
      await deleteFollowRequestDB(request.requestId);
    }

    // Gönderen kullanıcıya bildir (eğer çevrimiçiyse)
    if (io.sockets.sockets.has(request.fromSocketId)) {
      io.to(request.fromSocketId).emit('continue-request-rejected', {
        matchId,
        message: 'Devam isteğiniz reddedildi'
      });
    }

    // Eşleşmeyi kontrol et ve temizle
    const match = activeMatches.get(matchId);
    if (match) {
      // Eşleşmeyi sonlandır
      if (io.sockets.sockets.has(match.user1.socketId)) {
        io.to(match.user1.socketId).emit('match-ended', {
          matchId: matchId,
          message: 'Eşleşme sona erdi.'
        });
      }

      if (io.sockets.sockets.has(match.user2.socketId)) {
        io.to(match.user2.socketId).emit('match-ended', {
          matchId: matchId,
          message: 'Eşleşme sona erdi.'
        });
      }

      // Eşleşmeyi temizle
      const user1Info = activeUsers.get(match.user1.socketId);
      const user2Info = activeUsers.get(match.user2.socketId);
      if (user1Info) {
        user1Info.inMatch = false;
        user1Info.matchId = null;
      }
      if (user2Info) {
        user2Info.inMatch = false;
        user2Info.matchId = null;
      }
      await deleteActiveMatch(matchId);
    }

    // İsteği yapan kullanıcıya da bildir (matches-updated)
    socket.emit('matches-updated');
    if (io.sockets.sockets.has(request.fromSocketId)) {
      io.to(request.fromSocketId).emit('matches-updated');
    }

    console.log(`Devam isteği reddedildi ve silindi: ${matchId}`);
  });

  // Eski match-decision event'i kaldırıldı - artık takip isteği sistemi kullanılıyor

  // Mesaj gönderme (eşleşme içinde)
  socket.on('send-message', async (data) => {
    console.log('📨📨📨 MESAJ GÖNDERME İSTEĞİ:', { socketId: socket.id, userId: data.userId, matchId: data.matchId });
    console.log('   activeMatches size:', activeMatches.size);
    console.log('   activeMatches keys:', Array.from(activeMatches.keys()));
    
    let userInfo = activeUsers.get(socket.id);
    
    // Eğer kullanıcı activeUsers'da yoksa, userId ile bul ve ekle
    if (!userInfo) {
      if (data.userId) {
        console.log('⚠️ SocketId ile kullanıcı bulunamadı, userId ile aranıyor:', data.userId);
        const profile = users.get(data.userId);
        if (!profile) {
          console.log('❌ Profil bulunamadı userId ile:', data.userId);
          socket.emit('error', { message: 'Profil bulunamadı' });
          return;
        }
        
        // MatchId'yi bul - DAHA AGRESIF
        let currentMatchId = data.matchId || null;
        let foundMatch = null;
        
        if (currentMatchId) {
          // Önce activeMatches'te ara, bulamazsan completedMatches'te ara
          foundMatch = activeMatches.get(currentMatchId);
          if (!foundMatch) {
            foundMatch = completedMatches.get(currentMatchId);
          }
          if (foundMatch) {
            // Match'te socketId'yi güncelle - esnek yapı
            const u1Id = foundMatch.user1?.userId || foundMatch.user1?.user?.userId;
            const u2Id = foundMatch.user2?.userId || foundMatch.user2?.user?.userId;
            if (u1Id === data.userId && foundMatch.user1) {
              foundMatch.user1.socketId = socket.id;
            } else if (u2Id === data.userId && foundMatch.user2) {
              foundMatch.user2.socketId = socket.id;
            }
          }
        }
        
        // MatchId yoksa veya bulunamadıysa, aktif eşleşmelerde ara
        if (!foundMatch) {
          for (const [mid, match] of activeMatches.entries()) {
            const u1Id = match.user1?.userId || match.user1?.user?.userId;
            const u2Id = match.user2?.userId || match.user2?.user?.userId;
            if (u1Id === data.userId) {
              if (match.user1) match.user1.socketId = socket.id;
              currentMatchId = mid;
              foundMatch = match;
              break;
            } else if (u2Id === data.userId) {
              if (match.user2) match.user2.socketId = socket.id;
              currentMatchId = mid;
              foundMatch = match;
              break;
            }
          }
        }
        
        userInfo = {
          socketId: socket.id,
          userId: data.userId,
          profile: profile,
          inMatch: currentMatchId !== null,
          matchId: currentMatchId
        };
        activeUsers.set(socket.id, userInfo);
        console.log('✅ Kullanıcı otomatik eklendi:', userInfo.userId, 'matchId:', currentMatchId);
      } else {
        console.log('❌ userId verilmemiş, kullanıcı bulunamıyor');
        socket.emit('error', { message: 'Profil bulunamadı. Lütfen sayfayı yenileyin.' });
        return;
      }
    }

    const matchId = data.matchId || userInfo.matchId;
    console.log('🔍 MatchId arama:', matchId, 'UserInfo matchId:', userInfo.matchId);
    
    if (!matchId) {
      console.log('❌ MatchId bulunamadı');
      socket.emit('error', { message: 'Eşleşme bulunamadı' });
      return;
    }

    // Önce activeMatches'te ara, bulamazsan completedMatches'te ara
    let match = activeMatches.get(matchId);
    console.log('🔍 MatchId ile arama:', matchId, 'Bulundu mu?', !!match);
    if (!match) {
      match = completedMatches.get(matchId);
      console.log('🔍 completedMatches\'te arama:', matchId, 'Bulundu mu?', !!match);
    }
    
    // Eğer hala bulunamadıysa, userId ile tüm match'lerde ara
    if (!match && userInfo.userId) {
      console.log('⚠️⚠️⚠️ MatchId ile bulunamadı, userId ile aranıyor:', userInfo.userId);
      console.log('   activeMatches size:', activeMatches.size);
      console.log('   activeMatches keys:', Array.from(activeMatches.keys()));
      
      // activeMatches'te ara - esnek yapı kontrolü
      for (const [mid, m] of activeMatches.entries()) {
        console.log(`   Checking match ${mid}:`, {
          user1: m.user1,
          user2: m.user2,
          matchId: m.id
        });
        const u1Id = m.user1?.userId || m.user1?.user?.userId || (typeof m.user1 === 'string' ? m.user1 : null);
        const u2Id = m.user2?.userId || m.user2?.user?.userId || (typeof m.user2 === 'string' ? m.user2 : null);
        console.log(`   Comparing: ${u1Id} === ${userInfo.userId} or ${u2Id} === ${userInfo.userId}`);
        if (u1Id === userInfo.userId || u2Id === userInfo.userId) {
          match = m;
          console.log('✅✅✅ activeMatches\'te userId ile bulundu:', mid, 'matchId:', matchId);
          // MatchId'yi güncelle
          if (match.id !== matchId) {
            console.log('⚠️ MatchId uyuşmuyor, match.id kullanılıyor:', match.id, 'vs istenen:', matchId);
          }
          break;
        }
      }
      // completedMatches'te ara
      if (!match) {
        console.log('   completedMatches size:', completedMatches.size);
        for (const [mid, m] of completedMatches.entries()) {
          const u1Id = m.user1?.userId || m.user1?.user?.userId || (typeof m.user1 === 'string' ? m.user1 : null);
          const u2Id = m.user2?.userId || m.user2?.user?.userId || (typeof m.user2 === 'string' ? m.user2 : null);
          if (u1Id === userInfo.userId || u2Id === userInfo.userId) {
            match = m;
            console.log('✅ completedMatches\'te userId ile bulundu:', mid);
            break;
          }
        }
      }
    }
    
    if (!match) {
      console.log('❌ Match bulunamadı:', matchId);
      console.log('📋 Aktif eşleşmeler:', Array.from(activeMatches.keys()));
      console.log('📋 Tamamlanmış eşleşmeler:', Array.from(completedMatches.keys()));
      console.log('👤 Kullanıcı userId:', userInfo.userId);
      console.log('📊 Active matches detayları:');
      for (const [mid, m] of activeMatches.entries()) {
        console.log(`  Match ${mid}:`, {
          user1Id: m.user1?.userId,
          user2Id: m.user2?.userId,
          user1Socket: m.user1?.socketId,
          user2Socket: m.user2?.socketId
        });
      }
      
      // Son çare: userId ile aktif match'lerde ara ve ilk bulunanı kullan
      if (userInfo.userId && !match) {
        console.log('🆘🆘🆘 SON ÇARE: userId ile aktif match aranıyor:', userInfo.userId);
        console.log('   Active matches:', activeMatches.size);
        for (const [mid, m] of activeMatches.entries()) {
          console.log(`   Checking match ${mid}:`, {
            user1: m.user1,
            user2: m.user2
          });
          const u1Id = m.user1?.userId || m.user1?.user?.userId || (typeof m.user1 === 'object' && m.user1 !== null ? JSON.stringify(m.user1).substring(0, 50) : m.user1);
          const u2Id = m.user2?.userId || m.user2?.user?.userId || (typeof m.user2 === 'object' && m.user2 !== null ? JSON.stringify(m.user2).substring(0, 50) : m.user2);
          console.log(`   Comparing: ${u1Id} === ${userInfo.userId} or ${u2Id} === ${userInfo.userId}`);
          if (u1Id === userInfo.userId || u2Id === userInfo.userId) {
            match = m;
            console.log('✅✅✅ SON ÇARE İLE MATCH BULUNDU:', mid);
            break;
          }
        }
      }
      
      // EN SON ÇARE: Match bulunamazsa, matchId ile yeni bir match oluştur
      if (!match && matchId && userInfo.userId) {
        console.log('🆘🆘🆘 EN SON ÇARE: Match bulunamadı, matchId ile yeni match oluşturuluyor:', matchId);
        // Partner'ı bul (varsa)
        let partnerUserId = null;
        let partnerProfile = null;
        
        // activeUsers'dan partner'ı bul (aynı matchId'ye sahip başka bir kullanıcı)
        for (const [sid, uInfo] of activeUsers.entries()) {
          if (uInfo.userId !== userInfo.userId && uInfo.matchId === matchId) {
            partnerUserId = uInfo.userId;
            partnerProfile = uInfo.profile;
            break;
          }
        }
        
        // Match oluştur
        match = {
          id: matchId,
          user1: {
            socketId: socket.id,
            userId: userInfo.userId,
            profile: userInfo.profile
          },
          user2: partnerUserId ? {
            socketId: null,
            userId: partnerUserId,
            profile: partnerProfile
          } : {
            socketId: null,
            userId: null,
            profile: null
          },
          startedAt: new Date(),
          messages: [],
          user1Decision: null,
          user2Decision: null,
          timerStarted: false
        };
        
        activeMatches.set(matchId, match);
        if (useDatabase) saveActiveMatchDB(matchId, match);
        console.log('✅✅✅ EN SON ÇARE İLE MATCH OLUŞTURULDU:', matchId);
      }
      
      if (!match) {
        console.log('❌❌❌ MATCH BULUNAMADI - HATA GÖNDERİLİYOR');
        socket.emit('error', { message: 'Eşleşme bulunamadı' });
        return;
      }
    }
    
    console.log('✅ Match bulundu:', match.id);

    // Kullanıcının bu eşleşmede olup olmadığını kontrol et
    // Match yapısı farklı olabilir, esnek kontrol yap
    const user1Id = match.user1?.userId || match.user1?.user?.userId || match.user1;
    const user2Id = match.user2?.userId || match.user2?.user?.userId || match.user2;
    
    const isUser1 = user1Id === userInfo.userId;
    const isUser2 = user2Id === userInfo.userId;
    
    console.log('🔍 Kullanıcı kontrolü:', { 
      userId: userInfo.userId, 
      user1Id: user1Id, 
      user2Id: user2Id,
      isUser1, 
      isUser2,
      matchUser1: match.user1,
      matchUser2: match.user2
    });
    
    if (!isUser1 && !isUser2) {
      console.log('❌ Kullanıcı bu eşleşmede değil');
      socket.emit('error', { message: 'Bu eşleşmede değilsiniz' });
      return;
    }
    
    console.log('✅ Kullanıcı eşleşmede, mesaj gönderilebilir');

    // Partner'ın socketId'sini bul - esnek yapı
    const partnerInfo = isUser1 ? match.user2 : match.user1;
    const partnerUserId = partnerInfo?.userId || partnerInfo?.user?.userId || partnerInfo;
    let partnerSocketId = partnerInfo?.socketId || null;
    
    // Eğer socketId yoksa, activeUsers'dan partner'ın aktif socketId'sini bul
    if (!partnerSocketId && partnerUserId) {
      console.log('🔍 Partner socketId yok, activeUsers\'da aranıyor:', partnerUserId);
      const partnerSocket = Array.from(activeUsers.entries()).find(([_, info]) => info.userId === partnerUserId);
      if (partnerSocket) {
        partnerSocketId = partnerSocket[0]; // socketId
        console.log('✅ Partner socketId bulundu:', partnerSocketId);
        // Match'teki socketId'yi güncelle
        if (isUser1 && match.user2) {
          match.user2.socketId = partnerSocketId;
        } else if (!isUser1 && match.user1) {
          match.user1.socketId = partnerSocketId;
        }
      } else {
        console.log('⚠️ Partner socketId bulunamadı, partner offline olabilir');
      }
    }
    
    console.log('👥 Partner bilgisi:', { 
      partnerSocketId, 
      partnerUserId,
      matchUser1Socket: match.user1?.socketId,
      matchUser2Socket: match.user2?.socketId
    });

    const message = {
      id: uuidv4(),
      userId: userInfo.userId,
      username: userInfo.profile.username,
      text: data.text,
      timestamp: new Date(),
      matchId: match.id,
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType || null,
      readBy: [],
      reactions: {},
      deleted: false,
      edited: false
    };

    match.messages.push(message);
    
    // Eğer completed match ise, mesajı kaydet
    const isCompletedMatch = completedMatches.has(match.id);
    if (isCompletedMatch) {
      const completedMatch = completedMatches.get(match.id);
      completedMatch.messages.push(message);
      completedMatch.lastMessageAt = new Date();
      await saveMatches(completedMatches, userMatches); // Hemen kaydet
    } else if (activeMatches.has(match.id) && useDatabase) {
      // Active match ise de mesajları kaydet (deploy sonrası kaybolmasın)
      await saveActiveMatchDB(match.id, match);
    }

    // Online status güncelle
    const profile = users.get(userInfo.userId);
    if (profile) {
      profile.lastSeen = new Date();
      users.set(userInfo.userId, profile);
    }

    // Eşleşme partnerine mesajı gönder (bildirim ile)
    if (partnerSocketId) {
      io.to(partnerSocketId).emit('new-message', message);
      io.to(partnerSocketId).emit('notification', {
        type: 'new-message',
        matchId: match.id,
        from: userInfo.profile.username,
        message: data.text.substring(0, 50)
      });
    }
    
    // Gönderene sadece message-sent gönder (new-message gönderme - duplicate olur!)
    socket.emit('message-sent', message);

    console.log(`Mesaj gönderildi - Match: ${match.id}, From: ${userInfo.profile.username}, To: ${partnerSocketId}`);
  });

  // Yazıyor göstergesi
  socket.on('typing', (data) => {
    const userInfo = activeUsers.get(socket.id);
    if (!userInfo) return;

    const matchId = data.matchId || userInfo.matchId;
    if (!matchId) return;

    const match = activeMatches.get(matchId);
    if (!match) return;

    // Kullanıcının bu eşleşmede olup olmadığını kontrol et
    const isUser1 = match.user1.userId === userInfo.userId;
    const isUser2 = match.user2.userId === userInfo.userId;
    
    if (!isUser1 && !isUser2) return;

    const partnerSocketId = isUser1 ? match.user2.socketId : match.user1.socketId;

    io.to(partnerSocketId).emit('user-typing', {
      userId: userInfo.userId,
      username: userInfo.profile.username,
      isTyping: data.isTyping
    });
  });

  // Mesaj okundu işaretleme
  socket.on('mark-message-read', (data) => {
    const userInfo = activeUsers.get(socket.id);
    if (!userInfo) return;

    const { matchId, messageId } = data;
    const match = activeMatches.get(matchId) || completedMatches.get(matchId);
    if (!match) return;

    const message = match.messages.find(m => m.id === messageId);
    if (message && (!message.readBy || !message.readBy.includes(userInfo.userId))) {
      if (!message.readBy) message.readBy = [];
      message.readBy.push(userInfo.userId);
      // Partner'e bildir
      const partnerId = match.user1.userId === userInfo.userId ? match.user2.userId : match.user1.userId;
      const partnerSocket = Array.from(activeUsers.entries()).find(([_, info]) => info.userId === partnerId);
      if (partnerSocket) {
        io.to(partnerSocket[0]).emit('message-read', { messageId, readBy: userInfo.userId });
      }
    }
  });

  // Mesaja reaksiyon ekle/kaldır
  socket.on('react-to-message', async (data) => {
    const userInfo = activeUsers.get(socket.id);
    if (!userInfo) return;

    const { matchId, messageId, reaction } = data;
    const match = activeMatches.get(matchId) || completedMatches.get(matchId);
    if (!match) return;

    const message = match.messages.find(m => m.id === messageId);
    if (!message) return;

    if (!message.reactions) message.reactions = {};
    if (!message.reactions[reaction]) message.reactions[reaction] = [];

    const userIndex = message.reactions[reaction].indexOf(userInfo.userId);
    if (userIndex > -1) {
      // Reaksiyonu kaldır
      message.reactions[reaction].splice(userIndex, 1);
      if (message.reactions[reaction].length === 0) {
        delete message.reactions[reaction];
      }
    } else {
      // Reaksiyon ekle
      message.reactions[reaction].push(userInfo.userId);
    }

    // Completed match ise kaydet
    const isCompletedMatch = completedMatches.has(matchId);
    if (isCompletedMatch) {
      const completedMatch = completedMatches.get(matchId);
      const completedMessage = completedMatch.messages.find(m => m.id === messageId);
      if (completedMessage) {
        completedMessage.reactions = message.reactions;
        await saveMatches(completedMatches, userMatches);
      }
    }

    // Partner'e bildir
    const partnerId = match.user1.userId === userInfo.userId ? match.user2.userId : match.user1.userId;
    const partnerSocket = Array.from(activeUsers.entries()).find(([_, info]) => info.userId === partnerId);
    if (partnerSocket) {
      io.to(partnerSocket[0]).emit('message-reaction', { messageId, reactions: message.reactions });
    }
    socket.emit('message-reaction', { messageId, reactions: message.reactions });
  });

  // Mesaj silme
  socket.on('delete-message', (data) => {
    const userInfo = activeUsers.get(socket.id);
    if (!userInfo) return;

    const { matchId, messageId } = data;
    const match = activeMatches.get(matchId) || completedMatches.get(matchId);
    if (!match) return;

    const message = match.messages.find(m => m.id === messageId);
    if (message && message.userId === userInfo.userId) {
      message.deleted = true;
      message.text = 'Bu mesaj silindi';
      
      // Partner'e bildir
      const partnerId = match.user1.userId === userInfo.userId ? match.user2.userId : match.user1.userId;
      const partnerSocket = Array.from(activeUsers.entries()).find(([_, info]) => info.userId === partnerId);
      if (partnerSocket) {
        io.to(partnerSocket[0]).emit('message-deleted', { messageId });
      }
      socket.emit('message-deleted', { messageId });
    }
  });

  // Online durumu güncelle
  socket.on('update-online-status', () => {
    const userInfo = activeUsers.get(socket.id);
    if (!userInfo) return;

    const profile = users.get(userInfo.userId);
    if (profile) {
      profile.lastSeen = new Date();
      profile.isOnline = true;
      users.set(userInfo.userId, profile);
    }
  });

  // Bağlantı kopması
  socket.on('disconnect', async () => {
    const userInfo = activeUsers.get(socket.id);
    if (userInfo) {
      const userId = userInfo.userId;
      const matchId = userInfo.matchId;
      
      // Bu socket'i activeUsers'dan sil
      activeUsers.delete(socket.id);
      console.log(`Kullanıcı bağlantısını kesti: ${socket.id}`);
      
      // Aynı userId'ye sahip başka aktif socket var mı kontrol et
      let hasOtherConnection = false;
      for (const [socketId, info] of activeUsers.entries()) {
        if (info.userId === userId) {
          hasOtherConnection = true;
          console.log(`✅ Kullanıcı ${userId} başka bir socket ile hala bağlı: ${socketId}`);
          break;
        }
      }
      
      // Eğer başka bağlantı varsa, match'i silme
      if (hasOtherConnection) {
        console.log(`✅ Match silinmedi, kullanıcı hala bağlı: ${matchId}`);
        return;
      }
      
      // Online durumunu güncelle
      const profile = users.get(userId);
      if (profile) {
        profile.isOnline = false;
        profile.lastSeen = new Date();
        users.set(userId, profile);
      }

      // Eşleşme kuyruğundan çıkar
      const queueIndex = matchingQueue.findIndex(u => u.socketId === socket.id);
      if (queueIndex !== -1) {
        matchingQueue.splice(queueIndex, 1);
      }

      // 5 saniye bekle, sonra tekrar kontrol et (reconnect için zaman tanı)
      if (userInfo.inMatch && matchId) {
        console.log(`⏳ Kullanıcı ${userId} disconnect oldu, 5 saniye bekleniyor...`);
        
        setTimeout(async () => {
          // Tekrar kontrol et - kullanıcı geri bağlandı mı?
          let reconnected = false;
          for (const [socketId, info] of activeUsers.entries()) {
            if (info.userId === userId) {
              reconnected = true;
              console.log(`✅ Kullanıcı ${userId} geri bağlandı: ${socketId}`);
              break;
            }
          }
          
          if (reconnected) {
            console.log(`✅ Match korundu: ${matchId}`);
            return;
          }
          
          // Kullanıcı geri bağlanmadı, match'i sil
          const match = activeMatches.get(matchId);
          if (match) {
            const partnerSocketId = match.user1.userId === userId 
              ? match.user2.socketId 
              : match.user1.socketId;

            io.to(partnerSocketId).emit('partner-disconnected', {
              message: 'Eşleşme partneri bağlantısını kesti'
            });

            // Eşleşmeyi temizle
            const partnerInfo = activeUsers.get(partnerSocketId);
            if (partnerInfo) {
              partnerInfo.inMatch = false;
              partnerInfo.matchId = null;
            }
            await deleteActiveMatch(matchId);
            console.log(`🗑️ Match silindi (timeout sonrası): ${matchId}`);
          }
        }, 5000); // 5 saniye bekle
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
  console.log(`Eşleşme sistemi aktif`);
});