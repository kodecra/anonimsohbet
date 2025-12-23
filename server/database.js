const { Pool } = require('pg');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
    ? { rejectUnauthorized: false } 
    : false
});

// Veritabanı bağlantısını test et
pool.on('connect', () => {
  console.log('✅ Database bağlantısı başarılı');
});

pool.on('error', (err) => {
  console.error('❌ Database bağlantı hatası:', err);
});

// Tabloları oluştur
async function initDatabase() {
  try {
    // Users tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        gender VARCHAR(50),
        phone_number VARCHAR(20),
        birth_date DATE,
        age INTEGER,
        bio TEXT,
        interests TEXT[],
        photos JSONB DEFAULT '[]'::jsonb,
        verified BOOLEAN DEFAULT false,
        profile_views INTEGER DEFAULT 0,
        notification_settings JSONB DEFAULT '{}'::jsonb,
        blocked_users TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Eksik kolonları ekle (migration için)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymous_number VARCHAR(7);
    `);
    
    // Mevcut kullanıcılara anonim numarası ver (eğer yoksa)
    await pool.query(`
      UPDATE users 
      SET anonymous_number = LPAD(FLOOR(RANDOM() * 9000000 + 1000000)::TEXT, 7, '0')
      WHERE anonymous_number IS NULL OR anonymous_number = '';
    `);

    // Auth tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth (
        email VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL
      )
    `);

    // Completed matches tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS completed_matches (
        match_id VARCHAR(255) PRIMARY KEY,
        user1_id VARCHAR(255) NOT NULL,
        user2_id VARCHAR(255) NOT NULL,
        messages JSONB DEFAULT '[]'::jsonb,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        last_message_at TIMESTAMP
      )
    `);

    // User matches tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_matches (
        user_id VARCHAR(255),
        match_id VARCHAR(255),
        PRIMARY KEY (user_id, match_id)
      )
    `);

    // Verifications tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verifications (
        user_id VARCHAR(255) PRIMARY KEY,
        status VARCHAR(50) DEFAULT 'pending',
        poses INTEGER[],
        pose_images JSONB,
        selfie_url TEXT,
        filename TEXT,
        submitted_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Notifications tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        match_id VARCHAR(255),
        from_user_id VARCHAR(255),
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Index ekle
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
    `);

    // Complaints tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        complaint_id VARCHAR(255) PRIMARY KEY,
        reporter_id VARCHAR(255) NOT NULL,
        target_user_id VARCHAR(255) NOT NULL,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_complaints_reporter_id ON complaints(reporter_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_target_user_id ON complaints(target_user_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    `);

    // Active matches tablosu (anonim eşleşmeler - henüz tamamlanmamış)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS active_matches (
        match_id VARCHAR(255) PRIMARY KEY,
        user1_id VARCHAR(255) NOT NULL,
        user1_socket_id VARCHAR(255),
        user1_anonymous_id VARCHAR(20),
        user2_id VARCHAR(255) NOT NULL,
        user2_socket_id VARCHAR(255),
        user2_anonymous_id VARCHAR(20),
        user1_decision VARCHAR(20),
        user2_decision VARCHAR(20),
        timer_started BOOLEAN DEFAULT false,
        messages JSONB DEFAULT '[]'::jsonb,
        started_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_active_matches_user1 ON active_matches(user1_id);
      CREATE INDEX IF NOT EXISTS idx_active_matches_user2 ON active_matches(user2_id);
    `);

    // Follow requests tablosu (devam istekleri)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS follow_requests (
        request_id VARCHAR(255) PRIMARY KEY,
        match_id VARCHAR(255),
        from_user_id VARCHAR(255) NOT NULL,
        to_user_id VARCHAR(255) NOT NULL,
        from_socket_id VARCHAR(255),
        to_socket_id VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_follow_requests_from_user ON follow_requests(from_user_id);
      CREATE INDEX IF NOT EXISTS idx_follow_requests_to_user ON follow_requests(to_user_id);
      CREATE INDEX IF NOT EXISTS idx_follow_requests_status ON follow_requests(status);
      CREATE INDEX IF NOT EXISTS idx_follow_requests_match ON follow_requests(match_id);
    `);

    console.log('✅ Tablolar oluşturuldu/kontrol edildi');
  } catch (error) {
    console.error('❌ Tablo oluşturma hatası:', error);
    throw error;
  }
}

