import React, { useState } from 'react';
import axios from 'axios';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Upload,
  Avatar,
  Space,
  Tag,
  Alert,
  Spin,
  Card,
  Typography,
  Row,
  Col,
  Select,
  DatePicker,
  Checkbox,
  ConfigProvider,
  Progress,
  message
} from 'antd';
import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  PhoneOutlined,
  CalendarOutlined,
  UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import trTR from 'antd/locale/tr_TR';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import PoseVerification from './PoseVerification';
import './ProfileEdit.css';

dayjs.extend(customParseFormat);
dayjs.locale('tr');

const { TextArea } = Input;
const { Title, Text } = Typography;

function ProfileEdit({ profile, token, onProfileUpdated, onClose, API_URL }) {
  const [form] = Form.useForm();
  const [photos, setPhotos] = useState(profile.photos || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPoseVerification, setShowPoseVerification] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Temel ilgi alanları listesi
  const interestOptions = [
    'Müzik', 'Spor', 'Film', 'Kitap', 'Seyahat', 'Yemek', 'Sanat', 'Teknoloji',
    'Doğa', 'Dans', 'Fotoğrafçılık', 'Oyun', 'Moda', 'Hayvanlar', 'Fitness', 'Yoga',
    'Müze', 'Konser', 'Festival', 'Kamp', 'Deniz', 'Dağ', 'Şehir', 'Köy'
  ];

  React.useEffect(() => {
    form.setFieldsValue({
      username: profile.username || '',
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      gender: profile.gender || undefined,
      bio: profile.bio || '',
      phoneNumber: profile.phoneNumber || '',
      birthDate: profile.birthDate ? dayjs(profile.birthDate) : null,
      interests: profile.interests || []
    });
  }, [profile, form]);

  const handleUploadPhotos = async (options) => {
    const { file, onSuccess, onError } = options;

    if (photos.length >= 5) {
      message.error('En fazla 5 fotoğraf yükleyebilirsiniz');
      onError();
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simüle edilmiş progress (gerçek upload progress için axios interceptor kullanılabilir)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    const formData = new FormData();
    formData.append('photos', file);

    try {
      const response = await axios.post(`${API_URL}/api/profile/photos`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setPhotos(response.data.profile.photos);
        setIsUploading(false);
        setUploadProgress(0);
        onSuccess();
        message.success('Fotoğraf yüklendi');
        
        if (onProfileUpdated) {
          onProfileUpdated(response.data.profile);
        }
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
      message.error(err.response?.data?.error || 'Fotoğraf yüklenemedi');
      onError();
    }
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      const response = await axios.delete(`${API_URL}/api/profile/photos/${photoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setPhotos(response.data.profile.photos);
      message.success('Fotoğraf silindi');
      
      if (onProfileUpdated) {
        onProfileUpdated(response.data.profile);
      }
    } catch (err) {
      message.error('Fotoğraf silinemedi');
    }
  };

  const handleReorderPhotos = async (fromIndex, toIndex) => {
    const newPhotos = [...photos];
    const [removed] = newPhotos.splice(fromIndex, 1);
    newPhotos.splice(toIndex, 0, removed);
    
    setPhotos(newPhotos);
    
    // Backend'e yeni sırayı kaydet
    try {
      const response = await axios.post(`${API_URL}/api/profile/photos/reorder`, {
        photoIds: newPhotos.map(p => p.id)
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setPhotos(response.data.profile.photos);
      message.success('Fotoğraf sırası güncellendi');
      
      if (onProfileUpdated) {
        onProfileUpdated(response.data.profile);
      }
    } catch (err) {
      // Hata durumunda eski sıraya geri dön
      setPhotos(photos);
      message.error('Fotoğraf sırası güncellenemedi');
    }
  };

  const handleSave = async (values) => {
    setLoading(true);
    setError('');

    try {
      // İlgi alanları array olarak geliyor (checkbox'lardan)
      const interestsArray = Array.isArray(values.interests) 
        ? values.interests 
        : (values.interests 
            ? values.interests.split(',').map(i => i.trim()).filter(i => i.length > 0)
            : []);

      if (!values.lastName || !values.lastName.trim()) {
        setError('Soyisim zorunludur');
        setLoading(false);
        return;
      }

      // Doğum tarihinden yaş hesapla
      let age = null;
      let birthDateFormatted = null;
      
      if (values.birthDate) {
        const birthDate = dayjs(values.birthDate);
        if (birthDate.isValid()) {
          const today = dayjs();
          age = today.diff(birthDate, 'year');
          birthDateFormatted = birthDate.format('YYYY-MM-DD');
        }
      }

      const response = await axios.post(`${API_URL}/api/profile`, {
        username: values.username.trim(),
        firstName: values.firstName?.trim() || null,
        lastName: values.lastName.trim(),
        gender: values.gender || null,
        bio: values.bio?.trim() || '',
        phoneNumber: values.phoneNumber?.trim() || null,
        birthDate: birthDateFormatted,
        age: age,
        interests: interestsArray
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      message.success('Profil güncellendi');
      
      if (onProfileUpdated) {
        onProfileUpdated(response.data.profile);
      }
      
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Profil güncellenemedi');
      setLoading(false);
    }
  };

  const uploadProps = {
    customRequest: handleUploadPhotos,
    showUploadList: false,
    accept: 'image/png,image/jpeg,image/jpg,image/gif,image/webp',
    multiple: true,
    disabled: photos.length >= 5
  };

  return (
    <ConfigProvider locale={trTR}>
      <Modal
        open={true}
        onCancel={onClose}
        title={
          <Title level={4} style={{ margin: 0 }}>
            Profil Düzenle
          </Title>
        }
        footer={null}
        width={800}
        closeIcon={<CloseOutlined />}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
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

          <Form.Item
            name="username"
            label="Kullanıcı Adı"
            rules={[
              { required: true, message: 'Kullanıcı adı gereklidir' },
              { max: 50, message: 'En fazla 50 karakter olabilir' }
            ]}
          >
            <Input placeholder="Kullanıcı adınızı girin" />
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

          <Form.Item
            name="phoneNumber"
            label="Cep Telefonu"
            rules={[
              {
                pattern: /^[0-9]{10,15}$/,
                message: 'Geçerli bir telefon numarası giriniz (10-15 rakam)'
              }
            ]}
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
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Doğum tarihinizi seçin"
              format={['DD/MM/YYYY', 'DD.MM.YYYY']}
              disabledDate={(current) => {
                return current && current > dayjs().subtract(18, 'year');
              }}
            />
          </Form.Item>

          <Form.Item
            name="bio"
            label="Biyografi"
            rules={[
              { max: 200, message: 'En fazla 200 karakter olabilir' }
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Hakkınızda bir şeyler yazın..."
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="interests"
            label="İlgi Alanları"
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {interestOptions.map(interest => (
                  <Col span={8} key={interest}>
                    <Checkbox value={interest}>{interest}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          {/* Poz Doğrulama */}
          {!profile.verified && (
            <Card
              style={{
                marginBottom: '24px',
                backgroundColor: '#e6f7ff',
                border: '1px solid #91d5ff'
              }}
            >
              <Title level={5} style={{ marginBottom: '8px' }}>
                Profil Doğrulama
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                Profilinizin onaylanması için random pozlar yapmanız gerekiyor. 
                Bu sayede fake profil oluşturulmasını engelliyoruz.
              </Text>
              <Button
                block
                type="primary"
                onClick={() => setShowPoseVerification(true)}
                style={{
                  background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
                  border: 'none'
                }}
              >
                🎭 Poz Doğrulama Başlat
              </Button>
            </Card>
          )}

          {profile.verified && (
            <Alert
              message="Profil Onaylandı"
              description="Profiliniz başarıyla onaylanmıştır."
              type="success"
              icon={<SafetyCertificateOutlined />}
              style={{ marginBottom: '24px' }}
              showIcon
            />
          )}

          {/* Fotoğraf Yükleme */}
          <Form.Item label={`Fotoğraflar (${photos.length}/5)`}>
            <Row gutter={[16, 16]}>
              {photos.map((photo, index) => {
                // URL formatını düzelt
                let photoUrl = '';
                if (photo.url) {
                  if (photo.url.startsWith('http://') || photo.url.startsWith('https://')) {
                    photoUrl = photo.url;
                  } else {
                    // URL başında / varsa kaldır, yoksa ekle
                    const cleanUrl = photo.url.startsWith('/') ? photo.url : `/${photo.url}`;
                    const cleanApiUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
                    photoUrl = `${cleanApiUrl}${cleanUrl}`;
                  }
                }
                
                return (
                  <Col xs={12} sm={8} md={6} key={photo.id || index}>
                    <div 
                      style={{ 
                        position: 'relative',
                        cursor: 'move',
                        border: index === 0 ? '3px solid #1890ff' : '1px solid #d9d9d9',
                        borderRadius: '8px',
                        padding: index === 0 ? '2px' : '4px'
                      }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', index.toString());
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.opacity = '0.5';
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.opacity = '1';
                        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                        if (draggedIndex !== index) {
                          handleReorderPhotos(draggedIndex, index);
                        }
                      }}
                    >
                      {index === 0 && (
                        <div style={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          backgroundColor: '#1890ff',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          zIndex: 10
                        }}>
                          Profil
                        </div>
                      )}
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt="Profile photo"
                          style={{ 
                            width: '100%', 
                            height: 150, 
                            objectFit: 'cover',
                            borderRadius: '6px',
                            display: 'block',
                            backgroundColor: '#f0f0f0'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const placeholder = e.target.nextElementSibling;
                            if (placeholder) {
                              placeholder.style.display = 'flex';
                            }
                          }}
                          onLoad={(e) => {
                            // Fotoğraf yüklendiğinde placeholder'ı gizle
                            const placeholder = e.target.nextElementSibling;
                            if (placeholder) {
                              placeholder.style.display = 'none';
                            }
                          }}
                        />
                      ) : null}
                      <div style={{
                        width: '100%',
                        height: 150,
                        display: photoUrl ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f0f0f0',
                        borderRadius: '6px'
                      }}>
                        <UserOutlined style={{ fontSize: '48px', color: '#bfbfbf' }} />
                      </div>
                    <Button
                      type="primary"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        zIndex: 10
                      }}
                      onClick={() => handleDeletePhoto(photo.id)}
                    />
                  </div>
                </Col>
              );
              })}
              
              {photos.length < 5 && (
                <Col xs={12} sm={8} md={6}>
                  <Upload {...uploadProps}>
                    <div
                      style={{
                        width: '100%',
                        height: 150,
                        border: '2px dashed #d9d9d9',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backgroundColor: '#fafafa'
                      }}
                    >
                      <UploadOutlined style={{ fontSize: '32px', color: '#8c8c8c', marginBottom: '8px' }} />
                      <Text type="secondary">Fotoğraf Ekle</Text>
                    </div>
                  </Upload>
                </Col>
              )}
            </Row>
          </Form.Item>

          {/* Actions */}
          <Form.Item style={{ marginTop: '24px', marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={onClose} disabled={loading}>
                İptal
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{
                  background: 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)',
                  border: 'none'
                }}
              >
                Kaydet
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      {showPoseVerification && (
        <PoseVerification
          userId={profile.userId}
          token={token}
          onComplete={(verification) => {
            setShowPoseVerification(false);
            message.success('Poz doğrulama fotoğrafları yüklendi. İnceleme sonrası onaylanacaktır.');
            if (onProfileUpdated) {
              axios.get(`${API_URL}/api/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
              }).then(res => {
                onProfileUpdated(res.data.profile);
              });
            }
          }}
          API_URL={API_URL}
        />
      )}
    </ConfigProvider>
  );
}

export default ProfileEdit;