import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
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
  Divider
} from 'antd';
import {
  SendOutlined,
  SafetyCertificateOutlined,
  ArrowLeftOutlined
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
    if (!partnerProfile && !showDecision && matchId) {
      setTimer(30);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
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
              </Space>
              {partnerProfile.age && (
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Yaş: {partnerProfile.age}
                  </Text>
                </div>
              )}
            </div>
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
              <Text style={{ 
                color: message.userId === userId ? '#fff' : '#000'
              }}>
                {message.text}
              </Text>
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
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
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
              disabled={!messageText.trim()}
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