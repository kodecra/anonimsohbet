# PostgreSQL Kurulum Rehberi (Ubuntu 22.04)

## 1. PostgreSQL Kurulumu

```bash
# PostgreSQL'i yükle
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# PostgreSQL versiyonunu kontrol et
psql --version

# PostgreSQL servisini başlat
sudo systemctl start postgresql
sudo systemctl enable postgresql

# PostgreSQL durumunu kontrol et
sudo systemctl status postgresql
```

## 2. PostgreSQL Veritabanı ve Kullanıcı Oluşturma

```bash
# PostgreSQL'e postgres kullanıcısı ile bağlan
sudo -u postgres psql

# Veritabanı oluştur
CREATE DATABASE anonimsohbet;

# Kullanıcı oluştur ve şifre belirle
CREATE USER anonimsohbet_user WITH PASSWORD 'güvenli-şifre-buraya';

# Kullanıcıya veritabanı yetkisi ver
GRANT ALL PRIVILEGES ON DATABASE anonimsohbet TO anonimsohbet_user;

# PostgreSQL'den çık
\q
```

## 3. PostgreSQL Bağlantı Ayarları

```bash
# PostgreSQL config dosyasını düzenle
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Şu satırı bulun ve değiştirin:
```
#listen_addresses = 'localhost'
```
Şu şekilde değiştirin:
```
listen_addresses = 'localhost'
```

```bash
# pg_hba.conf dosyasını düzenle
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Dosyanın sonuna şunu ekleyin:
```
# Local connections
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

```bash
# PostgreSQL'i yeniden başlat
sudo systemctl restart postgresql
```

## 4. Backend .env Dosyasını Güncelle

```bash
cd /var/www/anonimsohbet/server
nano .env
```

`.env` dosyasına şunu ekleyin:
```
DATABASE_URL=postgresql://anonimsohbet_user:güvenli-şifre-buraya@localhost:5432/anonimsohbet
PORT=5000
JWT_SECRET=your-secret-key-here-change-this
NODE_ENV=production
```

**ÖNEMLİ:** `güvenli-şifre-buraya` kısmını kendi şifrenizle değiştirin!

## 5. PostgreSQL Bağlantısını Test Et

```bash
# PostgreSQL'e bağlanmayı test et
psql -U anonimsohbet_user -d anonimsohbet -h localhost

# Bağlantı başarılıysa şunu göreceksiniz:
# anonimsohbet=>

# Çıkmak için:
\q
```

## 6. Backend'i Yeniden Başlat

```bash
# PM2 ile backend'i yeniden başlat
pm2 restart anonimsohbet-backend

# Logları kontrol et
pm2 logs anonimsohbet-backend
```

## 7. Veritabanı Tablolarını Oluşturma

Backend ilk çalıştığında otomatik olarak tabloları oluşturacaktır. Eğer manuel kontrol etmek isterseniz:

```bash
# PostgreSQL'e bağlan
sudo -u postgres psql anonimsohbet

# Tabloları listele
\dt

# Çık
\q
```

## 8. PostgreSQL Yedekleme

```bash
# Veritabanını yedekle
sudo -u postgres pg_dump anonimsohbet > /var/backups/anonimsohbet_$(date +%Y%m%d).sql

# Yedekten geri yükle
sudo -u postgres psql anonimsohbet < /var/backups/anonimsohbet_20241222.sql
```

## 9. PostgreSQL Performans Ayarları (Opsiyonel)

8GB RAM için önerilen ayarlar:

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Şu satırları bulun ve değiştirin:
```
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB
```

```bash
# PostgreSQL'i yeniden başlat
sudo systemctl restart postgresql
```

## 10. PostgreSQL Log Kontrolü

```bash
# PostgreSQL loglarını görüntüle
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Hata logları
sudo grep ERROR /var/log/postgresql/postgresql-14-main.log
```

## 11. Güvenlik İpuçları

1. **Güçlü şifre kullanın**: PostgreSQL kullanıcı şifresi güçlü olmalı
2. **Firewall**: PostgreSQL sadece localhost'tan erişilebilir olmalı
3. **Düzenli yedekleme**: Otomatik yedekleme script'i oluşturun
4. **Güncellemeler**: Düzenli olarak PostgreSQL'i güncelleyin

## 12. Sorun Giderme

### PostgreSQL bağlanamıyor:
```bash
sudo systemctl status postgresql
sudo journalctl -u postgresql -n 50
```

### Port 5432 kullanımda:
```bash
sudo lsof -i :5432
```

### Şifre hatası:
```bash
# Şifreyi sıfırla
sudo -u postgres psql
ALTER USER anonimsohbet_user WITH PASSWORD 'yeni-şifre';
\q
```

## 13. Otomatik Yedekleme Script'i

```bash
# Yedekleme script'i oluştur
nano /var/www/anonimsohbet/backup-db.sh
```

Script içeriği:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups"
DATE=$(date +%Y%m%d_%H%M%S)
sudo -u postgres pg_dump anonimsohbet > $BACKUP_DIR/anonimsohbet_$DATE.sql
# Eski yedekleri sil (7 günden eski)
find $BACKUP_DIR -name "anonimsohbet_*.sql" -mtime +7 -delete
```

```bash
# Script'e çalıştırma izni ver
chmod +x /var/www/anonimsohbet/backup-db.sh

# Crontab'a ekle (her gün saat 02:00'de yedekle)
crontab -e
# Şunu ekle:
0 2 * * * /var/www/anonimsohbet/backup-db.sh
```

## 14. PostgreSQL Versiyon Kontrolü

```bash
# PostgreSQL versiyonunu kontrol et
sudo -u postgres psql -c "SELECT version();"
```

## Özet

✅ PostgreSQL kurulumu tamamlandı
✅ Veritabanı ve kullanıcı oluşturuldu
✅ Backend .env dosyası güncellendi
✅ Backend yeniden başlatıldı
✅ Veritabanı bağlantısı test edildi

Artık backend PostgreSQL kullanarak çalışacak! 🎉




