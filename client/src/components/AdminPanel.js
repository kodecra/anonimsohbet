import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  Typography,
  Button,
  Avatar,
  Tag,
  Spin,
  Alert,
  Space,
  Row,
  Col,
  Image,
  Divider,
  message
} from 'antd';
import {
  SafetyCertificateOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined
} from '@ant-design/icons';
import { ThemeContext } from '../App';
import './AdminPanel.css';

const { Title, Text } = Typography;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AdminPanel({ token, API_URL, onGoToProfile }) {
  const { isDarkMode } = React.useContext(ThemeContext);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVerifications();
    // Her 5 saniyede bir yenile
    const interval = setInterval(loadVerifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadVerifications = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/pending-verifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setVerifications(response.data.verifications || []);
      setError('');
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Bu sayfaya erişim yetkiniz yok');
      } else {
        setError(err.response?.data?.error || 'Veriler yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (userId, action) => {
    try {
      await axios.post(`${API_URL}/api/admin/verify-user`, {
        targetUserId: userId,
        action: action
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      message.success(action === 'approve' ? 'Kullanıcı onaylandı' : 'Doğrulama reddedildi');
      loadVerifications();
    } catch (err) {
      message.error(err.response?.data?.error || 'İşlem başarısız');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
        padding: '24px'
      }}>
        <Card style={{ textAlign: 'center', padding: '48px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text>Yükleniyor...</Text>
          </div>
        </Card>
      </div>
    );
  }

  if (error && error.includes('yetkiniz yok')) {
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
        padding: '24px'
      }}>
        <Card>
          <Alert
            message="Yetkisiz Erişim"
            description={error}
            type="error"
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: isDarkMode 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
      padding: '24px',
      transition: 'background 0.3s ease'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Card style={{ marginBottom: '24px', borderRadius: '16px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                🛡️ Superadmin Panel
              </Title>
              <Text type="secondary">Bekleyen Doğrulamalar</Text>
            </div>
            {onGoToProfile && (
              <Button
                type="primary"
                icon={<UserOutlined />}
                onClick={onGoToProfile}
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
                  border: 'none'
                }}
              >
                Profile Geçiş Yap
              </Button>
            )}
          </div>

          {error && (
            <Alert
              message="Hata"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError('')}
              style={{ marginBottom: '24px' }}
            />
          )}

          {verifications.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '64px 0' 
            }}>
              <Text type="secondary" style={{ fontSize: '16px' }}>
                Bekleyen doğrulama yok
              </Text>
            </div>
          ) : (
            <Row gutter={[24, 24]}>
              {verifications.map((verification) => (
                <Col xs={24} md={12} lg={8} key={verification.userId}>
                  <Card
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ marginBottom: '16px' }}>
                      <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>
                        {verification.username}
                      </Title>
                      <Text type="secondary" style={{ display: 'block', marginBottom: '4px' }}>
                        {verification.email}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Tarih: {new Date(verification.submittedAt).toLocaleString('tr-TR')}
                      </Text>
                    </div>

                    <Divider style={{ margin: '16px 0' }} />

                    <div style={{ marginBottom: '16px' }}>
                      {/* Eski sistem için selfie */}
                      {verification.selfieUrl && (
                        <Image
                          src={`${API_URL}${verification.selfieUrl}`}
                          alt="Selfie"
                          style={{ 
                            width: '100%', 
                            borderRadius: '8px',
                            marginBottom: '8px'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      {/* Yeni sistem için pozlar */}
                      {verification.poseImages && verification.poseImages.length > 0 && (
                        <Row gutter={[8, 8]}>
                          {verification.poseImages.map((img, index) => (
                            <Col span={8} key={index}>
                              <div style={{ position: 'relative' }}>
                                <Image
                                  src={`${API_URL}${img.url}`}
                                  alt={`Poz ${index + 1}`}
                                  style={{ 
                                    width: '100%', 
                                    borderRadius: '8px',
                                    aspectRatio: '1'
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                {verification.poses && verification.poses[index] && (
                                  <Tag
                                    style={{
                                      position: 'absolute',
                                      bottom: 4,
                                      left: 4
                                    }}
                                    color="blue"
                                  >
                                    Poz {index + 1}
                                  </Tag>
                                )}
                              </div>
                            </Col>
                          ))}
                        </Row>
                      )}
                    </div>

                    <Space style={{ width: '100%', justifyContent: 'center' }}>
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => handleVerify(verification.userId, 'approve')}
                        style={{
                          background: '#52c41a',
                          borderColor: '#52c41a'
                        }}
                      >
                        Onayla
                      </Button>
                      <Button
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => handleVerify(verification.userId, 'reject')}
                      >
                        Reddet
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      </div>
    </div>
  );
}

export default AdminPanel;