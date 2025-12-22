import React, { useState } from 'react';
import axios from 'axios';
import { Form, Input, Button, Card, Typography, Alert, Divider, Select, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import './Register.css';

const { Title, Text } = Typography;

function RegisterAntd({ onRegister, onSwitchToLogin, API_URL }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  const handleRegister = async (values) => {
    if (values.password !== values.confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/register`, {
        username: values.username.trim(),
        firstName: values.firstName?.trim() || null,
        lastName: values.lastName.trim(),
        gender: values.gender || null
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
    <div className="register-container" style={{ 
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
          <Title level={2} style={{ color: '#1890ff', marginBottom: '8px' }}>
            🎭 Anonim Sohbet
          </Title>
          <Text type="secondary">Kayıt Ol</Text>
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
          name="register"
          onFinish={handleRegister}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="username"
            label="Kullanıcı Adı"
            rules={[
              { required: true, message: 'Kullanıcı adı gereklidir' },
              { max: 50, message: 'En fazla 50 karakter olabilir' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="kullaniciadi"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="İsim"
                rules={[
                  { max: 50, message: 'En fazla 50 karakter olabilir' }
                ]}
              >
                <Input placeholder="İsminiz" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Soyisim"
                rules={[
                  { required: true, message: 'Soyisim zorunludur' },
                  { max: 50, message: 'En fazla 50 karakter olabilir' }
                ]}
              >
                <Input placeholder="Soyisminiz" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="gender"
            label="Cinsiyet"
            rules={[
              { required: false }
            ]}
          >
            <Select placeholder="Cinsiyet seçin (isteğe bağlı)">
              <Select.Option value="male">Erkek</Select.Option>
              <Select.Option value="female">Kadın</Select.Option>
              <Select.Option value="other">Diğer</Select.Option>
              <Select.Option value="prefer_not_to_say">Belirtmek istemiyorum</Select.Option>
            </Select>
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
              Kayıt Ol
            </Button>
          </Form.Item>
        </Form>

        <Divider>Zaten hesabınız var mı?</Divider>

        <Button 
          type="default" 
          block
          onClick={onSwitchToLogin || (() => {})}
          style={{
            height: '44px',
            fontSize: '16px',
            borderRadius: '8px'
          }}
        >
          Giriş Yap
        </Button>
      </Card>
    </div>
  );
}

export default RegisterAntd;
