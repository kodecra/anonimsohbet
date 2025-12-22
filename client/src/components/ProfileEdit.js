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
  message
} from 'antd';
import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  UploadOutlined
} from '@ant-design/icons';
import PoseVerification from './PoseVerification';
import './ProfileEdit.css';

const { TextArea } = Input;
const { Title, Text } = Typography;

function ProfileEdit({ profile, token, onProfileUpdated, onClose, API_URL }) {
  const [form] = Form.useForm();
  const [photos, setPhotos] = useState(profile.photos || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPoseVerification, setShowPoseVerification] = useState(false);

  React.useEffect(() => {
    form.setFieldsValue({
      username: profile.username || '',
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      gender: profile.gender || undefined,
      bio: profile.bio || '',
      interests: (profile.interests || []).join(', ')
    });
  }, [profile, form]);

  const handleUploadPhotos = async (options) => {
    const { file, onSuccess, onError } = options;

    if (photos.length >= 5) {
      message.error('En fazla 5 fotoğraf yükleyebilirsiniz');
      onError();
      return;
    }

    const formData = new FormData();
    formData.append('photos', file);

    try {
      const response = await axios.post(`${API_URL}/api/profile/photos`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setPhotos(response.data.profile.photos);
      onSuccess();
      message.success('Fotoğraf yüklendi');
      
      if (onProfileUpdated) {
        onProfileUpdated(response.data.profile);
      }
    } catch (err) {
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

  const handleSave = async (values) => {
    setLoading(true);
    setError('');

    try {
      const interestsArray = values.interests
        ? values.interests.split(',').map(i => i.trim()).filter(i => i.length > 0)
        : [];

      if (!values.lastName || !values.lastName.trim()) {
        setError('Soyisim zorunludur');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_URL}/api/profile`, {
        username: values.username.trim(),
        firstName: values.firstName?.trim() || null,
        lastName: values.lastName.trim(),
        gender: values.gender || null,
        bio: values.bio?.trim() || '',
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
    accept: 'image/*',
    multiple: true,
    disabled: photos.length >= 5
  };

  return (
    <>
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
            label="İlgi Alanları (virgülle ayırın)"
          >
            <Input placeholder="Müzik, Spor, Film..." />
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
              {photos.map((photo) => (
                <Col xs={12} sm={8} md={6} key={photo.id}>
                  <div style={{ position: 'relative' }}>
                    <Avatar
                      src={`${API_URL}${photo.url}`}
                      shape="square"
                      size={120}
                      style={{ width: '100%', height: 150, objectFit: 'cover' }}
                    />
                    <Button
                      type="primary"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4
                      }}
                      onClick={() => handleDeletePhoto(photo.id)}
                    />
                  </div>
                </Col>
              ))}
              
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
    </>
  );
}

export default ProfileEdit;