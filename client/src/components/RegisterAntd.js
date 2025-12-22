import React, { useState } from 'react';
import axios from 'axios';
import { Form, Input, Button, Card, Typography, Alert, Divider, Select, Row, Col, DatePicker, ConfigProvider } from 'antd';
import { UserOutlined, PhoneOutlined, LockOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import trTR from 'antd/locale/tr_TR';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import './Register.css';

dayjs.extend(customParseFormat);
dayjs.locale('tr');

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
      // Doğum tarihinden yaş hesapla
      let age = null;
      let birthDateFormatted = null;
      
      if (values.birthDate) {
        let birthDate;
        // Eğer string formatında gelirse (21.09.1996 gibi)
        if (typeof values.birthDate === 'string') {
          birthDate = dayjs(values.birthDate, 'DD.MM.YYYY', true);
          if (!birthDate.isValid()) {
            birthDate = dayjs(values.birthDate);
          }
        } else {
          birthDate = dayjs(values.birthDate);
        }
        
        if (birthDate.isValid()) {
          const today = dayjs();
          age = today.diff(birthDate, 'year');
          birthDateFormatted = birthDate.format('YYYY-MM-DD');
        }
      }

      const response = await axios.post(`${API_URL}/api/register`, {
        username: values.username.trim(),
        firstName: values.firstName?.trim() || null,
        lastName: values.lastName.trim(),
        gender: values.gender || null,
        phoneNumber: values.phoneNumber?.trim() || null,
        password: values.password,
        birthDate: birthDateFormatted,
        age: age
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
    <ConfigProvider locale={trTR}>
      <div className="register-container" style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <Card 
          style={{ 
            width: '100%', 
            maxWidth: 420,
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: '95vh',
            overflowY: 'auto'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img 
              src="/logo.png" 
              alt="Soulbate Logo" 
              style={{ 
                height: '60px', 
                width: 'auto', 
                marginBottom: '12px',
                objectFit: 'contain'
              }} 
            />
            <Text type="secondary" style={{ display: 'block', fontSize: '16px' }}>Kayıt Ol</Text>
          </div>

          {error && (
            <Alert
              message="Hata"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: '16px' }}
              closable
              onClose={() => setError('')}
            />
          )}

          <Form
            form={form}
            name="register"
            onFinish={handleRegister}
            layout="vertical"
            size="middle"
            autoComplete="off"
            style={{ marginBottom: '16px' }}
          >
          <Form.Item
            name="username"
            label="Kullanıcı Adı"
            rules={[
              { required: true, message: 'Kullanıcı adı gereklidir' },
              { max: 50, message: 'En fazla 50 karakter olabilir' }
            ]}
            style={{ marginBottom: '12px' }}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="kullaniciadi"
            />
          </Form.Item>

          <Row gutter={12} style={{ marginBottom: '0' }}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="İsim"
                rules={[
                  { max: 50, message: 'En fazla 50 karakter olabilir' }
                ]}
                style={{ marginBottom: '12px' }}
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
                style={{ marginBottom: '12px' }}
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
            style={{ marginBottom: '12px' }}
          >
            <Select placeholder="Cinsiyet seçin (isteğe bağlı)">
              <Select.Option value="male">Erkek</Select.Option>
              <Select.Option value="female">Kadın</Select.Option>
              <Select.Option value="other">Diğer</Select.Option>
              <Select.Option value="prefer_not_to_say">Belirtmek istemiyorum</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="phoneNumber"
            label="Cep Telefonu"
            rules={[
              { required: true, message: 'Cep telefonu numarası gereklidir' },
              { 
                pattern: /^[0-9]{10,15}$/, 
                message: 'Geçerli bir telefon numarası giriniz (10-15 rakam)' 
              }
            ]}
            style={{ marginBottom: '12px' }}
          >
            <Input 
              prefix={<PhoneOutlined />} 
              placeholder="5XX XXX XX XX"
              maxLength={15}
            />
          </Form.Item>

          <Form.Item
            name="birthDate"
            label="Doğum Tarihi"
            rules={[
              { required: true, message: 'Doğum tarihi gereklidir' },
              {
                validator: (_, value) => {
                  if (!value) {
                    return Promise.resolve();
                  }
                  
                  let date;
                  // String formatında gelirse (21.09.1996 gibi)
                  if (typeof value === 'string') {
                    date = dayjs(value, 'DD.MM.YYYY', true);
                    if (!date.isValid()) {
                      date = dayjs(value);
                    }
                  } else {
                    date = dayjs(value);
                  }
                  
                  if (!date.isValid()) {
                    return Promise.reject(new Error('Geçerli bir tarih giriniz (örn: 21.09.1996)'));
                  }
                  
                  // 18 yaş kontrolü
                  const today = dayjs();
                  const age = today.diff(date, 'year');
                  if (age < 18) {
                    return Promise.reject(new Error('18 yaşından büyük olmalısınız'));
                  }
                  
                  return Promise.resolve();
                }
              }
            ]}
            style={{ marginBottom: '12px' }}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Doğum tarihinizi seçin veya yazın (21.09.1996)"
              format="DD.MM.YYYY"
              allowClear
              disabledDate={(current) => {
                // 18 yaşından küçükleri engelle
                return current && current > dayjs().subtract(18, 'year');
              }}
              onChange={(date, dateString) => {
                // Manuel giriş için parse et
                if (dateString && !date) {
                  const parsed = dayjs(dateString, 'DD.MM.YYYY', true);
                  if (parsed.isValid()) {
                    form.setFieldsValue({ birthDate: parsed });
                  }
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Şifre"
            rules={[
              { required: true, message: 'Şifre gereklidir' },
              { min: 6, message: 'Şifre en az 6 karakter olmalıdır' }
            ]}
            style={{ marginBottom: '12px' }}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Şifrenizi girin"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Şifre Tekrar"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Şifre tekrarı gereklidir' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Şifreler eşleşmiyor'));
                },
              }),
            ]}
            style={{ marginBottom: '16px' }}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Şifrenizi tekrar girin"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: '12px' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              block
              loading={loading}
              style={{
                height: '44px',
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

        <Divider style={{ margin: '16px 0' }}>Zaten hesabınız var mı?</Divider>

        <Button 
          type="default" 
          block
          onClick={onSwitchToLogin || (() => {})}
          style={{
            height: '40px',
            fontSize: '15px',
            borderRadius: '8px'
          }}
        >
          Giriş Yap
        </Button>
      </Card>
    </div>
    </ConfigProvider>
  );
}

export default RegisterAntd;
