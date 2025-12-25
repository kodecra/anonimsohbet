@echo off
echo ========================================
echo 🚀 SOULBATE - DEPLOY SCRIPT
echo ========================================
echo.

REM Git add, commit ve push
echo [1/3] Git'e commit ve push yapılıyor...
cd /d C:\xampp\htdocs\anonimsohbet
git add -A
git commit -m "deploy: %date% %time%"
git push origin main

if %errorlevel% neq 0 (
    echo ❌ Git push başarısız!
    pause
    exit /b 1
)

echo ✅ Git push tamamlandı!
echo.

REM Sunucuya deploy
echo [2/3] Sunucuya deploy yapılıyor...
ssh root@72.62.146.220 "cd /var/www/anonimsohbet && git pull origin main && cd server && npm install && pm2 restart anonimso && cd ../client && npm install && npm run build && rm -rf /var/www/html/* && cp -r build/* /var/www/html/ && echo '✅ Deploy tamamlandı!'"

if %errorlevel% neq 0 (
    echo ❌ Deploy başarısız!
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ DEPLOY TAMAMLANDI!
echo ========================================
pause