// Users Map'i veritabanına kaydet
async function saveUsers(usersMap) {
  if (!pool) return false;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Tüm kullanıcıları güncelle veya ekle
    for (const [userId, profile] of usersMap.entries()) {
      await client.query(`
        INSERT INTO users (
          user_id, email, username, first_name, last_name, gender, phone_number, birth_date, age, bio, interests, photos,
          verified, profile_views, notification_settings, blocked_users, anonymous_number,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (user_id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          gender = EXCLUDED.gender,
          phone_number = EXCLUDED.phone_number,
          birth_date = EXCLUDED.birth_date,
          age = EXCLUDED.age,
          bio = EXCLUDED.bio,
          interests = EXCLUDED.interests,
          photos = EXCLUDED.photos,
          verified = EXCLUDED.verified,
          profile_views = EXCLUDED.profile_views,
          notification_settings = EXCLUDED.notification_settings,
          blocked_users = EXCLUDED.blocked_users,
          anonymous_number = EXCLUDED.anonymous_number,
          updated_at = EXCLUDED.updated_at
      `, [
        userId,
        profile.email,
        profile.username,
        profile.firstName || null,
        profile.lastName || null,
        profile.gender || null,
        profile.phoneNumber || null,
        profile.birthDate ? new Date(profile.birthDate) : null,
        profile.age || null,
        profile.bio || null,
        profile.interests || [],
        JSON.stringify(profile.photos || []),
        profile.verified || false,
        profile.profileViews || 0,
        JSON.stringify(profile.notificationSettings || {}),
        profile.blockedUsers || [],
        profile.anonymousNumber || null,
        profile.createdAt ? new Date(profile.createdAt) : new Date(),
        new Date()
      ]);
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('saveUsers hatası:', error);
    return false;
  } finally {
    client.release();
  }
}

