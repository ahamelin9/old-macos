// React
import React, { useState, useRef, useEffect } from 'react';
//Styling
import './Camera.css';

const Camera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The live stream sits in a ref, so the cleanup always stops the current one
  // (a cleanup that read state saw the stream from the first render, null, and
  // left the webcam on after the window closed)
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  // The webcam is on while the window is open, and off once it closes
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        // Closed before the camera answered (or React's dev double-run)
        if (cancelled) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = mediaStream;
        setStreaming(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError('Could not access the camera.');
        console.error('Camera error:', err);
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Retake brings back a new <video> element, so hand the stream to it again
  useEffect(() => {
    if (streaming && !photo && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [streaming, photo]);

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

  // Download the photo as a JPEG (it used to only say "Photo saved!")
  const savePhoto = () => {
    if (!photo) return;
    const link = document.createElement('a');
    link.href = photo;
    link.download = `photo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
    link.click();
  };

  return (
    <div className="camera-container">
      {error && <div className="camera-error">{error}</div>}

      {!photo ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-view"
          />
          <button onClick={takePhoto} className="camera-capture-button" disabled={!streaming}>
            Take Photo
          </button>
        </>
      ) : (
        <>
          <img src={photo} alt="Captured" className="camera-photo-preview" />
          <div className="camera-photo-actions">
            <button onClick={clearPhoto} className="camera-action-button">
              Retake
            </button>
            <button onClick={savePhoto} className="camera-action-button">
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
