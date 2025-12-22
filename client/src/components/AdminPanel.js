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
  message,
  Layout,
  Table,
  Select,
  Input
} from 'antd';
import {
  SafetyCertificateOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { ThemeContext } from '../App';
import './AdminPanel.css';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AdminPanel({ token, API_URL, onGoToProfile }) {
  const { isDarkMode } = React.useContext(ThemeContext);
  const [verifications, setVerifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('verifications'); // 'verifications', 'users', 'complaints'
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    if (activeTab === 'verifications') {
      loadVerifications();
      const interval = setInterval(loadVerifications, 5000);
      return () => clearInterval(interval);
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'complaints') {
      loadComplaints();
    }
  }, [activeTab, sortBy, sortOrder]);

  const loadVerifications = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/pending-verifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setVerifications(response.data.verifications || []);
      setError('');
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Bu sayfaya erişim yetkiniz yok');
      } else {
        setError(err.response?.data?.error || 'Veriler yüklenemedi');
      }
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          sortBy: sortBy,
          order: sortOrder
        }
      });
      setUsers(response.data.users || []);
      setError('');
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Bu sayfaya erişim yetkiniz yok');
      } else {
        setError(err.response?.data?.error || 'Veriler yüklenemedi');
      }
      setLoading(false);
    }
  };

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/admin/complaints`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setComplaints(response.data.complaints || []);
      setError('');
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Bu sayfaya erişim yetkiniz yok');
      } else {
        setError(err.response?.data?.error || 'Veriler yüklenemedi');
      }
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

  const renderContent = () => {
    if (activeTab === 'verifications') {
      return (
        <>
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
        </>
      );
    } else if (activeTab === 'users') {
      return (
        <>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 200 }}
            >
              <Select.Option value="createdAt">Kayıt Tarihi</Select.Option>
              <Select.Option value="username">Kullanıcı Adı</Select.Option>
              <Select.Option value="updatedAt">Güncelleme Tarihi</Select.Option>
              <Select.Option value="profileViews">Profil Görüntüleme</Select.Option>
            </Select>
            <Select
              value={sortOrder}
              onChange={setSortOrder}
              style={{ width: 150 }}
            >
              <Select.Option value="desc">Azalan</Select.Option>
              <Select.Option value="asc">Artan</Select.Option>
            </Select>
          </div>
          <Table
            dataSource={users}
            rowKey="userId"
            columns={[
              {
                title: 'Kullanıcı Adı',
                dataIndex: 'username',
                key: 'username',
              },
              {
                title: 'Email',
                dataIndex: 'email',
                key: 'email',
              },
              {
                title: 'Ad Soyad',
                key: 'name',
                render: (_, record) => `${record.firstName || ''} ${record.lastName || ''}`.trim() || '-',
              },
              {
                title: 'Durum',
                dataIndex: 'verified',
                key: 'verified',
                render: (verified) => (
                  <Tag color={verified ? 'success' : 'default'}>
                    {verified ? 'Onaylı' : 'Onaysız'}
                  </Tag>
                ),
              },
              {
                title: 'Kayıt Tarihi',
                dataIndex: 'createdAt',
                key: 'createdAt',
                render: (date) => date ? new Date(date).toLocaleString('tr-TR') : '-',
              },
            ]}
            pagination={{ pageSize: 10 }}
          />
        </>
      );
    } else if (activeTab === 'complaints') {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '64px 0' 
        }}>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Henüz şikayet bulunmuyor
          </Text>
        </div>
      );
    }
  };

  return (
    <Layout style={{ 
      minHeight: '100vh',
      background: isDarkMode 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
    }}>
      <Sider
        width={250}
        style={{
          background: isDarkMode ? '#1a202c' : '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ padding: '24px' }}>
          <Title level={4} style={{ marginBottom: '24px', color: isDarkMode ? '#e2e8f0' : '#32325d' }}>
            🛡️ Admin Panel
          </Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              type={activeTab === 'verifications' ? 'primary' : 'default'}
              icon={<CheckCircleOutlined />}
              onClick={() => setActiveTab('verifications')}
              block
              style={{ textAlign: 'left' }}
            >
              Doğrulama İstekleri
            </Button>
            <Button
              type={activeTab === 'users' ? 'primary' : 'default'}
              icon={<UserOutlined />}
              onClick={() => setActiveTab('users')}
              block
              style={{ textAlign: 'left' }}
            >
              Kullanıcılar
            </Button>
            <Button
              type={activeTab === 'complaints' ? 'primary' : 'default'}
              icon={<ExclamationCircleOutlined />}
              onClick={() => setActiveTab('complaints')}
              block
              style={{ textAlign: 'left' }}
            >
              Şikayetler
            </Button>
          </div>
          {onGoToProfile && (
            <Button
              type="default"
              icon={<UserOutlined />}
              onClick={onGoToProfile}
              block
              style={{ marginTop: '24px' }}
            >
              Profile Geçiş Yap
            </Button>
          )}
        </div>
      </Sider>
      <Content style={{ padding: '24px' }}>
        <Card style={{ borderRadius: '16px', minHeight: 'calc(100vh - 48px)' }}>
          <div style={{ marginBottom: '24px' }}>
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              {activeTab === 'verifications' && 'Bekleyen Doğrulamalar'}
              {activeTab === 'users' && 'Kullanıcılar'}
              {activeTab === 'complaints' && 'Şikayetler'}
            </Title>
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

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <Spin size="large" />
            </div>
          ) : (
            renderContent()
          )}
        </Card>
      </Content>
    </Layout>
  );
}
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '64px 0' 
        }}>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Henüz şikayet bulunmuyor
          </Text>
        </div>
      );
    }
  };

  return (
    <Layout style={{ 
      minHeight: '100vh',
      background: isDarkMode 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
    }}>
      <Sider
        width={250}
        style={{
          background: isDarkMode ? '#1a202c' : '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ padding: '24px' }}>
          <Title level={4} style={{ marginBottom: '24px', color: isDarkMode ? '#e2e8f0' : '#32325d' }}>
            🛡️ Admin Panel
          </Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              type={activeTab === 'verifications' ? 'primary' : 'default'}
              icon={<CheckCircleOutlined />}
              onClick={() => setActiveTab('verifications')}
              block
              style={{ textAlign: 'left' }}
            >
              Doğrulama İstekleri
            </Button>
            <Button
              type={activeTab === 'users' ? 'primary' : 'default'}
              icon={<UserOutlined />}
              onClick={() => setActiveTab('users')}
              block
              style={{ textAlign: 'left' }}
            >
              Kullanıcılar
            </Button>
            <Button
              type={activeTab === 'complaints' ? 'primary' : 'default'}
              icon={<ExclamationCircleOutlined />}
              onClick={() => setActiveTab('complaints')}
              block
              style={{ textAlign: 'left' }}
            >
              Şikayetler
            </Button>
          </div>
          {onGoToProfile && (
            <Button
              type="default"
              icon={<UserOutlined />}
              onClick={onGoToProfile}
              block
              style={{ marginTop: '24px' }}
            >
              Profile Geçiş Yap
            </Button>
          )}
        </div>
      </Sider>
      <Content style={{ padding: '24px' }}>
        <Card style={{ borderRadius: '16px', minHeight: 'calc(100vh - 48px)' }}>
          <div style={{ marginBottom: '24px' }}>
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              {activeTab === 'verifications' && 'Bekleyen Doğrulamalar'}
              {activeTab === 'users' && 'Kullanıcılar'}
              {activeTab === 'complaints' && 'Şikayetler'}
            </Title>
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

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <Spin size="large" />
            </div>
          ) : (
            renderContent()
          )}
        </Card>
      </Content>
    </Layout>
  );
}

export default AdminPanel;