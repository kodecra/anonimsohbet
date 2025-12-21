import React, { useState } from 'react';
import axios from 'axios';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
  Divider,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import './Login.css';

function Login({ onLogin, onSwitchToRegister, API_URL }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/login`, {
        email: email.trim(),
        password
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userId', response.data.user.userId);
      
      onLogin(response.data.token, response.data.profile);
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş yapılamadı');
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Container size={420} my={40}>
        <Paper shadow="xl" radius="lg" p="xl" withBorder style={{ background: 'white' }}>
          <Title ta="center" c="violet" fw={700} size="2.5rem" mb="md">
            🎭 Anonim Sohbet
          </Title>
          <Text c="dimmed" size="sm" ta="center" mt={5} mb="xl">
            Giriş Yap
          </Text>

          <form onSubmit={handleLogin}>
            <Stack gap="md">
              {error && (
                <Alert icon={<IconAlertCircle size="1rem" />} title="Hata!" color="red" variant="light">
                  {error}
                </Alert>
              )}

              <TextInput
                label="Email"
                placeholder="ornek@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                radius="md"
                size="md"
              />

              <PasswordInput
                label="Şifre"
                placeholder="Şifrenizi girin"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                radius="md"
                size="md"
              />

              <Button
                type="submit"
                fullWidth
                loading={loading}
                radius="md"
                size="md"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                Giriş Yap
              </Button>
            </Stack>
          </form>

          <Divider label="Hesabınız yok mu?" labelPosition="center" my="lg" />

          <Button
            variant="outline"
            fullWidth
            onClick={onSwitchToRegister || (() => {})}
            radius="md"
            size="md"
          >
            Kayıt Ol
          </Button>
        </Paper>
      </Container>
    </div>
  );
}

export default Login;