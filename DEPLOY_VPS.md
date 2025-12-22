# VPS Deploy Rehberi

## 1. VPS Sunucu Hazırlığı

### Gerekli Paketler
```bash
# Ubuntu/Debian için
sudo apt update
sudo apt install -y nodejs npm git nginx

# Node.js versiyonunu kontrol et (v18+ önerilir)
node --version
npm --version

# Eğer Node.js yoksa veya eski versiyondaysa:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Backend Kurulumu

```bash
# Projeyi klonla
cd /var/www
sudo git clone https://github.com/kodecra/anonimsohbet.git
cd anonimsohbet

# Backend dizinine git
cd server

# Bağımlılıkları yükle
npm install

# .env dosyası oluştur
nano .env
```

### .env dosyası içeriği:
```
PORT=5000
JWT_SECRET=your-secret-key-here-change-this
NODE_ENV=production
DATABASE_URL=  # PostgreSQL kullanıyorsanız, yoksa boş bırakın (JSON dosyası kullanılır)
```

### PM2 ile Backend'i Çalıştırma
```bash
# PM2'yi global olarak yükle
sudo npm install -g pm2

# Backend'i PM2 ile başlat
cd /var/www/anonimsohbet/server
pm2 start server.js --name "anonimsohbet-backend"

# PM2'yi sistem başlangıcında otomatik başlat
pm2 startup
pm2 save

# Logları kontrol et
pm2 logs anonimsohbet-backend
```

## 3. Frontend Build ve Deploy

```bash
# Frontend dizinine git
cd /var/www/anonimsohbet/client

# .env dosyası oluştur
nano .env
```

### Frontend .env içeriği:
```
REACT_APP_API_URL=https://your-domain.com
# veya IP kullanıyorsanız:
# REACT_APP_API_URL=http://your-server-ip:5000
```

```bash
# Bağımlılıkları yükle
npm install

# Production build oluştur
npm run build

# Build klasörünü web sunucusuna kopyala
sudo cp -r build/* /var/www/html/
# veya Nginx için:
sudo cp -r build/* /var/www/anonimsohbet-frontend/
```

## 4. Nginx Yapılandırması

```bash
sudo nano /etc/nginx/sites-available/anonimsohbet
```

### Nginx config içeriği:
```nginx
# Backend için reverse proxy
server {
    listen 80;
    server_name your-domain.com;

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

```bash
# Nginx config'i aktif et
sudo ln -s /etc/nginx/sites-available/anonimsohbet /etc/nginx/sites-enabled/

# Nginx config'i test et
sudo nginx -t

# Nginx'i yeniden başlat
sudo systemctl restart nginx
```

## 5. SSL Sertifikası (Let's Encrypt)

```bash
# Certbot yükle
sudo apt install -y certbot python3-certbot-nginx

# SSL sertifikası al
sudo certbot --nginx -d your-domain.com

# Otomatik yenileme test et
sudo certbot renew --dry-run
```

## 6. Firewall Ayarları

```bash
# UFW firewall aktif et
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## 7. Güncelleme Script'i

```bash
# Deploy script oluştur
nano /var/www/anonimsohbet/deploy.sh
```

### deploy.sh içeriği:
```bash
#!/bin/bash

echo "🚀 Deploy başlatılıyor..."

# Git'ten çek
cd /var/www/anonimsohbet
git pull origin main

# Backend'i yeniden başlat
cd server
npm install
pm2 restart anonimsohbet-backend

# Frontend build
cd ../client
npm install
npm run build

# Frontend dosyalarını kopyala
sudo cp -r build/* /var/www/html/

echo "✅ Deploy tamamlandı!"
```

```bash
# Script'e çalıştırma izni ver
chmod +x /var/www/anonimsohbet/deploy.sh
```

## 8. Log Kontrolü

```bash
# Backend logları
pm2 logs anonimsohbet-backend

# Nginx logları
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Sistem logları
sudo journalctl -u nginx -f
```

## 9. Hızlı Komutlar

```bash
# Backend'i yeniden başlat
pm2 restart anonimsohbet-backend

# Backend durumunu kontrol et
pm2 status

# Backend'i durdur
pm2 stop anonimsohbet-backend

# Backend'i başlat
pm2 start anonimsohbet-backend

# Deploy script'ini çalıştır
/var/www/anonimsohbet/deploy.sh
```

## 10. Sorun Giderme

### Backend çalışmıyor:
```bash
pm2 logs anonimsohbet-backend --lines 50
```

### Port 5000 kullanımda:
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
```

### Nginx çalışmıyor:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Frontend build hatası:
```bash
cd /var/www/anonimsohbet/client
rm -rf node_modules package-lock.json
npm install
npm run build
```

