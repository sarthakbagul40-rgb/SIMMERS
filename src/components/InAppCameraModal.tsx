import React, { useEffect, useRef, useState } from 'react';

interface InAppCameraModalProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export const InAppCameraModal: React.FC<InAppCameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch (err: any) {
        console.warn('[InAppCameraModal] getUserMedia failed:', err);
        setErrorMsg('Camera access unavailable. Please choose a photo from your gallery instead.');
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 800;
    const height = video.videoHeight || 800;

    const canvas = document.createElement('canvas');
    const maxDim = 1200;
    let targetWidth = width;
    let targetHeight = height;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        targetWidth = maxDim;
        targetHeight = Math.round((height * maxDim) / width);
      } else {
        targetHeight = maxDim;
        targetWidth = Math.round((width * maxDim) / height);
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      const base64 = canvas.toDataURL('image/jpeg', 0.92);

      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      onCapture(base64);
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack && typeof (videoTrack as any).applyConstraints === 'function') {
      try {
        const nextTorch = !torchOn;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setTorchOn(nextTorch);
      } catch (e) {
        console.warn('Torch constraint not supported:', e);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: 4000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 16px',
        boxSizing: 'border-box'
      }}
    >
      {/* Header bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#ffffff',
          zIndex: 10
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#ffffff',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '18px',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>

        <div style={{ fontWeight: '800', fontSize: '15px' }}>📷 In-App Packet Scanner</div>

        <button
          onClick={toggleTorch}
          style={{
            background: torchOn ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255,255,255,0.2)',
            border: torchOn ? '2px solid #eab308' : 'none',
            color: '#ffffff',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '18px',
            cursor: 'pointer'
          }}
        >
          ⚡
        </button>
      </div>

      {/* Video Viewfinder with Reticle Overlay */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: '65vh',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '24px',
          margin: '16px 0',
          background: '#090d16'
        }}
      >
        {errorMsg ? (
          <div style={{ textAlign: 'center', color: '#f8fafc', padding: '20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📷❌</div>
            <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '8px' }}>{errorMsg}</div>
            <button
              className="btn-stitch-secondary"
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              Close & Upload Photo
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />

            {/* Target Reticle Overlay */}
            <div
              style={{
                position: 'absolute',
                width: '75%',
                height: '55%',
                border: '3px solid rgba(59, 130, 246, 0.85)',
                borderRadius: '20px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  color: '#ffffff',
                  backgroundColor: 'rgba(59, 130, 246, 0.85)',
                  padding: '4px 12px',
                  borderRadius: '999px'
                }}
              >
                Position Expiry Date Inside Frame
              </div>
            </div>
          </>
        )}
      </div>

      {/* Capture Control Button */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingBottom: '10px' }}>
        <button
          onClick={handleSnap}
          disabled={!isReady || !!errorMsg}
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            border: '4px solid #ffffff',
            boxShadow: '0 0 25px rgba(59, 130, 246, 0.6)',
            cursor: isReady ? 'pointer' : 'not-allowed',
            opacity: isReady ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            color: '#ffffff'
          }}
        >
          📸
        </button>
      </div>
    </div>
  );
};
