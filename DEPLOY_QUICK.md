# 🚀 Hızlı Deploy Komutları

## Windows (PowerShell/CMD)

### Tek Satırlık Komut:
```powershell
cd C:\xampp\htdocs\anonimsohbet; git add -A; git commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"; git push origin main; ssh root@72.62.146.220 "cd /var/www/anonimsohbet && git pull origin main && cd server && npm install && pm2 restart anonimso && cd ../client && npm install && npm run build && rm -rf /var/www/html/* && cp -r build/* /var/www/html/"
```

### Batch Script ile:
```batch
DEPLOY.bat
```

## Linux/Mac (Bash)

### Tek Satırlık Komut:
```bash
cd /var/www/anonimsohbet && git add -A && git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')" && git push origin main && ssh root@72.62.146.220 "cd /var/www/anonimsohbet && git pull origin main && cd server && npm install && pm2 restart anonimso && cd ../client && npm install && npm run build && rm -rf /var/www/html/* && cp -r build/* /var/www/html/"
```

### Script ile:
```bash
chmod +x DEPLOY.sh
./DEPLOY.sh
```

## Manuel Adımlar

### 1. Git Commit & Push
```bash
cd C:\xampp\htdocs\anonimsohbet
git add -A
git commit -m "deploy: yeni özellikler"
git push origin main
```

### 2. Sunucuya Deploy
```bash
ssh root@72.62.146.220
cd /var/www/anonimsohbet
git pull origin main
cd server
npm install
pm2 restart anonimso
cd ../client
npm install
npm run build
rm -rf /var/www/html/*
cp -r build/* /var/www/html/
```

## Notlar

- **PM2 Process Name**: `anonimso` (sunucuda kontrol edin: `pm2 list`)
- **Build Klasörü**: `client/build`
- **Deploy Klasörü**: `/var/www/html/`
- **SSH Key**: SSH key'iniz yüklü olmalı, yoksa şifre soracaktır

## Hızlı Kontrol

```bash
# PM2 durumunu kontrol et
ssh root@72.62.146.220 "pm2 status"

# Son commit'leri kontrol et
git log --oneline -5

# Build dosyalarını kontrol et
ls -la client/build/
```
