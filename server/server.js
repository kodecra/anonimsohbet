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

// Async yükleme (PostgreSQL için)
(async () => {
  try {
    users = await loadUsers(); // userId -> user profile
    userAuth = await loadAuth(); // email -> { userId, passwordHash }
    const matchesData = await loadMatches();
    completedMatches = matchesData.completedMatches;
    userMatches = matchesData.userMatches;
    pendingVerifications = await loadVerifications();
    console.log('✅ Veriler yüklendi:', {
      users: users.size,
      auth: userAuth.size,
      completedMatches: completedMatches.size,
      userMatches: userMatches.size,
      verifications: pendingVerifications.size
    });
  } catch (error) {
    console.error('❌ Veri yükleme hatası:', error);
    // Fallback - boş Map'ler
    users = new Map();
    userAuth = new Map();
    completedMatches = new Map();
    userMatches = new Map();
    pendingVerifications = new Map();
  }
})();

const activeUsers = new Map(); // socketId -> user info (geçici)
const matchingQueue = []; // Eşleşme bekleyen kullanıcılar (geçici)
const activeMatches = new Map(); // matchId -> match info (geçici)

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'admin@admin.com'; // Superadmin email

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
  const { username, firstName, lastName, gender } = req.body;
  
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Kullanıcı adı gereklidir' });
  }

  if (!lastName || !lastName.trim()) {
    return res.status(400).json({ error: 'Soyisim zorunludur' });
  }

  // Kullanıcı adı kontrolü
  const existingUser = Array.from(users.values()).find(u => u.username === username.trim());
  if (existingUser) {
    return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
  }

  const userId = uuidv4();

  const userProfile = {
    userId,
    email: `${username.trim()}@anonimsohbet.local`, // Dummy email
    username: username.trim(),
    firstName: firstName ? firstName.trim() : null,
    lastName: lastName.trim(),
    gender: gender || null,
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

  const token = jwt.sign({ userId, username: username.trim() }, JWT_SECRET, { expiresIn: '7d' });

  res.json({ 
    token,
    user: {
      userId,
      username: userProfile.username
    }
  });
});

// Giriş yap
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email ve şifre gereklidir' });
  }

  const auth = userAuth.get(email.toLowerCase());
  if (!auth) {
    return res.status(401).json({ error: 'Email veya şifre hatalı' });
  }

  const isValidPassword = await bcrypt.compare(password, auth.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Email veya şifre hatalı' });
  }

  const profile = users.get(auth.userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
  }

  const token = jwt.sign({ userId: auth.userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });

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

  const updatedProfile = {
    ...profile,
    photos: allPhotos,
    updatedAt: new Date()
  };

  users.set(userId, updatedProfile);
  await saveUsers(users); // Hemen kaydet
  res.json({ profile: updatedProfile, message: `${req.files.length} fotoğraf yüklendi` });
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

  const updatedProfile = {
    ...profile,
    photos: photos,
    updatedAt: new Date()
  };

  users.set(userId, updatedProfile);
  await saveUsers(users); // Hemen kaydet
  res.json({ profile: updatedProfile, message: 'Fotoğraf silindi' });
});

// Profil oluşturma/güncelleme (artık authenticated)
app.post('/api/profile', authenticateToken, async (req, res) => {
  const { username, firstName, lastName, gender, age, bio, interests } = req.body;
  const userId = req.user.userId;
  
  const existingProfile = users.get(userId);
  if (!existingProfile) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  // Soyisim zorunlu kontrolü
  if (lastName === undefined || lastName === null || lastName.trim() === '') {
    return res.status(400).json({ error: 'Soyisim zorunludur' });
  }

  const userProfile = {
    ...existingProfile,
    username: username || existingProfile.username,
    firstName: firstName !== undefined ? firstName : existingProfile.firstName,
    lastName: lastName !== undefined ? lastName : existingProfile.lastName,
    gender: gender !== undefined ? gender : existingProfile.gender,
    age: age !== undefined ? age : existingProfile.age,
    bio: bio !== undefined ? bio : existingProfile.bio,
    interests: interests || existingProfile.interests,
    updatedAt: new Date()
  };

  users.set(userId, userProfile);
  await saveUsers(users); // Hemen kaydet
  res.json({ profile: userProfile });
});

