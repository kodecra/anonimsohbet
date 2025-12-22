import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import { ConfigProvider, theme } from 'antd';
import LoginAntd from './components/LoginAntd';
import RegisterAntd from './components/RegisterAntd';
import MainScreen from './components/MainScreen';
import ChatScreen from './components/ChatScreen';
import AdminPanel from './components/AdminPanel';
import './App.css';
import './theme.css';
import './dating-theme.css';
import './social-media-theme.css';
import './socialv-theme.css';
import './modern-social-ui.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Theme Context
export const ThemeContext = createContext();

function App() {
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [screen, setScreen] = useState('auth'); // 'auth', 'register', 'main', 'chat', 'admin'
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Dark mode değiştiğinde localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // URL'den route'u oku
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      // Admin paneli için token kontrolü yap
      const savedToken = localStorage.getItem('token');
      const savedUserId = localStorage.getItem('userId');
      
      if (savedToken && savedUserId) {
        setToken(savedToken);
        setUserId(savedUserId);
        axios.get(`${API_URL}/api/profile`, {
          headers: {
            'Authorization': `Bearer ${savedToken}`
          }
        })
        .then(res => {
          if (res.data.profile && res.data.profile.email === 'admin@admin.com') {
            setProfile(res.data.profile);
            setScreen('admin');
          } else {
            // Admin değilse ana sayfaya yönlendir
            window.history.pushState({}, '', '/');
            setScreen('main');
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          window.history.pushState({}, '', '/');
          setScreen('auth');
        });
      } else {
        window.history.pushState({}, '', '/');
        setScreen('auth');
      }
    }
  }, []);

  // Token kontrolü
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') return; // Admin route'u için yukarıdaki useEffect hallediyor
    
    const savedToken = localStorage.getItem('token');
    const savedUserId = localStorage.getItem('userId');
    
    if (savedToken && savedUserId) {
      setToken(savedToken);
      setUserId(savedUserId);
      // Profili yükle
      axios.get(`${API_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${savedToken}`
        }
      })
      .then(res => {
        if (res.data.profile) {
          setProfile(res.data.profile);
          // Superadmin kontrolü
          if (res.data.profile.email === 'admin@admin.com') {
            setScreen('admin');
          } else {
            setScreen('main');
          }
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        setScreen('auth');
      });
    } else {
      setScreen('auth');
    }
  }, []);

  const handleLogin = (newToken, newProfile) => {
    setToken(newToken);
    setProfile(newProfile);
    setUserId(newProfile.userId);
    // Superadmin kontrolü
    if (newProfile.email === 'admin@admin.com') {
      setScreen('admin');
    } else {
      setScreen('main');
    }
  };

  const handleRegister = (newToken, newProfile) => {
    setToken(newToken);
    setProfile(newProfile);
    setUserId(newProfile.userId);
    // Superadmin kontrolü
    if (newProfile.email === 'admin@admin.com') {
      setScreen('admin');
    } else {
      setScreen('main');
    }
  };

  const handleMatchFound = async (newMatchId) => {
    setMatchId(newMatchId);
    // Partner profilini API'den yükle - Completed match kontrolü için
    let partnerProfileData = null;
    try {
      const response = await axios.get(`${API_URL}/api/matches/${newMatchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('✅ handleMatchFound: Match data alındı', response.data);
      if (response.data && response.data.match) {
        // Backend'den gelen partner bilgisini kullan (aktif eşleşmede null, completed'de dolu)
        if (response.data.match.partner) {
          partnerProfileData = response.data.match.partner;
          console.log('✅ Completed match - partner profile alındı');
        } else {
          console.log('✅ Aktif eşleşme - partner profile null (anonim)');
        }
      }
    } catch (error) {
      console.error('Partner profil yüklenemedi:', error);
      // Hata durumunda yeni eşleşme olarak kabul et (partnerProfileData null kalır)
    }
    
    // Partner profile'ı set et ve sonra chat ekranına geç
    console.log('✅ handleMatchFound: Partner profile set ediliyor', partnerProfileData);
    setPartnerProfile(partnerProfileData);
    // Partner profile varsa completed match'tir, mesajlar yüklenecek
    setScreen('chat');
  };

  const handleMatchContinued = (newPartnerProfile) => {
    setPartnerProfile(newPartnerProfile);
  };

  const handleMatchEnded = () => {
    setMatchId(null);
    setPartnerProfile(null);
    setScreen('main');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setToken(null);
    setUserId(null);
    setProfile(null);
    setScreen('auth');
  };

  const handleProfileUpdated = (updatedProfile) => {
    setProfile(updatedProfile);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Ant Design theme configuration
  const antdTheme = {
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 8,
      fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
      fontSize: 14,
      fontSizeHeading1: 32,
      fontSizeHeading2: 24,
      fontSizeHeading3: 20,
      fontSizeHeading4: 16,
      fontSizeHeading5: 14,
    },
  };

  if (screen === 'auth') {
    return (
      <ConfigProvider theme={antdTheme}>
        <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
          <div>
            {authMode === 'login' ? (
              <LoginAntd 
                onLogin={handleLogin}
                onSwitchToRegister={() => setAuthMode('register')}
                API_URL={API_URL}
              />
            ) : (
              <RegisterAntd 
                onRegister={handleRegister}
                onSwitchToLogin={() => setAuthMode('login')}
                API_URL={API_URL}
              />
            )}
          </div>
        </ThemeContext.Provider>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={antdTheme}>
      <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
        {screen === 'main' && (
          <MainScreen
            userId={userId}
            profile={profile}
            token={token}
            onMatchFound={handleMatchFound}
            onMatchContinued={handleMatchContinued}
            onMatchEnded={handleMatchEnded}
            onLogout={handleLogout}
            onProfileUpdated={handleProfileUpdated}
            onGoToAdmin={() => setScreen('admin')}
            API_URL={API_URL}
          />
        )}

        {screen === 'chat' && (
          <ChatScreen
            userId={userId}
            profile={profile}
            matchId={matchId}
            partnerProfile={partnerProfile}
            onMatchEnded={handleMatchEnded}
            onMatchContinued={handleMatchContinued}
            onGoBack={() => setScreen('main')}
            API_URL={API_URL}
          />
        )}

        {screen === 'admin' && (
          <AdminPanel
            token={token}
            API_URL={API_URL}
            onGoToProfile={() => setScreen('main')}
          />
        )}
      </ThemeContext.Provider>
    </ConfigProvider>
  );
}

export default App;