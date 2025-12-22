# SSH Bağlantı ve İlk Kurulum

## 1. SSH ile Bağlanma

Terminal'inizde şu komutu çalıştırın:

```bash
ssh root@72.62.146.220
```

İlk bağlantıda şu mesajı göreceksiniz:
```
The authenticity of host '72.62.146.220' can't be established.
Are you sure you want to continue connecting (yes/no)?
```

**"yes" yazın ve Enter'a basın.**

Sonra root şifrenizi girin (VPS kurulumunda belirlediğiniz şifre).

## 2. İlk Bağlantı Sonrası Kontroller

Bağlandıktan sonra şu komutları çalıştırın:

```bash
# Sistem bilgilerini kontrol et
uname -a

# Disk kullanımını kontrol et
df -h

# RAM kullanımını kontrol et
free -h

# Ubuntu versiyonunu kontrol et
lsb_release -a
```

## 3. Sistem Güncellemeleri

```bash
# Sistem güncellemelerini yap
apt update && apt upgrade -y

# Gerekli paketleri yükle
apt install -y curl wget git build-essential
```

## 4. Node.js Kurulumu

```bash
# Node.js 18.x kurulumu
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Versiyonları kontrol et
node --version
npm --version
```

## 5. Nginx Kurulumu

```bash
# Nginx'i yükle
apt install -y nginx

# Nginx'i başlat ve otomatik başlatmayı etkinleştir
systemctl start nginx
systemctl enable nginx

# Durumu kontrol et
systemctl status nginx
```

## 6. PM2 Kurulumu

```bash
# PM2'yi global olarak yükle
npm install -g pm2

# PM2 versiyonunu kontrol et
pm2 --version
```

## 7. PostgreSQL Kurulumu

```bash
# PostgreSQL'i yükle
apt install -y postgresql postgresql-contrib

# PostgreSQL'i başlat ve otomatik başlatmayı etkinleştir
systemctl start postgresql
systemctl enable postgresql

# Durumu kontrol et
systemctl status postgresql
```

## 8. Firewall Ayarları

```bash
# UFW firewall'u yükle
apt install -y ufw

# Portları aç
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# Firewall'u aktif et
ufw enable

# Durumu kontrol et
ufw status
```

## 9. Projeyi Klonlama

```bash
# /var/www dizinine git
cd /var/www

# Projeyi klonla
git clone https://github.com/kodecra/anonimsohbet.git

# Dizine gir
cd anonimsohbet
```

## 10. Backend Kurulumu

```bash
# Backend dizinine git
cd server

# Bağımlılıkları yükle
npm install

# .env dosyası oluştur
nano .env
```

`.env` dosyasına şunu ekleyin (PostgreSQL şifresini kendi şifrenizle değiştirin):
```
PORT=5000
JWT_SECRET=your-secret-key-here-change-this-to-random-string
NODE_ENV=production
DATABASE_URL=postgresql://anonimsohbet_user:your-password@localhost:5432/anonimsohbet
```

**Ctrl+X, sonra Y, sonra Enter** ile kaydedin.

## 11. PostgreSQL Veritabanı Oluşturma

```bash
# PostgreSQL'e bağlan
sudo -u postgres psql

# Veritabanı ve kullanıcı oluştur
CREATE DATABASE anonimsohbet;
CREATE USER anonimsohbet_user WITH PASSWORD 'your-password-here';
GRANT ALL PRIVILEGES ON DATABASE anonimsohbet TO anonimsohbet_user;
\q
```

**ÖNEMLİ:** `your-password-here` kısmını güçlü bir şifreyle değiştirin ve `.env` dosyasındaki şifreyle aynı olmalı!

## 12. Backend'i PM2 ile Başlatma

```bash
# Backend dizininde
cd /var/www/anonimsohbet/server

# PM2 ile başlat
pm2 start server.js --name "anonimsohbet-backend"

# PM2'yi sistem başlangıcında otomatik başlat
pm2 startup
pm2 save

# Logları kontrol et
pm2 logs anonimsohbet-backend
```

## 13. Frontend Build

```bash
# Frontend dizinine git
cd /var/www/anonimsohbet/client

# .env dosyası oluştur
nano .env
```

`.env` dosyasına şunu ekleyin:
```
REACT_APP_API_URL=http://72.62.146.220:5000
```

**Ctrl+X, sonra Y, sonra Enter** ile kaydedin.

```bash
# Bağımlılıkları yükle
npm install

# Production build oluştur
npm run build

# Build dosyalarını web sunucusuna kopyala
cp -r build/* /var/www/html/
```

## 14. Nginx Yapılandırması

```bash
# Nginx config dosyası oluştur
nano /etc/nginx/sites-available/anonimsohbet
```

Şu içeriği ekleyin:

```nginx
server {
    listen 80;
    server_name 72.62.146.220;

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io için
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend static files
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    # Static dosyalar için cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        root /var/www/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Ctrl+X, sonra Y, sonra Enter** ile kaydedin.

```bash
# Config'i aktif et
ln -s /etc/nginx/sites-available/anonimsohbet /etc/nginx/sites-enabled/

# Default config'i devre dışı bırak (opsiyonel)
rm /etc/nginx/sites-enabled/default

# Nginx config'i test et
nginx -t

# Nginx'i yeniden başlat
systemctl restart nginx
```

## 15. Test

Tarayıcınızda şu adresi açın:
```
http://72.62.146.220
```

Backend API test:
```
http://72.62.146.220/api/health
```

## 16. Log Kontrolü

```bash
# Backend logları
pm2 logs anonimsohbet-backend

# Nginx logları
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

## Sorun Giderme

### Backend çalışmıyor:
```bash
pm2 logs anonimsohbet-backend --lines 50
pm2 restart anonimsohbet-backend
```

### Nginx çalışmıyor:
```bash
systemctl status nginx
nginx -t
```

### Port 5000 kullanımda:
```bash
lsof -i :5000
kill -9 <PID>
```

### PostgreSQL bağlanamıyor:
```bash
systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```


