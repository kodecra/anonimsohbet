const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

// FTP ayarları - .env dosyasından oku veya buraya yaz
const FTP_CONFIG = {
  host: process.env.FTP_HOST || 'ftp.yourdomain.com',
  user: process.env.FTP_USER || 'your-username',
  password: process.env.FTP_PASSWORD || 'your-password',
  secure: true
};

const REMOTE_DIR = '/public_html'; // Hostinger için genelde public_html
const BUILD_DIR = path.join(__dirname, 'build');

async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    console.log('🔌 FTP\'ye bağlanılıyor...');
    await client.access(FTP_CONFIG);
    console.log('✅ FTP bağlantısı başarılı!');

    // Remote dizine git
    await client.cd(REMOTE_DIR);
    console.log(`📁 Remote dizin: ${REMOTE_DIR}`);

    // Build klasöründeki tüm dosyaları yükle
    console.log('📤 Dosyalar yükleniyor...');
    await client.uploadFromDir(BUILD_DIR, REMOTE_DIR);
    
    console.log('✅ Tüm dosyalar başarıyla yüklendi!');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

// Sadece değişen dosyaları yükle
async function deployChanged() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    console.log('🔌 FTP\'ye bağlanılıyor...');
    await client.access(FTP_CONFIG);
    console.log('✅ FTP bağlantısı başarılı!');

    await client.cd(REMOTE_DIR);
    
    // Sadece build klasöründeki dosyaları kontrol et ve yükle
    const filesToUpload = [
      'index.html',
      'asset-manifest.json',
      '_redirects',
      '.htaccess',
      'static/css/main.730c069e.css',
      'static/css/main.730c069e.css.map',
      'static/js/main.c664b83b.js',
      'static/js/main.c664b83b.js.map',
      'static/js/main.c664b83b.js.LICENSE.txt'
    ];

    console.log('📤 Değişen dosyalar yükleniyor...');
    
    for (const file of filesToUpload) {
      const localPath = path.join(BUILD_DIR, file);
      const remotePath = file;
      
      if (fs.existsSync(localPath)) {
        // Klasör yapısını oluştur
        const remoteDir = path.dirname(remotePath).replace(/\\/g, '/');
        if (remoteDir !== '.') {
          try {
            await client.cd(REMOTE_DIR);
            await client.ensureDir(remoteDir);
          } catch (e) {
            // Klasör zaten varsa devam et
          }
        }
        
        await client.uploadFrom(localPath, path.basename(remotePath));
        console.log(`✅ ${file} yüklendi`);
      } else {
        console.log(`⚠️ ${file} bulunamadı, atlanıyor`);
      }
    }
    
    console.log('✅ Deploy tamamlandı!');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

// Komut satırı argümanına göre çalıştır
const command = process.argv[2] || 'all';

if (command === 'changed') {
  deployChanged();
} else {
  deploy();
}









