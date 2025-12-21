import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  List,
  Avatar, 
  Typography, 
  Empty,
  Spin,
  Alert,
  Tag,
  Space
} from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import './ChatsList.css';

const { Text } = Typography;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ChatsList({ token, onSelectChat, API_URL }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMatches();
  }, [token]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/matches`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setMatches(response.data.matches || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Sohbetler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: '64px 0' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <Alert message="Hata" description={error} type="error" showIcon />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <Empty
        description={
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              Henüz sohbetiniz yok
            </Text>
            <Text type="secondary">
              Eşleşme yaparak sohbetlere başlayın!
            </Text>
          </div>
        }
        style={{ padding: '64px 0' }}
      />
    );
  }

  return (
    <List
      dataSource={matches}
      renderItem={(match) => (
        <List.Item
          onClick={() => onSelectChat(match.matchId)}
          style={{
            cursor: 'pointer',
            padding: '16px',
            borderBottom: '1px solid #f0f0f0'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <List.Item.Meta
            avatar={
              <div style={{ position: 'relative' }}>
                {match.partner.photos && match.partner.photos.length > 0 ? (
                  <Avatar
                    src={`${API_URL}${match.partner.photos[0].url}`}
                    size={60}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/60';
                    }}
                  />
                ) : (
                  <Avatar size={60} style={{ backgroundColor: '#1890ff' }}>
                    {match.partner.username.charAt(0).toUpperCase()}
                  </Avatar>
                )}
                {match.partner.verified && (
                  <SafetyCertificateOutlined
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: '#52c41a',
                      color: 'white',
                      borderRadius: '50%',
                      padding: '2px',
                      fontSize: '14px'
                    }}
                  />
                )}
              </div>
            }
            title={
              <Space>
                <Text strong>{match.partner.username}</Text>
              </Space>
            }
            description={
              <div>
                {match.lastMessage && (
                  <Text 
                    type="secondary" 
                    ellipsis 
                    style={{ display: 'block', maxWidth: '200px', marginBottom: '4px' }}
                  >
                    {match.lastMessage.text.length > 50
                      ? match.lastMessage.text.substring(0, 50) + '...'
                      : match.lastMessage.text}
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {formatDate(match.lastMessageAt)}
                </Text>
              </div>
            }
          />
        </List.Item>
      )}
    />
  );
}

export default ChatsList;