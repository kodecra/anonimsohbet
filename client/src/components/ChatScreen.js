import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import {
  Layout,
  Card,
  Typography,
  Input,
  Button,
  Avatar,
  Tag,
  Space,
  Progress,
  Flex,
  Divider,
  Dropdown,
  Popover,
  message as antdMessage
} from 'antd';
import {
  SendOutlined,
  SafetyCertificateOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  SmileOutlined,
  DeleteOutlined,
  CheckOutlined,
  PictureOutlined,
  CloseOutlined,
  BlockOutlined,
  WarningOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { ThemeContext } from '../App';
import './ChatScreen.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

function ChatScreen({ userId, profile: currentProfile, matchId, partnerProfile: initialPartnerProfile, onMatchEnded, onMatchContinued, API_URL }) {
  const { isDarkMode } = React.useContext(ThemeContext);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [timer, setTimer] = useState(30);
  const [showDecision, setShowDecision] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState(initialPartnerProfile);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const timerRef = useRef(null);
  const [notificationSettings, setNotificationSettings] = useState({
    soundEnabled: true,
    browserEnabled: true,
    messageEnabled: true
  });
  const audioRef = useRef(null);

  useEffect(() => {
    // Sadece completed match için API'den mesaj geçmişini yükle
    // initialPartnerProfile varsa completed match'tir ve mesaj geçmişi yüklenebilir
    // Aktif eşleşmede (initialPartnerProfile null) API çağrısı YAPMA
    
    const newSocket = io(API_URL);
    setSocket(newSocket);

    // Socket bağlantı durumunu kontrol et
    const checkAndSetProfile = () => {
      if (newSocket.connected) {
        console.log('ChatScreen: Socket bağlı, profil set ediliyor:', userId, matchId);
        newSocket.emit('set-profile', { userId, matchId });
      } else {
        console.log('ChatScreen: Socket henüz bağlı değil, bekleniyor...');
      }
    };

    newSocket.on('connect', () => {
      console.log('ChatScreen: Socket bağlandı, profil set ediliyor:', userId, matchId);
      // set-profile event'ini gönder
      newSocket.emit('set-profile', { userId, matchId });
    });

    // profile-set event'ini dinle
    newSocket.on('profile-set', (data) => {
      console.log('ChatScreen: Profil başarıyla set edildi, mesaj gönderebilirsiniz');
    });

    // İlk kontrol
    checkAndSetProfile();
    
    // Socket zaten bağlıysa hemen profil gönder
    if (newSocket.connected) {
      checkAndSetProfile();
    }

    newSocket.on('new-message', (message) => {
      console.log('Yeni mesaj alındı:', message);
      
      // Mesajı ekle
      setMessages((prev) => {
        // Geçici mesajı gerçek mesajla değiştir
        const filtered = prev.filter(m => !m.isTemporary || m.text !== message.text);
        // Mesaj zaten varsa ekleme
        const exists = filtered.find(m => m.id === message.id);
        if (!exists) {
          return [...filtered, message];
        }
        return filtered;
      });
      
      // Bildirim göster (sadece kendi mesajımız değilse)
      if (message.userId !== userId) {
        showNotification(message);
      }
      
      // Mesajı okundu olarak işaretle
      if (message.userId !== userId && newSocket && matchId) {
        newSocket.emit('mark-message-read', { matchId, messageId: message.id });
      }
    });
    
    // Notification event'ini dinle
    newSocket.on('notification', (notification) => {
      console.log('Notification alındı:', notification);
      // Zaten new-message event'inde handle ediyoruz, burada ek bir şey yapmaya gerek yok
    });

    newSocket.on('message-sent', (message) => {
      console.log('Mesaj gönderildi (confirmation):', message);
      // Geçici mesajı gerçek mesajla değiştir
      setMessages((prev) => {
        const filtered = prev.filter(m => !m.isTemporary || m.text !== message.text);
        const exists = filtered.find(m => m.id === message.id);
        if (!exists) {
          return [...filtered, message];
        }
        return filtered;
      });
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      // Hata mesajı göster
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        text: error.message || 'Bir hata oluştu',
        isSystem: true,
        timestamp: new Date()
      }]);
    });

    newSocket.on('user-typing', (data) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          newSet.add(data.username);
        } else {
          newSet.delete(data.username);
        }
        return newSet;
      });
    });

    newSocket.on('match-ended', () => {
      onMatchEnded();
    });

    newSocket.on('partner-disconnected', () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          text: 'Eşleşme partneri bağlantısını kesti',
          isSystem: true,
          timestamp: new Date()
        }
      ]);
    });

    newSocket.on('time-up', () => {
      setShowDecision(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    // Mesaj reaksiyonu güncellendi
    newSocket.on('message-reaction', (data) => {
      setMessages((prev) => prev.map(m => 
        m.id === data.messageId ? { ...m, reactions: data.reactions } : m
      ));
    });

    // Mesaj okundu işaretlendi
    newSocket.on('message-read', (data) => {
      setMessages((prev) => prev.map(m => 
        m.id === data.messageId ? { 
          ...m, 
          readBy: [...(m.readBy || []), data.readBy] 
        } : m
      ));
    });

    // Mesaj silindi
    newSocket.on('message-deleted', (data) => {
      setMessages((prev) => prev.map(m => 
        m.id === data.messageId ? { ...m, deleted: true, text: 'Bu mesaj silindi' } : m
      ));
    });

    newSocket.on('match-continued', (data) => {
      setShowDecision(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setPartnerProfile(data.partnerProfile);
      if (onMatchContinued) {
        onMatchContinued(data.partnerProfile);
      }
      
      // Completed match oldu, mesaj geçmişini yükle
      if (matchId) {
        fetch(`${API_URL}/api/matches/${matchId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
        })
        .then(data => {
          if (data && data.match && data.match.messages && data.match.messages.length > 0) {
            setMessages(data.match.messages);
          }
        })
        .catch(err => {
          // Sessizce geç
        });
      }
    });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      newSocket.close();
    };
  }, [userId, API_URL, onMatchEnded, onMatchContinued]);

  // Timer başlat
  useEffect(() => {
    // Önceki timer'ı temizle
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!partnerProfile && !showDecision && matchId) {
      setTimer(30);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            // Timer bittiğinde karar ekranını göster
            setShowDecision(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [partnerProfile, showDecision, matchId]);

  // Mesajlar değiştiğinde scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (selectedMedia) {
      sendMediaMessage();
      return;
    }
    
    if (messageText.trim() && socket && matchId && !showDecision) {
      // Socket bağlantısı kontrolü
      if (!socket.connected) {
        console.warn('Socket bağlı değil, mesaj gönderilemiyor');
        // Socket bağlantısını bekle
        socket.once('connect', () => {
          console.log('Socket bağlandı, mesaj gönderiliyor');
          socket.emit('set-profile', { userId, matchId });
          // Kısa bir gecikme ile mesaj gönder
          setTimeout(() => {
            socket.emit('send-message', {
              matchId: matchId,
              text: messageText.trim(),
              userId: userId
            });
          }, 100);
        });
        return;
      }
      
      console.log('Mesaj gönderiliyor:', { matchId, text: messageText.trim(), socketConnected: socket.connected });
      
      // Optimistic update - mesajı hemen ekle
      const tempMessage = {
        id: `temp-${Date.now()}`,
        userId: userId,
        username: currentProfile?.username || 'Sen',
        text: messageText.trim(),
        timestamp: new Date(),
        matchId: matchId,
        isTemporary: true
      };
      setMessages((prev) => [...prev, tempMessage]);
      
      socket.emit('send-message', {
        matchId: matchId,
        text: messageText.trim(),
        userId: userId  // Backend'de kullanıcı bulunamazsa otomatik set-profile için
      });
      
      setMessageText('');
      setIsTyping(false);
      socket.emit('typing', { isTyping: false, matchId: matchId });
    } else {
      console.log('Mesaj gönderilemedi:', { 
        hasText: !!messageText.trim(), 
        hasSocket: !!socket, 
        hasMatchId: !!matchId, 
        showDecision 
      });
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      if (socket && matchId) {
        socket.emit('typing', { isTyping: true, matchId: matchId });
      }
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socket && matchId) {
        socket.emit('typing', { isTyping: false, matchId: matchId });
      }
    }, 1000);
  };

  const handleDecision = (decision) => {
    if (socket && matchId) {
      socket.emit('match-decision', { matchId, decision });
      setShowDecision(false);
    }
  };

  // Bildirim göster (ses + tarayıcı)
  const showNotification = (msg) => {
    if (!notificationSettings.messageEnabled) return;
    
    // Tarayıcı bildirimi
    if (notificationSettings.browserEnabled && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`${msg.username || 'Birisi'}`, {
          body: msg.text?.substring(0, 100) || 'Yeni mesaj',
          icon: msg.userId === userId ? '/logo192.png' : undefined
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(`${msg.username || 'Birisi'}`, {
              body: msg.text?.substring(0, 100) || 'Yeni mesaj',
              icon: msg.userId === userId ? '/logo192.png' : undefined
            });
          }
        });
      }
    }
    
    // Ses bildirimi
    if (notificationSettings.soundEnabled) {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBS2BzvLYijcIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DejkAKFF606euoVRQKRp/g8r5sIQ==');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch (e) {
        console.error('Ses çalınamadı:', e);
      }
    }
  };

  // Mesaj kopyala
  const copyMessage = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      antdMessage.success('Mesaj kopyalandı');
    }).catch(() => {
      antdMessage.error('Kopyalama başarısız');
    });
  };

  // Mesaj sil
  const deleteMessage = (messageId) => {
    if (socket && matchId) {
      socket.emit('delete-message', { matchId, messageId });
    }
  };

  // Mesaja reaksiyon ekle/kaldır
  const reactToMessage = (messageId, reaction) => {
    if (socket && matchId) {
      socket.emit('react-to-message', { matchId, messageId, reaction });
    }
  };

  // Medya yükle
  const handleMediaSelect = async (file) => {
    if (file.size > 5 * 1024 * 1024) {
      antdMessage.error('Dosya boyutu 5MB\'dan küçük olmalıdır');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      antdMessage.error('Sadece resim dosyaları gönderilebilir');
      return;
    }

    setSelectedMedia({ file, preview: URL.createObjectURL(file) });
  };

  // Medya gönder
  const sendMediaMessage = async () => {
    if (!selectedMedia || !socket || !matchId || uploadingMedia) return;

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('media', selectedMedia.file);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/messages/upload-media`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const { mediaUrl, mediaType } = response.data;

      // Socket üzerinden medya mesajı gönder
      socket.emit('send-message', {
        matchId,
        text: messageText.trim() || '',
        userId,
        mediaUrl,
        mediaType
      });

      // Mesajı ekle
      const tempMessage = {
        id: `temp-${Date.now()}`,
        userId,
        username: currentProfile?.username || 'Sen',
        text: messageText.trim() || '',
        timestamp: new Date(),
        matchId,
        mediaUrl,
        mediaType,
        isTemporary: true
      };
      setMessages((prev) => [...prev, tempMessage]);

      setMessageText('');
      setSelectedMedia(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Medya yükleme hatası:', error);
      antdMessage.error('Medya gönderilemedi');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Kullanıcı engelle
  const handleBlockUser = async () => {
    if (!partnerProfile || !partnerProfile.userId) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/users/block`, 
        { targetUserId: partnerProfile.userId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      antdMessage.success('Kullanıcı engellendi');
      onMatchEnded(); // Sohbeti sonlandır
    } catch (error) {
      console.error('Engelleme hatası:', error);
      antdMessage.error('Kullanıcı engellenemedi');
    }
  };

  // Kullanıcı şikayet et
  const handleReportUser = async () => {
    if (!partnerProfile || !partnerProfile.userId) return;
    
    const reason = window.prompt('Şikayet nedeni nedir?');
    if (!reason) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/users/report`, 
        { targetUserId: partnerProfile.userId, reason },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      antdMessage.success('Şikayet gönderildi');
    } catch (error) {
      console.error('Şikayet hatası:', error);
      antdMessage.error('Şikayet gönderilemedi');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Layout style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: isDarkMode 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
      transition: 'background 0.3s ease'
    }}>
      {/* Header */}
      <Header style={{ 
        background: '#fff', 
        padding: '16px 24px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Title level={4} style={{ margin: 0 }}>
          💬 Sohbet
        </Title>
        {partnerProfile && (
          <Space>
            <Avatar
              src={partnerProfile.photos && partnerProfile.photos.length > 0 ? `${API_URL}${partnerProfile.photos[0].url}` : undefined}
              style={{ backgroundColor: '#1890ff' }}
            >
              {partnerProfile.username.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Space>
                <Text strong>{partnerProfile.username}</Text>
                {partnerProfile.verified && (
                  <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                )}
                {partnerProfile.isOnline && (
                  <Tag color="green" style={{ margin: 0 }}>Çevrimiçi</Tag>
                )}
              </Space>
              {partnerProfile.age && (
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Yaş: {partnerProfile.age}
                  </Text>
                </div>
              )}
              {!partnerProfile.isOnline && partnerProfile.lastSeen && (
                <div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    Son görülme: {new Date(partnerProfile.lastSeen).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </div>
              )}
            </div>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'block',
                    label: 'Kullanıcıyı Engelle',
                    icon: <BlockOutlined />,
                    danger: true,
                    onClick: handleBlockUser
                  },
                  {
                    key: 'report',
                    label: 'Şikayet Et',
                    icon: <WarningOutlined />,
                    onClick: handleReportUser
                  }
                ]
              }}
              trigger={['click']}
            >
              <Button 
                type="text" 
                icon={<MoreOutlined />}
                style={{ fontSize: '18px' }}
              />
            </Dropdown>
          </Space>
        )}
        {!partnerProfile && !showDecision && (
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
              {timer}
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              30 saniye sonra karar verilecek
            </Text>
          </div>
        )}
      </Header>

      {partnerProfile && (
        <div style={{ 
          background: '#fff', 
          padding: '12px 24px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          {partnerProfile.bio && (
            <Text type="secondary" style={{ display: 'block', marginBottom: '8px' }}>
              {partnerProfile.bio}
            </Text>
          )}
          {partnerProfile.interests && partnerProfile.interests.length > 0 && (
            <Space wrap>
              {partnerProfile.interests.map((interest, index) => (
                <Tag key={index}>{interest}</Tag>
              ))}
            </Space>
          )}
        </div>
      )}

      {/* Messages */}
      <Content style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              alignSelf: message.userId === userId ? 'flex-end' : 'flex-start',
              maxWidth: '70%'
            }}
          >
            <Card
              style={{
                padding: '12px',
                backgroundColor: message.userId === userId ? '#1890ff' : '#f5f5f5',
                borderRadius: '8px',
                border: 'none'
              }}
              styles={{ body: { padding: 0 } }}
            >
              {!message.isSystem && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '4px' 
                }}>
                  <Text 
                    strong 
                    style={{ 
                      color: message.userId === userId ? '#fff' : '#000',
                      fontSize: '12px'
                    }}
                  >
                    {message.username}
                  </Text>
                  <Text 
                    style={{ 
                      color: message.userId === userId ? 'rgba(255,255,255,0.7)' : '#8c8c8c',
                      fontSize: '12px',
                      marginLeft: '8px'
                    }}
                  >
                    {formatTime(message.timestamp)}
                  </Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ 
                  color: message.userId === userId ? '#fff' : '#000',
                  flex: 1
                }}>
                  {message.deleted ? (
                    <Text type="secondary" italic style={{ 
                      color: message.userId === userId ? 'rgba(255,255,255,0.6)' : '#8c8c8c',
                      fontStyle: 'italic'
                    }}>
                      Bu mesaj silindi
                    </Text>
                  ) : (
                    <>
                      {message.mediaUrl && (
                        <div style={{ marginBottom: message.text ? '8px' : 0 }}>
                          <img 
                            src={message.mediaUrl.startsWith('http') ? message.mediaUrl : `${API_URL}${message.mediaUrl}`}
                            alt="Gönderilen medya"
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '300px', 
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              window.open(
                                message.mediaUrl.startsWith('http') ? message.mediaUrl : `${API_URL}${message.mediaUrl}`,
                                '_blank'
                              );
                            }}
                          />
                        </div>
                      )}
                      {message.text}
                    </>
                  )}
                </Text>
                {!message.isSystem && !message.deleted && (
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'copy',
                          label: 'Kopyala',
                          icon: <CopyOutlined />,
                          onClick: () => copyMessage(message.text)
                        },
                        ...(message.userId === userId ? [{
                          key: 'delete',
                          label: 'Sil',
                          icon: <DeleteOutlined />,
                          danger: true,
                          onClick: () => deleteMessage(message.id)
                        }] : []),
                        {
                          key: 'react',
                          label: 'Reaksiyon',
                          icon: <SmileOutlined />,
                          children: ['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => ({
                            key: emoji,
                            label: emoji,
                            onClick: () => reactToMessage(message.id, emoji)
                          }))
                        }
                      ]
                    }}
                    trigger={['contextMenu', 'click']}
                  >
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<SmileOutlined />}
                      style={{ 
                        color: message.userId === userId ? 'rgba(255,255,255,0.7)' : '#8c8c8c',
                        marginLeft: '8px'
                      }}
                    />
                  </Dropdown>
                )}
              </div>
              
              {/* Reaksiyonlar */}
              {message.reactions && Object.keys(message.reactions).length > 0 && (
                <div style={{ 
                  marginTop: '8px', 
                  display: 'flex', 
                  gap: '4px', 
                  flexWrap: 'wrap' 
                }}>
                  {Object.entries(message.reactions).map(([reaction, userIds]) => (
                    <Tag
                      key={reaction}
                      style={{ 
                        cursor: 'pointer',
                        backgroundColor: message.userId === userId ? 'rgba(255,255,255,0.2)' : '#f0f0f0'
                      }}
                      onClick={() => reactToMessage(message.id, reaction)}
                    >
                      {reaction} {userIds.length}
                    </Tag>
                  ))}
                </div>
              )}
              
              {/* Okundu bilgisi */}
              {message.userId === userId && message.readBy && message.readBy.length > 0 && (
                <div style={{ 
                  marginTop: '4px', 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <CheckOutlined style={{ 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '12px' 
                  }} />
                  <Text style={{ 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '11px' 
                  }}>
                    Okundu
                  </Text>
                </div>
              )}
            </Card>
          </div>
        ))}
        
        {typingUsers.size > 0 && (
          <Text type="secondary" italic style={{ fontSize: '12px' }}>
            {Array.from(typingUsers).join(', ')} yazıyor...
          </Text>
        )}
        <div ref={messagesEndRef} />
      </Content>

      {/* Decision or Input */}
      {showDecision ? (
        <Footer style={{ 
          background: '#fff', 
          padding: '24px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: '16px' }}>
            30 saniye doldu. Devam etmek istiyor musunuz?
          </Title>
          <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              onClick={() => handleDecision('continue')}
              style={{
                height: '48px',
                minWidth: '150px',
                background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
                border: 'none'
              }}
            >
              ✅ Devam Et
            </Button>
            <Button
              danger
              size="large"
              onClick={() => handleDecision('leave')}
              style={{
                height: '48px',
                minWidth: '150px'
              }}
            >
              ❌ Çık
            </Button>
          </Space>
        </Footer>
      ) : (
        <Footer style={{ 
          background: '#fff', 
          padding: '16px 24px',
          borderTop: '1px solid #f0f0f0'
        }}>
          {selectedMedia && (
            <div style={{ 
              padding: '12px', 
              background: '#f0f0f0', 
              borderRadius: '8px', 
              marginBottom: '8px',
              position: 'relative'
            }}>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => {
                  setSelectedMedia(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{ position: 'absolute', right: '8px', top: '8px' }}
              />
              <img 
                src={selectedMedia.preview} 
                alt="Önizleme" 
                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px' }}
              />
            </div>
          )}
          <form 
            onSubmit={sendMessage} 
            style={{ display: 'flex', gap: '8px' }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleMediaSelect(file);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files[0]) handleMediaSelect(e.target.files[0]);
              }}
            />
            <Button
              type="text"
              icon={<PictureOutlined />}
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: '20px' }}
              disabled={uploadingMedia}
            />
            <Popover
              content={
                <div style={{ width: '280px', maxHeight: '200px', overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px' }}>
                    {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].map(emoji => (
                      <Button
                        key={emoji}
                        type="text"
                        style={{ fontSize: '20px', padding: '4px' }}
                        onClick={() => {
                          setMessageText(prev => prev + emoji);
                          setEmojiPickerVisible(false);
                        }}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </div>
              }
              title="Emoji Seç"
              trigger="click"
              open={emojiPickerVisible}
              onOpenChange={setEmojiPickerVisible}
            >
              <Button 
                type="text" 
                icon={<SmileOutlined />}
                style={{ fontSize: '20px' }}
              />
            </Popover>
            <Input
              value={messageText}
              onChange={handleTyping}
              placeholder={partnerProfile ? "Mesajınızı yazın..." : "Anonim sohbet başladı..."}
              maxLength={500}
              size="large"
            />
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              disabled={(!messageText.trim() && !selectedMedia) || uploadingMedia}
              loading={uploadingMedia}
              size="large"
              style={{
                background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
                border: 'none'
              }}
            />
          </form>
        </Footer>
      )}
    </Layout>
  );
}

export default ChatScreen;