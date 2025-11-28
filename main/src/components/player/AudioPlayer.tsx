"use client"
import React, { useEffect, useRef } from 'react';

interface AudioPlayerProps {
  src: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5; // Adjust volume as needed
      audioRef.current.play().catch(error => console.error("Error playing audio:", error));
    }
  }, [src]);

  return (
    <audio ref={audioRef} src={src} loop autoPlay playsInline />
  );
};

export default AudioPlayer;
