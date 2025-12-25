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
  Checkbox,
  Radio,
  Badge,
  List as AntList,
  Empty
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
  CheckCircleOutlined,
  BellOutlined
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
  const [selectedGender, setSelectedGender] = useState(null); // Cinsiyet filtresi
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [pendingMatches, setPendingMatches] = useState([]); // Devam etmemiş eşleşmeler
  const timerRef = useRef(null);
  const matchesRefreshHandlerRef = useRef(null);

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
      loadNotifications();
      loadUnreadNotificationCount();
      loadPendingMatches();
    }
  }, [token, activeTab]);

  // Devam etmemiş eşleşmeleri yükle
  const loadPendingMatches = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Devam etmemiş eşleşmeleri filtrele:
      // 1. isActiveMatch: true ve partner.isAnonymous: true (devam etmek istemiyorum butonuna basılmamış)
      // 2. isPendingRequest: true ve requestStatus: 'sent' (devam etmek istiyorum butonuna basılmış ama karşı taraftan cevap gelmemiş)
      // 3. isPendingRequest: true ve requestStatus: 'received' (karşı taraf devam etmek istiyorum butonuna basmış ama biz cevaplamamışız - kırmızı badge)
      const pending = (response.data.matches || []).filter(match => {
        // Aktif eşleşme ve anonim (devam etmek istemiyorum butonuna basılmamış)
        if (match.isActiveMatch && match.partner?.isAnonymous && !match.isPendingRequest) {
          return true;
        }
        // Pending request (devam etmek istiyorum butonuna basılmış)
        if (match.isPendingRequest) {
          return true;
        }
        return false;
      });
      
      setPendingMatches(pending);
    } catch (error) {
      console.error('Devam etmemiş eşleşmeler yüklenemedi:', error);
      setPendingMatches([]);
    }
  };

  // Bildirimleri yükle
  const loadNotifications = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Bildirimler yüklenemedi:', error);
    }
  };

  // Okunmamış bildirim sayısını yükle
  const loadUnreadNotificationCount = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUnreadNotificationCount(response.data.count || 0);
    } catch (error) {
      console.error('Okunmamış bildirim sayısı yüklenemedi:', error);
    }
  };

  // Bildirimi okundu olarak işaretle
  const markNotificationAsRead = async (notificationId) => {
    try {
      await axios.post(`${API_URL}/api/notifications/${notificationId}/read`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Bildirim okundu işaretleme hatası:', error);
    }
  };

  // Tüm bildirimleri okundu olarak işaretle
  const markAllNotificationsAsRead = async () => {
    try {
      await axios.post(`${API_URL}/api/notifications/read-all`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadNotificationCount(0);
    } catch (error) {
      console.error('Tüm bildirimleri okundu işaretleme hatası:', error);
    }
  };

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
      loadStatistics(); // İstatistikleri güncelle (eşleşme sayısı dahil)
      setActiveTab('chats'); // Sohbetler sekmesine geç
      onMatchContinued(data.partnerProfile);
    });

    // Eşleşmeler güncellendi (backend'den gelen event)
    newSocket.on('matches-updated', () => {
      console.log('✅ matches-updated event alındı, sohbetler listesi yenileniyor...');
      setChatsRefreshKey(prev => prev + 1); // ChatsList'i yenile
      loadStatistics(); // İstatistikleri güncelle
      loadPendingMatches(); // Devam etmemiş eşleşmeleri yenile
    });

    // Window event'i dinle (handleMatchEnded'den gelir)
    matchesRefreshHandlerRef.current = () => {
      console.log('✅ matches-should-refresh event alındı, sohbetler listesi yenileniyor...');
      setChatsRefreshKey(prev => prev + 1);
      loadStatistics();
      loadPendingMatches();
    };
    
    window.addEventListener('matches-should-refresh', matchesRefreshHandlerRef.current);

    // Bildirim event'ini dinle
    newSocket.on('notification', (notification) => {
      console.log('Bildirim alındı:', notification);
      loadUnreadNotificationCount();
      loadNotifications();
    });

    // Anonim numarası güncellendi event'ini dinle
    newSocket.on('anonymous-number-updated', (data) => {
      console.log('Anonim numarası güncellendi:', data);
      // Eşleşmeler listesini yenile
      setChatsRefreshKey(prev => prev + 1);
      loadPendingMatches(); // Devam etmemiş eşleşmeleri yenile
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
      if (matchesRefreshHandlerRef.current) {
        window.removeEventListener('matches-should-refresh', matchesRefreshHandlerRef.current);
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
            filterInterests: selectedInterests.length > 0 ? selectedInterests : null,
            filterGender: selectedGender || null // Cinsiyet filtresi eklendi
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
            {/* Header - Logo ve Controls */}
            <div style={{ 
              padding: '12px 16px', 
              borderBottom: `1px solid ${isDarkMode ? '#2d3748' : '#f0f0f0'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
              minHeight: '56px'
            }}>
              <img 
                src="/logo.png" 
                alt="Soulbate Logo" 
                style={{ 
                  height: '32px', 
                  width: 'auto',
                  objectFit: 'contain',
                  filter: isDarkMode ? 'brightness(0) invert(1)' : 'none',
                  flexShrink: 0
                }} 
              />
              <Space size="small" style={{ flexShrink: 0 }}>
                <Badge count={unreadNotificationCount > 0 ? unreadNotificationCount : null} size="small" offset={[-2, 2]}>
                  <Button
                    type="text"
                    icon={<BellOutlined />}
                    onClick={() => {
                      setShowNotifications(true);
                      loadNotifications();
                    }}
                    style={{ 
                      fontSize: '18px', 
                      color: isDarkMode ? '#fff' : '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px 8px'
                    }}
                  />
                </Badge>
                <Switch
                  checked={isDarkMode}
                  onChange={toggleDarkMode}
                  checkedChildren={<MoonOutlined />}
                  unCheckedChildren={<SunOutlined />}
                  size="small"
                />
                {currentProfile && (
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => setShowProfileEdit(true)}
                    style={{ padding: '4px 8px' }}
                  />
                )}
              </Space>
            </div>

            {/* Profile Info */}
            {currentProfile && (
              <div style={{ 
                padding: '20px', 
                textAlign: 'center',
                borderBottom: `1px solid ${isDarkMode ? '#2d3748' : '#f0f0f0'}`
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
                    marginBottom: '16px',
                    border: '4px solid #fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  {currentProfile.username.charAt(0).toUpperCase()}
                </Avatar>
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
        <Col xs={24} md={16}>
          {activeTab === 'match' && (
            <Card style={{ borderRadius: '16px' }}>
              {/* Matching Section */}
              <div>
                {!isMatching && !matchId && (
                  <>
                    {/* Devam Etmemiş Eşleşmeler */}
                    {pendingMatches.length > 0 && (
                      <Card style={{ 
                        marginBottom: '16px', 
                        borderRadius: '12px',
                        background: isDarkMode ? '#1a1a2e' : '#fff'
                      }}>
                        <Title level={5} style={{ 
                          marginBottom: '12px',
                          color: isDarkMode ? '#fff' : '#000'
                        }}>
                          Devam Etmemiş Eşleşmeler
                        </Title>
                        <AntList
                          dataSource={pendingMatches}
                          renderItem={(match) => {
                            // Kırmızı badge gösterilecek mi? (karşı taraf devam etmek istiyorum butonuna basmış ama biz cevaplamamışız)
                            const needsResponse = match.isPendingRequest && match.requestStatus === 'received';
                            const isWaitingForResponse = match.isPendingRequest && match.requestStatus === 'sent';
                            
                            return (
                              <AntList.Item
                                style={{
                                  cursor: 'pointer',
                                  padding: '12px',
                                  borderRadius: '8px',
                                  marginBottom: '8px',
                                  background: isDarkMode ? '#2d3748' : '#f8f9fa',
                                  border: `1px solid ${needsResponse ? '#ff4d4f' : (isDarkMode ? '#424242' : '#e0e0e0')}`
                                }}
                                onClick={() => onMatchFound(match.matchId)}
                              >
                                <AntList.Item.Meta
                                  avatar={
                                    <Badge 
                                      count={needsResponse ? 1 : 0} 
                                      offset={[-5, 5]}
                                      style={{ 
                                        backgroundColor: '#ff4d4f',
                                        boxShadow: needsResponse ? '0 0 0 2px #fff' : 'none'
                                      }}
                                    >
                                      <Avatar 
                                        size={50}
                                        style={{
                                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                          color: '#fff',
                                          fontWeight: 'bold'
                                        }}
                                      >
                                        {match.partner?.username?.charAt(0) || 'A'}
                                      </Avatar>
                                    </Badge>
                                  }
                                  title={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ 
                                        color: isDarkMode ? '#fff' : '#000',
                                        fontWeight: 600
                                      }}>
                                        {match.partner?.username || 'Anonim'}
                                      </span>
                                      {needsResponse && (
                                        <Tag color="red" style={{ margin: 0 }}>
                                          Yanıt Bekliyor
                                        </Tag>
                                      )}
                                      {isWaitingForResponse && (
                                        <Tag color="blue" style={{ margin: 0 }}>
                                          Cevap Bekleniyor
                                        </Tag>
                                      )}
                                    </div>
                                  }
                                  description={
                                    <span style={{ 
                                      color: isDarkMode ? '#999' : '#666',
                                      fontSize: '12px'
                                    }}>
                                      {needsResponse 
                                        ? 'Devam etmek isteğinize yanıt verin' 
                                        : isWaitingForResponse
                                        ? 'Karşı tarafın cevabını bekliyorsunuz'
                                        : 'Devam etmek için tıklayın'
                                      }
                                    </span>
                                  }
                                />
                              </AntList.Item>
                            );
                          }}
                        />
                      </Card>
                    )}
                    
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
                      <Card style={{ 
                        marginBottom: '16px', 
                        borderRadius: '12px',
                        background: isDarkMode ? '#1a1a2e' : '#fff'
                      }}>
                        <Title level={5} style={{ 
                          marginBottom: '12px',
                          color: isDarkMode ? '#fff' : '#000'
                        }}>
                          Eşleşme Filtreleri
                        </Title>
                        
                        {/* Cinsiyet Filtresi */}
                        <div style={{ marginBottom: '16px' }}>
                          <Text strong style={{ 
                            display: 'block', 
                            marginBottom: '8px',
                            color: isDarkMode ? '#fff' : '#000'
                          }}>
                            Cinsiyet:
                          </Text>
                          <Radio.Group
                            value={selectedGender}
                            onChange={(e) => setSelectedGender(e.target.value)}
                            style={{ width: '100%' }}
                          >
                            <Space direction="vertical">
                              <Radio value={null} style={{ color: isDarkMode ? '#fff' : '#000' }}>
                                Tümü
                              </Radio>
                              <Radio value="Erkek" style={{ color: isDarkMode ? '#fff' : '#000' }}>
                                Erkek
                              </Radio>
                              <Radio value="Kadın" style={{ color: isDarkMode ? '#fff' : '#000' }}>
                                Kadın
                              </Radio>
                            </Space>
                          </Radio.Group>
                        </div>
                        
                        <Divider style={{ margin: '16px 0', borderColor: isDarkMode ? '#424242' : '#f0f0f0' }} />
                        
                        {/* İlgi Alanları Filtresi */}
                        <div>
                          <Text strong style={{ 
                            display: 'block', 
                            marginBottom: '12px',
                            color: isDarkMode ? '#fff' : '#000'
                          }}>
                            İlgi Alanlarına Göre Filtrele
                          </Text>
                          <Checkbox.Group
                            value={selectedInterests}
                            onChange={setSelectedInterests}
                            style={{ width: '100%' }}
                          >
                            <Row gutter={[8, 8]}>
                              {interestOptions.map(interest => (
                                <Col span={8} key={interest}>
                                  <Checkbox value={interest} style={{ color: isDarkMode ? '#fff' : '#000' }}>
                                    {interest}
                                  </Checkbox>
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
                        </div>
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
          )}
          
          {activeTab === 'chats' && (
            <Card style={{ borderRadius: '16px' }}>
              <ChatsList 
                key={chatsRefreshKey}
                token={token}
                onSelectChat={handleSelectChat}
                API_URL={API_URL}
              />
            </Card>
          )}
        </Col>
      </Row>

      {showProfileEdit && (
        <ProfileEdit
          profile={currentProfile}
          token={token}
          onProfileUpdated={(updatedProfile, shouldClose = false) => {
            setCurrentProfile(updatedProfile);
            if (onProfileUpdated) {
              onProfileUpdated(updatedProfile);
            }
            // Sadece shouldClose true ise modal'ı kapat (örneğin profil kaydedildiğinde)
            if (shouldClose) {
              setShowProfileEdit(false);
            }
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

      {/* Bildirimler Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '24px' }}>
            <Space>
              <span>Bildirimler</span>
              {unreadNotificationCount > 0 && (
                <Badge count={unreadNotificationCount} />
              )}
            </Space>
            {notifications.length > 0 && (
              <Button 
                type="link" 
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllNotificationsAsRead();
                }}
                style={{ padding: 0, fontSize: '13px' }}
              >
                Tümünü Okundu İşaretle
              </Button>
            )}
          </div>
        }
        open={showNotifications}
        onCancel={() => setShowNotifications(false)}
        footer={null}
        width={600}
        style={{
          top: 20
        }}
      >
        {notifications.length === 0 ? (
          <Empty 
            description="Henüz bildiriminiz yok"
            style={{ padding: '40px 0' }}
          />
        ) : (
          <AntList
            dataSource={notifications}
            renderItem={(notification) => (
              <AntList.Item
                style={{
                  backgroundColor: notification.read ? 'transparent' : (isDarkMode ? '#2e2e2e' : '#f0f7ff'),
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (!notification.read) {
                    markNotificationAsRead(notification.id);
                  }
                  if (notification.matchId) {
                    onMatchFound(notification.matchId);
                    setShowNotifications(false);
                  }
                }}
              >
                <AntList.Item.Meta
                  title={
                    <Space>
                      <Text strong={!notification.read}>
                        {notification.title || 'Yeni Mesaj'}
                      </Text>
                      {!notification.read && (
                        <Badge dot color="red" />
                      )}
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ display: 'block', marginBottom: '4px' }}>
                        {notification.message}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(notification.createdAt).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </div>
                  }
                />
              </AntList.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
}

export default MainScreen;