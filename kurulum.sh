#!/bin/bash

echo "🚀 VPS Kurulum Başlatılıyor..."

# Sistem güncellemeleri
echo "📦 Sistem güncelleniyor..."
apt update && apt upgrade -y

# Gerekli paketler
echo "📦 Gerekli paketler yükleniyor..."
apt install -y curl wget git build-essential

# Node.js kurulumu
echo "📦 Node.js kuruluyor..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Node.js versiyonunu kontrol et
echo "✅ Node.js versiyonu:"
node --version
npm --version

# Nginx kurulumu
echo "📦 Nginx kuruluyor..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# PM2 kurulumu
echo "📦 PM2 kuruluyor..."
npm install -g pm2

# PostgreSQL kurulumu
echo "📦 PostgreSQL kuruluyor..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Firewall ayarları
echo "🔥 Firewall yapılandırılıyor..."
apt install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Projeyi klonla
echo "📥 Proje klonlanıyor..."
cd /var/www
git clone https://github.com/kodecra/anonimsohbet.git
cd anonimsohbet

# Backend kurulumu
echo "📦 Backend kuruluyor..."
cd server
npm install

# PostgreSQL veritabanı oluştur
echo "🗄️ PostgreSQL veritabanı oluşturuluyor..."
sudo -u postgres psql <<EOF
CREATE DATABASE anonimsohbet;
CREATE USER anonimsohbet_user WITH PASSWORD 'AnonimSohbet2024!Secure';
GRANT ALL PRIVILEGES ON DATABASE anonimsohbet TO anonimsohbet_user;
\q
EOF

# .env dosyası oluştur
echo "📝 .env dosyası oluşturuluyor..."
cat > .env <<EOF
PORT=5000
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
DATABASE_URL=postgresql://anonimsohbet_user:AnonimSohbet2024!Secure@localhost:5432/anonimsohbet
EOF

# Backend'i PM2 ile başlat
echo "🚀 Backend başlatılıyor..."
pm2 start server.js --name "anonimsohbet-backend"
pm2 startup
pm2 save

# Frontend kurulumu
echo "📦 Frontend kuruluyor..."
cd ../client
cat > .env <<EOF
REACT_APP_API_URL=http://72.62.146.220:5000
EOF

npm install
npm run build

# Frontend dosyalarını kopyala
echo "📁 Frontend dosyaları kopyalanıyor..."
cp -r build/* /var/www/html/

# Nginx config
echo "⚙️ Nginx yapılandırılıyor..."
cat > /etc/nginx/sites-available/anonimsohbet <<'NGINXEOF'
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
NGINXEOF

ln -s /etc/nginx/sites-available/anonimsohbet /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "✅ Kurulum tamamlandı!"
echo "🌐 Tarayıcınızda şu adresi açın: http://72.62.146.220"
echo "📊 Backend logları: pm2 logs anonimsohbet-backend"

