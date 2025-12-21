import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';

function ProfileSetup({ userId, onProfileCreated, API_URL }) {
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim()) {
      Alert.alert('Hata', 'Kullanıcı adı gereklidir');
      return;
    }

    setLoading(true);

    try {
      const interestsArray = interests
        .split(',')
        .map(i => i.trim())
        .filter(i => i.length > 0);

      const response = await axios.post(`${API_URL}/api/profile`, {
        userId: userId || null,
        username: username.trim(),
        age: age ? parseInt(age) : null,
        bio: bio.trim(),
        interests: interestsArray
      });

      onProfileCreated(response.data.profile);
    } catch (err) {
      Alert.alert('Hata', err.response?.data?.error || 'Profil oluşturulamadı');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>🎭 Profil Oluştur</Text>
          <Text style={styles.subtitle}>Anonim sohbet için profilini oluştur</Text>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Kullanıcı Adı *</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Kullanıcı adınız"
                placeholderTextColor="#999"
                maxLength={50}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Yaş (İsteğe bağlı)</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="Yaşınız"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Biyografi (İsteğe bağlı)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Kendinizden bahsedin..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                maxLength={200}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>İlgi Alanları (İsteğe bağlı)</Text>
              <TextInput
                style={styles.input}
                value={interests}
                onChangeText={setInterests}
                placeholder="Müzik, Spor, Film... (virgülle ayırın)"
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>Profili Oluştur</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
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
    marginBottom: 10,
    color: '#667eea',
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 16,
  },
  form: {
    gap: 20,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
    color: '#333',
    fontSize: 14,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileSetup;
