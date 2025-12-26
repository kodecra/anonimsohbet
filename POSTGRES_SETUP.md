# Render PostgreSQL Kurulum Rehberi

## 1. Render'da PostgreSQL Oluşturma

1. Render dashboard'da **"New"** → **"Postgres"** seçin
2. Ayarlar:
   - **Name:** `anonimsohbet-db`
   - **Database:** `anonimsohbet` (otomatik oluşturulur)
   - **User:** `anonimsohbet_user` (otomatik oluşturulur)
   - **Region:** Backend'inizle aynı region (örn: Frankfurt)
   - **PostgreSQL Version:** En son sürüm (varsayılan)
   - **Plan:** `Free` ✓
3. **"Create Database"** butonuna tıklayın
4. PostgreSQL oluşturulduktan sonra **"Connections"** sekmesinden bilgileri alın:
   - **Internal Database URL** (önemli! - backend ile aynı network'te)
   - **External Database URL** (opsiyonel - dış bağlantı için)

## 2. Backend'e Environment Variable Ekleme

Render dashboard'da backend servisinize (`anonimsohbet-backend`) gidin:

**Environment** sekmesine gidin ve ekleyin:
```
DATABASE_URL = [Internal Database URL'yi buraya yapıştırın]
```

**Örnek format:**
```
postgresql://anonimsohbet_user:password@dpg-xxxxx-a/anonimsohbet
```

## 3. Veritabanı Tabloları

Kod otomatik olarak tabloları oluşturacak, ama manuel oluşturmak isterseniz:

```sql
-- Users tablosu
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) NOT NULL,
  age INTEGER,
  bio TEXT,
  interests TEXT[],
  photos JSONB,
  verified BOOLEAN DEFAULT false,
  profile_views INTEGER DEFAULT 0,
  notification_settings JSONB,
  blocked_users TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auth tablosu
CREATE TABLE IF NOT EXISTS auth (
  email VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

-- Completed matches tablosu
CREATE TABLE IF NOT EXISTS completed_matches (
  match_id VARCHAR(255) PRIMARY KEY,
  user1_id VARCHAR(255) NOT NULL,
  user2_id VARCHAR(255) NOT NULL,
  messages JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  last_message_at TIMESTAMP
);

-- User matches (kullanıcıların eşleşme listesi)
CREATE TABLE IF NOT EXISTS user_matches (
  user_id VARCHAR(255),
  match_id VARCHAR(255),
  PRIMARY KEY (user_id, match_id)
);

-- Verifications tablosu
CREATE TABLE IF NOT EXISTS verifications (
  user_id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) DEFAULT 'pending',
  poses INTEGER[],
  pose_images JSONB,
  selfie_url TEXT,
  filename TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);
```

## 4. Test

Deploy tamamlandıktan sonra, backend loglarında şunu görmelisiniz:
```
✅ Database bağlantısı başarılı
✅ Tablolar oluşturuldu
```

## Önemli Notlar

- **Free tier limitleri:**
  - 90 gün kullanılmazsa silinir
  - 1 GB storage
  - Sınırlı connection sayısı
- **Internal URL kullanın:** Backend ile PostgreSQL aynı network'te olduğu için daha hızlı
- **Otomatik yedekleme:** Render PostgreSQL otomatik yedek alır

















