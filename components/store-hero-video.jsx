'use client';
import { useEffect, useRef, useState } from 'react';

export function StoreHeroVideo() {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const manuallyPaused = useRef(false);
  useEffect(() => {
    const video = videoRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const pause = () => {
      if (reduced.matches || document.hidden) video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
      else if (!reduced.matches && !manuallyPaused.current && !document.hidden)
        void video.play().catch(() => {});
    });
    const onUserPause = () => {
      manuallyPaused.current = true;
    };
    video.addEventListener('user-pause', onUserPause);
    reduced.addEventListener('change', pause);
    document.addEventListener('visibilitychange', pause);
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
      video.removeEventListener('user-pause', onUserPause);
      reduced.removeEventListener('change', pause);
      document.removeEventListener('visibilitychange', pause);
    };
  }, []);
  return (
    <>
      <video
        ref={videoRef}
        className="store-hero-video"
        muted
        loop
        playsInline
        preload="none"
        poster="/media/fraguan-portada.jpg"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setPlaying(false)}
      >
        <source
          src="/media/fraguan-portada-movil.mp4"
          type="video/mp4"
          media="(max-width: 700px)"
        />
        <source src="/media/fraguan-portada.mp4" type="video/mp4" />
      </video>
      <div className="store-hero-shade" aria-hidden="true" />
      {
        <button
          type="button"
          className="store-hero-play"
          aria-label={
            playing ? 'Pausar video de portada' : 'Reproducir video de portada'
          }
          onClick={() => {
            const video = videoRef.current;
            if (playing) {
              video.dispatchEvent(new Event('user-pause'));
              video.pause();
            } else {
              manuallyPaused.current = false;
              void video.play().catch(() => setPlaying(false));
            }
          }}
        >
          {playing ? 'Pausar video' : 'Reproducir video'}
        </button>
      }
    </>
  );
}
