const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const authFile = path.join(dataDir, 'auth.json');
const matchesFile = path.join(dataDir, 'matches.json');
const verificationsFile = path.join(dataDir, 'verifications.json');

// Data klasörünü oluştur
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// JSON dosyalarını yükle
function loadData(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err);
  }
  return defaultValue;
}

// JSON dosyalarına kaydet
function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err);
    return false;
  }
}

// Users Map'i JSON'a dönüştür ve kaydet
function saveUsers(usersMap) {
  const usersObj = {};
  for (const [userId, profile] of usersMap.entries()) {
    // Date objelerini string'e çevir
    usersObj[userId] = {
      ...profile,
      createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : null,
      updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : null
    };
  }
  return saveData(usersFile, usersObj);
}

// JSON'dan Users Map'i yükle
function loadUsers() {
  const usersObj = loadData(usersFile, {});
  const usersMap = new Map();
  
  for (const [userId, profile] of Object.entries(usersObj)) {
    usersMap.set(userId, {
      ...profile,
      createdAt: profile.createdAt ? new Date(profile.createdAt) : new Date(),
      updatedAt: profile.updatedAt ? new Date(profile.updatedAt) : new Date()
    });
  }
  
  return usersMap;
}

// Auth Map'i kaydet
function saveAuth(authMap) {
  const authObj = {};
  for (const [email, auth] of authMap.entries()) {
    authObj[email] = auth;
  }
  return saveData(authFile, authObj);
}

// Auth Map'i yükle
function loadAuth() {
  const authObj = loadData(authFile, {});
  const authMap = new Map();
  
  for (const [email, auth] of Object.entries(authObj)) {
    authMap.set(email, auth);
  }
  
  return authMap;
}

// Matches kaydet
function saveMatches(completedMatches, userMatches) {
  const matchesObj = {};
  for (const [matchId, match] of completedMatches.entries()) {
    matchesObj[matchId] = {
      ...match,
      startedAt: match.startedAt ? new Date(match.startedAt).toISOString() : null,
      completedAt: match.completedAt ? new Date(match.completedAt).toISOString() : null,
      lastMessageAt: match.lastMessageAt ? new Date(match.lastMessageAt).toISOString() : null,
      messages: match.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : null
      }))
    };
  }
  
  const userMatchesObj = {};
  for (const [userId, matchIds] of userMatches.entries()) {
    userMatchesObj[userId] = matchIds;
  }
  
  return saveData(matchesFile, { completedMatches: matchesObj, userMatches: userMatchesObj });
}

// Matches yükle
function loadMatches() {
  const data = loadData(matchesFile, { completedMatches: {}, userMatches: {} });
  const completedMatches = new Map();
  const userMatches = new Map();
  
  // Completed matches
  for (const [matchId, match] of Object.entries(data.completedMatches || {})) {
    completedMatches.set(matchId, {
      ...match,
      startedAt: match.startedAt ? new Date(match.startedAt) : new Date(),
      completedAt: match.completedAt ? new Date(match.completedAt) : new Date(),
      lastMessageAt: match.lastMessageAt ? new Date(match.lastMessageAt) : new Date(),
      messages: (match.messages || []).map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }))
    });
  }
  
  // User matches
  for (const [userId, matchIds] of Object.entries(data.userMatches || {})) {
    userMatches.set(userId, matchIds);
  }
  
  return { completedMatches, userMatches };
}

// Verifications kaydet
function saveVerifications(verificationsMap) {
  const verificationsObj = {};
  for (const [userId, verification] of verificationsMap.entries()) {
    verificationsObj[userId] = {
      ...verification,
      submittedAt: verification.submittedAt ? new Date(verification.submittedAt).toISOString() : null
    };
  }
  return saveData(verificationsFile, verificationsObj);
}

// Verifications yükle
function loadVerifications() {
  const verificationsObj = loadData(verificationsFile, {});
  const verificationsMap = new Map();
  
  for (const [userId, verification] of Object.entries(verificationsObj)) {
    verificationsMap.set(userId, {
      ...verification,
      submittedAt: verification.submittedAt ? new Date(verification.submittedAt) : new Date()
    });
  }
  
  return verificationsMap;
}

module.exports = {
  saveUsers,
  loadUsers,
  saveAuth,
  loadAuth,
  saveMatches,
  loadMatches,
  saveVerifications,
  loadVerifications
};
