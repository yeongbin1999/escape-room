"use client"
import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  onEnded: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, onEnded }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => console.error("Error playing video:", error));
    }
  }, [src]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={src}
        onEnded={onEnded}
        className="max-w-full max-h-full object-contain"
        autoPlay
        playsInline
      />
    </div>
  );
};

export default VideoPlayer;