// Profil getirme (kendi profili - authenticated)
app.get('/api/profile', authenticateToken, (req, res) => {
  const profile = users.get(req.user.userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profil bulunamadı' });
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
  
  // Superadmin kontrolü (email ile)
  if (profile.email !== SUPERADMIN_EMAIL) {
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
  
  // Superadmin kontrolü
  if (profile.email !== SUPERADMIN_EMAIL) {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }

  if (!targetUserId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Geçersiz parametreler' });
  }

  const verification = pendingVerifications.get(targetUserId);
  if (!verification) {
    return res.status(404).json({ error: 'Doğrulama bulunamadı' });
  }

  const targetProfile = users.get(targetUserId);
  if (!targetProfile) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  if (action === 'approve') {
    targetProfile.verified = true;
    verification.status = 'approved';
    users.set(targetUserId, targetProfile);
    await saveUsers(users); // Hemen kaydet
    await saveVerifications(pendingVerifications); // Hemen kaydet
    res.json({ message: 'Kullanıcı onaylandı', verified: true });
  } else {
    verification.status = 'rejected';
    // Selfie dosyasını sil
    const filePath = path.join(uploadsDir, verification.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await saveVerifications(pendingVerifications); // Hemen kaydet
    res.json({ message: 'Doğrulama reddedildi' });
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
app.post('/api/users/report', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { targetUserId, reason } = req.body;
  
  if (!targetUserId || !reason) {
    return res.status(400).json({ error: 'Kullanıcı ID ve sebep gereklidir' });
  }

  // Şikayeti kaydet (basit bir şekilde, ileride veritabanına taşınabilir)
  const report = {
    reporterId: userId,
    targetUserId,
    reason,
    timestamp: new Date()
  };
  
  // Burada şikayetleri bir dosyaya kaydedebilirsiniz veya veritabanına ekleyebilirsiniz
  console.log('Kullanıcı şikayeti:', report);
  
  res.json({ message: 'Şikayet kaydedildi, incelenecektir' });
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
  profileViews = profile?.profileViews || 0;
  
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
app.get('/api/notifications/settings', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const profile = users.get(userId);
  
  res.json({
    soundEnabled: profile?.notificationSettings?.soundEnabled !== false,
    browserEnabled: profile?.notificationSettings?.browserEnabled !== false,
    messageEnabled: profile?.notificationSettings?.messageEnabled !== false
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
  
  // Eşleşmeyi kullanıcının listesinden çıkar
  const userMatchIds = userMatches.get(userId) || [];
  const filteredMatchIds = userMatchIds.filter(id => id !== matchId);
  userMatches.set(userId, filteredMatchIds);
  
  // Partner'ın listesinden de çıkar (eğer partnerId varsa)
  const partnerId = user1Id === userId ? user2Id : user1Id;
  if (partnerId) {
    const partnerMatchIds = userMatches.get(partnerId) || [];
    const filteredPartnerMatchIds = partnerMatchIds.filter(id => id !== matchId);
    userMatches.set(partnerId, filteredPartnerMatchIds);
  }
  
  // Eşleşmeyi sil
  completedMatches.delete(matchId);
  activeMatches.delete(matchId);
  
  await saveMatches(completedMatches, userMatches);
  
  console.log(`Eşleşme silindi: ${matchId} (Kullanıcı: ${userId})`);
  
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
  
  const matches = matchIds.map(matchId => {
    const match = completedMatches.get(matchId);
    if (!match) return null;

    // Partner bilgisini bul
    const partner = match.user1.userId === userId ? match.user2 : match.user1;
    
    // Partner bilgisini esnek şekilde al (farklı yapılar için)
    const partnerProfile = partner.profile || partner;
    const partnerUserId = partner.userId || partnerProfile?.userId;
    const partnerUsername = partner.username || partnerProfile?.username || 'Bilinmeyen Kullanıcı';
    const partnerFirstName = partner.firstName || partnerProfile?.firstName || null;
    const partnerLastName = partner.lastName || partnerProfile?.lastName || null;
    const partnerPhotos = partnerProfile?.photos || partner.photos || [];
    const partnerVerified = partnerProfile?.verified || partner.verified || false;
    
    return {
      matchId: match.id,
      partner: {
        userId: partnerUserId,
        username: partnerUsername,
        firstName: partnerFirstName,
        lastName: partnerLastName,
        photos: partnerPhotos,
        verified: partnerVerified
      },
      lastMessage: match.messages.length > 0 ? match.messages[match.messages.length - 1] : null,
      lastMessageAt: match.lastMessageAt,
      messageCount: match.messages.length,
      startedAt: match.startedAt
    };
  }).filter(m => m !== null).sort((a, b) => {
    // En son mesaj alanı üstte
    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
  });

  res.json({ matches });
});

// Belirli bir eşleşmenin detaylarını getir - DELETE'den SONRA olmalı!
app.get('/api/matches/:matchId', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const matchId = req.params.matchId;
  
  // Önce activeMatches'te ara, bulamazsan completedMatches'te ara
  let match = activeMatches.get(matchId);
  let isActiveMatch = false;
  if (match) {
    isActiveMatch = true;
  } else {
    match = completedMatches.get(matchId);
  }

  if (!match) {
    console.log('⚠️ Match bulunamadı:', matchId);
    console.log('Active matches:', Array.from(activeMatches.keys()));
    console.log('Completed matches:', Array.from(completedMatches.keys()));
    console.log('Request userId:', userId);
    // Debug için activeUsers'ı kontrol et
    for (const [socketId, userInfo] of activeUsers.entries()) {
      if (userInfo.userId === userId) {
        console.log('User active socket:', socketId, 'matchId:', userInfo.matchId);
        // Eğer kullanıcı aktif bir eşleşmedeyse, o match'i döndür
        if (userInfo.matchId && userInfo.matchId !== matchId) {
          console.log('⚠️ Kullanıcının aktif matchId farklı:', userInfo.matchId, 'vs istenen:', matchId);
        }
      }
    }
    return res.status(404).json({ error: 'Eşleşme bulunamadı' });
  }
  
  console.log('✅ Match bulundu:', matchId, 'isActiveMatch:', isActiveMatch);

  // Kullanıcının bu eşleşmede olup olmadığını kontrol et
  if (match.user1.userId !== userId && match.user2.userId !== userId) {
    return res.status(403).json({ error: 'Bu eşleşmeye erişim yetkiniz yok' });
  }

  const partner = match.user1.userId === userId ? match.user2 : match.user1;
  
  let partnerInfo = null;
  if (!isActiveMatch) {
    // Completed match - partner bilgisini göster
    const partnerProfile = users.get(partner.userId);
    
    // activeMatches'te partner.profile var, completedMatches'te partner direkt profile olabilir
    const partnerData = partnerProfile || partner.profile || partner;
    
    partnerInfo = {
      userId: partner.userId,
      username: partnerData.username || partnerData.profile?.username,
      age: partnerData.age || partnerData.profile?.age,
      bio: partnerData.bio || partnerData.profile?.bio,
      interests: partnerData.interests || partnerData.profile?.interests || [],
      photos: partnerData.photos || partnerData.profile?.photos || [],
      verified: partnerData.verified || partnerData.profile?.verified || false
    };
  }
  
  res.json({
    match: {
      matchId: match.id,
      partner: partnerInfo,  // Aktif eşleşmede null, completed'de partner bilgisi
      messages: match.messages || [],
      startedAt: match.startedAt
    }
  });
});

// Socket.io bağlantıları
io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);

  // Kullanıcı profili ile bağlanıyor
  socket.on('set-profile', (data) => {
    const { userId, matchId } = data;
    const profile = users.get(userId);
    
    if (!profile) {
      socket.emit('error', { message: 'Profil bulunamadı. Lütfen önce profil oluşturun.' });
      return;
    }

    let currentMatchId = matchId || null;
    
    // Eğer matchId verilmişse, match'teki socketId'yi güncelle
    if (matchId) {
      const match = activeMatches.get(matchId);
      if (match) {
        if (match.user1.userId === userId) {
          match.user1.socketId = socket.id;
        } else if (match.user2.userId === userId) {
          match.user2.socketId = socket.id;
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
  socket.on('start-matching', (data) => {
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

    if (userInfo.inMatch) {
      socket.emit('error', { message: 'Zaten bir eşleşmede bulunuyorsunuz' });
      return;
    }

    // Kuyruğa ekle
    if (!matchingQueue.find(u => u.socketId === socket.id)) {
      matchingQueue.push({
        socketId: socket.id,
        userId: userInfo.userId,
        profile: userInfo.profile
      });
      socket.emit('matching-started', { message: 'Eşleşme aranıyor...' });
      console.log(`${userInfo.profile.username} eşleşme kuyruğuna eklendi`);
    }

    // Eşleşme kontrolü
    if (matchingQueue.length >= 2) {
      const user1 = matchingQueue.shift();
      const user2 = matchingQueue.shift();

      const matchId = uuidv4();
      // Match yapısını netleştir - user1 ve user2'de userId ve socketId olmalı
      const match = {
        id: matchId,
        user1: {
          socketId: user1.socketId,
          userId: user1.userId,
          profile: user1.profile
        },
        user2: {
          socketId: user2.socketId,
          userId: user2.userId,
          profile: user2.profile
        },
        startedAt: new Date(),
        messages: [],
        user1Decision: null,
        user2Decision: null,
        timerStarted: false
      };

      activeMatches.set(matchId, match);
      console.log('✅✅✅ MATCH OLUŞTURULDU:', matchId);
      console.log('   user1:', { userId: user1.userId, socketId: user1.socketId, username: user1.profile?.username });
      console.log('   user2:', { userId: user2.userId, socketId: user2.socketId, username: user2.profile?.username });
      console.log('   activeMatches size:', activeMatches.size);
      console.log('   activeMatches keys:', Array.from(activeMatches.keys()));

      // Her iki kullanıcıyı da eşleşmeye bağla
      const user1Info = activeUsers.get(user1.socketId);
      const user2Info = activeUsers.get(user2.socketId);

      if (user1Info) {
        user1Info.inMatch = true;
        user1Info.matchId = matchId;
      }
      if (user2Info) {
        user2Info.inMatch = true;
        user2Info.matchId = matchId;
      }

      // Her iki kullanıcıya eşleşme bildirimi gönder (anonim)
      io.to(user1.socketId).emit('match-found', {
        matchId: matchId,
        message: 'Birisiyle eşleştiniz! 30 saniye sonra devam edip etmeyeceğiniz sorulacak.'
      });

      io.to(user2.socketId).emit('match-found', {
        matchId: matchId,
        message: 'Birisiyle eşleştiniz! 30 saniye sonra devam edip etmeyeceğiniz sorulacak.'
      });

      // 30 saniyelik timer başlat
      match.timerStarted = true;
      setTimeout(() => {
        const currentMatch = activeMatches.get(matchId);
        if (!currentMatch) return;

        // Her iki kullanıcıya da karar sor
        io.to(user1.socketId).emit('time-up', {
          matchId: matchId,
          message: '30 saniye doldu. Devam etmek istiyor musunuz?'
        });

        io.to(user2.socketId).emit('time-up', {
          matchId: matchId,
          message: '30 saniye doldu. Devam etmek istiyor musunuz?'
        });

        console.log(`30 saniye doldu - Match: ${matchId}`);
      }, 30000);

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

  // Devam/Çıkış kararı
  socket.on('match-decision', async (data) => {
    const { matchId, decision } = data; // decision: 'continue' veya 'leave'
    const userInfo = activeUsers.get(socket.id);
    
    if (!userInfo) {
      console.log('❌ match-decision: Kullanıcı bulunamadı', { socketId: socket.id });
      socket.emit('error', { message: 'Kullanıcı bulunamadı' });
      return;
    }

    console.log(`📥 match-decision event alındı:`, { matchId, decision, userId: userInfo.userId });

    // Önce activeMatches'te kontrol et
    let match = activeMatches.get(matchId);
    
    // Eğer activeMatches'te yoksa, completedMatches'te kontrol et (belki zaten tamamlanmış)
    if (!match) {
      console.log(`⚠️ Match activeMatches'te bulunamadı, completedMatches'te aranıyor: ${matchId}`);
      const completedMatch = completedMatches.get(matchId);
      if (completedMatch) {
        console.log(`✅ Match completedMatches'te bulundu: ${matchId}`);
        // Match zaten tamamlanmış, match-continued event'i gönder
        const isUser1 = completedMatch.user1.userId === userInfo.userId;
        const isUser2 = completedMatch.user2.userId === userInfo.userId;
        
        if (isUser1 || isUser2) {
          const partnerProfile = isUser1 ? completedMatch.user2.profile : completedMatch.user1.profile;
          
          // Güncel socket ID'yi bul
          let userSocketId = socket.id;
          for (const [socketId, uInfo] of activeUsers.entries()) {
            if (uInfo.userId === userInfo.userId) {
              userSocketId = socketId;
              break;
            }
          }
          
          io.to(userSocketId).emit('match-continued', {
            matchId: matchId,
            partnerProfile: partnerProfile,
            message: 'Eşleşme onaylandı! Artık birbirinizin profillerini görebilirsiniz.'
          });
          console.log(`✅ match-continued gönderildi (completed match): ${userSocketId}`);
          return;
        }
      }
      
      // Match hiçbir yerde bulunamadı - userId ile ara (race condition için)
      console.log(`⚠️ Match hiçbir yerde bulunamadı, userId ile aranıyor: ${userInfo.userId}`);
      for (const [mid, m] of activeMatches.entries()) {
        const u1Id = m.user1?.userId;
        const u2Id = m.user2?.userId;
        if ((u1Id === userInfo.userId || u2Id === userInfo.userId) && mid === matchId) {
          match = m;
          console.log(`✅ Match userId ile bulundu: ${mid}`);
          break;
        }
      }
      
      // Hala bulunamadıysa, completedMatches'te userId ile ara
      if (!match) {
        for (const [mid, cm] of completedMatches.entries()) {
          const u1Id = cm.user1?.userId;
          const u2Id = cm.user2?.userId;
          if ((u1Id === userInfo.userId || u2Id === userInfo.userId) && mid === matchId) {
            // Match completedMatches'te bulundu, match-continued gönder
            const isUser1 = u1Id === userInfo.userId;
            const partnerProfile = isUser1 ? cm.user2.profile : cm.user1.profile;
            
            let userSocketId = socket.id;
            for (const [socketId, uInfo] of activeUsers.entries()) {
              if (uInfo.userId === userInfo.userId) {
                userSocketId = socketId;
                break;
              }
            }
            
            io.to(userSocketId).emit('match-continued', {
              matchId: matchId,
              partnerProfile: partnerProfile,
              message: 'Eşleşme onaylandı! Artık birbirinizin profillerini görebilirsiniz.'
            });
            console.log(`✅ match-continued gönderildi (completed match - userId ile bulundu): ${userSocketId}`);
            return;
          }
        }
      }
      
      if (!match) {
        console.log('❌ match-decision: Eşleşme bulunamadı', { 
          matchId, 
          userId: userInfo.userId,
          activeMatchesSize: activeMatches.size,
          completedMatchesSize: completedMatches.size,
          userMatchId: userInfo.matchId,
          activeMatchesKeys: Array.from(activeMatches.keys()),
          completedMatchesKeys: Array.from(completedMatches.keys())
        });
        socket.emit('error', { message: 'Eşleşme bulunamadı' });
        return;
      }
    }
    
    // Match activeMatches'te var, kullanıcının bu match'te olduğunu kontrol et
    const isUser1 = match.user1.userId === userInfo.userId;
    const isUser2 = match.user2.userId === userInfo.userId;
    
    if (!isUser1 && !isUser2) {
      console.log('❌ match-decision: Kullanıcı match\'te bulunamadı', { 
        userId: userInfo.userId, 
        matchUser1Id: match.user1.userId, 
        matchUser2Id: match.user2.userId 
      });
      socket.emit('error', { message: 'Eşleşmede kullanıcı bulunamadı' });
      return;
    }

    console.log(`✅ match-decision: ${isUser1 ? 'user1' : 'user2'} karar verdi: ${decision}`, { matchId, userId: userInfo.userId });
    if (isUser1) {
      match.user1Decision = decision;
      match.user1.socketId = socket.id; // Socket ID'yi güncelle
    } else {
      match.user2Decision = decision;
      match.user2.socketId = socket.id; // Socket ID'yi güncelle
    }
    
    console.log(`📊 match-decision durumu:`, { 
      matchId, 
      user1Decision: match.user1Decision, 
      user2Decision: match.user2Decision 
    });

    // Eğer kullanıcı "continue" dediyse, karşı tarafa bildir
    if (decision === 'continue') {
      // Partner'ın userId'sini bul
      const partnerUserId = isUser1 ? match.user2.userId : match.user1.userId;
      
      // Güncel socket ID'yi bul (userId ile)
      let partnerSocketId = null;
      for (const [socketId, userInfo] of activeUsers.entries()) {
        if (userInfo.userId === partnerUserId) {
          partnerSocketId = socketId;
          break;
        }
      }
      
      if (partnerSocketId) {
        console.log(`📤 partner-continued gönderiliyor: ${partnerSocketId} (userId: ${partnerUserId})`);
        io.to(partnerSocketId).emit('partner-continued', {
          matchId: matchId,
          message: 'Karşı taraf devam etmek istiyor, sizin kararınızı bekliyor...'
        });
      } else {
        console.log(`❌ partner socket bulunamadı: userId=${partnerUserId}`);
      }
    }

    // Her iki karar da alındı mı? (null check'i daha güvenli yap)
    const bothDecisionsReceived = match.user1Decision !== null && match.user2Decision !== null && 
                                  match.user1Decision !== undefined && match.user2Decision !== undefined;
    
    if (bothDecisionsReceived) {
      if (match.user1Decision === 'continue' && match.user2Decision === 'continue') {
        // Her iki kullanıcı da devam etmek istiyor - Profilleri göster
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

        // ÖNCE completedMatches'e ekle (match-decision handler'ında bulunabilmesi için)
        completedMatches.set(matchId, completedMatch);

        // Kullanıcıların eşleşme listelerine ekle
        if (!userMatches.has(match.user1.userId)) {
          userMatches.set(match.user1.userId, []);
        }
        if (!userMatches.has(match.user2.userId)) {
          userMatches.set(match.user2.userId, []);
        }
        userMatches.get(match.user1.userId).push(matchId);
        userMatches.get(match.user2.userId).push(matchId);
        await saveMatches(completedMatches, userMatches); // Hemen kaydet

        // Güncel socket ID'leri bul (userId ile)
        let user1SocketId = match.user1.socketId;
        let user2SocketId = match.user2.socketId;
        
        // activeUsers'dan güncel socket ID'leri bul
        for (const [socketId, userInfo] of activeUsers.entries()) {
          if (userInfo.userId === match.user1.userId) {
            user1SocketId = socketId;
          }
          if (userInfo.userId === match.user2.userId) {
            user2SocketId = socketId;
          }
        }

        console.log(`📤 match-continued gönderiliyor:`, {
          matchId,
          user1SocketId,
          user2SocketId,
          user1UserId: match.user1.userId,
          user2UserId: match.user2.userId
        });

        // Her iki kullanıcıya da match-continued event'ini gönder
        if (user1SocketId) {
          io.to(user1SocketId).emit('match-continued', {
            matchId: matchId,
            partnerProfile: user2Profile,
            message: 'Eşleşme onaylandı! Artık birbirinizin profillerini görebilirsiniz.'
          });
          console.log(`✅ user1'e match-continued gönderildi: ${user1SocketId}`);
        } else {
          console.log(`❌ user1 socket bulunamadı: ${match.user1.userId}`);
        }

        if (user2SocketId) {
          io.to(user2SocketId).emit('match-continued', {
            matchId: matchId,
            partnerProfile: user1Profile,
            message: 'Eşleşme onaylandı! Artık birbirinizin profillerini görebilirsiniz.'
          });
          console.log(`✅ user2'ye match-continued gönderildi: ${user2SocketId}`);
        } else {
          console.log(`❌ user2 socket bulunamadı: ${match.user2.userId}`);
        }

        // SONRA active match'i temizle (event'ler gönderildikten sonra)
        activeMatches.delete(matchId);
        
        // Kullanıcıların match durumunu güncelle (userId ile bul)
        for (const [socketId, userInfo] of activeUsers.entries()) {
          if (userInfo.userId === match.user1.userId || userInfo.userId === match.user2.userId) {
            userInfo.inMatch = false;
            userInfo.matchId = null;
          }
        }

        console.log(`✅✅✅ Eşleşme onaylandı: ${matchId}`);
      } else {
        // Biri veya ikisi de çıkmak istiyor
        console.log(`❌ Eşleşme sona erdi (birisi çıktı): ${matchId}`, {
          user1Decision: match.user1Decision,
          user2Decision: match.user2Decision
        });
        
        // Güncel socket ID'leri bul (userId ile)
        let user1SocketId = match.user1.socketId;
        let user2SocketId = match.user2.socketId;
        
        // activeUsers'dan güncel socket ID'leri bul
        for (const [socketId, userInfo] of activeUsers.entries()) {
          if (userInfo.userId === match.user1.userId) {
            user1SocketId = socketId;
          }
          if (userInfo.userId === match.user2.userId) {
            user2SocketId = socketId;
          }
        }
        
        if (user1SocketId) {
          io.to(user1SocketId).emit('match-ended', {
            matchId: matchId,
            message: 'Eşleşme sona erdi.'
          });
        }
        
        if (user2SocketId) {
          io.to(user2SocketId).emit('match-ended', {
            matchId: matchId,
            message: 'Eşleşme sona erdi.'
          });
        }

        // Active match'i temizle
        activeMatches.delete(matchId);
        
        // Eşleşmeyi temizle (userId ile bul)
        for (const [socketId, userInfo] of activeUsers.entries()) {
          if (userInfo.userId === match.user1.userId || userInfo.userId === match.user2.userId) {
            userInfo.inMatch = false;
            userInfo.matchId = null;
          }
        }

        console.log(`Eşleşme sona erdi: ${matchId}`);
      }
    } else {
      // Diğer kullanıcının kararını bekle
      socket.emit('decision-saved', { message: 'Kararınız kaydedildi, diğer kullanıcının kararını bekliyorsunuz...' });
    }
  });

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
      console.log(`✅ Mesaj partner'e gönderildi: ${partnerSocketId}`);
    } else {
      console.log('⚠️ Partner socketId yok, mesaj gönderilemedi. Partner offline olabilir.');
    }
    
    socket.emit('new-message', message); // Gönderen kişiye de mesajı gönder
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
  socket.on('disconnect', () => {
    const userInfo = activeUsers.get(socket.id);
    if (userInfo) {
      // Online durumunu güncelle
      const profile = users.get(userInfo.userId);
      if (profile) {
        profile.isOnline = false;
        profile.lastSeen = new Date();
        users.set(userInfo.userId, profile);
      }

      // Eşleşme kuyruğundan çıkar
      const queueIndex = matchingQueue.findIndex(u => u.socketId === socket.id);
      if (queueIndex !== -1) {
        matchingQueue.splice(queueIndex, 1);
      }

      // Aktif eşleşmeyi sonlandır
      if (userInfo.inMatch && userInfo.matchId) {
        const match = activeMatches.get(userInfo.matchId);
        if (match) {
          const partnerSocketId = match.user1.socketId === socket.id 
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
          activeMatches.delete(userInfo.matchId);
        }
      }

      activeUsers.delete(socket.id);
      console.log(`Kullanıcı bağlantısını kesti: ${socket.id}`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
  console.log(`Eşleşme sistemi aktif`);
});