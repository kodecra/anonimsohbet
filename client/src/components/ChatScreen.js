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
  Modal,
  Row,
  Col,
  Radio,
  Spin,
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
import { Image } from 'antd';
import { ThemeContext } from '../App';
import './ChatScreen.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { Group: RadioGroup } = Radio;

function ChatScreen({ userId, profile: currentProfile, matchId: initialMatchId, partnerProfile: initialPartnerProfile, onMatchEnded, onMatchContinued, onGoBack, API_URL }) {
  const { isDarkMode } = React.useContext(ThemeContext);
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
  const [showPartnerProfileModal, setShowPartnerProfileModal] = useState(false);
  const [showViewProfileModal, setShowViewProfileModal] = useState(false);
  const [viewProfileData, setViewProfileData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReasonType, setReportReasonType] = useState(null);
  const [reportCustomReason, setReportCustomReason] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    // Random 6 haneli anonim ID oluştur
    if (!userAnonymousId) {
      const randomId = Math.floor(100000 + Math.random() * 900000);
      setUserAnonymousId(randomId);
    }
    
    // Completed match kontrolü: initialPartnerProfile yoksa ama matchId varsa API'den kontrol et
    const activeMatchId = currentMatchId || initialMatchId;
    if (!initialPartnerProfile && activeMatchId && typeof activeMatchId === 'string' && activeMatchId.trim() !== '') {
      // matchId'nin geçerli olduğundan emin ol
      const cleanMatchId = activeMatchId.trim();
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ Token bulunamadı, login sayfasına yönlendiriliyor...');
        if (onGoBack) onGoBack();
        return;
      }
      
      // Retry mekanizması ile fetch
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
          
          // 404 hatası - retry mekanizması
          if (response.status === 404 && retries < maxRetries) {
            console.warn(`⚠️ Match bulunamadı (404), ${retryDelay}ms sonra tekrar deneniyor... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchMatchWithRetry(retries + 1);
          }
          
          // 404 hatası ve retry limiti aşıldı - geri dön
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
          // Backend'den gelen partner bilgisini kullan
          // Aktif eşleşmede partner null, completed'de dolu
          const partnerProfile = data.match.partner;
          
          
          // Mesaj geçmişini yükle (hem aktif hem completed için)
          if (data.match.messages && data.match.messages.length > 0) {
            console.log(`✅ ${data.match.messages.length} mesaj yüklendi`);
            setMessages(data.match.messages);
          } else {
            console.log('⚠️ Mesaj geçmişi boş');
          }
          
          if (partnerProfile && (partnerProfile.userId || partnerProfile.username)) {
            // Completed match - partner bilgisi var
            console.log('✅ Completed match bulundu, profil yükleniyor:', partnerProfile);
            setIsCompletedMatch(true);
            setPartnerProfile(partnerProfile);
            
            // Mesajları okundu olarak işaretle
            fetch(`${API_URL}/api/matches/${cleanMatchId}/mark-read`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            }).catch(err => console.error('Mesaj okundu işaretleme hatası:', err));
          } else {
            // Aktif eşleşme - partner null (anonim)
            console.log('✅ Aktif eşleşme - partner null (anonim)');
            setIsCompletedMatch(false);
            setPartnerProfile(null);
            
            // Partner'ın anonim numarasını API'den al
            if (data.match.partnerAnonymousId) {
              setPartnerAnonymousId(data.match.partnerAnonymousId);
            }
          }
          
          // Pending follow request kontrolü
          if (data.match.pendingFollowRequest) {
            const pfr = data.match.pendingFollowRequest;
            console.log('✅ Pending follow request bulundu:', pfr);
            if (pfr.isReceived) {
              // Kullanıcıya gelen istek - yanıt vermesi gerekiyor
              console.log('✅ Kullanıcıya gelen istek, yanıt vermesi gerekiyor');
              setContinueRequestReceived(true);
              setWaitingForPartner(false);
            } else if (pfr.isSent) {
              // Kullanıcının gönderdiği istek - yanıt bekliyor
              console.log('✅ Kullanıcının gönderdiği istek, yanıt bekliyor');
              setWaitingForPartner(true);
              waitingForPartnerRef.current = true;
              setContinueRequestReceived(false);
            }
          }
        }
      })
      .catch(err => {
        // Match bulunamadı veya hata, yeni eşleşme olarak kabul et
        // Sadece debug için log, kullanıcıya gösterme
        if (err.message !== 'Match bulunamadı') {
          console.error('Match kontrolü hatası:', err);
        }
        setIsCompletedMatch(false);
      });
    } else if (initialPartnerProfile && activeMatchId) {
      // initialPartnerProfile varsa zaten completed match
      console.log('✅ initialPartnerProfile var - completed match', initialPartnerProfile);
      setIsCompletedMatch(true);
      setPartnerProfile(initialPartnerProfile);
      
      // Mesaj geçmişini yükle
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
          
          // Mesajları okundu olarak işaretle
          fetch(`${API_URL}/api/matches/${activeMatchId}/mark-read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(err => console.error('Mesaj okundu işaretleme hatası:', err));
        })
        .catch(err => console.error('Mesaj yükleme hatası:', err));
      }
    }
    
    const newSocket = io(API_URL);
    setSocket(newSocket);

    // Socket bağlantı durumunu kontrol et
    const checkAndSetProfile = () => {
      const activeMatchId = currentMatchId || initialMatchId;
      if (newSocket.connected) {
        console.log('ChatScreen: Socket bağlı, profil set ediliyor:', userId, activeMatchId);
        newSocket.emit('set-profile', { userId, matchId: activeMatchId });
      } else {
        console.log('ChatScreen: Socket henüz bağlı değil, bekleniyor...');
      }
    };

    newSocket.on('connect', () => {
      const activeMatchId = currentMatchId || initialMatchId;
      console.log('ChatScreen: Socket bağlandı, socket.id:', newSocket.id, 'userId:', userId, 'matchId:', activeMatchId);
      // set-profile event'ini gönder
      newSocket.emit('set-profile', { userId, matchId: activeMatchId });
      // Not: Mesaj geçmişi zaten ilk API çağrısında yükleniyor, tekrar yüklemeye gerek yok
    });

    // profile-set event'ini dinle
    newSocket.on('profile-set', (data) => {
      console.log('ChatScreen: Profil başarıyla set edildi, mesaj gönderebilirsiniz');
    });

    // match-found event'ini dinle
    newSocket.on('match-found', (data) => {
      console.log('✅ ChatScreen: match-found event alındı', data);
      if (data.matchId) {
        setCurrentMatchId(data.matchId);
        console.log('✅ ChatScreen: matchId güncellendi:', data.matchId);
      }
      if (data.userAnonymousId) {
        setUserAnonymousId(data.userAnonymousId);
      }
      if (data.partnerAnonymousId) {
        setPartnerAnonymousId(data.partnerAnonymousId);
      }
    });

    // Timer sistemi kaldırıldı - artık takip isteği sistemi kullanılıyor

    // İlk kontrol
    checkAndSetProfile();
    
    // Socket zaten bağlıysa hemen profil gönder
    if (newSocket.connected) {
      checkAndSetProfile();
    }

    newSocket.on('new-message', (message) => {
      console.log('Yeni mesaj alındı:', message);
      
      // Sadece başkasından gelen mesajları ekle (kendi mesajlarımız message-sent ile geliyor)
      if (message.userId === userId) {
        console.log('Kendi mesajımız, new-message ile eklenmeyecek');
        return;
      }
      
      // Mesajı ekle
      setMessages((prev) => {
        // ID ile kontrol - zaten varsa ekleme
        if (prev.some(m => m.id === message.id)) {
          console.log('Mesaj zaten var (ID):', message.id);
          return prev;
        }
        return [...prev, message];
      });
      
      // Bildirim göster (sadece kendi mesajımız değilse)
      if (message.userId !== userId) {
        showNotification(message);
      }
      
      // Mesajı okundu olarak işaretle
      const activeMatchId = currentMatchId || initialMatchId;
      if (message.userId !== userId && newSocket && activeMatchId) {
        newSocket.emit('mark-message-read', { matchId: activeMatchId, messageId: message.id });
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
        // Geçici mesajı kaldır
        const filtered = prev.filter(m => !m.isTemporary || m.text !== message.text);
        // ID ile kontrol - zaten varsa ekleme
        if (filtered.some(m => m.id === message.id)) {
          console.log('Mesaj zaten var (message-sent):', message.id);
          return filtered;
        }
        if (!filtered.some(m => m.id === message.id)) {
          return [...filtered, message];
        }
        return filtered;
      });
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      // "Profil bulunamadı" hatası - token geçersiz veya kullanıcı silinmiş
      if (error.message && error.message.includes('Profil bulunamadı')) {
        console.log('❌ Profil bulunamadı hatası alındı, login sayfasına yönlendiriliyor...');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        antdMessage.error('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
        setTimeout(() => {
          if (onGoBack) onGoBack();
        }, 1500);
        return;
      }
      // "Eşleşme bulunamadı" hatası geldiğinde timer'ı durdur ve eşleşmeyi sonlandır
      if (error.message && error.message.includes('Eşleşme bulunamadı')) {
        console.log('❌ Eşleşme bulunamadı hatası alındı');
        setWaitingForPartner(false);
        if (onMatchEnded) onMatchEnded();
        return;
      }
      // Hata mesajı göster
      antdMessage.error(error.message || 'Bir hata oluştu');
    });

    newSocket.on('user-typing', (data) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          // Anonim eşleşmede "Anonim yazıyor" göster
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

    // time-up event'i kaldırıldı - artık kullanılmıyor

    // Mesaj reaksiyonu güncellendi
    newSocket.on('message-reaction', (data) => {
      setMessages((prev) => prev.map(m => 
        m.id === data.messageId ? { ...m, reactions: data.reactions } : m
      ));
    });

    // Mesaj okundu işaretlendi (tek mesaj)
    newSocket.on('message-read', (data) => {
      setMessages((prev) => prev.map(m => 
        m.id === data.messageId ? { 
          ...m, 
          readBy: [...(m.readBy || []), data.readBy] 
        } : m
      ));
    });
    
    // Mesajlar okundu işaretlendi (çoklu mesaj)
    newSocket.on('messages-read', (data) => {
      setMessages((prev) => prev.map(m => 
        data.messageIds && data.messageIds.includes(m.id) ? { 
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
      console.log('✅ ChatScreen: match-continued event alındı', data);
      
      // State'leri güncelle
      waitingForPartnerRef.current = false;
      setWaitingForPartner(false);
      setContinueRequestReceived(false);
      setIsCompletedMatch(true); // ÖNCE isCompletedMatch'i true yap
      setPartnerProfile(data.partnerProfile); // SONRA partnerProfile'ı set et
      
      // Partner için random ID oluştur
      if (!partnerAnonymousId) {
        const randomId = Math.floor(100000 + Math.random() * 900000);
        setPartnerAnonymousId(randomId);
      }
      
      // Hemen sohbet ekranına geç, geri sayım bekleme
      if (onMatchContinued) {
        console.log('✅ ChatScreen: onMatchContinued çağrılıyor', data.partnerProfile);
        onMatchContinued(data.partnerProfile);
      }
      
      // Completed match oldu, mesaj geçmişini yükle (mevcut mesajları koru)
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
          if (response.ok) {
            return response.json();
          }
          throw new Error('Mesaj geçmişi yüklenemedi');
        })
        .then(responseData => {
          console.log('✅ match-continued: Mesaj geçmişi yüklendi', responseData);
          if (responseData && responseData.match && responseData.match.messages && responseData.match.messages.length > 0) {
            console.log(`✅ ${responseData.match.messages.length} mesaj yüklendi`);
            // Mevcut mesajları koru, yeni mesajları ekle
            setMessages(prevMessages => {
              const existingIds = new Set(prevMessages.map(m => m.id));
              const newMessages = responseData.match.messages.filter(m => !existingIds.has(m.id));
              return [...prevMessages, ...newMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            });
          } else {
            console.log('⚠️ Mesaj geçmişi boş, mevcut mesajlar korunuyor');
            // Mesajlar boşsa bile mevcut mesajları koru
          }
        })
        .catch(err => {
          console.error('❌ Mesaj geçmişi yüklenemedi:', err);
          // Hata olsa bile mevcut mesajları koru
        });
      }
    });
    
    // Devam isteği alındığında
    newSocket.on('continue-request-received', (data) => {
      console.log('✅ ChatScreen: continue-request-received event alındı', data);
      setContinueRequestReceived(true);
      setWaitingForPartner(false);
    });

    // Devam isteği gönderildi onayı
    newSocket.on('continue-request-sent', (data) => {
      console.log('✅ ChatScreen: continue-request-sent event alındı', data);
      setWaitingForPartner(true);
      waitingForPartnerRef.current = true;
    });

    // Devam isteği reddedildiğinde
    newSocket.on('continue-request-rejected', (data) => {
      console.log('❌ ChatScreen: continue-request-rejected event alındı', data);
      setWaitingForPartner(false);
      setContinueRequestReceived(false);
      antdMessage.error('Devam isteği reddedildi');
      onMatchEnded();
    });

    // Error event'ini dinle (ikinci handler - duplicate, ama güvenlik için bırakıyoruz)
    // Not: İlk error handler yukarıda zaten var, bu sadece ek kontrol için

    return () => {
      newSocket.close();
    };
  }, [userId, API_URL, onMatchEnded, onMatchContinued]);

  // Timer sistemi kaldırıldı - artık takip isteği sistemi kullanılıyor

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
    
    const activeMatchId = currentMatchId || initialMatchId;
    if (messageText.trim() && socket && activeMatchId) {
      // Socket bağlantısı kontrolü
      if (!socket.connected) {
        console.warn('Socket bağlı değil, mesaj gönderilemiyor');
        // Socket bağlantısını bekle
        socket.once('connect', () => {
          console.log('Socket bağlandı, mesaj gönderiliyor');
          socket.emit('set-profile', { userId, matchId: activeMatchId });
          // Kısa bir gecikme ile mesaj gönder
          setTimeout(() => {
            socket.emit('send-message', {
              matchId: activeMatchId,
              text: messageText.trim(),
              userId: userId
            });
          }, 100);
        });
        return;
      }
      
      console.log('Mesaj gönderiliyor:', { matchId: activeMatchId, text: messageText.trim(), socketConnected: socket.connected });
      
      // Optimistic update - mesajı hemen ekle
      const tempMessage = {
        id: `temp-${Date.now()}`,
        userId: userId,
        username: partnerProfile 
          ? (currentProfile?.username || 'Sen')
          : `Anonim-${userAnonymousId || '000000'}`,
        text: messageText.trim(),
        timestamp: new Date(),
        matchId: activeMatchId,
        isTemporary: true
      };
      setMessages((prev) => [...prev, tempMessage]);
      
      socket.emit('send-message', {
        matchId: activeMatchId,
        text: messageText.trim(),
        userId: userId  // Backend'de kullanıcı bulunamazsa otomatik set-profile için
      });
      
      setMessageText('');
      setIsTyping(false);
      socket.emit('typing', { isTyping: false, matchId: activeMatchId });
    } else {
      const activeMatchId = currentMatchId || initialMatchId;
      console.log('Mesaj gönderilemedi:', { 
        hasText: !!messageText.trim(), 
        hasSocket: !!socket, 
        hasMatchId: !!activeMatchId
      });
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    const activeMatchId = currentMatchId || initialMatchId;
    if (!isTyping) {
      setIsTyping(true);
      if (socket && activeMatchId) {
        socket.emit('typing', { isTyping: true, matchId: activeMatchId });
      }
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      const activeMatchId = currentMatchId || initialMatchId;
      if (socket && activeMatchId) {
        socket.emit('typing', { isTyping: false, matchId: activeMatchId });
      }
    }, 1000);
  };

  // Devam etmek istiyorum isteği gönder
  const handleContinueRequest = () => {
    // currentMatchId veya initialMatchId kullan
    const activeMatchId = currentMatchId || initialMatchId;
    
    if (socket && activeMatchId) {
      console.log('Devam isteği gönderiliyor:', { matchId: activeMatchId, socketConnected: socket.connected, currentMatchId, initialMatchId });
      
      // Socket bağlı değilse hata göster
      if (!socket.connected) {
        antdMessage.error('Bağlantı hatası. Lütfen sayfayı yenileyin.');
        return;
      }
      
      socket.emit('continue-request', { matchId: activeMatchId });
      setWaitingForPartner(true);
      waitingForPartnerRef.current = true;
    } else {
      console.error('Devam isteği gönderilemedi:', { hasSocket: !!socket, hasMatchId: !!activeMatchId, currentMatchId, initialMatchId });
      antdMessage.error('Eşleşme bilgisi bulunamadı');
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
      onMatchEnded();
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
    
    // Ses bildirimi - Modern ve profesyonel bildirim sesi
    if (notificationSettings.soundEnabled) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // İki tonlu modern bildirim sesi (yüksek-düşük)
        const frequencies = [880, 660]; // A5 ve E5 notaları (uyumlu akor)
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
    const activeMatchId = currentMatchId || initialMatchId;
    if (socket && activeMatchId) {
      socket.emit('delete-message', { matchId: activeMatchId, messageId });
    }
  };

  // Mesaja reaksiyon ekle/kaldır
  const reactToMessage = (messageId, reaction) => {
    const activeMatchId = currentMatchId || initialMatchId;
    if (socket && activeMatchId && socket.connected) {
      console.log('Reaksiyon gönderiliyor:', { matchId: activeMatchId, messageId, reaction });
      socket.emit('react-to-message', { matchId: activeMatchId, messageId, reaction });
    } else {
      console.warn('Reaksiyon gönderilemedi:', { socket: !!socket, matchId: activeMatchId, connected: socket?.connected });
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

      // Socket üzerinden medya mesajı gönder
      socket.emit('send-message', {
        matchId: activeMatchId,
        text: messageText.trim() || '',
        userId,
        mediaUrl,
        mediaType
      });

      // Mesajı ekle
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

  // Kullanıcı adı formatla: "İsim Soyisim (@username)"
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

  // Galeri modal state
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);

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
                e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
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
                {partnerProfile.username.charAt(0).toUpperCase()}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Text strong style={{ 
                    color: isDarkMode ? '#fff' : '#000', 
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {formatDisplayName(partnerProfile)}
                    {partnerProfile.age && ` (${partnerProfile.age})`}
                  </Text>
                  {partnerProfile.verified && (
                    <SafetyCertificateOutlined style={{ color: '#52c41a', fontSize: '13px', flexShrink: 0 }} />
                  )}
                </div>
                <Text style={{ 
                  color: isDarkMode ? '#8c8c8c' : '#666', 
                  fontSize: '12px',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  @{partnerProfile.username}
                </Text>
                <Text style={{ 
                  color: partnerProfile.isOnline ? '#52c41a' : (isDarkMode ? '#666' : '#999'), 
                  fontSize: '11px',
                  display: 'block'
                }}>
                  {partnerProfile.isOnline ? 'Çevrimiçi' : partnerProfile.lastSeen ? 
                    `Son görülme: ${new Date(partnerProfile.lastSeen).toLocaleString('tr-TR', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}` : ''}
                </Text>
              </div>
            </div>
          ) : !isCompletedMatch ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Avatar size={40} style={{ backgroundColor: '#667eea', flexShrink: 0 }}>
                A
              </Avatar>
              <div>
                <Text strong style={{ color: isDarkMode ? '#fff' : '#000', fontSize: '14px' }}>
                  Anonim-{partnerAnonymousId || '0000000'}
                </Text>
                <div>
                  <Text style={{ color: isDarkMode ? '#8c8c8c' : '#999', fontSize: '12px' }}>
                    Anonim sohbet
                  </Text>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <Space style={{ flexShrink: 0 }}>
          {(partnerProfile || !isCompletedMatch) && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'leave',
                    label: 'Eşleşmeden Çık',
                    icon: <CloseOutlined />,
                    danger: true,
                    onClick: async () => {
                      const activeMatchId = currentMatchId || initialMatchId;
                      if (activeMatchId) {
                        try {
                          if (isCompletedMatch || partnerProfile) {
                            const token = localStorage.getItem('token');
                            await axios.delete(`${API_URL}/api/matches/${activeMatchId}`, {
                              headers: {
                                'Authorization': `Bearer ${token}`
                              }
                            });
                            antdMessage.success('Eşleşmeden çıkıldı');
                            if (onMatchEnded) {
                              onMatchEnded();
                            }
                            if (onGoBack) {
                              onGoBack();
                            }
                          } else if (socket) {
                            socket.emit('match-decision', { matchId: activeMatchId, decision: 'leave' });
                            if (onMatchEnded) {
                              onMatchEnded();
                            }
                          }
                        } catch (error) {
                          console.error('Eşleşmeden çıkma hatası:', error);
                          antdMessage.error('Eşleşmeden çıkılamadı');
                        }
                      }
                    }
                  },
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
          )}
          {!isCompletedMatch && !partnerProfile && !waitingForPartner && (
            <Button
              type="primary"
              onClick={handleContinueRequest}
            >
              Devam Etmek İstiyorum
            </Button>
          )}
        </Space>
      </Header>

      {partnerProfile && isCompletedMatch && (
        <div style={{ 
          background: isDarkMode ? '#1a1a2e' : '#fff', 
          padding: '16px 24px',
          borderBottom: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          {/* Fotoğraflar */}
          {partnerProfile.photos && partnerProfile.photos.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <Text strong style={{ display: 'block', marginBottom: '8px', color: isDarkMode ? '#fff' : '#000' }}>
                Fotoğraflar
              </Text>
              <Space wrap>
                {partnerProfile.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo.url && photo.url.startsWith('http')
                      ? photo.url
                      : `${API_URL}${photo.url}`}
                    alt={`Fotoğraf ${index + 1}`}
                    style={{
                      width: '80px',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: index === 0 ? '2px solid #1890ff' : '1px solid #d9d9d9'
                    }}
                    onError={(e) => {
                      if (e && e.target) {
                        e.target.src = 'https://via.placeholder.com/80';
                      }
                    }}
                  />
                ))}
              </Space>
            </div>
          )}
          
          {/* Bio */}
          {partnerProfile.bio && (
            <div style={{ marginBottom: '12px' }}>
              <Text strong style={{ display: 'block', marginBottom: '4px', color: isDarkMode ? '#fff' : '#000' }}>
                Hakkında
              </Text>
              <Text type="secondary" style={{ display: 'block', color: isDarkMode ? '#b8b8b8' : '#999' }}>
                {partnerProfile.bio}
              </Text>
            </div>
          )}
          
          {/* İlgi Alanları */}
          {partnerProfile.interests && partnerProfile.interests.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: '8px', color: isDarkMode ? '#fff' : '#000' }}>
                İlgi Alanları
              </Text>
              <Space wrap>
                {partnerProfile.interests.map((interest, index) => (
                  <Tag key={index} style={{ 
                    marginBottom: '4px',
                    background: isDarkMode ? '#2e2e2e' : undefined,
                    color: isDarkMode ? '#fff' : undefined,
                    borderColor: isDarkMode ? '#424242' : undefined
                  }}>
                    {interest}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <Content style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        background: isDarkMode ? '#0b141a' : '#efeae2',
        backgroundImage: isDarkMode 
          ? 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
          : 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        transition: 'background 0.3s ease'
      }}>
        {messages.filter((message, index, self) => 
          index === self.findIndex(m => m.id === message.id)
        ).map((message) => {
          const messageSenderProfile = message.userId === userId ? currentProfile : partnerProfile;
          const isOwn = message.userId === userId;
          const isRead = message.readBy && message.readBy.filter(id => id !== userId).length > 0;
          
          return (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: isOwn ? 'flex-end' : 'flex-start',
              marginBottom: '1px'
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '6px 8px 4px 8px',
                backgroundColor: isOwn 
                  ? (isDarkMode ? '#005c4b' : '#d9fdd3')
                  : (isDarkMode ? '#202c33' : '#fff'),
                borderRadius: isOwn ? '8px 8px 0 8px' : '8px 8px 8px 0',
                boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
                position: 'relative'
              }}
            >
              {/* Kullanıcı adı */}
              {!message.isSystem && (
                <div style={{ 
                  color: isOwn 
                    ? (isDarkMode ? '#53bdeb' : '#075e54') 
                    : (isDarkMode ? '#53bdeb' : '#1f7aec'),
                  fontSize: '12.5px',
                  fontWeight: 500,
                  marginBottom: '1px'
                }}>
                  {isCompletedMatch && messageSenderProfile
                    ? `${formatDisplayName(messageSenderProfile)} (@${messageSenderProfile.username})`
                    : isOwn ? 'Sen' : `Anonim-${partnerAnonymousId || '000000'}`
                  }
                </div>
              )}
              {/* Mesaj içeriği */}
              <div style={{ 
                color: isDarkMode ? '#e9edef' : '#111b21',
                fontSize: '14.2px',
                lineHeight: '19px',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}>
                {message.deleted ? (
                  <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Bu mesaj silindi</span>
                ) : (
                  <>
                    {message.mediaUrl && (
                      <div style={{ marginBottom: message.text ? '4px' : 0 }}>
                        <img 
                          src={message.mediaUrl.startsWith('http') ? message.mediaUrl : `${API_URL}${message.mediaUrl}`}
                          alt="Gönderilen medya"
                          style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px', cursor: 'pointer' }}
                          onClick={() => window.open(message.mediaUrl.startsWith('http') ? message.mediaUrl : `${API_URL}${message.mediaUrl}`, '_blank')}
                        />
                      </div>
                    )}
                    {message.text}
                  </>
                )}
              </div>
              {/* Saat ve okundu bilgisi - sağ alt */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'center',
                gap: '3px',
                marginTop: '2px',
                marginLeft: '8px',
                float: 'right'
              }}>
                <span style={{ 
                  color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)',
                  fontSize: '11px'
                }}>
                  {formatTime(message.timestamp)}
                </span>
                {isOwn && (
                  <span style={{ 
                    color: isRead ? '#53bdeb' : (isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'),
                    fontSize: '14px',
                    marginLeft: '2px'
                  }}>
                    {isRead ? '✓✓' : '✓'}
                  </span>
                )}
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
      
      {/* Galeri Modal */}
      <Image.PreviewGroup
        preview={{
          visible: galleryVisible,
          onVisibleChange: (visible) => setGalleryVisible(visible),
          current: galleryStartIndex
        }}
      >
        {galleryImages.map((img, index) => (
          <Image key={index} src={img} style={{ display: 'none' }} />
        ))}
      </Image.PreviewGroup>

      {/* Continue Request or Input */}
      {continueRequestReceived ? (
        <Footer style={{ 
          background: isDarkMode ? '#1a1a2e' : '#fff', 
          padding: '24px',
          borderTop: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: '16px', color: isDarkMode ? '#fff' : '#000' }}>
            Karşı taraf devam etmek istiyor
          </Title>
          <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              onClick={handleAcceptContinue}
              style={{
                height: '48px',
                minWidth: '150px',
                background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
                border: 'none'
              }}
            >
              ✅ Kabul Et
            </Button>
            <Button
              danger
              size="large"
              onClick={handleRejectContinue}
              style={{
                height: '48px',
                minWidth: '150px'
              }}
            >
              ❌ Reddet
            </Button>
          </Space>
        </Footer>
      ) : waitingForPartner ? (
        <Footer style={{ 
          background: isDarkMode ? '#1a1a2e' : '#fff', 
          padding: '24px',
          borderTop: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: '16px', color: '#ff9800' }}>
            Karşı taraftan yanıt bekleniyor...
          </Title>
        </Footer>
      ) : (
        <Footer style={{ 
          background: isDarkMode ? '#1a1a2e' : '#fff', 
          padding: '16px 24px',
          borderTop: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          {selectedMedia && (
            <div style={{ 
              padding: '12px', 
              background: isDarkMode ? '#2e2e2e' : '#f0f0f0', 
              borderRadius: '8px', 
              marginBottom: '8px',
              position: 'relative',
              transition: 'background 0.3s ease'
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
            {partnerProfile && (
              <Button
                type="text"
                icon={<PictureOutlined />}
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '20px' }}
                disabled={uploadingMedia}
              />
            )}
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
          {!partnerProfile && !isCompletedMatch && (
            <Text type="secondary" style={{ fontSize: '12px', color: isDarkMode ? '#b8b8b8' : '#999', marginTop: '4px', marginLeft: '4px' }}>
              Anonim-{partnerAnonymousId || '0000000'}
            </Text>
          )}
        </Footer>
      )}

      {/* Partner Profile Modal */}
      <Modal
        title={
          <Space>
            <Avatar
              src={partnerProfile?.photos && partnerProfile.photos.length > 0 
                ? (partnerProfile.photos[0].url && partnerProfile.photos[0].url.startsWith('http')
                    ? partnerProfile.photos[0].url
                    : `${API_URL}${partnerProfile.photos[0].url}`)
                : undefined}
              size={40}
              style={{ backgroundColor: '#1890ff' }}
            >
              {partnerProfile?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                {partnerProfile ? formatDisplayName(partnerProfile) : 'Kullanıcı Profili'}
              </Text>
              {partnerProfile?.verified && (
                <SafetyCertificateOutlined style={{ color: '#52c41a', marginLeft: '8px' }} />
              )}
            </div>
          </Space>
        }
        open={showPartnerProfileModal}
        onCancel={() => setShowPartnerProfileModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowPartnerProfileModal(false)}>
            Kapat
          </Button>,
          <Button 
            key="profile" 
            type="primary" 
            onClick={async () => {
              setShowPartnerProfileModal(false);
              try {
                const token = localStorage.getItem('token');
                // Profil görüntüleme sayısını artır
                await axios.post(`${API_URL}/api/profile/view`, 
                  { targetUserId: partnerProfile.userId },
                  { headers: { 'Authorization': `Bearer ${token}` } }
                );
                // Partner profil bilgilerini set et ve modalı aç
                setViewProfileData(partnerProfile);
                setShowViewProfileModal(true);
              } catch (error) {
                console.error('Profil görüntüleme hatası:', error);
                antdMessage.error('Profil görüntülenemedi');
              }
            }}
          >
            Profile Git
          </Button>
        ]}
        width={600}
        style={{
          top: 20
        }}
        styles={{
          body: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            color: isDarkMode ? '#fff' : '#000'
          },
          header: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            borderBottom: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0'
          },
          footer: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            borderTop: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0'
          }
        }}
      >
        {partnerProfile && (
          <div>
            {/* Fotoğraflar Galerisi */}
            {partnerProfile.photos && partnerProfile.photos.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '12px' }}>
                  Fotoğraflar
                </Title>
                <Image.PreviewGroup>
                  <Row gutter={[8, 8]}>
                    {partnerProfile.photos.map((photo, index) => (
                      <Col key={photo.id || index} span={8}>
                        <Image
                          src={photo.url && photo.url.startsWith('http')
                            ? photo.url
                            : `${API_URL}${photo.url}`}
                          alt={`Fotoğraf ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '150px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                          preview={{
                            mask: <div style={{ color: '#fff' }}>Görüntüle</div>
                          }}
                        />
                      </Col>
                    ))}
                  </Row>
                </Image.PreviewGroup>
              </div>
            )}

            {/* Bio */}
            {partnerProfile.bio && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '8px' }}>
                  Hakkında
                </Title>
                <Text style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                  {partnerProfile.bio}
                </Text>
              </div>
            )}

            {/* İlgi Alanları */}
            {partnerProfile.interests && partnerProfile.interests.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '8px' }}>
                  İlgi Alanları
                </Title>
                <Space wrap>
                  {partnerProfile.interests.map((interest, index) => (
                    <Tag key={index} color="blue" style={{ marginBottom: '4px' }}>
                      {interest}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* Bilgiler */}
            <div>
              <Title level={5} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '8px' }}>
                Bilgiler
              </Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                {partnerProfile.age && (
                  <Text style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    <strong>Yaş:</strong> {partnerProfile.age}
                  </Text>
                )}
                {partnerProfile.gender && (
                  <Text style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    <strong>Cinsiyet:</strong> {partnerProfile.gender === 'male' ? 'Erkek' : partnerProfile.gender === 'female' ? 'Kadın' : partnerProfile.gender}
                  </Text>
                )}
                {partnerProfile.isOnline ? (
                  <Tag color="green">Çevrimiçi</Tag>
                ) : partnerProfile.lastSeen ? (
                  <Text style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    <strong>Son görülme:</strong> {new Date(partnerProfile.lastSeen).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                ) : null}
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* Şikayet Modal */}
      <Modal
        title="Şikayet Et"
        open={showReportModal}
        onCancel={() => {
          setShowReportModal(false);
          setReportReasonType(null);
          setReportCustomReason('');
        }}
        onOk={submitReport}
        okText="Şikayet Gönder"
        cancelText="İptal"
        styles={{
          body: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            color: isDarkMode ? '#fff' : '#000'
          },
          header: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            borderBottom: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
            color: isDarkMode ? '#fff' : '#000'
          },
          footer: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            borderTop: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0'
          }
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong style={{ color: isDarkMode ? '#fff' : '#000', display: 'block', marginBottom: '12px' }}>
              Şikayet Sebebi
            </Text>
            <Radio.Group 
              value={reportReasonType} 
              onChange={(e) => setReportReasonType(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="fake_account" style={{ color: isDarkMode ? '#fff' : '#000' }}>
                  Sahte Hesap
                </Radio>
                <Radio value="inappropriate_username" style={{ color: isDarkMode ? '#fff' : '#000' }}>
                  Uygunsuz Kullanıcı Adı
                </Radio>
                <Radio value="inappropriate_photo" style={{ color: isDarkMode ? '#fff' : '#000' }}>
                  Uygunsuz Fotoğraf
                </Radio>
                <Radio value="other" style={{ color: isDarkMode ? '#fff' : '#000' }}>
                  Diğer
                </Radio>
              </Space>
            </Radio.Group>
          </div>
          
          <div>
            <Text strong style={{ color: isDarkMode ? '#fff' : '#000', display: 'block', marginBottom: '8px' }}>
              Açıklama (İsteğe Bağlı)
            </Text>
            <TextArea
              rows={4}
              placeholder="Şikayet sebebinizi detaylı olarak açıklayın..."
              value={reportCustomReason}
              onChange={(e) => setReportCustomReason(e.target.value)}
              style={{
                background: isDarkMode ? '#2e2e2e' : '#fff',
                color: isDarkMode ? '#fff' : '#000',
                border: isDarkMode ? '1px solid #424242' : '1px solid #d9d9d9'
              }}
            />
          </div>
        </Space>
      </Modal>

      {/* Profil Görüntüleme Modal */}
      <Modal
        title={
          <Space>
            <Avatar
              src={viewProfileData?.photos && viewProfileData.photos.length > 0 
                ? (viewProfileData.photos[0].url && viewProfileData.photos[0].url.startsWith('http')
                    ? viewProfileData.photos[0].url
                    : `${API_URL}${viewProfileData.photos[0].url}`)
                : undefined}
              size={40}
              style={{ backgroundColor: '#1890ff' }}
            >
              {viewProfileData?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                {viewProfileData ? formatDisplayName(viewProfileData) : 'Kullanıcı Profili'}
              </Text>
              {viewProfileData?.verified && (
                <SafetyCertificateOutlined style={{ color: '#52c41a', marginLeft: '8px' }} />
              )}
            </div>
          </Space>
        }
        open={showViewProfileModal}
        onCancel={() => {
          setShowViewProfileModal(false);
          setViewProfileData(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setShowViewProfileModal(false);
            setViewProfileData(null);
          }}>
            Kapat
          </Button>
        ]}
        width={600}
        style={{ top: 20 }}
        styles={{
          body: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            color: isDarkMode ? '#fff' : '#000'
          },
          header: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            borderBottom: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
            color: isDarkMode ? '#fff' : '#000'
          },
          footer: {
            background: isDarkMode ? '#1a1a2e' : '#fff',
            borderTop: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0'
          }
        }}
      >
        {viewProfileData ? (
          <div>
            {/* Fotoğraflar Galerisi */}
            {viewProfileData.photos && viewProfileData.photos.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '12px' }}>
                  Fotoğraflar
                </Title>
                <Image.PreviewGroup>
                  <Row gutter={[8, 8]}>
                    {viewProfileData.photos.map((photo, index) => (
                      <Col key={photo.id || index} span={8}>
                        <Image
                          src={photo.url && photo.url.startsWith('http')
                            ? photo.url
                            : `${API_URL}${photo.url}`}
                          alt={`Fotoğraf ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '150px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                          preview={{
                            mask: <div style={{ color: '#fff' }}>Görüntüle</div>
                          }}
                        />
                      </Col>
                    ))}
                  </Row>
                </Image.PreviewGroup>
              </div>
            )}

            {/* Bio */}
            {viewProfileData.bio && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '8px' }}>
                  Hakkında
                </Title>
                <Text style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                  {viewProfileData.bio}
                </Text>
              </div>
            )}

            {/* İlgi Alanları */}
            {viewProfileData.interests && viewProfileData.interests.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '8px' }}>
                  İlgi Alanları
                </Title>
                <Space wrap>
                  {viewProfileData.interests.map((interest, index) => (
                    <Tag key={index} color="blue" style={{ marginBottom: '4px' }}>
                      {interest}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* Bilgiler */}
            <div>
              <Title level={5} style={{ color: isDarkMode ? '#fff' : '#000', marginBottom: '8px' }}>
                Bilgiler
              </Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                {viewProfileData.age && (
                  <Text style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    <strong>Yaş:</strong> {viewProfileData.age}
                  </Text>
                )}
                {viewProfileData.gender && (
                  <Text style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    <strong>Cinsiyet:</strong> {viewProfileData.gender === 'male' ? 'Erkek' : viewProfileData.gender === 'female' ? 'Kadın' : viewProfileData.gender}
                  </Text>
                )}
                {viewProfileData.isOnline ? (
                  <Tag color="green">Çevrimiçi</Tag>
                ) : viewProfileData.lastSeen ? (
                  <Text style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    <strong>Son görülme:</strong> {new Date(viewProfileData.lastSeen).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                ) : null}
              </Space>
            </div>
          </div>
        ) : (
          <Spin />
        )}
      </Modal>
    </Layout>
  );
}

export default ChatScreen;