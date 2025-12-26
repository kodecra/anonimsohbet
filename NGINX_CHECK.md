# 🔍 Nginx Yapılandırma Kontrolü

## 1. Nginx Config Dosyasını Kontrol Et

```bash
# Tüm site config'lerini listele
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/

# Aktif config'i kontrol et
cat /etc/nginx/sites-available/default
# veya
cat /etc/nginx/sites-enabled/default

# Eğer soulbate.com için özel config varsa
cat /etc/nginx/sites-available/soulbate.com
```

## 2. Nginx Config Test Et

```bash
nginx -t
```

## 3. Nginx Error Loglarını Kontrol Et

```bash
# Son hataları göster
tail -50 /var/log/nginx/error.log

# Access log'u kontrol et
tail -50 /var/log/nginx/access.log
```

## 4. Port Kontrolü

```bash
# Port 80 ve 443 dinleniyor mu?
netstat -tulpn | grep nginx
# veya
ss -tulpn | grep nginx

# Firewall kontrolü
ufw status
iptables -L -n | grep 80
iptables -L -n | grep 443
```

## 5. Doğru Nginx Config Örneği

Nginx config dosyası şöyle olmalı:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name soulbate.com www.soulbate.com;

    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (backend için)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io proxy
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
}
```

## 6. Config'i Düzeltme

```bash
# Config dosyasını düzenle
nano /etc/nginx/sites-available/default
# veya
vi /etc/nginx/sites-available/default

# Değişiklikten sonra test et
nginx -t

# Test başarılıysa reload
systemctl reload nginx
# veya
nginx -s reload
```



## 1. Nginx Config Dosyasını Kontrol Et

```bash
# Tüm site config'lerini listele
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/

# Aktif config'i kontrol et
cat /etc/nginx/sites-available/default
# veya
cat /etc/nginx/sites-enabled/default

# Eğer soulbate.com için özel config varsa
cat /etc/nginx/sites-available/soulbate.com
```

## 2. Nginx Config Test Et

```bash
nginx -t
```

## 3. Nginx Error Loglarını Kontrol Et

```bash
# Son hataları göster
tail -50 /var/log/nginx/error.log

# Access log'u kontrol et
tail -50 /var/log/nginx/access.log
```

## 4. Port Kontrolü

```bash
# Port 80 ve 443 dinleniyor mu?
netstat -tulpn | grep nginx
# veya
ss -tulpn | grep nginx

# Firewall kontrolü
ufw status
iptables -L -n | grep 80
iptables -L -n | grep 443
```

## 5. Doğru Nginx Config Örneği

Nginx config dosyası şöyle olmalı:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name soulbate.com www.soulbate.com;

    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (backend için)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io proxy
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
}
```

## 6. Config'i Düzeltme

```bash
# Config dosyasını düzenle
nano /etc/nginx/sites-available/default
# veya
vi /etc/nginx/sites-available/default

# Değişiklikten sonra test et
nginx -t

# Test başarılıysa reload
systemctl reload nginx
# veya
nginx -s reload
```


