import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Input, Button, Card, Typography, Alert, Divider, Space, Modal, message } from 'antd';
import { UserOutlined, LockOutlined, GoogleOutlined } from '@ant-design/icons';
import './Login.css';

const { Title, Text } = Typography;

function LoginAntd({ onLogin, onSwitchToRegister, API_URL }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: code+password, 3: success
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resetForgotState = () => {
    setForgotStep(1);
    setForgotEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
  };

  const handleForgotSubmit = async () => {
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail.trim()) {
      setForgotError('Lütfen email adresinizi girin');
      return;
    }
    setForgotLoading(true);
    try {
      await axios.post(`${API_URL}/api/forgot-password`, { email: forgotEmail.trim() });
      setForgotSuccess('Şifre sıfırlama kodu email adresinize gönderildi.');
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.response?.data?.error || 'Email gönderilemedi');
    } finally {
      setForgotLoading(false);
    }
  };

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
    if (resetCode.length !== 6) {
      setForgotError('Lütfen 6 haneli kodu girin');
      return;
    }

    setForgotLoading(true);
    try {
      await axios.post(`${API_URL}/api/reset-password`, {
        code: resetCode,
        newPassword
      });
      setForgotSuccess('Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.');
      setForgotStep(3);
      setTimeout(() => {
        setForgotOpen(false);
        resetForgotState();
      }, 2000);
    } catch (err) {
      setForgotError(err.response?.data?.error || 'Şifre güncellenemedi');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (values) => {
    setError('');
    setLoading(true);

    try {
      const usernameOrPhone = values.username.trim();
      
      // Kullanıcı adı mı telefon numarası mı kontrol et
      const isPhone = /^[0-9]{10,15}$/.test(usernameOrPhone);
      
      const response = await axios.post(`${API_URL}/api/login`, {
        username: isPhone ? null : usernameOrPhone,
        phoneNumber: isPhone ? usernameOrPhone : null,
        password: values.password
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
        flexDirection: windowWidth < 768 ? 'column' : 'row',
        background: '#000000',
        color: '#ffffff'
      }}>
      {/* Left Side - Logo */}
      <div style={{
        flex: windowWidth < 768 ? 'none' : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: windowWidth < 768 ? '40px 20px' : '40px',
        minHeight: windowWidth < 768 ? '200px' : 'auto'
      }}>
        <img 
          src="/logo.png" 
          alt="Soulbate Logo" 
          style={{ 
            height: windowWidth < 768 ? '80px' : windowWidth < 1024 ? '160px' : '200px', 
            width: windowWidth < 768 ? '80%' : 'auto',
            maxWidth: windowWidth < 768 ? '200px' : 'none',
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)'
          }} 
        />
      </div>

      {/* Right Side - Login Form */}
      <div style={{
        flex: windowWidth < 768 ? 'none' : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: windowWidth < 768 ? '20px' : '40px',
        maxWidth: windowWidth < 768 ? '100%' : '600px',
        width: '100%'
      }}>
        <div style={{ marginBottom: windowWidth < 768 ? '32px' : '48px' }}>
          <Title level={1} style={{ 
            color: '#ffffff', 
            marginBottom: '16px', 
            fontSize: windowWidth < 768 ? '36px' : windowWidth < 1024 ? '48px' : '64px', 
            fontWeight: 700,
            lineHeight: 1.2
          }}>
            Ruh Eşinizi Bulun
          </Title>
          <Title level={2} style={{ 
            color: '#ffffff', 
            fontSize: windowWidth < 768 ? '20px' : windowWidth < 1024 ? '24px' : '31px', 
            fontWeight: 700,
            lineHeight: 1.3
          }}>
            Anonim sohbet ile gerçek bağlantılar kurun.
          </Title>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <Button
            block
            size="large"
            icon={<GoogleOutlined />}
            style={{
              height: '52px',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '26px',
              backgroundColor: '#ffffff',
              color: '#000000',
              border: 'none',
              marginBottom: '12px'
            }}
            onClick={() => {
              // Google login - ileride implement edilebilir
              alert('Google ile giriş yakında eklenecek');
            }}
          >
            Google ile kaydol
          </Button>
        </div>

        <Divider style={{ borderColor: '#2f3336', margin: '16px 0' }}>
          <Text style={{ color: '#71767b' }}>VEYA</Text>
        </Divider>

        {error && (
          <Alert
            message="Hata"
            description={error}
            type="error"
            showIcon
            style={{ 
              marginBottom: '24px',
              backgroundColor: '#f4212e',
              borderColor: '#f4212e',
              color: '#ffffff'
            }}
            closable
            onClose={() => setError('')}
          />
        )}

        <Form
          form={form}
          name="login"
          onFinish={handleLogin}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Kullanıcı adı veya telefon numarası gereklidir' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Kullanıcı adı, e-posta veya telefon"
              style={{
                height: '56px',
                fontSize: '17px',
                backgroundColor: '#000000',
                borderColor: '#2f3336',
                color: '#ffffff',
                borderRadius: '4px'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Şifre gereklidir' },
              { min: 6, message: 'Şifre en az 6 karakter olmalıdır' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Şifre"
              style={{
                height: '56px',
                fontSize: '17px',
                backgroundColor: '#000000',
                borderColor: '#2f3336',
                color: '#ffffff',
                borderRadius: '4px'
              }}
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block
              loading={loading}
              style={{
                height: '52px',
                fontSize: '17px',
                fontWeight: 700,
                backgroundColor: '#ffffff',
                color: '#000000',
                border: 'none',
                borderRadius: '26px',
                marginBottom: '12px'
              }}
            >
              Giriş yap
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <Button type="link" onClick={() => setForgotOpen(true)} style={{ color: '#1d9bf0', padding: 0 }}>
              Forgot Password
            </Button>
          </div>
        </Form>

        <div style={{ marginTop: '8px' }}>
          <Text style={{ color: '#71767b', fontSize: '15px', display: 'block', marginBottom: '12px' }}>
            Zaten bir hesabın var mı?
          </Text>
          <Button 
            block
            onClick={onSwitchToRegister || (() => {})}
            style={{
              height: '52px',
              fontSize: '17px',
              fontWeight: 700,
              backgroundColor: '#000000',
              color: '#1d9bf0',
              border: '1px solid #2f3336',
              borderRadius: '26px'
            }}
          >
            Hesap oluştur
          </Button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
      title="Forgot Password"
      open={forgotOpen}
      onCancel={() => {
        setForgotOpen(false);
        resetForgotState();
      }}
      footer={null}
      width={400}
    >
      {forgotStep === 1 && (
        <div>
          <p>Email adresinizi girin, şifre sıfırlama kodu göndereceğiz:</p>
          <Input
            placeholder="Email adresi"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            block
            loading={forgotLoading}
            onClick={() => {
              setForgotLoading(true);
              setForgotError('');
              setForgotSuccess('');
              
              axios.post(`${API_URL}/api/forgot-password`, {
                email: forgotEmail.trim()
              })
              .then(() => {
                setForgotSuccess('Şifre sıfırlama kodu email adresinize gönderildi.');
                setForgotStep(2);
              })
              .catch(err => {
                setForgotError(err.response?.data?.error || 'Email gönderilemedi');
              })
              .finally(() => {
                setForgotLoading(false);
              });
            }}
          >
            Kod Gönder
          </Button>
        </div>
      )}
      
      {forgotStep === 2 && (
        <div>
          <p>Email adresinize gelen kodu ve yeni şifrenizi girin:</p>
          <Input
            placeholder="Sıfırlama kodu"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Input.Password
            placeholder="Yeni şifre"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Input.Password
            placeholder="Yeni şifre (tekrar)"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            block
            loading={forgotLoading}
            onClick={() => {
              if (!resetCode || !newPassword || !confirmPassword) {
                setForgotError('Tüm alanları doldurun');
                return;
              }
              
              if (newPassword !== confirmPassword) {
                setForgotError('Şifreler eşleşmiyor');
                return;
              }
              
              setForgotLoading(true);
              setForgotError('');
              setForgotSuccess('');
              
              axios.post(`${API_URL}/api/reset-password`, {
                email: forgotEmail.trim(),
                resetCode: resetCode.trim(),
                newPassword: newPassword
              })
              .then(() => {
                setForgotSuccess('Şifreniz başarıyla sıfırlandı.');
                setForgotStep(3);
                setTimeout(() => {
                  setForgotOpen(false);
                  resetForgotState();
                }, 2000);
              })
              .catch(err => {
                setForgotError(err.response?.data?.error || 'Şifre sıfırlanamadı');
              })
              .finally(() => {
                setForgotLoading(false);
              });
            }}
          >
            Şifreyi Sıfırla
          </Button>
        </div>
      )}
      
      {forgotStep === 3 && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#52c41a', fontSize: '16px' }}>
            Şifreniz başarıyla sıfırlandı!
          </p>
        </div>
      )}
      
      {forgotError && (
        <Alert
          message={forgotError}
          type="error"
          style={{ marginTop: 16 }}
        />
      )}
      
      {forgotSuccess && (
        <Alert
          message={forgotSuccess}
          type="success"
          style={{ marginTop: 16 }}
        />
      )}
    </Modal>
  </div>
  );
};

export default LoginAntd;
