import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  Layout,
  Typography,
  Button,
  Input,
  Avatar,
  Space,
  Tooltip,
  Modal,
  Badge,
  Dropdown,
  Menu,
  Spin,
  message as antdMessage,
  Radio,
  Popconfirm
} from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  SmileOutlined,
  UserOutlined,
  PhoneOutlined,
  PictureOutlined,
  MoreOutlined,
  ExclamationCircleOutlined,
  BlockOutlined,
  WarningOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import io from 'socket.io-client';
import axios from 'axios';
import { Image } from 'antd';
import { ThemeContext } from '../App';
import './ChatScreen.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Group: RadioGroup } = Radio;

function ChatScreen({
  userId,
  profile: currentProfile,
  matchId: initialMatchId,
  partnerProfile: initialPartnerProfile,
  onMatchEnded,
  onMatchContinued,
  onGoBack,
  API_URL
}) {
  const { isDarkMode } = useContext(ThemeContext);

  // --- STATE ---
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [isCompletedMatch, setIsCompletedMatch] = useState(!!initialPartnerProfile);
  const [partnerProfile, setPartnerProfile] = useState(initialPartnerProfile);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [continueRequestReceived, setContinueRequestReceived] = useState(false);
  const waitingForPartnerRef = useRef(false);
  const [userAnonymousId, setUserAnonymousId] = useState(null);
  const [partnerAnonymousId, setPartnerAnonymousId] = useState(null);
  const [currentMatchId, setCurrentMatchId] = useState(initialMatchId);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    soundEnabled: true,
    browserEnabled: true,
    messageEnabled: true
  });
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [showPartnerProfileModal, setShowPartnerProfileModal] = useState(false);
  const [showViewProfileModal, setShowViewProfileModal] = useState(false);
  const [viewProfileData, setViewProfileData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReasonType, setReportReasonType] = useState(null);
  const [reportCustomReason, setReportCustomReason] = useState('');
  const audioRef = useRef(null);

  // --- IMAGE PREVIEW MODAL ---
  const renderImagePreviewModal = () => (
    <Modal
      open={isPreviewVisible}
      footer={null}
      centered
      onCancel={() => setIsPreviewVisible(false)}
      bodyStyle={{ padding: 0, backgroundColor: '#000' }}
      width="auto"
    >
      {previewImageUrl && (
        <img
          src={previewImageUrl}
          alt="Medya Önizleme"
          style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block', margin: '0 auto' }}
        />
      )}
    </Modal>
  );

  // --- INITIAL LOAD & SOCKET SETUP ---
  useEffect(() => {
    // Random 6 haneli anonim ID
    if (!userAnonymousId) {
      const randomId = Math.floor(100000 + Math.random() * 900000);
      setUserAnonymousId(randomId);
    }

    const activeMatchId = currentMatchId || initialMatchId;

    // Eğer initialPartnerProfile yoksa ama matchId varsa: completed match için API'den kontrol
    if (!initialPartnerProfile && activeMatchId && typeof activeMatchId === 'string' && activeMatchId.trim() !== '') {
      const cleanMatchId = activeMatchId.trim();
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ Token bulunamadı, login sayfasına yönlendiriliyor...');
        if (onGoBack) onGoBack();
        return;
      }

      const fetchMatchWithRetry = async (retries = 0) => {
        const maxRetries = 3;
        const retryDelay = 500;

        try {
          const response = await fetch(`${API_URL}/api/matches/${cleanMatchId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.status === 401) {
            console.error('❌ Token geçersiz, login sayfasına yönlendiriliyor...');
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            if (onGoBack) onGoBack();
            return null;
          }

          if (response.ok) {
            return await response.json();
          }

          if (response.status === 404 && retries < maxRetries) {
            console.warn(`⚠️ Match bulunamadı (404), ${retryDelay}ms sonra tekrar deneniyor... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchMatchWithRetry(retries + 1);
          }

          if (response.status === 404) {
            console.warn('⚠️ Match bulunamadı (404), geri dönülüyor...');
            if (onGoBack) onGoBack();
            return null;
          }

          throw new Error('Match bulunamadı');
        } catch (error) {
          if (retries < maxRetries) {
            console.warn(`⚠️ Hata oluştu, ${retryDelay}ms sonra tekrar deneniyor... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchMatchWithRetry(retries + 1);
          }
          throw error;
        }
      };

      fetchMatchWithRetry()
        .then(response => {
          if (!response) return;
          return response;
        })
        .then(data => {
          if (data && data.match) {
            const partner = data.match.partner;

            if (data.match.messages && data.match.messages.length > 0) {
              console.log(`✅ ${data.match.messages.length} mesaj yüklendi`);
              setMessages(data.match.messages);
            } else {
              console.log('⚠️ Mesaj geçmişi boş');
            }

            if (partner && (partner.userId || partner.username)) {
              console.log('✅ Completed match bulundu, profil yükleniyor:', partner);
              setIsCompletedMatch(true);
              setPartnerProfile(partner);

              fetch(`${API_URL}/api/matches/${cleanMatchId}/mark-read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              }).catch(err => console.error('Mesaj okundu işaretleme hatası:', err));
            } else {
              console.log('✅ Aktif eşleşme - partner null (anonim)');
              setIsCompletedMatch(false);
              setPartnerProfile(null);

              if (data.match.partnerAnonymousId) {
                setPartnerAnonymousId(data.match.partnerAnonymousId);
              }
            }

            if (data.match.pendingFollowRequest) {
              const pfr = data.match.pendingFollowRequest;
              console.log('✅ Pending follow request bulundu:', pfr);
              if (pfr.isReceived) {
                console.log('✅ Kullanıcıya gelen istek, yanıt vermesi gerekiyor');
                setContinueRequestReceived(true);
                setWaitingForPartner(false);
              } else if (pfr.isSent) {
                console.log('✅ Kullanıcının gönderdiği istek, yanıt bekliyor');
                setWaitingForPartner(true);
                waitingForPartnerRef.current = true;
                setContinueRequestReceived(false);
              }
            }
          }
        })
        .catch(err => {
          if (err.message !== 'Match bulunamadı') {
            console.error('Match kontrolü hatası:', err);
          }
          setIsCompletedMatch(false);
        });
    } else if (initialPartnerProfile && activeMatchId) {
      console.log('✅ initialPartnerProfile var - completed match', initialPartnerProfile);
      setIsCompletedMatch(true);
      setPartnerProfile(initialPartnerProfile);

      const token = localStorage.getItem('token');
      if (token) {
        fetch(`${API_URL}/api/matches/${activeMatchId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.match?.messages?.length > 0) {
              console.log(`✅ ${data.match.messages.length} mesaj yüklendi`);
              setMessages(data.match.messages);
            }

            fetch(`${API_URL}/api/matches/${activeMatchId}/mark-read`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            }).catch(err => console.error('Mesaj okundu işaretleme hatası:', err));
          })
          .catch(err => console.error('Mesaj yükleme hatası:', err));
      }
    }

    // SOCKET
    const newSocket = io(API_URL);
    setSocket(newSocket);

    const checkAndSetProfile = () => {
      const activeMatchIdLocal = currentMatchId || initialMatchId;
      if (newSocket.connected) {
        console.log('ChatScreen: Socket bağlı, profil set ediliyor:', userId, activeMatchIdLocal);
        newSocket.emit('set-profile', { userId, matchId: activeMatchIdLocal });
      } else {
        console.log('ChatScreen: Socket henüz bağlı değil, bekleniyor...');
      }
    };

    newSocket.on('connect', () => {
      const activeMatchIdLocal = currentMatchId || initialMatchId;
      console.log('ChatScreen: Socket bağlandı, socket.id:', newSocket.id, 'userId:', userId, 'matchId:', activeMatchIdLocal);
      newSocket.emit('set-profile', { userId, matchId: activeMatchIdLocal });
    });

    newSocket.on('profile-set', () => {
      console.log('ChatScreen: Profil başarıyla set edildi, mesaj gönderebilirsiniz');
    });

    newSocket.on('match-found', (data) => {
      console.log('✅ ChatScreen: match-found event alındı', data);
      if (data.matchId) {
        setCurrentMatchId(data.matchId);
        console.log('✅ ChatScreen: matchId güncellendi:', data.matchId);
      }
      if (data.userAnonymousId) setUserAnonymousId(data.userAnonymousId);
      if (data.partnerAnonymousId) setPartnerAnonymousId(data.partnerAnonymousId);
    });

    checkAndSetProfile();
    if (newSocket.connected) {
      checkAndSetProfile();
    }

    newSocket.on('new-message', (message) => {
      console.log('Yeni mesaj alındı:', message);
      if (message.userId === userId) {
        console.log('Kendi mesajımız, new-message ile eklenmeyecek');
        return;
      }

      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          console.log('Mesaj zaten var (ID):', message.id);
          return prev;
        }
        return [...prev, message];
      });

      if (message.userId !== userId) {
        showNotification(message);
      }

      const activeMatchIdLocal = currentMatchId || initialMatchId;
      if (message.userId !== userId && newSocket && activeMatchIdLocal) {
        newSocket.emit('mark-message-read', { matchId: activeMatchIdLocal, messageId: message.id });
      }
    });

    newSocket.on('notification', (notification) => {
      console.log('Notification alındı:', notification);
    });

    newSocket.on('message-sent', (message) => {
      console.log('Mesaj gönderildi (confirmation):', message);
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isTemporary || m.text !== message.text);
        if (filtered.some(m => m.id === message.id)) {
          console.log('Mesaj zaten var (message-sent):', message.id);
          return filtered;
        }
        return [...filtered, message];
      });
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      if (error.message && error.message.includes('Profil bulunamadı')) {
        console.log('❌ Profil bulunamadı, login sayfasına yönlendiriliyor...');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        antdMessage.error('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
        setTimeout(() => {
          if (onGoBack) onGoBack();
        }, 1500);
        return;
      }
      if (error.message && error.message.includes('Eşleşme bulunamadı')) {
        console.log('❌ Eşleşme bulunamadı hatası alındı');
        setWaitingForPartner(false);
        if (onMatchEnded) onMatchEnded();
        return;
      }
      antdMessage.error(error.message || 'Bir hata oluştu');
    });

    newSocket.on('user-typing', (data) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          if (!partnerProfile) {
            newSet.add('Anonim');
          } else {
            newSet.add(data.username);
          }
        } else {
          if (!partnerProfile) {
            newSet.delete('Anonim');
          } else {
            newSet.delete(data.username);
          }
        }
        return newSet;
      });
    });

    newSocket.on('match-ended', (data) => {
      console.log('❌ ChatScreen: match-ended event alındı', data);
      setWaitingForPartner(false);
      onMatchEnded && onMatchEnded();
    });

    newSocket.on('partner-disconnected', () => {
      setMessages(prev => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          text: 'Eşleşme partneri bağlantısını kesti',
          isSystem: true,
          timestamp: new Date()
        }
      ]);
    });

    newSocket.on('message-reaction', (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, reactions: data.reactions } : m
      ));
    });

    newSocket.on('message-read', (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId
          ? { ...m, readBy: [...(m.readBy || []), data.readBy] }
          : m
      ));
    });

    newSocket.on('messages-read', (data) => {
      setMessages(prev => prev.map(m =>
        data.messageIds && data.messageIds.includes(m.id)
          ? { ...m, readBy: [...(m.readBy || []), data.readBy] }
          : m
      ));
    });

    newSocket.on('message-deleted', (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, deleted: true, text: 'Bu mesaj silindi' } : m
      ));
    });

    newSocket.on('match-continued', (data) => {
      console.log('✅ ChatScreen: match-continued event alındı', data);
      waitingForPartnerRef.current = false;
      setWaitingForPartner(false);
      setContinueRequestReceived(false);
      setIsCompletedMatch(true);
      setPartnerProfile(data.partnerProfile);

      if (!partnerAnonymousId) {
        const randomId = Math.floor(100000 + Math.random() * 900000);
        setPartnerAnonymousId(randomId);
      }

      if (onMatchContinued) {
        console.log('✅ ChatScreen: onMatchContinued çağrılıyor', data.partnerProfile);
        onMatchContinued(data.partnerProfile);
      }

      const updatedMatchId = data.matchId || currentMatchId || initialMatchId;
      if (updatedMatchId) {
        setCurrentMatchId(updatedMatchId);
        console.log('✅ match-continued: Mesaj geçmişi yükleniyor...', updatedMatchId);
        fetch(`${API_URL}/api/matches/${updatedMatchId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
          .then(response => {
            if (response.ok) return response.json();
            throw new Error('Mesaj geçmişi yüklenemedi');
          })
          .then(responseData => {
            console.log('✅ match-continued: Mesaj geçmişi yüklendi', responseData);
            if (responseData?.match?.messages?.length > 0) {
              console.log(`✅ ${responseData.match.messages.length} mesaj yüklendi`);
              setMessages(prevMessages => {
                const existingIds = new Set(prevMessages.map(m => m.id));
                const newMessages = responseData.match.messages.filter(m => !existingIds.has(m.id));
                return [...prevMessages, ...newMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              });
            } else {
              console.log('⚠️ Mesaj geçmişi boş, mevcut mesajlar korunuyor');
            }
          })
          .catch(err => {
            console.error('❌ Mesaj geçmişi yüklenemedi:', err);
          });
      }
    });

    newSocket.on('continue-request-received', (data) => {
      console.log('✅ ChatScreen: continue-request-received event alındı', data);
      setContinueRequestReceived(true);
      setWaitingForPartner(false);
    });

    newSocket.on('continue-request-sent', (data) => {
      console.log('✅ ChatScreen: continue-request-sent event alındı', data);
      setWaitingForPartner(true);
      waitingForPartnerRef.current = true;
    });

    newSocket.on('continue-request-rejected', (data) => {
      console.log('❌ ChatScreen: continue-request-rejected event alındı', data);
      setWaitingForPartner(false);
      setContinueRequestReceived(false);
      antdMessage.error('Devam isteği reddedildi');
      onMatchEnded && onMatchEnded();
    });

    return () => {
      newSocket.close();
    };
  }, [userId, API_URL, onMatchEnded, onMatchContinued, onGoBack, currentMatchId, initialMatchId, initialPartnerProfile, partnerProfile, partnerAnonymousId]);

  // Scroll messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // --- ACTIONS ---

  const sendMessage = (e) => {
    e.preventDefault();
    if (selectedMedia) {
      sendMediaMessage();
      return;
    }

    const activeMatchId = currentMatchId || initialMatchId;
    if (messageText.trim() && socket && activeMatchId) {
      if (!socket.connected) {
        console.warn('Socket bağlı değil, mesaj gönderilemiyor');
        socket.once('connect', () => {
          console.log('Socket bağlandı, mesaj gönderiliyor');
          socket.emit('set-profile', { userId, matchId: activeMatchId });
          setTimeout(() => {
            socket.emit('send-message', {
              matchId: activeMatchId,
              text: messageText.trim(),
              userId
            });
          }, 100);
        });
        return;
      }

      console.log('Mesaj gönderiliyor:', { matchId: activeMatchId, text: messageText.trim(), socketConnected: socket.connected });

      const tempMessage = {
        id: `temp-${Date.now()}`,
        userId,
        username: partnerProfile
          ? (currentProfile?.username || 'Sen')
          : `Anonim-${userAnonymousId || '000000'}`,
        text: messageText.trim(),
        timestamp: new Date(),
        matchId: activeMatchId,
        isTemporary: true
      };
      setMessages(prev => [...prev, tempMessage]);

      socket.emit('send-message', {
        matchId: activeMatchId,
        text: messageText.trim(),
        userId
      });

      setMessageText('');
      setIsTyping(false);
      socket.emit('typing', { isTyping: false, matchId: activeMatchId });
    } else {
      const activeMatchIdLocal = currentMatchId || initialMatchId;
      console.log('Mesaj gönderilemedi:', {
        hasText: !!messageText.trim(),
        hasSocket: !!socket,
        hasMatchId: !!activeMatchIdLocal
      });
    }
  };

  // Devam etmek istiyorum isteği gönder
  const handleContinueRequest = () => {
    const activeMatchId = currentMatchId || initialMatchId;

    if (socket && activeMatchId) {
      console.log('Devam isteği gönderiliyor:', { matchId: activeMatchId, socketConnected: socket.connected, currentMatchId, initialMatchId });

      if (!socket.connected) {
        antdMessage.error('Bağlantı hatası. Lütfen sayfayı yenileyin.');
        return;
      }

      socket.emit('continue-request', { matchId: activeMatchId });
      setWaitingForPartner(true);
      waitingForPartnerRef.current = true;
    } else {
      console.error('Devam isteği gönderilemedi:', { hasSocket: !!socket, hasMatchId: !!activeMatchId, currentMatchId, initialMatchId });
    }
  };

  // Devam isteğini kabul et
  const handleAcceptContinue = () => {
    const activeMatchId = currentMatchId || initialMatchId;
    if (socket && activeMatchId) {
      socket.emit('accept-continue-request', { matchId: activeMatchId });
    }
  };

  // Devam isteğini reddet
  const handleRejectContinue = () => {
    const activeMatchId = currentMatchId || initialMatchId;
    if (socket && activeMatchId) {
      socket.emit('reject-continue-request', { matchId: activeMatchId });
      onMatchEnded && onMatchEnded();
    }
  };

  const showNotification = (msg) => {
    if (!notificationSettings.messageEnabled) return;

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

    if (notificationSettings.soundEnabled) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const frequencies = [880, 660];
        const duration = 0.15;

        frequencies.forEach((freq, index) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = freq;
          oscillator.type = 'sine';

          const startTime = audioContext.currentTime + (index * 0.05);
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        });
      } catch (e) {
        console.error('Ses çalınamadı:', e);
      }
    }
  };

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      antdMessage.success('Mesaj kopyalandı');
    }).catch(() => {
      antdMessage.error('Kopyalama başarısız');
    });
  };

  const deleteMessage = (messageId) => {
    const activeMatchId = currentMatchId || initialMatchId;
    if (socket && activeMatchId) {
      socket.emit('delete-message', { matchId: activeMatchId, messageId });
    }
  };

  const reactToMessage = (messageId, reaction) => {
    const activeMatchId = currentMatchId || initialMatchId;
    if (socket && activeMatchId && socket.connected) {
      console.log('Reaksiyon gönderiliyor:', { matchId: activeMatchId, messageId, reaction });
      socket.emit('react-to-message', { matchId: activeMatchId, messageId, reaction });
    } else {
      console.warn('Reaksiyon gönderilemedi:', { socket: !!socket, matchId: activeMatchId, connected: socket?.connected });
    }
  };

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

  const sendMediaMessage = async () => {
    const activeMatchId = currentMatchId || initialMatchId;
    if (!selectedMedia || !socket || !activeMatchId || uploadingMedia) return;

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

      socket.emit('send-message', {
        matchId: activeMatchId,
        text: messageText.trim() || '',
        userId,
        mediaUrl,
        mediaType
      });

      const tempMessage = {
        id: `temp-${Date.now()}`,
        userId,
        username: partnerProfile
          ? (currentProfile?.username || 'Sen')
          : `Anonim-${userAnonymousId || '000000'}`,
        text: messageText.trim() || '',
        timestamp: new Date(),
        matchId: activeMatchId,
        mediaUrl,
        mediaType,
        isTemporary: true
      };
      setMessages(prev => [...prev, tempMessage]);

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

  const handleBlockUser = async () => {
    if (!partnerProfile || !partnerProfile.userId) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/users/block`,
        { targetUserId: partnerProfile.userId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      antdMessage.success('Kullanıcı engellendi');
      onMatchEnded && onMatchEnded();
    } catch (error) {
      console.error('Engelleme hatası:', error);
      antdMessage.error('Kullanıcı engellenemedi');
    }
  };

  const handleReportUser = async () => {
    if (!partnerProfile || !partnerProfile.userId) return;
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportReasonType && !reportCustomReason.trim()) {
      antdMessage.warning('Lütfen bir sebep seçin veya yazın');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/users/report`,
        {
          targetUserId: partnerProfile.userId,
          reasonType: reportReasonType,
          customReason: reportCustomReason.trim() || null
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      antdMessage.success('Şikayet gönderildi');
      setShowReportModal(false);
      setReportReasonType(null);
      setReportCustomReason('');
    } catch (error) {
      console.error('Şikayet gönderme hatası:', error);
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

  const formatDisplayName = (profile) => {
    if (!profile) return 'Bilinmeyen Kullanıcı';
    const firstName = profile.firstName || '';
    const lastName = profile.lastName || '';
    const username = profile.username || '';

    if (firstName || lastName) {
      const fullName = `${firstName} ${lastName}`.trim();
      return username ? `${fullName} (@${username})` : fullName;
    }
    return username ? `@${username}` : 'Bilinmeyen Kullanıcı';
  };

  // Galeri (ileride kullanmak istersen)
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);

  // --- RENDER ---
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
        background: isDarkMode ? '#1a1a2e' : '#fff',
        padding: '8px 12px',
        borderBottom: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 0.3s ease, border-color 0.3s ease',
        height: 'auto',
        lineHeight: 'normal',
        minHeight: '56px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {onGoBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onGoBack}
              style={{
                fontSize: '16px',
                padding: '4px 8px',
                flexShrink: 0
              }}
            />
          )}
          {partnerProfile ? (
            <div
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flex: 1,
                minWidth: 0,
                padding: '4px',
                borderRadius: '8px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDarkMode
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => setShowPartnerProfileModal(true)}
            >
              <Avatar
                size={40}
                src={partnerProfile.photos && partnerProfile.photos.length > 0
                  ? (partnerProfile.photos[0].url && partnerProfile.photos[0].url.startsWith('http')
                    ? partnerProfile.photos[0].url
                    : `${API_URL}${partnerProfile.photos[0].url}`)
                  : undefined}
                style={{ backgroundColor: '#1890ff', flexShrink: 0 }}
              >
                {partnerProfile.username?.charAt(0).toUpperCase()}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Text strong style={{
                    color: isDarkMode ? '#fff' : '#000',
                    fontSize: '15px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {formatDisplayName(partnerProfile)}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {partnerProfile.age ? `${partnerProfile.age} yaş` : 'Yaş belirtilmemiş'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {partnerProfile.city || 'Şehir belirtilmemiş'}
                  </Text>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <Text strong style={{
                color: isDarkMode ? '#fff' : '#000',
                fontSize: '15px'
              }}>
                Anonim Sohbet
              </Text>
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Eşleşme ID: {currentMatchId || initialMatchId || 'Yükleniyor...'}
                </Text>
              </div>
            </div>
          )}
        </div>
      </Header>

      {/* Messages */}
      <Content style={{
        flex: 1,
        overflow: 'auto',
        padding: '10px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: isDarkMode ? '#17202a' : '#f5f5f5',
        transition: 'background 0.3s ease'
      }}>
        {messages
          .filter((m, idx, self) => idx === self.findIndex(mm => mm.id === m.id))
          .map((message) => {
            const messageSenderProfile = message.userId === userId ? currentProfile : partnerProfile;
            const isOwn = message.userId === userId;
            const isRead = message.readBy && message.readBy.filter(id => id !== userId).length > 0;

            return (
              <div
                key={message.id}
                className="rce-container-mbox"
                style={{
                  display: 'flex',
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                  alignItems: 'flex-end'
                }}
              >
                <div
                  className="rce-mbox"
                  style={{
                    position: 'relative',
                    maxWidth: '80%',
                    minWidth: '120px',
                    backgroundColor: isOwn
                      ? (isDarkMode ? '#5b5ea6' : '#4f81e2')
                      : (isDarkMode ? '#2d2d30' : '#ffffff'),
                    borderRadius: isOwn ? '10px 10px 0 10px' : '10px 10px 10px 0',
                    boxShadow: isDarkMode
                      ? '0 1px 2px rgba(0,0,0,0.3)'
                      : '0 1px 2px rgba(0,0,0,0.1)',
                    overflow: 'hidden'
                  }}
                >
                  {!message.isSystem && (
                    <div
                      className="rce-mbox-title"
                      style={{
                        padding: '5px 10px 0 10px',
                        color: isOwn
                          ? 'rgba(255,255,255,0.9)'
                          : (isDarkMode ? '#4fc3f7' : '#4f81e2'),
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {isCompletedMatch && messageSenderProfile
                        ? formatDisplayName(messageSenderProfile)
                        : isOwn ? 'Sen' : `Anonim-${partnerAnonymousId || '000000'}`
                      }
                    </div>
                  )}

                  <div
                    className="rce-mbox-body"
                    style={{
                      padding: message.isSystem ? '8px 10px' : '3px 10px 6px 10px'
                    }}
                  >
                    {message.mediaUrl && !message.deleted && (
                      <div style={{ marginBottom: message.text ? '6px' : 0 }}>
                        <img
                          src={message.mediaUrl.startsWith('http')
                            ? message.mediaUrl
                            : `${API_URL}${message.mediaUrl}`}
                          alt="Medya"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '200px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'block'
                          }}
                          onClick={() => {
                            const url = message.mediaUrl.startsWith('http')
                              ? message.mediaUrl
                              : `${API_URL}${message.mediaUrl}`;
                            setPreviewImageUrl(url);
                            setIsPreviewVisible(true);
                          }}
                        />
                      </div>
                    )}

                    <div
                      className="rce-mbox-text"
                      style={{
                        color: isOwn
                          ? '#fff'
                          : (isDarkMode ? '#e4e6eb' : '#303030'),
                        fontSize: '14px',
                        lineHeight: '1.4',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {message.deleted
                        ? <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Bu mesaj silindi</span>
                        : message.text}
                    </div>

                    <div
                      className="rce-mbox-time"
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '4px'
                      }}
                    >
                      <span style={{
                        fontSize: '11px',
                        color: isOwn
                          ? 'rgba(255,255,255,0.7)'
                          : (isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)')
                      }}>
                        {formatTime(message.timestamp)}
                      </span>
                      {isOwn && (
                        <span style={{
                          fontSize: '13px',
                          color: isRead ? '#4fc3f7' : 'rgba(255,255,255,0.5)'
                        }}>
                          {isRead ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        {typingUsers.size > 0 && (
          <Text type="secondary" italic style={{ fontSize: '12px' }}>
            {Array.from(typingUsers).join(', ')} yazıyor...
          </Text>
        )}
        <div ref={messagesEndRef} />
      </Content>

      {/* Continue Request / Input Footer */}
      {/* (Buraya mevcut input alanın vs. gelecektir; mevcut projenin alt kısmını koru) */}

       {/* Image preview modal */}
      {renderImagePreviewModal()}
    </Layout>
  );
}

export default ChatScreen;