@echo off
echo ========================================
echo 🔍 VPS SORUN GİDERME
echo ========================================
echo.

echo VPS'e bağlanılıyor ve kontrol ediliyor...
echo.

ssh root@72.62.146.220 "systemctl status nginx | head -3; echo ''; echo 'Port kontrol:'; netstat -tuln | grep :80 | head -1; echo ''; echo 'Dosya kontrol:'; ls -la /var/www/html/ | head -3; echo ''; echo 'Nginx restart...'; systemctl restart nginx; echo '✅ Tamamlandı!'"

echo.
echo ========================================
echo ✅ Kontrol tamamlandı!
echo Siteyi test edin: https://soulbate.com
echo ========================================
pause


echo ========================================
echo 🔍 VPS SORUN GİDERME
echo ========================================
echo.

echo VPS'e bağlanılıyor ve kontrol ediliyor...
echo.

ssh root@72.62.146.220 "systemctl status nginx | head -3; echo ''; echo 'Port kontrol:'; netstat -tuln | grep :80 | head -1; echo ''; echo 'Dosya kontrol:'; ls -la /var/www/html/ | head -3; echo ''; echo 'Nginx restart...'; systemctl restart nginx; echo '✅ Tamamlandı!'"

echo.
echo ========================================
echo ✅ Kontrol tamamlandı!
echo Siteyi test edin: https://soulbate.com
echo ========================================
pause

