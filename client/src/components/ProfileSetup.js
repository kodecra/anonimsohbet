import React, { useState } from 'react';
import axios from 'axios';
import './ProfileSetup.css';

function ProfileSetup({ userId, onProfileCreated, API_URL }) {
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Kullanıcı adı gereklidir');
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
      setError(err.response?.data?.error || 'Profil oluşturulamadı');
      setLoading(false);
    }
  };

  return (
    <div className="profile-setup-container">
      <div className="profile-setup-card">
        <h1 className="profile-setup-title">🎭 Profil Oluştur</h1>
        <p className="profile-setup-subtitle">Anonim sohbet için profilini oluştur</p>

        <form onSubmit={handleSubmit} className="profile-setup-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Kullanıcı Adı *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Kullanıcı adınız"
              required
              maxLength={50}
            />
          </div>

          <div className="form-group">
            <label>Yaş (İsteğe bağlı)</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Yaşınız"
              min="13"
              max="120"
            />
          </div>

          <div className="form-group">
            <label>Biyografi (İsteğe bağlı)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Kendinizden bahsedin..."
              rows="4"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label>İlgi Alanları (İsteğe bağlı)</label>
            <input
              type="text"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="Müzik, Spor, Film... (virgülle ayırın)"
            />
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Oluşturuluyor...' : 'Profili Oluştur'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfileSetup;
