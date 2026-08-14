import React, { useState, useRef, useEffect } from 'react';

interface ZoomableImageModalProps {
  src: string;
  isScanning?: boolean;
}

export const ZoomableImageModal: React.FC<ZoomableImageModalProps> = ({ src, isScanning }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Drag Support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Prevent scroll when dragging inside fullscreen
  useEffect(() => {
    const handleGlobalUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, []);

  return (
    <div className="zoomable-preview-wrapper">
      {/* Interactive Control Toolbar */}
      <div className="zoomable-toolbar">
        <div className="zoom-info">
          <span>🔍 {Math.round(scale * 100)}%</span>
        </div>
        <div className="zoom-actions">
          <button type="button" className="btn-zoom-icon" onClick={handleZoomIn} title="Zoom In">
            ➕
          </button>
          <button type="button" className="btn-zoom-icon" onClick={handleZoomOut} title="Zoom Out" disabled={scale <= 1}>
            ➖
          </button>
          <button type="button" className="btn-zoom-icon" onClick={handleResetZoom} title="Reset Zoom">
            ↺
          </button>
          <button
            type="button"
            className="btn-zoom-icon highlight"
            onClick={() => setIsFullscreen(true)}
            title="Open Fullscreen Zoom View"
          >
            ⛶ View Full
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        ref={containerRef}
        className={`scanner-preview-container ${scale > 1 ? 'is-draggable' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={src}
          alt="Packet Preview"
          className="scanner-img"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
          }}
          onClick={() => scale === 1 && setIsFullscreen(true)}
        />

        {/* Laser Scanning Beam Effect */}
        {isScanning && (
          <div className="scanner-beam-wrapper">
            <div className="scanner-beam"></div>
            <div className="scanner-overlay-text">AI Optical Reader Active...</div>
          </div>
        )}
      </div>

      <div className="zoom-hint-text">
        {scale > 1 ? '👆 Drag photo to scroll & read expiry/MRP details' : '💡 Tap photo or click "View Full" for fullscreen zoom'}
      </div>

      {/* Fullscreen Lightbox Overlay Modal */}
      {isFullscreen && (
        <div className="fullscreen-lightbox-backdrop" onClick={() => setIsFullscreen(false)}>
          <div className="fullscreen-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <div className="lightbox-title">📷 High-Res Packet Photo ({Math.round(scale * 100)}% Zoom)</div>
              <div className="lightbox-controls">
                <button type="button" className="btn-zoom-icon" onClick={handleZoomIn}>
                  ➕
                </button>
                <button type="button" className="btn-zoom-icon" onClick={handleZoomOut} disabled={scale <= 1}>
                  ➖
                </button>
                <button type="button" className="btn-zoom-icon" onClick={handleResetZoom}>
                  ↺
                </button>
                <button type="button" className="btn-lightbox-close" onClick={() => setIsFullscreen(false)}>
                  ✖ Close
                </button>
              </div>
            </div>

            <div
              className="lightbox-viewport"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={src}
                alt="Full Packet View"
                className="lightbox-img"
                style={{
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
