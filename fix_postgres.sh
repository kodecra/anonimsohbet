#!/bin/bash

# PostgreSQL kullanıcı oluştur (şifrede ! karakteri yok)
sudo -u postgres psql <<'PSQL'
CREATE USER anonimsohbet_user WITH PASSWORD 'AnonimSohbet2024Secure';
GRANT ALL PRIVILEGES ON DATABASE anonimsohbet TO anonimsohbet_user;
\q
PSQL

# .env dosyasını güncelle
cd /var/www/anonimsohbet/server
sed -i "s|AnonimSohbet2024!Secure|AnonimSohbet2024Secure|g" .env

echo "✅ PostgreSQL kullanıcısı oluşturuldu ve .env güncellendi!"




