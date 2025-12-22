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
  Statistic
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
  const timerRef = useRef(null);

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
          socket.emit('start-matching', { userId }); // userId'yi de gönder
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
            socket.emit('start-matching', { userId });
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
              flexDirection: 'column'
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
            {/* Header */}
            <div style={{ 
              padding: '20px', 
              borderBottom: '1px solid #f0f0f0', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <Title level={4} style={{ margin: 0, color: '#1890ff', fontWeight: 600 }}>
                🎭 Anonim Sohbet
              </Title>
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
                  />
                )}
              </Space>
            </div>

            {/* Profile Info */}
            {currentProfile && (
              <div style={{ 
                padding: '20px', 
                borderBottom: '1px solid #f0f0f0', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px' 
              }}>
                <Avatar
                  src={currentProfile.photos && currentProfile.photos.length > 0 ? `${API_URL}${currentProfile.photos[0].url}` : undefined}
                  size={60}
                  style={{ backgroundColor: '#1890ff', flexShrink: 0 }}
                >
                  {currentProfile.username.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Space>
                    <Text strong>{currentProfile.username}</Text>
                    {currentProfile.verified && (
                      <Tag 
                        icon={<SafetyCertificateOutlined />}
                        color="success"
                        style={{ margin: 0 }}
                      >
                        Onaylandı
                      </Tag>
                    )}
                  </Space>
                </div>
              </div>
            )}

            {/* İstatistikler */}
            {statistics && (
              <div style={{ 
                padding: '16px', 
                borderBottom: '1px solid #f0f0f0',
                background: '#f8f9fa'
              }}>
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Statistic
                      title="Toplam Mesaj"
                      value={statistics.totalMessages}
                      valueStyle={{ fontSize: '18px', color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Aktif Sohbet"
                      value={statistics.activeChats}
                      valueStyle={{ fontSize: '18px', color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Toplam Eşleşme"
                      value={statistics.totalMatches}
                      valueStyle={{ fontSize: '18px', color: '#722ed1' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Profil Görüntüleme"
                      value={statistics.profileViews}
                      valueStyle={{ fontSize: '18px', color: '#fa8c16' }}
                    />
                  </Col>
                </Row>
              </div>
            )}

            {/* Tabs */}
            <Tabs 
              activeKey={activeTab}
              onChange={handleTabChange}
              style={{ borderBottom: '1px solid #f0f0f0', marginLeft: '16px' }}
              size="large"
              items={[
                {
                  key: 'match',
                  label: (
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      fontWeight: 500,
                      fontSize: '15px'
                    }}>
                      <SearchOutlined style={{ fontSize: '16px' }} />
                      Eşleşmeler
                    </span>
                  )
                },
                {
                  key: 'chats',
                  label: (
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      fontWeight: 500,
                      fontSize: '15px'
                    }}>
                      <MessageOutlined style={{ fontSize: '16px' }} />
                      Sohbetlerim
                    </span>
                  )
                }
              ]}
            />

            {/* Admin Panel Button */}
            {currentProfile && currentProfile.email === 'admin@admin.com' && (
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
              <div style={{ flex: 1, overflow: 'auto' }}>
                <ChatsList 
                  key={chatsRefreshKey} // Key değiştiğinde component yeniden render olur
                  token={token}
                  onSelectChat={handleSelectChat}
                  API_URL={API_URL}
                />
              </div>
            )}

            {/* Çıkış Yap Butonu */}
            <div style={{ 
              padding: '16px', 
              marginTop: 'auto', 
              borderTop: '1px solid #f0f0f0' 
            }}>
              <Button
                block
                danger
                icon={<LogoutOutlined />}
                onClick={onLogout}
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
                      Hoş geldin, {currentProfile.username}!
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