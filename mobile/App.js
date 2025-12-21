import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import ProfileSetup from './src/components/ProfileSetup';
import MainScreen from './src/components/MainScreen';
import ChatScreen from './src/components/ChatScreen';

// Backend URL - gerçek kullanımda IP adresinizi buraya yazın
const API_URL = 'http://localhost:5000';

function App() {
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [screen, setScreen] = useState('profile'); // 'profile', 'main', 'chat'

  // AsyncStorage'dan userId al
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const savedUserId = await AsyncStorage.getItem('userId');
        if (savedUserId) {
          setUserId(savedUserId);
          // Profili yükle
          try {
            const response = await axios.get(`${API_URL}/api/profile/${savedUserId}`);
            if (response.data.profile) {
              setProfile(response.data.profile);
              setScreen('main');
            }
          } catch (err) {
            await AsyncStorage.removeItem('userId');
          }
        }
      } catch (error) {
        console.error('AsyncStorage error:', error);
      }
    };

    loadUserId();
  }, []);

  const handleProfileCreated = async (newProfile) => {
    setProfile(newProfile);
    setUserId(newProfile.userId);
    try {
      await AsyncStorage.setItem('userId', newProfile.userId);
    } catch (error) {
      console.error('AsyncStorage error:', error);
    }
    setScreen('main');
  };

  const handleMatchFound = (newMatchId) => {
    setMatchId(newMatchId);
    setScreen('chat');
  };

  const handleMatchContinued = (newPartnerProfile) => {
    setPartnerProfile(newPartnerProfile);
  };

  const handleMatchEnded = () => {
    setMatchId(null);
    setPartnerProfile(null);
    setScreen('main');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {screen === 'profile' && (
        <ProfileSetup
          userId={userId}
          onProfileCreated={handleProfileCreated}
          API_URL={API_URL}
        />
      )}
      {screen === 'main' && profile && (
        <MainScreen
          userId={userId}
          profile={profile}
          onMatchFound={handleMatchFound}
          onMatchContinued={handleMatchContinued}
          onMatchEnded={handleMatchEnded}
          API_URL={API_URL}
        />
      )}
      {screen === 'chat' && matchId && (
        <ChatScreen
          userId={userId}
          profile={profile}
          matchId={matchId}
          partnerProfile={partnerProfile}
          onMatchEnded={handleMatchEnded}
          onMatchContinued={handleMatchContinued}
          API_URL={API_URL}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
});

export default App;