# 🔍 VPS Kontrol Komutları

## Hızlı Kontrol

SSH ile VPS'e bağlanıp şu komutları çalıştırın:

```bash
ssh root@72.62.146.220
```

## 1. Web Sunucusu Durumu

```bash
# Nginx kontrolü
systemctl status nginx
# veya
service nginx status

# Apache kontrolü
systemctl status apache2
# veya
service apache2 status

# Eğer çalışmıyorsa başlat
systemctl start nginx
# veya
systemctl start apache2
```

## 2. Port Kontrolü

```bash
# Port 80 ve 443 açık mı?
netstat -tulpn | grep :80
netstat -tulpn | grep :443

# veya
ss -tulpn | grep :80
ss -tulpn | grep :443

# Firewall kontrolü
ufw status
# veya
iptables -L -n
```

## 3. Site Dosyaları Kontrolü

```bash
# Dosyalar var mı?
ls -la /var/www/html/

# İzinler doğru mu?
ls -la /var/www/html/ | head -5
```

## 4. Web Sunucusu Yapılandırması

### Nginx için:
```bash
# Nginx config dosyasını kontrol et
cat /etc/nginx/sites-available/default
# veya
cat /etc/nginx/conf.d/soulbate.com.conf

# Nginx config test
nginx -t

# Nginx restart
systemctl restart nginx
```

### Apache için:
```bash
# Apache config kontrol
cat /etc/apache2/sites-available/000-default.conf

# Apache config test
apache2ctl configtest

# Apache restart
systemctl restart apache2
```

## 5. PM2 Backend Kontrolü

```bash
# PM2 durumu
pm2 list

# PM2 logları
pm2 logs anonimso --lines 50

# Backend çalışıyor mu?
curl http://localhost:5000/api/health
```

## 6. Hızlı Çözüm Komutları

```bash
# Tüm servisleri restart et
systemctl restart nginx
pm2 restart anonimso

# Dosyaları kontrol et ve kopyala
cd /var/www/anonimsohbet/client
npm run build
rm -rf /var/www/html/*
cp -r build/* /var/www/html/
chown -R www-data:www-data /var/www/html/
chmod -R 755 /var/www/html/
```

## 7. Firewall Portlarını Aç

```bash
# UFW kullanıyorsanız
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

# iptables kullanıyorsanız
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables-save
```



## Hızlı Kontrol

SSH ile VPS'e bağlanıp şu komutları çalıştırın:

```bash
ssh root@72.62.146.220
```

## 1. Web Sunucusu Durumu

```bash
# Nginx kontrolü
systemctl status nginx
# veya
service nginx status

# Apache kontrolü
systemctl status apache2
# veya
service apache2 status

# Eğer çalışmıyorsa başlat
systemctl start nginx
# veya
systemctl start apache2
```

## 2. Port Kontrolü

```bash
# Port 80 ve 443 açık mı?
netstat -tulpn | grep :80
netstat -tulpn | grep :443

# veya
ss -tulpn | grep :80
ss -tulpn | grep :443

# Firewall kontrolü
ufw status
# veya
iptables -L -n
```

## 3. Site Dosyaları Kontrolü

```bash
# Dosyalar var mı?
ls -la /var/www/html/

# İzinler doğru mu?
ls -la /var/www/html/ | head -5
```

## 4. Web Sunucusu Yapılandırması

### Nginx için:
```bash
# Nginx config dosyasını kontrol et
cat /etc/nginx/sites-available/default
# veya
cat /etc/nginx/conf.d/soulbate.com.conf

# Nginx config test
nginx -t

# Nginx restart
systemctl restart nginx
```

### Apache için:
```bash
# Apache config kontrol
cat /etc/apache2/sites-available/000-default.conf

# Apache config test
apache2ctl configtest

# Apache restart
systemctl restart apache2
```

## 5. PM2 Backend Kontrolü

```bash
# PM2 durumu
pm2 list

# PM2 logları
pm2 logs anonimso --lines 50

# Backend çalışıyor mu?
curl http://localhost:5000/api/health
```

## 6. Hızlı Çözüm Komutları

```bash
# Tüm servisleri restart et
systemctl restart nginx
pm2 restart anonimso

# Dosyaları kontrol et ve kopyala
cd /var/www/anonimsohbet/client
npm run build
rm -rf /var/www/html/*
cp -r build/* /var/www/html/
chown -R www-data:www-data /var/www/html/
chmod -R 755 /var/www/html/
```

## 7. Firewall Portlarını Aç

```bash
# UFW kullanıyorsanız
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

# iptables kullanıyorsanız
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables-save
```


