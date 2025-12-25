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
  Modal,
  PinInput,
  Group,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconMail } from '@tabler/icons-react';
import './Login.css';

function Login({ onLogin, onSwitchToRegister, API_URL }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Şifremi unuttum state'leri
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: code, 3: new password
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

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

  // Şifremi unuttum - email gönder
  const handleForgotPasswordSubmit = async () => {
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);

    try {
      await axios.post(`${API_URL}/api/forgot-password`, {
        email: forgotEmail.trim()
      });
      setForgotSuccess('Şifre sıfırlama kodu email adresinize gönderildi.');
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.error || 'Email gönderilemedi');
    } finally {
      setForgotLoading(false);
    }
  };

  // Şifremi unuttum - şifreyi sıfırla
  const handleResetPassword = async () => {
    setForgotError('');
    setForgotSuccess('');

    if (newPassword !== confirmPassword) {
      setForgotError('Şifreler eşleşmiyor');
      return;
    }

    if (newPassword.length < 6) {
      setForgotError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setForgotLoading(true);

    try {
      await axios.post(`${API_URL}/api/reset-password`, {
        code: resetCode,
        newPassword
      });
      setForgotSuccess('Şifreniz başarıyla güncellendi!');
      setForgotStep(3);
      // 2 saniye sonra modal'ı kapat
      setTimeout(() => {
        setForgotModalOpen(false);
        resetForgotModal();
      }, 2000);
    } catch (err) {
      setForgotError(err.response?.data?.error || 'Şifre güncellenemedi');
    } finally {
      setForgotLoading(false);
    }
  };

  // Modal'ı sıfırla
  const resetForgotModal = () => {
    setForgotStep(1);
    setForgotEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
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

              <Text 
                size="sm" 
                c="violet" 
                style={{ cursor: 'pointer', textAlign: 'right' }}
                onClick={() => {
                  resetForgotModal();
                  setForgotModalOpen(true);
                }}
              >
                Şifremi Unuttum
              </Text>

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

      {/* Şifremi Unuttum Modal */}
      <Modal
        opened={forgotModalOpen}
        onClose={() => {
          setForgotModalOpen(false);
          resetForgotModal();
        }}
        title={
          <Text fw={600} size="lg" c="violet">
            {forgotStep === 1 && '🔐 Şifremi Unuttum'}
            {forgotStep === 2 && '📧 Kodu Girin'}
            {forgotStep === 3 && '✅ Başarılı!'}
          </Text>
        }
        centered
        radius="lg"
        size="sm"
      >
        <Stack gap="md">
          {forgotError && (
            <Alert icon={<IconAlertCircle size="1rem" />} color="red" variant="light">
              {forgotError}
            </Alert>
          )}
          
          {forgotSuccess && (
            <Alert icon={<IconCheck size="1rem" />} color="green" variant="light">
              {forgotSuccess}
            </Alert>
          )}

          {forgotStep === 1 && (
            <>
              <Text size="sm" c="dimmed">
                Email adresinizi girin, size şifre sıfırlama kodu göndereceğiz.
              </Text>
              <TextInput
                label="Email"
                placeholder="ornek@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                radius="md"
                leftSection={<IconMail size={16} />}
              />
              <Button
                fullWidth
                loading={forgotLoading}
                onClick={handleForgotPasswordSubmit}
                radius="md"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
                disabled={!forgotEmail.trim()}
              >
                Kod Gönder
              </Button>
            </>
          )}

          {forgotStep === 2 && (
            <>
              <Text size="sm" c="dimmed">
                Email adresinize gönderilen 6 haneli kodu girin ve yeni şifrenizi belirleyin.
              </Text>
              
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PinInput 
                  length={6} 
                  value={resetCode}
                  onChange={setResetCode}
                  size="lg"
                  type="number"
                />
              </div>

              <PasswordInput
                label="Yeni Şifre"
                placeholder="En az 6 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                radius="md"
              />

              <PasswordInput
                label="Şifreyi Onayla"
                placeholder="Şifrenizi tekrar girin"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                radius="md"
              />

              <Group grow>
                <Button
                  variant="outline"
                  onClick={() => {
                    setForgotStep(1);
                    setResetCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setForgotError('');
                  }}
                  radius="md"
                >
                  Geri
                </Button>
                <Button
                  loading={forgotLoading}
                  onClick={handleResetPassword}
                  radius="md"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                  disabled={resetCode.length !== 6 || !newPassword || !confirmPassword}
                >
                  Şifreyi Sıfırla
                </Button>
              </Group>
            </>
          )}

          {forgotStep === 3 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ 
                fontSize: '60px', 
                marginBottom: '16px' 
              }}>
                🎉
              </div>
              <Text size="lg" fw={500}>
                Şifreniz güncellendi!
              </Text>
              <Text size="sm" c="dimmed" mt="xs">
                Yeni şifrenizle giriş yapabilirsiniz.
              </Text>
            </div>
          )}
        </Stack>
      </Modal>
    </div>
  );
}

export default Login;