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
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      loadUsers(); // Kullanıcılar listesini de yenile
    } catch (err) {
      message.error(err.response?.data?.error || 'İşlem başarısız');
    }
  };

  const handleBanUser = async (userId, username) => {
    Modal.confirm({
      title: 'Kullanıcıyı Yasakla',
      content: `${username} kullanıcısını yasaklamak istediğinize emin misiniz?`,
      okText: 'Evet, Yasakla',
      okType: 'danger',
      cancelText: 'İptal',
      onOk: async () => {
        try {
          await axios.post(`${API_URL}/api/admin/ban-user`, {
            targetUserId: userId
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          message.success('Kullanıcı yasaklandı');
          loadComplaints();
        } catch (err) {
          message.error(err.response?.data?.error || 'İşlem başarısız');
        }
      }
    });
  };

  const handleWarnUser = async (userId, username) => {
    Modal.confirm({
      title: 'Kullanıcıya Uyarı Gönder',
      content: `${username} kullanıcısına "Hakkınızda şikayet var" uyarısı gönderilecek. Devam etmek istiyor musunuz?`,
      okText: 'Evet, Gönder',
      cancelText: 'İptal',
      onOk: async () => {
        try {
          await axios.post(`${API_URL}/api/admin/warn-user`, {
            targetUserId: userId
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          message.success('Uyarı gönderildi');
          loadComplaints();
        } catch (err) {
          message.error(err.response?.data?.error || 'İşlem başarısız');
        }
      }
    });
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
                      boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                      background: isDarkMode ? '#2e2e2e' : '#fff',
                      border: isDarkMode ? '1px solid #424242' : 'none'
                    }}
                  >
                    <div style={{ marginBottom: '16px' }}>
                      <Title level={4} style={{ 
                        margin: 0, 
                        marginBottom: '8px',
                        color: isDarkMode ? '#fff' : '#000'
                      }}>
                        {verification.username}
                      </Title>
                      <Text type="secondary" style={{ 
                        display: 'block', 
                        marginBottom: '4px',
                        color: isDarkMode ? '#b8b8b8' : '#666'
                      }}>
                        {verification.email}
                      </Text>
                      <Text type="secondary" style={{ 
                        fontSize: '12px',
                        color: isDarkMode ? '#b8b8b8' : '#666'
                      }}>
                        Tarih: {new Date(verification.submittedAt).toLocaleString('tr-TR')}
                      </Text>
                    </div>

                    <Divider style={{ 
                      margin: '16px 0',
                      borderColor: isDarkMode ? '#424242' : '#f0f0f0'
                    }} />

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
                                {img.poseName && (
                                  <Tag
                                    style={{
                                      position: 'absolute',
                                      bottom: 4,
                                      left: 4,
                                      color: isDarkMode ? '#fff' : '#000',
                                      background: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)'
                                    }}
                                    color="blue"
                                  >
                                    {img.poseName}
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
            scroll={{ x: window.innerWidth < 768 ? 800 : undefined }}
            style={{
              background: isDarkMode ? '#2e2e2e' : '#fff'
            }}
            pagination={{
              pageSize: 10,
              showSizeChanger: false
            }}
            columns={[
              {
                title: 'Kullanıcı Adı',
                dataIndex: 'username',
                key: 'username',
                render: (text) => <span style={{ color: isDarkMode ? '#fff' : '#000' }}>{text}</span>
              },
              {
                title: 'Email',
                dataIndex: 'email',
                key: 'email',
                render: (text) => <span style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>{text}</span>
              },
              {
                title: 'Ad Soyad',
                key: 'name',
                render: (_, record) => (
                  <span style={{ color: isDarkMode ? '#fff' : '#000' }}>
                    {`${record.firstName || ''} ${record.lastName || ''}`.trim() || '-'}
                  </span>
                ),
              },
              {
                title: 'Durum',
                dataIndex: 'verified',
                key: 'verified',
                render: (verified, record) => (
                  <Space>
                    <Tag color={verified ? 'success' : 'default'}>
                      {verified ? 'Onaylı' : 'Onaysız'}
                    </Tag>
                    {!verified && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => handleVerify(record.userId, 'approve')}
                        style={{
                          background: '#52c41a',
                          borderColor: '#52c41a'
                        }}
                      >
                        Onayla
                      </Button>
                    )}
                  </Space>
                ),
              },
              {
                title: 'Kayıt Tarihi',
                dataIndex: 'createdAt',
                key: 'createdAt',
                render: (date) => (
                  <span style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    {date ? new Date(date).toLocaleString('tr-TR') : '-'}
                  </span>
                ),
              },
            ]}
          />
        </>
      );
    } else if (activeTab === 'complaints') {
      if (complaints.length === 0) {
        return (
          <div style={{ 
            textAlign: 'center', 
            padding: '64px 0' 
          }}>
            <Text type="secondary" style={{ 
              fontSize: '16px',
              color: isDarkMode ? '#b8b8b8' : '#666'
            }}>
              Henüz şikayet bulunmuyor
            </Text>
          </div>
        );
      }
      
      return (
        <div>
          <Table
            dataSource={complaints}
            rowKey="id"
            scroll={{ x: window.innerWidth < 768 ? 800 : undefined }}
            style={{
              background: isDarkMode ? '#2e2e2e' : '#fff'
            }}
            columns={[
              {
                title: 'Şikayet Eden',
                dataIndex: 'reporterUsername',
                key: 'reporterUsername',
                render: (text) => <span style={{ color: isDarkMode ? '#fff' : '#000' }}>{text}</span>
              },
              {
                title: 'Şikayet Edilen',
                dataIndex: 'targetUsername',
                key: 'targetUsername',
                render: (text) => <span style={{ color: isDarkMode ? '#fff' : '#000' }}>{text}</span>
              },
              {
                title: 'Sebep',
                dataIndex: 'reasonType',
                key: 'reasonType',
                render: (reasonType) => {
                  const reasonNames = {
                    'fake_account': 'Sahte Hesap',
                    'inappropriate_username': 'Uygunsuz Kullanıcı Adı',
                    'inappropriate_photo': 'Uygunsuz Fotoğraf',
                    'other': 'Diğer'
                  };
                  return (
                    <Tag color="red">
                      {reasonNames[reasonType] || reasonType}
                    </Tag>
                  );
                }
              },
              {
                title: 'Açıklama',
                dataIndex: 'customReason',
                key: 'customReason',
                render: (text) => (
                  <span style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    {text || '-'}
                  </span>
                )
              },
              {
                title: 'Tarih',
                dataIndex: 'timestamp',
                key: 'timestamp',
                render: (date) => (
                  <span style={{ color: isDarkMode ? '#b8b8b8' : '#666' }}>
                    {date ? new Date(date).toLocaleString('tr-TR') : '-'}
                  </span>
                )
              },
              {
                title: 'İşlemler',
                key: 'actions',
                render: (_, record) => (
                  <Space>
                    <Button
                      size="small"
                      danger
                      onClick={() => handleBanUser(record.targetUserId, record.targetUsername)}
                    >
                      Yasakla
                    </Button>
                    <Button
                      size="small"
                      type="default"
                      onClick={() => handleWarnUser(record.targetUserId, record.targetUsername)}
                    >
                      Uyarı Gönder
                    </Button>
                  </Space>
                )
              },
            ]}
            pagination={{ pageSize: 10 }}
          />
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
        width={windowWidth < 768 ? 200 : 250}
        breakpoint="lg"
        collapsedWidth={windowWidth < 768 ? 0 : 80}
        style={{
          background: isDarkMode ? '#1a202c' : '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ padding: windowWidth < 768 ? '16px' : '24px' }}>
          <Title level={4} style={{ 
            marginBottom: '24px', 
            color: isDarkMode ? '#e2e8f0' : '#32325d',
            fontSize: windowWidth < 768 ? '16px' : '20px'
          }}>
            🛡️ Admin Panel
          </Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              type={activeTab === 'verifications' ? 'primary' : 'default'}
              icon={<CheckCircleOutlined />}
              onClick={() => setActiveTab('verifications')}
              block
              style={{ 
                textAlign: 'left',
                marginBottom: '8px',
                background: activeTab === 'verifications' && isDarkMode ? '#2e2e2e' : undefined,
                borderColor: isDarkMode ? '#424242' : undefined,
                color: isDarkMode ? '#fff' : undefined
              }}
            >
              Doğrulama İstekleri
            </Button>
            <Button
              type={activeTab === 'users' ? 'primary' : 'default'}
              icon={<UserOutlined />}
              onClick={() => setActiveTab('users')}
              block
              style={{ 
                textAlign: 'left',
                marginBottom: '8px',
                background: activeTab === 'users' && isDarkMode ? '#2e2e2e' : undefined,
                borderColor: isDarkMode ? '#424242' : undefined,
                color: isDarkMode ? '#fff' : undefined
              }}
            >
              Kullanıcılar
            </Button>
            <Button
              type={activeTab === 'complaints' ? 'primary' : 'default'}
              icon={<ExclamationCircleOutlined />}
              onClick={() => setActiveTab('complaints')}
              block
              style={{ 
                textAlign: 'left',
                marginBottom: '8px',
                background: activeTab === 'complaints' && isDarkMode ? '#2e2e2e' : undefined,
                borderColor: isDarkMode ? '#424242' : undefined,
                color: isDarkMode ? '#fff' : undefined
              }}
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
      <Content style={{ 
        padding: windowWidth < 768 ? '16px' : '24px',
        background: isDarkMode ? '#1a202c' : '#fff'
      }}>
        <Card style={{ 
          borderRadius: '16px', 
          minHeight: 'calc(100vh - 48px)',
          background: isDarkMode ? '#2e2e2e' : '#fff',
          border: isDarkMode ? '1px solid #424242' : 'none'
        }}>
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