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



