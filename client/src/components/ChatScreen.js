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
import { Image } from 'antd';
import { ThemeContext } from '../App';
import './ChatScreen.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

function ChatScreen({ userId, profile: currentProfile, matchId, partnerProfile: initialPartnerProfile, onMatchEnded, onMatchContinued, onGoBack, API_URL }) {
  const { isDarkMode } = React.useContext(ThemeContext);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  // Timer sadece yeni eşleşmelerde (initialPartnerProfile yoksa) başlatılacak
  // initialPartnerProfile varsa completed match'tir, timer olmamalı
  // initialPartnerProfile null ise ve matchId varsa, completed match kontrolü yap
  const [isCompletedMatch, setIsCompletedMatch] = useState(!!initialPartnerProfile);
  const [timer, setTimer] = useState(initialPartnerProfile ? null : 30);
  const [showDecision, setShowDecision] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState(initialPartnerProfile);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [waitingTimer, setWaitingTimer] = useState(15);
  const waitingTimerRef = useRef(null);
  const waitingForPartnerRef = useRef(false);
  const [userAnonymousId, setUserAnonymousId] = useState(null);
  const [partnerAnonymousId, setPartnerAnonymousId] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    soundEnabled: true,
    browserEnabled: true,
    messageEnabled: true
  });
  const audioRef = useRef(null);

  useEffect(() => {
    // Random 6 haneli anonim ID oluştur
    if (!userAnonymousId) {
      const randomId = Math.floor(100000 + Math.random() * 900000);
      setUserAnonymousId(randomId);
    }
    
    // Completed match kontrolü: initialPartnerProfile yoksa ama matchId varsa API'den kontrol et
    if (!initialPartnerProfile && matchId) {
      fetch(`${API_URL}/api/matches/${matchId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Match bulunamadı');
      })
      .then(data => {
        if (data && data.match) {
          // Partner bilgisini bul
          const partner = data.match.user1.userId === userId 
            ? data.match.user2 
            : data.match.user1;
          
          // Partner profile varsa completed match'tir
          if (partner && partner.profile) {
            console.log('✅ Completed match bulundu, profil yükleniyor:', partner.profile);
            setIsCompletedMatch(true);
            setPartnerProfile(partner.profile);
            setTimer(null);
            
            // Mesaj geçmişini yükle
            if (data.match.messages && data.match.messages.length > 0) {
              console.log(`✅ ${data.match.messages.length} mesaj yüklendi`);
              setMessages(data.match.messages);
            } else {
              console.log('⚠️ Mesaj geçmişi boş');
            }
          } else {
            // Yeni eşleşme
            console.log('⚠️ Yeni eşleşme (completed match değil)');
            setIsCompletedMatch(false);
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
    } else if (initialPartnerProfile && matchId) {
      // initialPartnerProfile varsa zaten completed match
      console.log('✅ initialPartnerProfile var - completed match', initialPartnerProfile);
      setIsCompletedMatch(true);
      setPartnerProfile(initialPartnerProfile);
      setTimer(null);
      
      // Mesaj geçmişini yükle
      console.log('✅ Mesaj geçmişi yükleniyor...', matchId);
      fetch(`${API_URL}/api/matches/${matchId}`, {
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
      .then(data => {
        console.log('✅ Mesaj geçmişi API response:', data);
        if (data && data.match && data.match.messages && data.match.messages.length > 0) {
          console.log(`✅ ${data.match.messages.length} mesaj yüklendi`);
          setMessages(data.match.messages);
        } else {
          console.log('⚠️ Mesaj geçmişi boş veya bulunamadı');
          setMessages([]); // Boş array set et
        }
      })
      .catch(err => {
        console.error('❌ Mesaj geçmişi yüklenemedi:', err);
        setMessages([]); // Hata durumunda boş array
      });
    }
    
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
      
      // Socket bağlandığında mesajları tekrar yükle (kaybolma sorununu önlemek için)
      if (matchId && isCompletedMatch) {
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
            console.log('✅ Socket bağlandığında mesaj geçmişi yüklendi:', data.match.messages.length, 'mesaj');
            setMessages(data.match.messages);
          } else {
            console.log('⚠️ Socket bağlandığında mesaj geçmişi boş');
          }
        })
        .catch(err => {
          console.error('Mesaj geçmişi yüklenemedi:', err);
        });
      }
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
      // "Eşleşme bulunamadı" hatası geldiğinde timer'ı durdur ve eşleşmeyi sonlandır
      if (error.message && error.message.includes('Eşleşme bulunamadı')) {
        console.log('❌ Eşleşme bulunamadı hatası alındı, timer durduruluyor');
        if (waitingTimerRef.current) {
          clearInterval(waitingTimerRef.current);
          waitingTimerRef.current = null;
        }
        setWaitingForPartner(false);
        setShowDecision(false);
        onMatchEnded();
        return;
      }
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

    newSocket.on('match-ended', (data) => {
      console.log('❌ ChatScreen: match-ended event alındı', data);
      // Timer'ları temizle
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setWaitingForPartner(false);
      setShowDecision(false);
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
      console.log('✅ ChatScreen: match-continued event alındı', data);
      
      // ÖNCE timer'ları durdur
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      
      // State'leri güncelle
      setShowDecision(false);
      waitingForPartnerRef.current = false;
      setWaitingForPartner(false);
      setWaitingTimer(0);
      setTimer(null); // Timer'ı null yap
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
      const currentMatchId = data.matchId || matchId;
      if (currentMatchId) {
        console.log('✅ match-continued: Mesaj geçmişi yükleniyor...', currentMatchId);
        fetch(`${API_URL}/api/matches/${currentMatchId}`, {
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
    
    // Partner devam ettiğinde (sadece bilgilendirme, timer devam eder)
    newSocket.on('partner-continued', (data) => {
      console.log('✅ ChatScreen: partner-continued event alındı', data);
      // Partner devam etmek istiyor, match-continued event'i yakında gelecek
      // Timer'ı durdurmuyoruz çünkü match-continued event'i geldiğinde durdurulacak
      // Ama eğer match-continued gelmezse timer devam edecek ve eşleşme iptal olacak
    });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
      }
      newSocket.close();
    };
  }, [userId, API_URL, onMatchEnded, onMatchContinued]);

  // Timer başlat
  useEffect(() => {
    console.log('🔄 Timer useEffect çalışıyor:', { isCompletedMatch, partnerProfile: !!partnerProfile, showDecision, waitingForPartner, matchId });
    
    // Önceki timer'ı temizle
    if (timerRef.current) {
      console.log('⏹️ Önceki timer durduruluyor');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Completed match kontrolü: isCompletedMatch true ise veya partnerProfile varsa timer başlatma
    if (isCompletedMatch || partnerProfile) {
      console.log('✅ Completed match - timer başlatılmayacak');
      // Completed match'te timer'ı temizle
      setTimer(null);
      setShowDecision(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Sadece yeni eşleşmelerde timer başlat (isCompletedMatch false ise ve partnerProfile yoksa)
    if (!isCompletedMatch && !partnerProfile && !showDecision && !waitingForPartner && matchId) {
      console.log('⏱️ Yeni eşleşme - timer başlatılıyor');
      setTimer(30);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            // Timer bittiğinde karar ekranını göster
            setShowDecision(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      console.log('⏸️ Timer başlatılmıyor:', { isCompletedMatch, partnerProfile: !!partnerProfile, showDecision, waitingForPartner, matchId });
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isCompletedMatch, showDecision, waitingForPartner, matchId, partnerProfile]); // partnerProfile eklendi - completed match'te timer başlamasın

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
        username: partnerProfile 
          ? (currentProfile?.username || 'Sen')
          : `Anonim-${userAnonymousId || '000000'}`,
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
      if (decision === 'continue') {
        socket.emit('match-decision', { matchId, decision });
        setShowDecision(false);
        // Karşı tarafın cevabını bekle, ama geri sayım başlatma
        // Backend'den match-continued event'i geldiğinde otomatik geçiş yapılacak
        setWaitingForPartner(true);
        waitingForPartnerRef.current = true; // Ref'i de güncelle
        setWaitingTimer(30); // Timer'ı 30 saniyeye çıkar
        
        // 30 saniye geri sayım başlat (sadece karşı taraf cevap vermezse)
        if (waitingTimerRef.current) {
          clearInterval(waitingTimerRef.current);
        }
        waitingTimerRef.current = setInterval(() => {
          setWaitingTimer((prev) => {
            // match-continued event'i geldiyse timer'ı durdur (ref ile kontrol)
            if (!waitingForPartnerRef.current) {
              clearInterval(waitingTimerRef.current);
              waitingTimerRef.current = null;
              return prev;
            }
            if (prev <= 1) {
              clearInterval(waitingTimerRef.current);
              waitingTimerRef.current = null;
              // 30 saniye doldu, eşleşmeyi iptal et
              socket.emit('match-decision', { matchId, decision: 'leave' });
              setWaitingForPartner(false);
              waitingForPartnerRef.current = false;
              onMatchEnded();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        socket.emit('match-decision', { matchId, decision });
        setShowDecision(false);
        onMatchEnded();
      }
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
    if (socket && matchId) {
      socket.emit('delete-message', { matchId, messageId });
    }
  };

  // Mesaja reaksiyon ekle/kaldır
  const reactToMessage = (messageId, reaction) => {
    if (socket && matchId && socket.connected) {
      console.log('Reaksiyon gönderiliyor:', { matchId, messageId, reaction });
      socket.emit('react-to-message', { matchId, messageId, reaction });
    } else {
      console.warn('Reaksiyon gönderilemedi:', { socket: !!socket, matchId, connected: socket?.connected });
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
        username: partnerProfile 
          ? (currentProfile?.username || 'Sen')
          : `Anonim-${userAnonymousId || '000000'}`,
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
        padding: '16px 24px',
        borderBottom: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 0.3s ease, border-color 0.3s ease'
      }}>
        <Space>
          {onGoBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onGoBack}
              style={{ 
                fontSize: '18px',
                marginRight: '8px'
              }}
            />
          )}
          <Title level={4} style={{ margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
            💬 Sohbet
          </Title>
        </Space>
        {partnerProfile && (
          <Space>
            <Avatar
              src={partnerProfile.photos && partnerProfile.photos.length > 0 
                ? (partnerProfile.photos[0].url && partnerProfile.photos[0].url.startsWith('http')
                    ? partnerProfile.photos[0].url
                    : `${API_URL}${partnerProfile.photos[0].url}`)
                : undefined}
              style={{ backgroundColor: '#1890ff' }}
            >
              {partnerProfile.username.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Space>
                <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                  {partnerProfile.username}
                </Text>
                {partnerProfile.verified && (
                  <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                )}
                {partnerProfile.isOnline && (
                  <Tag color="green" style={{ margin: 0 }}>Çevrimiçi</Tag>
                )}
              </Space>
              {partnerProfile.age && (
                <div>
                  <Text type="secondary" style={{ fontSize: '12px', color: isDarkMode ? '#b8b8b8' : '#999' }}>
                    Yaş: {partnerProfile.age}
                  </Text>
                </div>
              )}
              {!partnerProfile.isOnline && partnerProfile.lastSeen && (
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', color: isDarkMode ? '#b8b8b8' : '#999' }}>
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
                    key: 'leave',
                    label: 'Eşleşmeden Çık',
                    icon: <CloseOutlined />,
                    danger: true,
                    onClick: async () => {
                      if (matchId) {
                        try {
                          // Completed match ise API ile sil, aktif eşleşme ise socket ile
                          if (isCompletedMatch || partnerProfile) {
                            const token = localStorage.getItem('token');
                            await axios.delete(`${API_URL}/api/matches/${matchId}`, {
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
                            // Aktif eşleşme
                            socket.emit('match-decision', { matchId, decision: 'leave' });
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
          </Space>
        )}
        {!isCompletedMatch && !partnerProfile && !showDecision && !waitingForPartner && timer !== null && timer > 0 && (
          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
            <Title level={3} style={{ margin: 0, color: isDarkMode ? '#5E72E4' : '#1890ff', fontSize: '24px', fontWeight: 'bold' }}>
              {timer}
            </Title>
            <Text type="secondary" style={{ fontSize: '11px', display: 'block', color: isDarkMode ? '#b8b8b8' : '#999' }}>
              30 saniye sonra karar verilecek
            </Text>
          </div>
        )}
        {waitingForPartner && (
          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
            <Title level={3} style={{ margin: 0, color: '#ff9800', fontSize: '24px', fontWeight: 'bold' }}>
              {waitingTimer}
            </Title>
            <Text type="secondary" style={{ fontSize: '11px', display: 'block', color: isDarkMode ? '#b8b8b8' : '#999' }}>
              Karşı taraftan yanıt bekleniyor...
            </Text>
          </div>
        )}
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
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: isDarkMode ? '#16213e' : '#f8f9fa',
        transition: 'background 0.3s ease'
      }}>
        {messages.map((message) => {
          // Mesaj gönderenin profil bilgisini bul
          const messageSenderProfile = message.userId === userId 
            ? currentProfile 
            : partnerProfile;
          
          return (
          <div
            key={message.id}
            style={{
              alignSelf: message.userId === userId ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              display: 'flex',
              flexDirection: message.userId === userId ? 'row-reverse' : 'row',
              gap: '8px',
              alignItems: 'flex-end'
            }}
          >
            {/* Profil Resmi */}
            {isCompletedMatch && messageSenderProfile && (
              <Avatar
                src={messageSenderProfile.photos && messageSenderProfile.photos.length > 0 
                  ? (messageSenderProfile.photos[0].url && messageSenderProfile.photos[0].url.startsWith('http')
                      ? messageSenderProfile.photos[0].url
                      : `${API_URL}${messageSenderProfile.photos[0].url}`)
                  : null}
                size={32}
                style={{ 
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                onClick={() => {
                  if (messageSenderProfile.photos && messageSenderProfile.photos.length > 0) {
                    setGalleryImages(messageSenderProfile.photos.map(p => `${API_URL}${p.url}`));
                    setGalleryStartIndex(0);
                    setGalleryVisible(true);
                  }
                }}
              >
                {messageSenderProfile.firstName || messageSenderProfile.lastName
                  ? `${(messageSenderProfile.firstName || '').charAt(0)}${(messageSenderProfile.lastName || '').charAt(0)}`.toUpperCase()
                  : (messageSenderProfile.username || '?').charAt(0).toUpperCase()}
              </Avatar>
            )}
            
            <Card
              style={{
                padding: '12px',
                backgroundColor: message.userId === userId 
                  ? (isDarkMode ? '#5E72E4' : '#1890ff')
                  : (isDarkMode ? '#2e2e2e' : '#f5f5f5'),
                borderRadius: '8px',
                border: 'none',
                flex: 1,
                transition: 'background-color 0.3s ease'
              }}
              styles={{ body: { padding: 0 } }}
            >
              {!message.isSystem && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '4px',
                  alignItems: 'center'
                }}>
                  <Text 
                    strong 
                    style={{ 
                      color: message.userId === userId ? '#fff' : (isDarkMode ? '#fff' : '#000'),
                      fontSize: '12px'
                    }}
                  >
                    {isCompletedMatch && messageSenderProfile
                      ? formatDisplayName(messageSenderProfile)
                      : message.userId === userId 
                        ? `Anonim-${userAnonymousId || '000000'}` 
                        : `Anonim-${partnerAnonymousId || '000000'}`
                    }
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
                  color: message.userId === userId ? '#fff' : (isDarkMode ? '#fff' : '#000'),
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

      {/* Decision or Input */}
      {showDecision ? (
        <Footer style={{ 
          background: isDarkMode ? '#1a1a2e' : '#fff', 
          padding: '24px',
          borderTop: isDarkMode ? '1px solid #424242' : '1px solid #f0f0f0',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: '16px', color: isDarkMode ? '#fff' : '#000' }}>
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
          <Text type="secondary" style={{ textAlign: 'center', display: 'block', color: isDarkMode ? '#b8b8b8' : '#999' }}>
            {waitingTimer} saniye içinde yanıt gelmezse eşleşme iptal edilecek
          </Text>
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
        </Footer>
      )}
    </Layout>
  );
}

export default ChatScreen;