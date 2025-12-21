import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import io from 'socket.io-client';

function MainScreen({ userId, profile, onMatchFound, onMatchContinued, onMatchEnded, API_URL }) {
  const [socket, setSocket] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  const [matchId, setMatchId] = useState(null);
  const [showDecision, setShowDecision] = useState(false);
  const [timer, setTimer] = useState(30);
  const timerRef = useRef(null);

  useEffect(() => {
    const newSocket = io(API_URL, {
      transports: ['websocket'],
    });
    setSocket(newSocket);

    // Profil ile bağlan
    newSocket.emit('set-profile', { userId });

    // Eşleşme bulundu - Direkt ChatScreen'e geç
    newSocket.on('match-found', (data) => {
      setIsMatching(false);
      onMatchFound(data.matchId); // Hemen ChatScreen'e geç
    });

    // 30 saniye doldu - ChatScreen'de işlenecek
    newSocket.on('time-up', () => {
      // ChatScreen'de işlenecek
    });

    // Eşleşme onaylandı
    newSocket.on('match-continued', (data) => {
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
      setMatchStatus(data.message);
      setIsMatching(false);
      Alert.alert('Hata', data.message);
    });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      newSocket.close();
    };
  }, [userId, API_URL, onMatchFound, onMatchContinued]);

  const handleStartMatching = () => {
    if (socket && !isMatching) {
      setIsMatching(true);
      setMatchStatus('Eşleşme aranıyor...');
      setShowDecision(false);
      setTimer(30);
      socket.emit('start-matching');
    }
  };

  const handleStopMatching = () => {
    if (socket) {
      socket.emit('stop-matching');
      setIsMatching(false);
      setMatchStatus('');
    }
  };

  // Karar verme artık ChatScreen'de olacak

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>🎭 Anonim Sohbet</Text>
        
        {profile && (
          <View style={styles.profileInfo}>
            <Text style={styles.welcomeText}>Hoş geldin, {profile.username}!</Text>
            {profile.age && <Text style={styles.profileText}>Yaş: {profile.age}</Text>}
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
            {profile.interests && profile.interests.length > 0 && (
              <Text style={styles.interests}>
                <Text style={styles.interestsLabel}>İlgi Alanları: </Text>
                {profile.interests.join(', ')}
              </Text>
            )}
          </View>
        )}

        <View style={styles.matchingSection}>
          {!isMatching && !matchId && (
            <TouchableOpacity
              style={styles.matchButton}
              onPress={handleStartMatching}
              activeOpacity={0.8}
            >
              <Text style={styles.matchButtonText}>🔍 Eşleşme Başlat</Text>
            </TouchableOpacity>
          )}

          {isMatching && (
            <View style={styles.matchingStatus}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.statusText}>{matchStatus}</Text>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopMatching}
                activeOpacity={0.8}
              >
                <Text style={styles.stopButtonText}>İptal Et</Text>
              </TouchableOpacity>
            </View>
          )}

          {matchStatus && !isMatching && (
            <Text style={styles.statusMessage}>{matchStatus}</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#667eea',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#667eea',
  },
  profileInfo: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  profileText: {
    color: '#666',
    marginBottom: 8,
  },
  bio: {
    fontStyle: 'italic',
    color: '#555',
    marginBottom: 8,
  },
  interests: {
    color: '#666',
    marginTop: 10,
  },
  interestsLabel: {
    fontWeight: '600',
  },
  matchingSection: {
    marginTop: 20,
  },
  matchButton: {
    backgroundColor: '#667eea',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  matchButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  matchingStatus: {
    alignItems: 'center',
    gap: 20,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  stopButton: {
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    paddingHorizontal: 30,
  },
  stopButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  matchFound: {
    alignItems: 'center',
    gap: 20,
  },
  timerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  timerText: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  decisionSection: {
    gap: 20,
  },
  decisionQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
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
  statusMessage: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
});

export default MainScreen;
