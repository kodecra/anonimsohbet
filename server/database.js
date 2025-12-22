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
          verified, profile_views, notification_settings, blocked_users,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
    
    // User matches - önce temizle
    await client.query('DELETE FROM user_matches');
    
    // Sonra ekle
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
  loadVerifications
};

