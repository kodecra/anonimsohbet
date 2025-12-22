import React, { useState } from 'react';
import axios from 'axios';
import { Form, Input, Button, Card, Typography, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import './Login.css';

const { Title, Text } = Typography;

function LoginAntd({ onLogin, onSwitchToRegister, API_URL }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

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
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
      padding: '20px'
    }}>
      <Card 
        style={{ 
          width: '100%', 
          maxWidth: 420,
          borderRadius: '16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img 
            src="/logo.png" 
            alt="Soulbate Logo" 
            style={{ 
              height: '80px', 
              width: 'auto', 
              marginBottom: '16px',
              objectFit: 'contain'
            }} 
          />
          <Text type="secondary" style={{ display: 'block', fontSize: '16px' }}>Giriş Yap</Text>
        </div>

        {error && (
          <Alert
            message="Hata"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: '24px' }}
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
            label="Kullanıcı Adı veya Telefon"
            rules={[
              { required: true, message: 'Kullanıcı adı veya telefon numarası gereklidir' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Kullanıcı adı veya telefon numarası"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Şifre"
            rules={[
              { required: true, message: 'Şifre gereklidir' },
              { min: 6, message: 'Şifre en az 6 karakter olmalıdır' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Şifrenizi girin"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block
              loading={loading}
              style={{
                height: '48px',
                fontSize: '16px',
                background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
                border: 'none',
                borderRadius: '8px'
              }}
            >
              Giriş Yap
            </Button>
          </Form.Item>
        </Form>

        <Divider>Hesabınız yok mu?</Divider>

        <Button 
          type="default" 
          block
          onClick={onSwitchToRegister || (() => {})}
          style={{
            height: '44px',
            fontSize: '16px',
            borderRadius: '8px'
          }}
        >
          Kayıt Ol
        </Button>
      </Card>
    </div>
  );
}

export default LoginAntd;
