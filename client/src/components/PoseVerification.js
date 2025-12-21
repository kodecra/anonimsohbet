import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './PoseVerification.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Random pozlar
const POSES = [
  {
    id: 1,
    name: 'Tek Parmağı Burna',
    description: 'Tek parmağınızı burnunuza koyun',
    icon: '👆',
    animation: 'point-nose'
  },
  {
    id: 2,
    name: 'İki Parmağı Kulağa',
    description: 'İki parmağınızı kulağınıza koyun',
    icon: '✌️',
    animation: 'point-ear'
  },
  {
    id: 3,
    name: 'Yumruk Havaya',
    description: 'Yumruğunuzu havaya kaldırın',
    icon: '✊',
    animation: 'fist-up'
  },
  {
    id: 4,
    name: 'İki El Yanlara',
    description: 'İki elinizi yanlara açın',
    icon: '🤗',
    animation: 'hands-out'
  },
  {
    id: 5,
    name: 'Bir El Çeneye',
    description: 'Bir elinizi çenenize koyun',
    icon: '🤔',
    animation: 'hand-chin'
  }
];

function PoseVerification({ userId, token, onComplete, API_URL }) {
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [selectedPoses, setSelectedPoses] = useState([]);

  // Random 3 poz seç
  useEffect(() => {
    const shuffled = [...POSES].sort(() => 0.5 - Math.random());
    setSelectedPoses(shuffled.slice(0, 3));
  }, []);

  // Kamerayı başlat
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Kamera erişimi hatası:', err);
      alert('Kamera erişimi sağlanamadı. Lütfen izin verin.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    return imageData;
  };

  const handleCapture = () => {
    setIsCapturing(true);
    const imageData = capturePhoto();
    
    if (imageData) {
      const newImages = [...capturedImages, {
        pose: selectedPoses[currentPoseIndex],
        image: imageData
      }];
      setCapturedImages(newImages);

      if (currentPoseIndex < selectedPoses.length - 1) {
        setTimeout(() => {
          setCurrentPoseIndex(currentPoseIndex + 1);
          setIsCapturing(false);
        }, 500);
      } else {
        // Tüm pozlar tamamlandı
        setIsCapturing(false);
        setShowPreview(true);
      }
    }
  };

  const handleRetake = () => {
    const newImages = capturedImages.slice(0, -1);
    setCapturedImages(newImages);
    setCurrentPoseIndex(Math.max(0, currentPoseIndex - 1));
    setShowPreview(false);
  };

  const handleSubmit = async () => {
    try {
      const formData = new FormData();
      
      // Her poz için fotoğrafı blob'a çevir ve ekle
      capturedImages.forEach((item, index) => {
        const blob = dataURLtoBlob(item.image);
        formData.append(`pose_${item.pose.id}`, blob, `pose_${item.pose.id}.jpg`);
      });

      // Poz bilgilerini ekle
      formData.append('poses', JSON.stringify(capturedImages.map(i => i.pose.id)));

      const response = await axios.post(`${API_URL}/api/profile/verify-poses`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      stopCamera();
      if (onComplete) {
        onComplete(response.data.verification);
      }
    } catch (err) {
      console.error('Poz doğrulama hatası:', err);
      alert('Pozlar yüklenemedi: ' + (err.response?.data?.error || err.message));
    }
  };

  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const currentPose = selectedPoses[currentPoseIndex];

  if (showPreview && capturedImages.length === selectedPoses.length) {
    return (
      <div className="pose-verification-container">
        <div className="pose-preview">
          <h2>Fotoğrafları Kontrol Edin</h2>
          <div className="preview-grid">
            {capturedImages.map((item, index) => (
              <div key={index} className="preview-item">
                <img src={item.image} alt={item.pose.name} />
                <p>{item.pose.icon} {item.pose.name}</p>
              </div>
            ))}
          </div>
          <div className="preview-actions">
            <button onClick={handleRetake} className="retake-button">
              Yeniden Çek
            </button>
            <button onClick={handleSubmit} className="submit-button">
              Gönder
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentPose) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div className="pose-verification-container" onClick={(e) => e.stopPropagation()}>
      <div className="pose-verification-content" onClick={(e) => e.stopPropagation()}>
        <div className="pose-header">
          <h2>Profil Doğrulama</h2>
          <p className="pose-counter">
            {currentPoseIndex + 1} / {selectedPoses.length}
          </p>
        </div>

        <div className="pose-instruction">
          <div className={`pose-icon ${currentPose.animation}`}>
            {currentPose.icon}
          </div>
          <h3>{currentPose.name}</h3>
          <p>{currentPose.description}</p>
        </div>

        <div className="camera-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video"
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCapture();
          }}
          disabled={isCapturing}
          className="capture-button"
        >
          {isCapturing ? 'Çekiliyor...' : '📸 Fotoğraf Çek'}
        </button>

        <div className="pose-progress">
          {selectedPoses.map((pose, index) => (
            <div
              key={pose.id}
              className={`progress-dot ${index <= currentPoseIndex ? 'completed' : ''}`}
            >
              {index < currentPoseIndex ? '✓' : index + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PoseVerification;
