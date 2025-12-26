#!/bin/bash

echo "========================================"
echo "🔍 NGINX CONFIG KONTROLÜ"
echo "========================================"
echo ""

# 1. Tüm config dosyalarını listele
echo "[1/4] Mevcut config dosyaları:"
echo "sites-available:"
ls -la /etc/nginx/sites-available/
echo ""
echo "sites-enabled:"
ls -la /etc/nginx/sites-enabled/
echo ""

# 2. Nginx ana config'i kontrol et
echo "[2/4] Nginx ana config:"
cat /etc/nginx/nginx.conf | grep -E "include|sites"
echo ""

# 3. Aktif config dosyasını bul
echo "[3/4] Aktif config dosyası:"
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "✅ /etc/nginx/sites-enabled/default bulundu"
    cat /etc/nginx/sites-enabled/default
elif [ -f "/etc/nginx/conf.d/default.conf" ]; then
    echo "✅ /etc/nginx/conf.d/default.conf bulundu"
    cat /etc/nginx/conf.d/default.conf
else
    echo "⚠️ Default config bulunamadı, tüm config'leri kontrol ediliyor..."
    find /etc/nginx -name "*.conf" -type f
fi
echo ""

# 4. Nginx test
echo "[4/4] Nginx config test:"
nginx -t

echo ""
echo "========================================"
echo "✅ Kontrol tamamlandı!"
echo "========================================"



echo "========================================"
echo "🔍 NGINX CONFIG KONTROLÜ"
echo "========================================"
echo ""

# 1. Tüm config dosyalarını listele
echo "[1/4] Mevcut config dosyaları:"
echo "sites-available:"
ls -la /etc/nginx/sites-available/
echo ""
echo "sites-enabled:"
ls -la /etc/nginx/sites-enabled/
echo ""

# 2. Nginx ana config'i kontrol et
echo "[2/4] Nginx ana config:"
cat /etc/nginx/nginx.conf | grep -E "include|sites"
echo ""

# 3. Aktif config dosyasını bul
echo "[3/4] Aktif config dosyası:"
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "✅ /etc/nginx/sites-enabled/default bulundu"
    cat /etc/nginx/sites-enabled/default
elif [ -f "/etc/nginx/conf.d/default.conf" ]; then
    echo "✅ /etc/nginx/conf.d/default.conf bulundu"
    cat /etc/nginx/conf.d/default.conf
else
    echo "⚠️ Default config bulunamadı, tüm config'leri kontrol ediliyor..."
    find /etc/nginx -name "*.conf" -type f
fi
echo ""

# 4. Nginx test
echo "[4/4] Nginx config test:"
nginx -t

echo ""
echo "========================================"
echo "✅ Kontrol tamamlandı!"
echo "========================================"


