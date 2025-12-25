import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  List,
  Avatar, 
  Typography, 
  Empty,
  Spin,
  Alert,
  Tag,
  Space,
  Input,
  Dropdown,
  Button,
  Modal,
  Radio,
  message as antdMessage
} from 'antd';
import { 
  SafetyCertificateOutlined, 
  SearchOutlined,
  MoreOutlined,
  BlockOutlined,
  WarningOutlined,
  CloseOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { Badge } from 'antd';
import { ThemeContext } from '../App';
import './ChatsList.css';

const { Text } = Typography;
const { Search, TextArea } = Input;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ChatsList({ token, onSelectChat, API_URL, refreshTrigger }) {
  const { isDarkMode } = React.useContext(ThemeContext);
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewProfileModal, setViewProfileModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // matchId -> count

  useEffect(() => {
    loadMatches();
  }, [token, refreshTrigger]);

  // Okunmamış mesaj sayılarını yükle
  useEffect(() => {
    if (matches.length > 0) {
      loadUnreadCounts();
    }
  }, [matches, token]);

  const loadUnreadCounts = async () => {
    const counts = {};
    for (const match of matches) {
      try {
        const response = await axios.get(`${API_URL}/api/matches/${match.matchId}/unread-count`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        counts[match.matchId] = response.data.count || 0;
      } catch (error) {
        counts[match.matchId] = 0;
      }
    }
    setUnreadCounts(counts);
  };

  const markMatchAsRead = async (matchId) => {
    try {
      // Önce local state'i güncelle (hemen sıfırla)
      setUnreadCounts(prev => ({ ...prev, [matchId]: 0 }));
      
      // Bu match'e ait tüm bildirimleri okundu olarak işaretle
      const response = await axios.get(`${API_URL}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const notifications = response.data.notifications || [];
      const matchNotifications = notifications.filter(n => n.matchId === matchId && !n.read);
      
      for (const notification of matchNotifications) {
        await axios.post(`${API_URL}/api/notifications/${notification.id}/read`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      // Okunmamış sayıyı güncelle
      setUnreadCounts(prev => ({ ...prev, [matchId]: 0 }));
    } catch (error) {
      console.error('Bildirim okundu işaretleme hatası:', error);
    }
  };

  const loadMatches = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/matches`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const matchesData = response.data.matches || [];
      
      // Sohbetlerim sadece kabul edilmiş (completed) eşleşmeleri göstermeli
      // Aktif eşleşmeler ve pending request'ler "Eşleşmeler" tabında gösterilir
      const completedMatches = matchesData.filter(match => {
        // Aktif eşleşme veya pending request ise gösterme
        if (match.isActiveMatch) return false;
        if (match.isPendingRequest) return false;
        // Anonim partner varsa gösterme (henüz kabul edilmemiş)
        if (match.partner?.isAnonymous) return false;
        return true;
      });
      
      setMatches(completedMatches);
      setFilteredMatches(completedMatches);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Sohbetler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  // Arama fonksiyonu
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMatches(matches);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = matches.filter(match => {
      // Kullanıcı adı, isim, soyisim araması
      const usernameMatch = (match.partner?.username || '').toLowerCase().includes(query);
      const firstNameMatch = (match.partner?.firstName || '').toLowerCase().includes(query);
      const lastNameMatch = (match.partner?.lastName || '').toLowerCase().includes(query);
      
      // Son mesaj içeriği araması
      const lastMessageMatch = match.lastMessage && match.lastMessage.text.toLowerCase().includes(query);
      
      // Tüm mesajlar içinde arama (match.messages varsa)
      let messagesMatch = false;
      if (match.messages && Array.isArray(match.messages)) {
        messagesMatch = match.messages.some(msg => 
          msg.text && msg.text.toLowerCase().includes(query)
        );
      }
      
      return usernameMatch || firstNameMatch || lastNameMatch || lastMessageMatch || messagesMatch;
    });
    setFilteredMatches(filtered);
  }, [searchQuery, matches]);

  // Engelle
  const handleBlockUser = async (partnerUserId, partnerUsername, e) => {
    e.stopPropagation(); // List item'a tıklamayı engelle
    try {
      await axios.post(`${API_URL}/api/users/block`, 
        { targetUserId: partnerUserId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      antdMessage.success(`${partnerUsername} engellendi`);
      loadMatches(); // Listeyi yenile
    } catch (error) {
      console.error('Engelleme hatası:', error);
      antdMessage.error('Kullanıcı engellenemedi');
    }
  };

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUserId, setReportTargetUserId] = useState(null);
  const [reportTargetUsername, setReportTargetUsername] = useState('');
  const [reportReasonType, setReportReasonType] = useState(null);
  const [reportCustomReason, setReportCustomReason] = useState('');

  // Şikayet et
  const handleReportUser = async (partnerUserId, partnerUsername, e) => {
    e.stopPropagation();
    setReportTargetUserId(partnerUserId);
    setReportTargetUsername(partnerUsername);
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportReasonType && !reportCustomReason.trim()) {
      antdMessage.warning('Lütfen bir sebep seçin veya yazın');
      return;
    }

    try {
      await axios.post(`${API_URL}/api/users/report`, 
        { 
          targetUserId: reportTargetUserId, 
          reasonType: reportReasonType,
          customReason: reportCustomReason.trim() || null
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      antdMessage.success('Şikayet gönderildi');
      setShowReportModal(false);
      setReportTargetUserId(null);
      setReportTargetUsername('');
      setReportReasonType(null);
      setReportCustomReason('');
    } catch (error) {
      console.error('Şikayet gönderme hatası:', error);
      antdMessage.error('Şikayet gönderilemedi');
    }
  };

  // Eşleşmeden çık
  const handleLeaveMatch = async (matchId, partnerUsername, e) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Eşleşmeden Çık',
      content: `${partnerUsername} ile eşleşmeden çıkmak istediğinizden emin misiniz?`,
      okText: 'Çık',
      cancelText: 'İptal',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const response = await axios.delete(`${API_URL}/api/matches/${matchId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.data && response.data.success) {
            antdMessage.success(response.data.message || 'Eşleşmeden çıkıldı');
            loadMatches(); // Listeyi yenile
          } else {
            antdMessage.error('Eşleşmeden çıkılamadı');
          }
        } catch (error) {
          console.error('Eşleşmeden çıkma hatası:', error);
          const errorMessage = error.response?.data?.error || error.message || 'Eşleşmeden çıkılamadı';
          antdMessage.error(errorMessage);
          // Hata olsa bile listeyi yenile (match zaten silinmiş olabilir)
          loadMatches();
        }
      }
    });
  };

  // Profili görüntüle
  const handleViewProfile = (partner, e) => {
    e.stopPropagation();
    setSelectedPartner(partner);
    setViewProfileModal(true);
    
    // Profil görüntüleme sayısını artır
    if (partner.userId) {
      axios.post(`${API_URL}/api/profile/view`, 
        { targetUserId: partner.userId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      ).catch(err => console.error('Profil görüntüleme hatası:', err));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: '64px 0' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <Alert message="Hata" description={error} type="error" showIcon />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <Empty
        description={
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              Henüz sohbetiniz yok
            </Text>
            <Text type="secondary">
              Eşleşme yaparak sohbetlere başlayın!
            </Text>
          </div>
        }
        style={{ padding: '64px 0' }}
      />
    );
  }

  return (
    <div>
      <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          placeholder="Sohbet ara..."
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          prefix={<SearchOutlined />}
          style={{ width: '100%' }}
        />
      </div>
      {filteredMatches.length === 0 && searchQuery ? (
        <Empty
          description={
            <Text type="secondary">
              "{searchQuery}" için sonuç bulunamadı
            </Text>
          }
          style={{ padding: '64px 0' }}
        />
      ) : (
        <List
          dataSource={filteredMatches}
      renderItem={(match) => (
        <List.Item
          onClick={(e) => {
            // Dropdown veya dropdown içindeki elementlere tıklanırsa sohbete girme
            if (e.target.closest('.ant-dropdown') || e.target.closest('.ant-btn') || e.target.closest('.ant-dropdown-menu')) {
              return;
            }
            // Pending request ise gerçek matchId'yi kullan
            const actualMatchId = match.isPendingRequest && match.matchId ? match.matchId : match.matchId;
            onSelectChat(actualMatchId);
            // Sohbete girildiğinde bildirimleri okundu olarak işaretle
            if (unreadCounts[match.matchId] > 0) {
              markMatchAsRead(match.matchId);
            }
          }}
          style={{
            cursor: 'pointer',
            padding: '16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDarkMode ? '#2e2e2e' : '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <List.Item.Meta
            avatar={
              <Badge count={unreadCounts[match.matchId] || 0} offset={[-5, 5]}>
                <div style={{ position: 'relative' }}>
                  {match.partner.photos && match.partner.photos.length > 0 ? (
                    <Avatar
                      src={match.partner.photos[0].url && match.partner.photos[0].url.startsWith('http')
                        ? match.partner.photos[0].url
                        : `${API_URL}${match.partner.photos[0].url}`}
                      size={60}
                      onError={(e) => {
                        if (e && e.target) {
                          e.target.src = 'https://via.placeholder.com/60';
                        }
                      }}
                    />
                  ) : (
                    <Avatar size={60} style={{ backgroundColor: '#1890ff' }}>
                      {match.partner?.username ? match.partner.username.charAt(0).toUpperCase() : '?'}
                    </Avatar>
                  )}
                  {match.partner.verified && (
                    <SafetyCertificateOutlined
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        backgroundColor: '#52c41a',
                        color: 'white',
                        borderRadius: '50%',
                        padding: '2px',
                        fontSize: '14px'
                      }}
                    />
                  )}
                </div>
              </Badge>
            }
            title={
              <Space size={4} wrap>
                {match.isPendingRequest && (
                  <Tag color="orange" style={{ margin: 0, fontSize: '10px', padding: '0 4px', lineHeight: '16px' }}>
                    {match.requestStatus === 'sent' ? 'Beklemede' : 'Yanıt Bekliyor'}
                  </Tag>
                )}
                <Text strong style={{ fontSize: '14px' }}>
                  {(() => {
                    const partner = match.partner;
                    if (!partner) return 'Bilinmeyen Kullanıcı';
                    const firstName = partner.firstName || '';
                    const lastName = partner.lastName || '';
                    const age = partner.age;
                    
                    if (firstName || lastName) {
                      const fullName = `${firstName} ${lastName}`.trim();
                      return age ? `${fullName}, ${age}` : fullName;
                    }
                    return partner.username ? `@${partner.username}` : 'Bilinmeyen Kullanıcı';
                  })()}
                </Text>
              </Space>
            }
            description={
              <div>
                {match.isPendingRequest ? (
                  <Text 
                    type="secondary" 
                    style={{ display: 'block', maxWidth: '200px', marginBottom: '4px' }}
                  >
                    {match.requestStatus === 'sent' 
                      ? 'Yanıt bekleniyor...' 
                      : 'Devam isteği bekleniyor'}
                  </Text>
                ) : match.lastMessage ? (
                  <Text 
                    type="secondary" 
                    ellipsis 
                    style={{ display: 'block', maxWidth: '200px', marginBottom: '4px' }}
                  >
                    {match.lastMessage.text.length > 50
                      ? match.lastMessage.text.substring(0, 50) + '...'
                      : match.lastMessage.text}
                  </Text>
                ) : null}
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {formatDate(match.lastMessageAt)}
                </Text>
              </div>
            }
          />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'view-profile',
                  label: 'Profili Görüntüle',
                  icon: <EyeOutlined />,
                  onClick: ({ domEvent }) => {
                    domEvent.stopPropagation();
                    handleViewProfile(match.partner, domEvent);
                  }
                },
                {
                  key: 'leave',
                  label: 'Eşleşmeden Çık',
                  icon: <CloseOutlined />,
                  danger: true,
                  onClick: ({ domEvent }) => {
                    domEvent.stopPropagation();
                    handleLeaveMatch(match.matchId, match.partner?.username || 'Bilinmeyen Kullanıcı', domEvent);
                  }
                },
                {
                  key: 'block',
                  label: 'Engelle',
                  icon: <BlockOutlined />,
                  danger: true,
                  onClick: ({ domEvent }) => {
                    domEvent.stopPropagation();
                    handleBlockUser(match.partner?.userId, match.partner?.username || 'Bilinmeyen Kullanıcı', domEvent);
                  }
                },
                {
                  key: 'report',
                  label: 'Şikayet Et',
                  icon: <WarningOutlined />,
                  onClick: ({ domEvent }) => {
                    domEvent.stopPropagation();
                    handleReportUser(match.partner?.userId, match.partner?.username || 'Bilinmeyen Kullanıcı', domEvent);
                  }
                }
              ]
            }}
            trigger={['click']}
            onClick={(e) => e.stopPropagation()}
          >
            <Button 
              type="text" 
              icon={<MoreOutlined />}
              onClick={(e) => {
                e.stopPropagation();
              }}
              style={{ fontSize: '18px' }}
            />
          </Dropdown>
        </List.Item>
      )}
        />
      )}

      {/* Profil Görüntüleme Modal */}
      <Modal
        title="Profil Bilgileri"
        open={viewProfileModal}
        onCancel={() => setViewProfileModal(false)}
        footer={[
          <Button key="close" onClick={() => setViewProfileModal(false)}>
            Kapat
          </Button>,
          <Button 
            key="view" 
            type="primary" 
            onClick={() => {
              setViewProfileModal(false);
              // Profil görüntüleme modalını açmak için ChatScreen'e geç
              // Bu özellik için MainScreen'den bir callback gerekebilir
              // Şimdilik modal'da profil bilgilerini gösteriyoruz
            }}
          >
            Profili Görüntüle
          </Button>
        ]}
        width={500}
      >
        {selectedPartner && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              {selectedPartner.photos && selectedPartner.photos.length > 0 ? (
                <Avatar
                  src={selectedPartner.photos[0].url && selectedPartner.photos[0].url.startsWith('http')
                    ? selectedPartner.photos[0].url
                    : `${API_URL}${selectedPartner.photos[0].url}`}
                  size={120}
                  style={{ marginBottom: '16px' }}
                />
              ) : (
                <Avatar 
                  size={120} 
                  style={{ backgroundColor: '#1890ff', marginBottom: '16px', fontSize: '48px' }}
                >
                  {selectedPartner.username.charAt(0).toUpperCase()}
                </Avatar>
              )}
              <div>
                <Space>
                  <Text strong style={{ fontSize: '20px' }}>{selectedPartner.username}</Text>
                  {selectedPartner.verified && (
                    <SafetyCertificateOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                  )}
                </Space>
              </div>
            </div>
            
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {selectedPartner.age && (
                <div>
                  <Text type="secondary">Yaş:</Text>
                  <Text strong style={{ marginLeft: '8px' }}>{selectedPartner.age}</Text>
                </div>
              )}
              
              {selectedPartner.bio && (
                <div>
                  <Text type="secondary">Biyografi:</Text>
                  <div style={{ marginTop: '8px' }}>
                    <Text>{selectedPartner.bio}</Text>
                  </div>
                </div>
              )}
              
              {selectedPartner.interests && selectedPartner.interests.length > 0 && (
                <div>
                  <Text type="secondary">İlgi Alanları:</Text>
                  <div style={{ marginTop: '8px' }}>
                    <Space wrap>
                      {selectedPartner.interests.map((interest, index) => (
                        <Tag key={index} color="blue">{interest}</Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              )}
              
              {selectedPartner.photos && selectedPartner.photos.length > 1 && (
                <div>
                  <Text type="secondary">Fotoğraflar:</Text>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedPartner.photos.slice(1).map((photo, index) => (
                      <img
                        key={index}
                        src={`${API_URL}${photo.url}`}
                        alt={`Fotoğraf ${index + 2}`}
                        style={{
                          width: '80px',
                          height: '80px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                        onClick={() => window.open(`${API_URL}${photo.url}`, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Space>
          </div>
        )}
      </Modal>

      {/* Şikayet Modal */}
      <Modal
        title="Şikayet Et"
        open={showReportModal}
        onCancel={() => {
          setShowReportModal(false);
          setReportTargetUserId(null);
          setReportTargetUsername('');
          setReportReasonType(null);
          setReportCustomReason('');
        }}
        onOk={submitReport}
        okText="Şikayet Gönder"
        cancelText="İptal"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong style={{ display: 'block', marginBottom: '12px' }}>
              Şikayet Sebebi
            </Text>
            <Radio.Group 
              value={reportReasonType} 
              onChange={(e) => setReportReasonType(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="fake_account">Sahte Hesap</Radio>
                <Radio value="inappropriate_username">Uygunsuz Kullanıcı Adı</Radio>
                <Radio value="inappropriate_photo">Uygunsuz Fotoğraf</Radio>
                <Radio value="other">Diğer</Radio>
              </Space>
            </Radio.Group>
          </div>
          
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              Açıklama (İsteğe Bağlı)
            </Text>
            <TextArea
              rows={4}
              placeholder="Şikayet sebebinizi detaylı olarak açıklayın..."
              value={reportCustomReason}
              onChange={(e) => setReportCustomReason(e.target.value)}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}

export default ChatsList;