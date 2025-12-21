import React, { useState } from 'react';
import axios from 'axios';
import { Button, TextField, Card, CardContent, Typography, Box, Alert } from '@mui/material';
import './Register.css';

function Register({ onRegister, onSwitchToLogin, API_URL }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email ve şifre gereklidir');
      return;
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/register`, {
        email: email.trim(),
        password
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userId', response.data.user.userId);
      
      // Profili getir
      const profileResponse = await axios.get(`${API_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${response.data.token}`
        }
      });
      
      onRegister(response.data.token, profileResponse.data.profile);
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt olunamadı');
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <Card sx={{ maxWidth: 450, width: '100%', borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" sx={{ 
            mb: 1, 
            color: 'primary.main', 
            fontWeight: 700,
            textAlign: 'center'
          }}>
            🎭 Anonim Sohbet
          </Typography>
          <Typography variant="body1" sx={{ 
            mb: 3, 
            textAlign: 'center', 
            color: 'text.secondary' 
          }}>
            Kayıt Ol
          </Typography>

          <Box component="form" onSubmit={handleRegister}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              required
              disabled={loading}
              margin="normal"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Şifre"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              required
              disabled={loading}
              margin="normal"
              helperText="Şifre en az 6 karakter olmalıdır"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Şifre Tekrar"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Şifrenizi tekrar girin"
              required
              disabled={loading}
              margin="normal"
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ 
                py: 1.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #5a3780 100%)',
                }
              }}
            >
              {loading ? 'Kayıt olunuyor...' : 'Kayıt Ol'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3, pt: 3, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Zaten hesabınız var mı?
            </Typography>
            <Button
              type="button"
              onClick={onSwitchToLogin || (() => {})}
              fullWidth
              variant="outlined"
              sx={{
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.dark',
                  background: 'primary.main',
                  color: 'white',
                }
              }}
            >
              Giriş Yap
            </Button>
          </Box>
        </CardContent>
      </Card>
    </div>
  );
}

export default Register;