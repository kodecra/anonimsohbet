import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import io from 'socket.io-client';

function ChatScreen({ userId, profile, matchId, partnerProfile, onMatchEnded, onMatchContinued, API_URL }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [timer, setTimer] = useState(30);
  const [showDecision, setShowDecision] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const newSocket = io(API_URL, {
      transports: ['websocket'],
    });

    setSocket(newSocket);

    // Profil ile bağlan (matchId'yi de gönder)
    newSocket.emit('set-profile', { userId, matchId });

    // Mesaj alma
    newSocket.on('new-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Kullanıcı yazıyor göstergesi
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

    // Eşleşme sona erdi
    newSocket.on('match-ended', () => {
      onMatchEnded();
    });

    // Partner bağlantısını kesti
    newSocket.on('partner-disconnected', () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          text: 'Eşleşme partneri bağlantısını kesti',
          isSystem: true,
          timestamp: new Date(),
        },
      ]);
    });

    // 30 saniye doldu - karar butonlarını göster
    newSocket.on('time-up', () => {
      setShowDecision(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    // Eşleşme onaylandı - profiller görünür oldu
    newSocket.on('match-continued', (data) => {
      setShowDecision(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (onMatchContinued) {
        onMatchContinued(data.partnerProfile);
      }
    });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      newSocket.close();
    };
  }, [userId, API_URL, onMatchEnded, onMatchContinued]);

  // Timer başlat (partnerProfile yoksa ve showDecision false ise)
  useEffect(() => {
    if (!partnerProfile && !showDecision && matchId) {
      setTimer(30);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setTimer(prev => {
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

  // Yazma durumu
  useEffect(() => {
    if (messageText.trim() && !isTyping && socket && matchId) {
      setIsTyping(true);
      socket.emit('typing', { isTyping: true, matchId: matchId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && socket && matchId) {
        setIsTyping(false);
        socket.emit('typing', { isTyping: false, matchId: matchId });
      }
    }, 1000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [messageText, isTyping, socket, matchId]);

  const sendMessage = () => {
    if (messageText.trim() && socket && matchId && !showDecision) {
      socket.emit('send-message', { text: messageText, matchId: matchId });
      setMessageText('');
      setIsTyping(false);
      socket.emit('typing', { isTyping: false, matchId: matchId });
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = ({ item: message }) => {
    if (message.isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessage}>{message.text}</Text>
        </View>
      );
    }

    const isOwnMessage = message.userId === userId;

    return (
      <View style={[styles.message, isOwnMessage && styles.ownMessage]}>
        {!isOwnMessage && (
          <View style={styles.messageHeader}>
            <Text style={styles.messageUsername}>{message.username}</Text>
            <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {message.text}
          </Text>
        </View>
        {isOwnMessage && (
          <Text style={styles.messageTimeRight}>{formatTime(message.timestamp)}</Text>
        )}
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;
    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>
          {Array.from(typingUsers).join(', ')} yazıyor...
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>💬 Sohbet</Text>
            {partnerProfile ? (
              <ScrollView style={styles.partnerProfile} horizontal>
                <View>
                  <Text style={styles.partnerName}>{partnerProfile.username}</Text>
                  {partnerProfile.age && (
                    <Text style={styles.partnerDetails}>Yaş: {partnerProfile.age}</Text>
                  )}
                  {partnerProfile.bio && (
                    <Text style={styles.partnerBio} numberOfLines={1}>
                      {partnerProfile.bio}
                    </Text>
                  )}
                  {partnerProfile.interests && partnerProfile.interests.length > 0 && (
                    <Text style={styles.partnerInterests} numberOfLines={1}>
                      İlgi: {partnerProfile.interests.join(', ')}
                    </Text>
                  )}
                </View>
              </ScrollView>
            ) : !showDecision ? (
              <View style={styles.timerSection}>
                <View style={styles.timerCircle}>
                  <Text style={styles.timerText}>{timer}</Text>
                </View>
                <Text style={styles.timerInfo}>30 saniye sonra devam edip etmeyeceğiniz sorulacak</Text>
              </View>
            ) : (
              <Text style={styles.decisionHeaderText}>30 saniye doldu. Devam etmek istiyor musunuz?</Text>
            )}
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListFooterComponent={renderTypingIndicator}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input veya Karar Butonları */}
        {showDecision ? (
          <View style={styles.decisionSection}>
            <View style={styles.decisionButtons}>
              <TouchableOpacity
                style={[styles.decisionButton, styles.continueButton]}
                onPress={() => handleDecision('continue')}
                activeOpacity={0.8}
              >
                <Text style={styles.decisionButtonText}>✅ Devam Et</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.decisionButton, styles.leaveButton]}
                onPress={() => handleDecision('leave')}
                activeOpacity={0.8}
              >
                <Text style={styles.decisionButtonText}>❌ Çık</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder={partnerProfile ? "Mesajınızı yazın..." : "Anonim sohbet başladı..."}
              placeholderTextColor="#999"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              activeOpacity={0.8}
              disabled={!messageText.trim()}
            >
              <Text style={styles.sendButtonText}>Gönder</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 15,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  partnerProfile: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  partnerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  partnerDetails: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  partnerBio: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  partnerInterests: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  waitingPartner: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontStyle: 'italic',
    fontSize: 14,
  },
  messagesList: {
    padding: 15,
  },
  message: {
    marginBottom: 15,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 5,
  },
  messageUsername: {
    fontWeight: '600',
    color: '#667eea',
    fontSize: 13,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  messageTimeRight: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
    marginRight: 5,
  },
  messageBubble: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: '80%',
  },
  ownMessageBubble: {
    backgroundColor: '#667eea',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  ownMessageText: {
    color: 'white',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemMessage: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 15,
    fontSize: 13,
    fontStyle: 'italic',
  },
  typingContainer: {
    padding: 10,
  },
  typingText: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  timerSection: {
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  timerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  timerInfo: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    textAlign: 'center',
  },
  decisionHeaderText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  decisionSection: {
    padding: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  decisionButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  decisionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#28a745',
  },
  leaveButton: {
    backgroundColor: '#dc3545',
  },
  decisionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChatScreen;
