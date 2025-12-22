import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import {
  Layout,
  Card,
  Typography,
  Button,
  Avatar,
  Tabs,
  Tag,
  Spin,
  Space,
  Row,
  Col,
  Flex,
  Divider,
  Switch,
  Modal,
  Statistic,
  Checkbox
} from 'antd';
import {
  EditOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  MessageOutlined,
  LogoutOutlined,
  SettingOutlined,
  MoonOutlined,
  SunOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { ThemeContext } from '../App';
import ProfileEdit from './ProfileEdit';
import ChatsList from './ChatsList';
import './MainScreen.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

// Superadmin email'leri (backend ile aynı)
const SUPERADMIN_EMAILS = ['admin@admin.com', 'oguzhancakar@anonimsohbet.local'].map(e => e.toLowerCase());

// Helper function to check if user is superadmin
function isSuperAdmin(email) {
  return email && SUPERADMIN_EMAILS.includes(email.toLowerCase());
}

function MainScreen({ userId, profile, token, onMatchFound, onMatchContinued, onMatchEnded, onLogout, onProfileUpdated, onGoToAdmin, API_URL }) {
  const { isDarkMode, toggleDarkMode } = React.useContext(ThemeContext);
  const [socket, setSocket] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  const [matchId, setMatchId] = useState(null);
  const [showDecision, setShowDecision] = useState(false);
  const [timer, setTimer] = useState(30);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(profile);
  const [activeTab, setActiveTab] = useState('match'); // 'match' or 'chats'
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [pendingMatchId, setPendingMatchId] = useState(null);
  const [chatsRefreshKey, setChatsRefreshKey] = useState(0); // ChatsList'i yenilemek için
  const [statistics, setStatistics] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMatchFilters, setShowMatchFilters] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const timerRef = useRef(null);

  // Temel ilgi alanları listesi (ProfileEdit ile aynı)
  const interestOptions = [
    'Müzik', 'Spor', 'Film', 'Kitap', 'Seyahat', 'Yemek', 'Sanat', 'Teknoloji',
    'Doğa', 'Dans', 'Fotoğrafçılık', 'Oyun', 'Moda', 'Hayvanlar', 'Fitness', 'Yoga',
    'Müze', 'Konser', 'Festival', 'Kamp', 'Deniz', 'Dağ', 'Şehir', 'Köy'
  ];

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  // İstatistikleri yükle
  useEffect(() => {
    if (token) {
      loadStatistics();
    }
  }, [token]);

  const loadStatistics = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setStatistics(response.data);
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error);
    }
  };

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    // Socket bağlantısı kurulduğunda profil ile bağlan
    newSocket.on('connect', () => {
      console.log('Socket bağlandı, profil gönderiliyor:', userId);
      newSocket.emit('set-profile', { userId });
    });

    // Eğer socket zaten bağlıysa hemen profil gönder
    if (newSocket.connected) {
      console.log('Socket zaten bağlı, profil gönderiliyor:', userId);
      newSocket.emit('set-profile', { userId });
    }

    // Profil set edildiğinde
    newSocket.on('profile-set', (data) => {
      console.log('Profil set edildi:', data.profile);
    });

    // Eşleşme bulundu - Animasyon göster, sonra ChatScreen'e geç
    newSocket.on('match-found', (data) => {
      setIsMatching(false);
      setPendingMatchId(data.matchId);
      setShowMatchAnimation(true);
      // 2 saniye sonra chat sayfasına geç
      setTimeout(() => {
        setShowMatchAnimation(false);
        onMatchFound(data.matchId);
      }, 2000);
    });

    // Eşleşme onaylandı
    newSocket.on('match-continued', (data) => {
      // Eşleşme onaylandı, sohbetler listesini yenile
      setChatsRefreshKey(prev => prev + 1); // ChatsList'i yenile
      setActiveTab('chats'); // Sohbetler sekmesine geç
      onMatchContinued(data.partnerProfile);
    });

    // Eşleşme sona erdi
    newSocket.on('match-ended', () => {
      setMatchId(null);
      setShowDecision(false);
      setIsMatching(false);
      setMatchStatus('');
      setTimer(30);
      clearInterval(timerRef.current);
    });

    // Hata
    newSocket.on('error', (data) => {
      console.error('Socket error:', data);
      setMatchStatus(data.message);
      setIsMatching(false);
    });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      newSocket.close();
    };
  }, [userId, API_URL, onMatchFound, onMatchContinued]);

  const handleStartMatching = () => {
    if (socket && !isMatching && userId) {
      // Önce profil set edildiğinden emin ol
      if (socket.connected) {
        socket.emit('set-profile', { userId });
        // set-profile event'inin tamamlanması için kısa bir gecikme
        setTimeout(() => {
          setIsMatching(true);
          setMatchStatus('Eşleşme aranıyor...');
          setShowDecision(false);
          setTimer(30);
          socket.emit('start-matching', { 
            userId,
            filterInterests: selectedInterests.length > 0 ? selectedInterests : null
          });
        }, 200);
      } else {
        // Socket bağlı değilse, bağlanmasını bekle
        socket.once('connect', () => {
          socket.emit('set-profile', { userId });
          setTimeout(() => {
            setIsMatching(true);
            setMatchStatus('Eşleşme aranıyor...');
            setShowDecision(false);
            setTimer(30);
            socket.emit('start-matching', { 
              userId,
              filterInterests: selectedInterests.length > 0 ? selectedInterests : null
            });
          }, 200);
        });
      }
    }
  };

  // Temel ilgi alanları listesi (ProfileEdit ile aynı)
  const interestOptions = [
    'Müzik', 'Spor', 'Film', 'Kitap', 'Seyahat', 'Yemek', 'Sanat', 'Teknoloji',
    'Doğa', 'Dans', 'Fotoğrafçılık', 'Oyun', 'Moda', 'Hayvanlar', 'Fitness', 'Yoga',
    'Müze', 'Konser', 'Festival', 'Kamp', 'Deniz', 'Dağ', 'Şehir', 'Köy'
  ];

  const handleStopMatching = () => {
    if (socket) {
      socket.emit('stop-matching');
      setIsMatching(false);
      setMatchStatus('');
    }
  };

  const handleSelectChat = (selectedMatchId) => {
    onMatchFound(selectedMatchId);
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: isDarkMode 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
      padding: '24px',
      transition: 'background 0.3s ease'
    }}>
      <Row gutter={[24, 24]} style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Sidebar */}
        <Col xs={24} md={8}>
          <Card 
            style={{ 
              borderRadius: '16px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: isDarkMode ? '#1a1a2e' : '#fff'
            }}
            styles={{ 
              body: { 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%',
                padding: 0
              }
            }}
          >
            {/* Banner Image */}
            <div style={{
              height: '180px',
              background: isDarkMode 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Profile Picture - Banner üzerine bindirilmiş */}
              {currentProfile && (
                <div style={{
                  position: 'absolute',
                  bottom: '-50px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10
                }}>
                  <Avatar
                    src={currentProfile.photos && currentProfile.photos.length > 0 
                      ? (currentProfile.photos[0].url.startsWith('http') 
                          ? currentProfile.photos[0].url 
                          : `${API_URL}${currentProfile.photos[0].url}`)
                      : undefined}
                    size={100}
                    style={{ 
                      backgroundColor: '#1890ff', 
                      border: '4px solid #fff',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    {currentProfile.username.charAt(0).toUpperCase()}
                  </Avatar>
                </div>
              )}
              {/* Header Controls - Sağ üstte */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 11
              }}>
                <Space>
                  <Switch
                    checked={isDarkMode}
                    onChange={toggleDarkMode}
                    checkedChildren={<MoonOutlined />}
                    unCheckedChildren={<SunOutlined />}
                  />
                  {currentProfile && (
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => setShowProfileEdit(true)}
                      style={{ color: '#fff' }}
                    />
                  )}
                </Space>
              </div>
            </div>

            {/* Profile Info - Banner altında */}
            {currentProfile && (
              <div style={{ 
                padding: '60px 20px 20px 20px', 
                textAlign: 'center',
                borderBottom: `1px solid ${isDarkMode ? '#2d3748' : '#f0f0f0'}`
              }}>
                <Title level={4} style={{ 
                  margin: '0 0 4px 0',
                  color: isDarkMode ? '#e2e8f0' : '#32325d'
                }}>
                  {(() => {
                    const firstName = currentProfile.firstName || '';
                    const lastName = currentProfile.lastName || '';
                    if (firstName || lastName) {
                      return `${firstName} ${lastName}`.trim();
                    }
                    return currentProfile.username || 'Bilinmeyen Kullanıcı';
                  })()}
                </Title>
                <Text type="secondary" style={{ 
                  display: 'block',
                  marginBottom: '8px',
                  color: isDarkMode ? '#a0aec0' : '#8898aa'
                }}>
                  @{currentProfile.username}
                  {currentProfile.verified && (
                    <Tag 
                      icon={<SafetyCertificateOutlined />}
                      color="success"
                      style={{ marginLeft: '8px' }}
                    >
                      Onaylandı
                    </Tag>
                  )}
                </Text>
                {currentProfile.bio && (
                  <Text style={{ 
                    display: 'block',
                    marginTop: '8px',
                    fontStyle: 'italic',
                    color: isDarkMode ? '#a0aec0' : '#8898aa'
                  }}>
                    "{currentProfile.bio}"
                  </Text>
                )}
                {/* Profil Doluluğu */}
                {(() => {
                  const calculateProfileCompleteness = (profile) => {
                    let completed = 0;
                    let total = 0;
                    
                    // Fotoğraf (20%)
                    total += 20;
                    if (profile.photos && profile.photos.length > 0) completed += 20;
                    
                    // İsim Soyisim (15%)
                    total += 15;
                    if (profile.firstName && profile.lastName) completed += 15;
                    
                    // Bio (15%)
                    total += 15;
                    if (profile.bio && profile.bio.trim().length > 0) completed += 15;
                    
                    // İlgi Alanları (15%)
                    total += 15;
                    if (profile.interests && profile.interests.length > 0) completed += 15;
                    
                    // Doğum Tarihi (10%)
                    total += 10;
                    if (profile.birthDate) completed += 10;
                    
                    // Telefon (10%)
                    total += 10;
                    if (profile.phoneNumber) completed += 10;
                    
                    // Cinsiyet (5%)
                    total += 5;
                    if (profile.gender) completed += 5;
                    
                    // Doğrulama (10%)
                    total += 10;
                    if (profile.verified) completed += 10;
                    
                    return Math.round((completed / total) * 100);
                  };
                  
                  const completeness = calculateProfileCompleteness(currentProfile);
                  
                  return (
                    <div style={{ 
                      marginTop: '16px',
                      padding: '12px',
                      background: isDarkMode ? 'rgba(94, 114, 228, 0.1)' : 'rgba(94, 114, 228, 0.05)',
                      borderRadius: '8px',
                      border: `1px solid ${isDarkMode ? 'rgba(94, 114, 228, 0.3)' : 'rgba(94, 114, 228, 0.2)'}`
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <Text strong style={{ color: isDarkMode ? '#e2e8f0' : '#32325d' }}>
                          Profil Doluluğu
                        </Text>
                        <Text strong style={{ 
                          fontSize: '18px',
                          color: completeness >= 80 ? '#52c41a' : completeness >= 50 ? '#faad14' : '#ff4d4f'
                        }}>
                          %{completeness}
                        </Text>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: '8px', 
                        background: isDarkMode ? '#2d3748' : '#e9ecef',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          width: `${completeness}%`,
                          height: '100%',
                          background: completeness >= 80 
                            ? 'linear-gradient(90deg, #52c41a 0%, #73d13d 100%)'
                            : completeness >= 50 
                            ? 'linear-gradient(90deg, #faad14 0%, #ffc53d 100%)'
                            : 'linear-gradient(90deg, #ff4d4f 0%, #ff7875 100%)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <Text style={{ 
                        fontSize: '12px',
                        color: isDarkMode ? '#a0aec0' : '#8898aa',
                        fontStyle: 'italic'
                      }}>
                        {completeness < 100 
                          ? 'Profili tamamlamak eşleşme şansını arttırır'
                          : 'Profiliniz tamamlandı! 🎉'}
                      </Text>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* İstatistikler - Modern 3 sütunlu tasarım */}
            {statistics && (
              <div style={{ 
                padding: '20px', 
                borderBottom: `1px solid ${isDarkMode ? '#2d3748' : '#e9ecef'}`,
                background: isDarkMode ? '#1a202c' : '#f8f9fe'
              }}>
                <Row gutter={[0, 0]} style={{ textAlign: 'center' }}>
                  <Col span={8} style={{ 
                    borderRight: `1px solid ${isDarkMode ? '#2d3748' : '#e9ecef'}`,
                    padding: '8px'
                  }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 700,
                      color: isDarkMode ? '#e2e8f0' : '#32325d',
                      marginBottom: '4px'
                    }}>
                      {statistics.totalMessages || 0}
                    </div>
                    <div style={{ 
                      fontSize: '12px',
                      color: isDarkMode ? '#a0aec0' : '#8898aa'
                    }}>
                      Mesaj
                    </div>
                  </Col>
                  <Col span={8} style={{ 
                    borderRight: `1px solid ${isDarkMode ? '#2d3748' : '#e9ecef'}`,
                    padding: '8px'
                  }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 700,
                      color: isDarkMode ? '#e2e8f0' : '#32325d',
                      marginBottom: '4px'
                    }}>
                      {statistics.activeChats || 0}
                    </div>
                    <div style={{ 
                      fontSize: '12px',
                      color: isDarkMode ? '#a0aec0' : '#8898aa'
                    }}>
                      Sohbet
                    </div>
                  </Col>
                  <Col span={8} style={{ padding: '8px' }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 700,
                      color: isDarkMode ? '#e2e8f0' : '#32325d',
                      marginBottom: '4px'
                    }}>
                      {statistics.totalMatches || 0}
                    </div>
                    <div style={{ 
                      fontSize: '12px',
                      color: isDarkMode ? '#a0aec0' : '#8898aa'
                    }}>
                      Eşleşme
                    </div>
                  </Col>
                </Row>
              </div>
            )}

            {/* Navigation Menu - Modern sidebar menü */}
            <div style={{ 
              flex: 1,
              padding: '12px 0',
              borderBottom: `1px solid ${isDarkMode ? '#2d3748' : '#e9ecef'}`
            }}>
              <div
                onClick={() => setActiveTab('match')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  background: activeTab === 'match' 
                    ? (isDarkMode ? 'rgba(94, 114, 228, 0.2)' : 'rgba(94, 114, 228, 0.1)')
                    : 'transparent',
                  color: activeTab === 'match' 
                    ? (isDarkMode ? '#8293F9' : '#5E72E4')
                    : (isDarkMode ? '#a0aec0' : '#8898aa'),
                  transition: 'all 0.2s',
                  borderLeft: activeTab === 'match' 
                    ? `3px solid ${isDarkMode ? '#8293F9' : '#5E72E4'}`
                    : '3px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'match') {
                    e.currentTarget.style.background = isDarkMode ? 'rgba(94, 114, 228, 0.1)' : 'rgba(94, 114, 228, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'match') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <SearchOutlined style={{ fontSize: '18px', marginRight: '12px' }} />
                <span style={{ fontSize: '15px', fontWeight: activeTab === 'match' ? 600 : 400 }}>
                  Eşleşmeler
                </span>
              </div>
              <div
                onClick={() => setActiveTab('chats')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  background: activeTab === 'chats' 
                    ? (isDarkMode ? 'rgba(94, 114, 228, 0.2)' : 'rgba(94, 114, 228, 0.1)')
                    : 'transparent',
                  color: activeTab === 'chats' 
                    ? (isDarkMode ? '#8293F9' : '#5E72E4')
                    : (isDarkMode ? '#a0aec0' : '#8898aa'),
                  transition: 'all 0.2s',
                  borderLeft: activeTab === 'chats' 
                    ? `3px solid ${isDarkMode ? '#8293F9' : '#5E72E4'}`
                    : '3px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'chats') {
                    e.currentTarget.style.background = isDarkMode ? 'rgba(94, 114, 228, 0.1)' : 'rgba(94, 114, 228, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'chats') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <MessageOutlined style={{ fontSize: '18px', marginRight: '12px' }} />
                <span style={{ fontSize: '15px', fontWeight: activeTab === 'chats' ? 600 : 400 }}>
                  Sohbetlerim
                </span>
              </div>
            </div>

            {/* Admin Panel Button */}
            {currentProfile && isSuperAdmin(currentProfile.email) && (
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Button
                  block
                  icon={<SettingOutlined />}
                  onClick={() => setShowSettings(true)}
                  style={{ 
                    backgroundColor: '#1890ff', 
                    color: '#fff',
                    borderColor: '#1890ff'
                  }}
                >
                  Ayarlar
                </Button>
                <Button
                  block
                  icon={<SettingOutlined />}
                  onClick={() => {
                    if (onGoToAdmin) {
                      window.history.pushState({}, '', '/admin');
                      onGoToAdmin();
                    }
                  }}
                  style={{ 
                    backgroundColor: '#ffc107', 
                    color: '#333',
                    borderColor: '#ffc107'
                  }}
                >
                  Admin Panel
                </Button>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'chats' && (
              <div style={{ 
                flex: 1, 
                overflow: 'auto',
                backgroundColor: '#fff',
                minHeight: '400px'
              }}>
                <ChatsList 
                  key={chatsRefreshKey} // Key değiştiğinde component yeniden render olur
                  token={token}
                  onSelectChat={handleSelectChat}
                  API_URL={API_URL}
                />
              </div>
            )}

            {/* View Profile & Logout Buttons */}
            <div style={{ 
              padding: '16px', 
              marginTop: 'auto', 
              borderTop: `1px solid ${isDarkMode ? '#2d3748' : '#e9ecef'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <Button
                block
                type="primary"
                onClick={() => setShowProfileEdit(true)}
                style={{
                  background: isDarkMode ? '#5E72E4' : '#5E72E4',
                  borderColor: isDarkMode ? '#5E72E4' : '#5E72E4',
                  height: '40px',
                  fontWeight: 600
                }}
              >
                Profili Görüntüle
              </Button>
              <Button
                block
                danger
                icon={<LogoutOutlined />}
                onClick={onLogout}
                style={{
                  height: '40px'
                }}
              >
                Çıkış Yap
              </Button>
            </div>
          </Card>
        </Col>

        {/* Main Content */}
        {activeTab === 'match' && (
          <Col xs={24} md={16}>
            <Card style={{ borderRadius: '16px' }}>
              {currentProfile && (
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start', 
                    marginBottom: '16px' 
                  }}>
                    <Title level={3} style={{ margin: 0 }}>
                      Hoş geldin, {(() => {
                        const firstName = currentProfile.firstName || '';
                        const lastName = currentProfile.lastName || '';
                        const username = currentProfile.username || '';
                        if (firstName || lastName) {
                          const fullName = `${firstName} ${lastName}`.trim();
                          return username ? `${fullName} (@${username})` : fullName;
                        }
                        return username ? `@${username}` : 'Bilinmeyen Kullanıcı';
                      })()}!
                    </Title>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => setShowProfileEdit(true)}
                    >
                      Düzenle
                    </Button>
                  </div>
                  
                  {currentProfile.age && (
                    <Text type="secondary" style={{ display: 'block', marginBottom: '8px' }}>
                      Yaş: {currentProfile.age}
                    </Text>
                  )}
                  
                  {currentProfile.bio && (
                    <Text italic style={{ 
                      display: 'block', 
                      marginBottom: '16px', 
                      color: '#8c8c8c' 
                    }}>
                      {currentProfile.bio}
                    </Text>
                  )}
                  
                  {currentProfile.interests && currentProfile.interests.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                        İlgi Alanları:
                      </Text>
                      <Space wrap>
                        {currentProfile.interests.map((interest, index) => (
                          <Tag key={index}>{interest}</Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                  
                  {currentProfile.photos && currentProfile.photos.length > 0 && (
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                        Fotoğraflar:
                      </Text>
                      <Space wrap>
                        {currentProfile.photos.slice(0, 3).map((photo) => (
                          <Avatar
                            key={photo.id}
                            src={`${API_URL}${photo.url}`}
                            size={50}
                            shape="square"
                          />
                        ))}
                        {currentProfile.photos.length > 3 && (
                          <Avatar size={50} shape="square" style={{ backgroundColor: '#d9d9d9' }}>
                            +{currentProfile.photos.length - 3}
                          </Avatar>
                        )}
                      </Space>
                    </div>
                  )}
                </div>
              )}

              {/* Matching Section */}
              <div>
                {!isMatching && !matchId && (
                  <>
                    <Button
                      block
                      type="default"
                      size="middle"
                      icon={<SettingOutlined />}
                      onClick={() => setShowMatchFilters(!showMatchFilters)}
                      style={{
                        marginBottom: '12px',
                        height: '40px'
                      }}
                    >
                      {showMatchFilters ? 'Filtreleri Gizle' : 'Filtrele (İlgi Alanları)'}
                    </Button>
                    
                    {showMatchFilters && (
                      <Card style={{ marginBottom: '16px', borderRadius: '12px' }}>
                        <Title level={5} style={{ marginBottom: '12px' }}>
                          İlgi Alanlarına Göre Filtrele
                        </Title>
                        <Checkbox.Group
                          value={selectedInterests}
                          onChange={setSelectedInterests}
                          style={{ width: '100%' }}
                        >
                          <Row gutter={[8, 8]}>
                            {interestOptions.map(interest => (
                              <Col span={8} key={interest}>
                                <Checkbox value={interest}>{interest}</Checkbox>
                              </Col>
                            ))}
                          </Row>
                        </Checkbox.Group>
                        {selectedInterests.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              Seçilen: {selectedInterests.join(', ')}
                            </Text>
                          </div>
                        )}
                      </Card>
                    )}
                    
                    <Button
                      block
                      type="primary"
                      size="large"
                      icon={<SearchOutlined />}
                      onClick={handleStartMatching}
                      style={{
                        height: '56px',
                        fontSize: '18px',
                        background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
                        border: 'none'
                      }}
                    >
                      Eşleşme Başlat
                    </Button>
                  </>
                )}

                {isMatching && (
                  <div style={{ textAlign: 'center' }}>
                    <Spin size="large" style={{ marginBottom: '16px' }} />
                    <Title level={4} style={{ marginBottom: '16px' }}>
                      {matchStatus}
                    </Title>
                    <Button
                      danger
                      onClick={handleStopMatching}
                    >
                      İptal Et
                    </Button>
                  </div>
                )}

                {matchStatus && !isMatching && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '16px', 
                    backgroundColor: '#f5f5f5', 
                    borderRadius: '8px' 
                  }}>
                    <Text type="secondary">{matchStatus}</Text>
                  </div>
                )}
              </div>
            </Card>
          </Col>
        )}
      </Row>

      {showProfileEdit && (
        <ProfileEdit
          profile={currentProfile}
          token={token}
          onProfileUpdated={(updatedProfile) => {
            setCurrentProfile(updatedProfile);
            if (onProfileUpdated) {
              onProfileUpdated(updatedProfile);
            }
            setShowProfileEdit(false);
          }}
          onClose={() => setShowProfileEdit(false)}
          API_URL={API_URL}
        />
      )}

      {/* Eşleşme Bulundu Animasyonu */}
      {showMatchAnimation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-in'
        }}>
          <div style={{
            textAlign: 'center',
            animation: 'scaleIn 0.5s ease-out'
          }}>
            <CheckCircleOutlined 
              style={{ 
                fontSize: '120px', 
                color: '#52c41a',
                animation: 'spinAndPulse 1.5s ease-in-out infinite',
                filter: 'drop-shadow(0 4px 8px rgba(82, 196, 26, 0.3))'
              }} 
            />
            <Title level={1} style={{ 
              marginTop: '32px', 
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '48px',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }}>
              Eşleşme Bulundu! 🎉
            </Title>
            <Text style={{ 
              fontSize: '20px', 
              color: '#fff',
              opacity: 0.95,
              display: 'block',
              marginTop: '16px',
              fontWeight: 500
            }}>
              Sohbete yönlendiriliyorsunuz...
            </Text>
          </div>
        </div>
      )}

      {/* Ayarlar Modal */}
      <Modal
        title="Bildirim Ayarları"
        open={showSettings}
        onCancel={() => setShowSettings(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>Ses Bildirimleri</Text>
            <Switch 
              defaultChecked 
              style={{ marginLeft: '16px' }}
            />
          </div>
          <div>
            <Text strong>Tarayıcı Bildirimleri</Text>
            <Switch 
              defaultChecked 
              style={{ marginLeft: '16px' }}
            />
          </div>
          <div>
            <Text strong>Mesaj Bildirimleri</Text>
            <Switch 
              defaultChecked 
              style={{ marginLeft: '16px' }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}

export default MainScreen;