'use client';
import { useEffect, useRef } from 'react';

export function StoreHeroVideo() {
  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    let visible = true;
    const update = () => {
      if (visible && !document.hidden) void video.play().catch(() => {});
      else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(video);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      video.pause();
    };
  }, []);
  return (
    <>
      <video
        ref={videoRef}
        className="store-hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/fraguan-portada.jpg"
        aria-hidden="true"
        disablePictureInPicture
      >
        <source
          src="/media/fraguan-portada-movil.mp4"
          type="video/mp4"
          media="(max-width: 700px)"
        />
        <source src="/media/fraguan-portada.mp4" type="video/mp4" />
      </video>
      <div className="store-hero-shade" aria-hidden="true" />
    </>
  );
}
