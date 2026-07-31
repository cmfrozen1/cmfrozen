import { FC, useEffect, useRef, useState } from 'react';

const VideoBackground: FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId: number;

    const updateVideoStatus = () => {
      if (!video.duration) {
        rafId = requestAnimationFrame(updateVideoStatus);
        return;
      }

      const currentTime = video.currentTime;
      const duration = video.duration;
      const fadeTime = 0.5;

      let newOpacity = 1;

      // Fade in at the start
      if (currentTime < fadeTime) {
        newOpacity = currentTime / fadeTime;
      } 
      // Fade out at the end
      else if (currentTime > duration - fadeTime) {
        newOpacity = (duration - currentTime) / fadeTime;
      }

      setOpacity(Math.max(0, Math.min(1, newOpacity)));

      rafId = requestAnimationFrame(updateVideoStatus);
    };

    const handleEnded = () => {
      setOpacity(0);
      setTimeout(() => {
        if (video) {
          video.currentTime = 0;
          video.play().catch(err => console.error("Video play failed:", err));
        }
      }, 100);
    };

    video.addEventListener('ended', handleEnded);
    rafId = requestAnimationFrame(updateVideoStatus);

    return () => {
      video.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="absolute z-0 w-full"
      style={{ 
        top: '300px', 
        bottom: 0, 
        left: 0, 
        right: 0,
        overflow: 'hidden'
      }}
    >
      <video
        ref={videoRef}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4"
        className="w-full h-full object-cover transition-opacity duration-100"
        style={{ opacity }}
        muted
        autoPlay
        playsInline
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white pointer-events-none" />
    </div>
  );
};

export default VideoBackground;