// Users Map'i veritabanından yükle
async function loadUsers() {
  if (!pool) return new Map();
  
  try {
    const result = await pool.query('SELECT * FROM users');
    const usersMap = new Map();
    
    for (const row of result.rows) {
      // Eğer anonim numarası yoksa otomatik oluştur (eski kullanıcılar için)
      let anonymousNumber = row.anonymous_number;
      if (!anonymousNumber) {
        anonymousNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
        // Veritabanına kaydet (async olarak)
        pool.query(
          'UPDATE users SET anonymous_number = $1 WHERE user_id = $2',
          [anonymousNumber, row.user_id]
        ).catch(err => console.error('Anonim numarası kaydedilemedi:', err));
      }
      
      usersMap.set(row.user_id, {
        userId: row.user_id,
        email: row.email,
        username: row.username,
        firstName: row.first_name || null,
        lastName: row.last_name || null,
        gender: row.gender || null,
        phoneNumber: row.phone_number || null,
        birthDate: row.birth_date ? row.birth_date.toISOString().split('T')[0] : null,
        age: row.age,
        bio: row.bio,
        interests: row.interests || [],
        photos: row.photos || [],
        verified: row.verified || false,
        profileViews: row.profile_views || 0,
        notificationSettings: row.notification_settings || {},
        blockedUsers: row.blocked_users || [],
        anonymousNumber: anonymousNumber,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }
    
    return usersMap;
  } catch (error) {
    console.error('loadUsers hatası:', error);
    return new Map();
  }
}

// Auth Map'i kaydet
async function saveAuth(authMap) {
  if (!pool) return false;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const [email, auth] of authMap.entries()) {
      await client.query(`
        INSERT INTO auth (email, user_id, password_hash)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          password_hash = EXCLUDED.password_hash
      `, [email.toLowerCase(), auth.userId, auth.passwordHash]);
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('saveAuth hatası:', error);
    return false;
  } finally {
    client.release();
  }
}

// Auth Map'i yükle
async function loadAuth() {
  if (!pool) return new Map();
  
  try {
    const result = await pool.query('SELECT * FROM auth');
    const authMap = new Map();
    
    for (const row of result.rows) {
      authMap.set(row.email.toLowerCase(), {
        userId: row.user_id,
        passwordHash: row.password_hash
      });
    }
    
    return authMap;
  } catch (error) {
    console.error('loadAuth hatası:', error);
    return new Map();
  }
}

// Matches kaydet
async function saveMatches(completedMatches, userMatches) {
  if (!pool) return false;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Completed matches
    for (const [matchId, match] of completedMatches.entries()) {
      const user1Id = match.user1?.userId || match.user1?.user?.userId || match.user1;
      const user2Id = match.user2?.userId || match.user2?.user?.userId || match.user2;
      
      await client.query(`
        INSERT INTO completed_matches (
          match_id, user1_id, user2_id, messages,
          started_at, completed_at, last_message_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (match_id) DO UPDATE SET
          messages = EXCLUDED.messages,
          last_message_at = EXCLUDED.last_message_at
      `, [
        matchId,
        user1Id,
        user2Id,
        JSON.stringify(match.messages || []),
        match.startedAt ? new Date(match.startedAt) : new Date(),
        match.completedAt ? new Date(match.completedAt) : null,
        match.lastMessageAt ? new Date(match.lastMessageAt) : null
      ]);
    }
    
    // User matches - sadece ekle (DELETE yapmıyoruz, race condition'ı önlemek için)
    // Her kullanıcı için tüm matchId'leri ekle
    for (const [userId, matchIds] of userMatches.entries()) {
      for (const matchId of matchIds) {
        await client.query(`
          INSERT INTO user_matches (user_id, match_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [userId, matchId]);
      }
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('saveMatches hatası:', error);
    return false;
  } finally {
    client.release();
  }
}

// Sadece yeni bir eşleşmeyi ekle (race condition'ı önlemek için)
async function addUserMatch(userId, matchId) {
  if (!pool) return false;
  
  try {
    await pool.query(`
      INSERT INTO user_matches (user_id, match_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [userId, matchId]);
    return true;
  } catch (error) {
    console.error('addUserMatch hatası:', error);
    return false;
  }
}

// Matches yükle
async function loadMatches() {
  if (!pool) {
    return { completedMatches: new Map(), userMatches: new Map() };
  }
  
  try {
    // Completed matches - tek query ile optimize edildi
    const matchesResult = await pool.query('SELECT * FROM completed_matches');
    const completedMatches = new Map();
    
    // Tüm user ID'leri topla
    const userIds = new Set();
    for (const row of matchesResult.rows) {
      userIds.add(row.user1_id);
      userIds.add(row.user2_id);
    }
    
    // Tüm profilleri tek seferde çek
    const userIdsArray = Array.from(userIds);
    const profilesMap = new Map();
    if (userIdsArray.length > 0) {
      const profilesResult = await pool.query(
        `SELECT user_id, email, username, age, bio, interests, photos, verified FROM users WHERE user_id = ANY($1::varchar[])`,
        [userIdsArray]
      );
      for (const profile of profilesResult.rows) {
        profilesMap.set(profile.user_id, {
          userId: profile.user_id,
          email: profile.email,
          username: profile.username,
          age: profile.age,
          bio: profile.bio,
          interests: profile.interests || [],
          photos: profile.photos || [],
          verified: profile.verified || false
        });
      }
    }
    
    // Matches'leri oluştur
    for (const row of matchesResult.rows) {
      completedMatches.set(row.match_id, {
        id: row.match_id,
        user1: {
          userId: row.user1_id,
          profile: profilesMap.get(row.user1_id) || null
        },
        user2: {
          userId: row.user2_id,
          profile: profilesMap.get(row.user2_id) || null
        },
        messages: row.messages || [],
        startedAt: row.started_at,
        completedAt: row.completed_at,
        lastMessageAt: row.last_message_at
      });
    }
    
    // User matches
    const userMatchesResult = await pool.query('SELECT * FROM user_matches');
    const userMatches = new Map();
    
    for (const row of userMatchesResult.rows) {
      if (!userMatches.has(row.user_id)) {
        userMatches.set(row.user_id, []);
      }
      userMatches.get(row.user_id).push(row.match_id);
    }
    
    return { completedMatches, userMatches };
  } catch (error) {
    console.error('loadMatches hatası:', error);
    return { completedMatches: new Map(), userMatches: new Map() };
  }
}

// Verifications kaydet
async function saveVerifications(verificationsMap) {
  if (!pool) return false;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const [userId, verification] of verificationsMap.entries()) {
      await client.query(`
        INSERT INTO verifications (
          user_id, status, poses, pose_images, selfie_url, filename, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          status = EXCLUDED.status,
          poses = EXCLUDED.poses,
          pose_images = EXCLUDED.pose_images,
          selfie_url = EXCLUDED.selfie_url,
          filename = EXCLUDED.filename,
          submitted_at = EXCLUDED.submitted_at
      `, [
        userId,
        verification.status || 'pending',
        verification.poses || null,
        verification.poseImages ? JSON.stringify(verification.poseImages) : null,
        verification.selfieUrl || null,
        verification.filename || null,
        verification.submittedAt ? new Date(verification.submittedAt) : new Date()
      ]);
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('saveVerifications hatası:', error);
    return false;
  } finally {
    client.release();
  }
}

// Verifications yükle
async function loadVerifications() {
  if (!pool) return new Map();
  
  try {
    const result = await pool.query('SELECT * FROM verifications');
    const verificationsMap = new Map();
    
    for (const row of result.rows) {
      verificationsMap.set(row.user_id, {
        userId: row.user_id,
        status: row.status,
        poses: row.poses || [],
        poseImages: row.pose_images || [],
        selfieUrl: row.selfie_url,
        filename: row.filename,
        submittedAt: row.submitted_at
      });
    }
    
    return verificationsMap;
  } catch (error) {
    console.error('loadVerifications hatası:', error);
    return new Map();
  }
}

// Bildirim kaydetme
async function saveNotification(notification) {
  try {
    const { notificationId, userId, type, title, message, matchId, fromUserId } = notification;
    await pool.query(
      `INSERT INTO notifications (notification_id, user_id, type, title, message, match_id, from_user_id, read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (notification_id) DO UPDATE SET
         read = EXCLUDED.read`,
      [notificationId, userId, type, title, message, matchId || null, fromUserId || null, false]
    );
  } catch (error) {
    console.error('❌ Bildirim kaydetme hatası:', error);
    throw error;
  }
}

// Kullanıcının bildirimlerini yükle
async function loadNotifications(userId) {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [userId]
    );
    return result.rows.map(row => ({
      id: row.notification_id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      matchId: row.match_id,
      fromUserId: row.from_user_id,
      read: row.read,
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error('❌ Bildirim yükleme hatası:', error);
    return [];
  }
}

// Bildirimi okundu olarak işaretle
async function markNotificationAsRead(notificationId, userId) {
  try {
    await pool.query(
      `UPDATE notifications SET read = true 
       WHERE notification_id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  } catch (error) {
    console.error('❌ Bildirim okundu işaretleme hatası:', error);
    throw error;
  }
}

// Okunmamış bildirim sayısı
async function getUnreadNotificationCount(userId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = $1 AND read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    console.error('❌ Okunmamış bildirim sayısı hatası:', error);
    return 0;
  }
}

// Şikayet kaydetme
async function saveComplaint(complaint) {
  try {
    const { complaintId, reporterId, targetUserId, reason, status = 'pending' } = complaint;
    await pool.query(
      `INSERT INTO complaints (complaint_id, reporter_id, target_user_id, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (complaint_id) DO UPDATE SET
         status = EXCLUDED.status`,
      [complaintId, reporterId, targetUserId, reason, status]
    );
  } catch (error) {
    console.error('❌ Şikayet kaydetme hatası:', error);
    throw error;
  }
}

// Şikayetleri yükle
async function loadComplaints(status = null) {
  try {
    let query = `SELECT c.*, 
                        r.username as reporter_username, r.email as reporter_email,
                        t.username as target_username, t.email as target_email
                 FROM complaints c
                 LEFT JOIN users r ON c.reporter_id = r.user_id
                 LEFT JOIN users t ON c.target_user_id = t.user_id`;
    const params = [];
    
    if (status) {
      query += ' WHERE c.status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      complaintId: row.complaint_id,
      reporterId: row.reporter_id,
      reporterUsername: row.reporter_username,
      reporterEmail: row.reporter_email,
      targetUserId: row.target_user_id,
      targetUsername: row.target_username,
      targetEmail: row.target_email,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error('❌ Şikayet yükleme hatası:', error);
    return [];
  }
}

// ============== ACTIVE MATCHES (Anonim Eşleşmeler) ==============

// Aktif eşleşme kaydet
async function saveActiveMatch(matchId, match) {
  if (!pool) return false;
  
  try {
    const user1Id = match.user1?.userId || match.user1;
    const user2Id = match.user2?.userId || match.user2;
    
    await pool.query(`
      INSERT INTO active_matches (
        match_id, user1_id, user1_socket_id, user1_anonymous_id,
        user2_id, user2_socket_id, user2_anonymous_id,
        user1_decision, user2_decision, timer_started, messages, started_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (match_id) DO UPDATE SET
        user1_socket_id = EXCLUDED.user1_socket_id,
        user2_socket_id = EXCLUDED.user2_socket_id,
        user1_decision = EXCLUDED.user1_decision,
        user2_decision = EXCLUDED.user2_decision,
        timer_started = EXCLUDED.timer_started,
        messages = EXCLUDED.messages,
        updated_at = NOW()
    `, [
      matchId,
      user1Id,
      match.user1?.socketId || null,
      match.user1?.anonymousId || null,
      user2Id,
      match.user2?.socketId || null,
      match.user2?.anonymousId || null,
      match.user1Decision || null,
      match.user2Decision || null,
      match.timerStarted || false,
      JSON.stringify(match.messages || []),
      match.startedAt ? new Date(match.startedAt) : new Date()
    ]);
    return true;
  } catch (error) {
    console.error('saveActiveMatch hatası:', error);
    return false;
  }
}

// Tüm aktif eşleşmeleri yükle
async function loadActiveMatches() {
  if (!pool) return new Map();
  
  try {
    const result = await pool.query('SELECT * FROM active_matches');
    const activeMatchesMap = new Map();
    
    for (const row of result.rows) {
      activeMatchesMap.set(row.match_id, {
        id: row.match_id,
        user1: {
          userId: row.user1_id,
          socketId: row.user1_socket_id,
          anonymousId: row.user1_anonymous_id
        },
        user2: {
          userId: row.user2_id,
          socketId: row.user2_socket_id,
          anonymousId: row.user2_anonymous_id
        },
        user1Decision: row.user1_decision,
        user2Decision: row.user2_decision,
        timerStarted: row.timer_started,
        messages: row.messages || [],
        startedAt: row.started_at,
        updatedAt: row.updated_at
      });
    }
    
    console.log(`✅ ${activeMatchesMap.size} aktif eşleşme yüklendi`);
    return activeMatchesMap;
  } catch (error) {
    console.error('loadActiveMatches hatası:', error);
    return new Map();
  }
}

// Aktif eşleşme sil
async function deleteActiveMatch(matchId) {
  if (!pool) return false;
  
  try {
    await pool.query('DELETE FROM active_matches WHERE match_id = $1', [matchId]);
    return true;
  } catch (error) {
    console.error('deleteActiveMatch hatası:', error);
    return false;
  }
}

// ============== FOLLOW REQUESTS (Devam İstekleri) ==============

// Follow request kaydet
async function saveFollowRequest(requestId, request) {
  if (!pool) return false;
  
  try {
    await pool.query(`
      INSERT INTO follow_requests (
        request_id, match_id, from_user_id, to_user_id,
        from_socket_id, to_socket_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (request_id) DO UPDATE SET
        from_socket_id = EXCLUDED.from_socket_id,
        to_socket_id = EXCLUDED.to_socket_id,
        status = EXCLUDED.status
    `, [
      requestId,
      request.matchId || null,
      request.fromUserId,
      request.toUserId,
      request.fromSocketId || null,
      request.toSocketId || null,
      request.status || 'pending',
      request.createdAt ? new Date(request.createdAt) : new Date()
    ]);
    return true;
  } catch (error) {
    console.error('saveFollowRequest hatası:', error);
    return false;
  }
}

// Tüm follow requests yükle
async function loadFollowRequests() {
  if (!pool) return new Map();
  
  try {
    const result = await pool.query('SELECT * FROM follow_requests');
    const followRequestsMap = new Map();
    
    for (const row of result.rows) {
      followRequestsMap.set(row.request_id, {
        matchId: row.match_id,
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        fromSocketId: row.from_socket_id,
        toSocketId: row.to_socket_id,
        status: row.status,
        createdAt: row.created_at
      });
    }
    
    console.log(`✅ ${followRequestsMap.size} follow request yüklendi`);
    return followRequestsMap;
  } catch (error) {
    console.error('loadFollowRequests hatası:', error);
    return new Map();
  }
}

// Follow request sil
async function deleteFollowRequest(requestId) {
  if (!pool) return false;
  
  try {
    await pool.query('DELETE FROM follow_requests WHERE request_id = $1', [requestId]);
    return true;
  } catch (error) {
    console.error('deleteFollowRequest hatası:', error);
    return false;
  }
}

// Follow request güncelle
async function updateFollowRequestStatus(requestId, status) {
  if (!pool) return false;
  
  try {
    await pool.query(
      'UPDATE follow_requests SET status = $1 WHERE request_id = $2',
      [status, requestId]
    );
    return true;
  } catch (error) {
    console.error('updateFollowRequestStatus hatası:', error);
    return false;
  }
}

module.exports = {
  pool,
  initDatabase,
  saveUsers,
  loadUsers,
  saveAuth,
  loadAuth,
  saveMatches,
  loadMatches,
  saveVerifications,
  loadVerifications,
  addUserMatch,
  saveNotification,
  loadNotifications,
  markNotificationAsRead,
  getUnreadNotificationCount,
  saveComplaint,
  loadComplaints,
  // Yeni eklenenler
  saveActiveMatch,
  loadActiveMatches,
  deleteActiveMatch,
  saveFollowRequest,
  loadFollowRequests,
  deleteFollowRequest,
  updateFollowRequestStatus
};

