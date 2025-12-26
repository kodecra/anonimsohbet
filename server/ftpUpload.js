const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

/**
 * FTP ile dosya yükleme fonksiyonu
 * @param {string} localFilePath - Yüklenecek dosyanın local yolu
 * @param {string} remoteFilePath - Hosting'deki hedef yol (örn: /uploads/filename.jpg)
 * @returns {Promise<string>} - Yüklenen dosyanın URL'i
 */
async function uploadToFTP(localFilePath, remoteFilePath) {
  const client = new ftp.Client();
  client.ftp.verbose = true; // Debug için

  try {
    const ftpConfig = {
      host: process.env.FTP_HOST || 'ftp.clinofy.com',
      user: process.env.FTP_USER || 'u230954858',
      password: process.env.FTP_PASSWORD,
      secure: false // FTP (true = FTPS)
    };

    if (!ftpConfig.password) {
      throw new Error('FTP_PASSWORD environment variable is required');
    }

    await client.access(ftpConfig);
    
    // Remote dizinin var olup olmadığını kontrol et, yoksa oluştur
    const remoteDir = path.dirname(remoteFilePath);
    try {
      await client.ensureDir(remoteDir);
    } catch (err) {
      // Dizin oluşturulamazsa devam et (zaten var olabilir)
      console.log('Dizin oluşturma hatası (muhtemelen zaten var):', err.message);
    }

    // Dosyayı yükle
    await client.uploadFrom(localFilePath, remoteFilePath);
    
    // URL oluştur (HTTPS)
    const baseUrl = process.env.FTP_BASE_URL || 'https://clinofy.com';
    const fileUrl = `${baseUrl}${remoteFilePath}`;
    
    return fileUrl;
  } catch (error) {
    console.error('FTP upload error:', error);
    throw error;
  } finally {
    client.close();
  }
}

module.exports = { uploadToFTP };

















