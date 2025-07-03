// React
import React, { useState, useRef, useEffect } from 'react';
//Styling
import './Camera.css';

const Camera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start the camera when component mounts
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setError(null);
    } catch (err) {
      setError('Could not access the camera.');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context?.drawImage(video, 0, 0, canvas.width, canvas.height);

      const photoDataUrl = canvas.toDataURL('image/jpeg');
      setPhoto(photoDataUrl);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
  };

  return (
    <div className="camera-container">
      {error && <div className="error-message">{error}</div>}
      
      {!photo ? (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="camera-view"
          />
          <button onClick={takePhoto} className="capture-button">
            Take Photo
          </button>
        </>
      ) : (
        <>
          <img src={photo} alt="Captured" className="photo-preview" />
          <div className="photo-actions">
            <button onClick={clearPhoto} className="action-button">
              Retake
            </button>
            <button onClick={() => alert('Photo saved!')} className="action-button">
              Save
            </button>
          </div>
        </>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default Camera;