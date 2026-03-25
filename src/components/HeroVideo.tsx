import { siteConfig } from '../data/siteContent';

export function HeroVideo() {
  return (
    <div className="hero-video" aria-hidden="true">
      <video
        className="hero-video__media"
        autoPlay
        muted
        loop
        playsInline
        poster={siteConfig.videoPoster}
      >
        <source src={siteConfig.videoSource} type="video/mp4" />
      </video>
      <div className="hero-video__overlay" />
    </div>
  );
}
