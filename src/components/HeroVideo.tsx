import { useMemo, useState } from "react";
import {
  LEGACY_VIDEO_POSTER,
  LEGACY_VIDEO_SOURCES,
  MANHATTAN_VIDEO_POSTER,
  MANHATTAN_VIDEO_SOURCES,
} from "../config/videoConfig";

type HeroVideoProps = {
  variant?: "legacy" | "manhattan";
  mode?: "fill" | "block";
};

export function HeroVideo({ variant = "legacy", mode = "fill" }: HeroVideoProps) {
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const sources = variant === "manhattan" ? MANHATTAN_VIDEO_SOURCES : LEGACY_VIDEO_SOURCES;
  const poster = variant === "manhattan" ? MANHATTAN_VIDEO_POSTER : LEGACY_VIDEO_POSTER;

  const currentVideo = useMemo(() => sources[Math.min(videoIndex, sources.length - 1)], [sources, videoIndex]);

  return (
    <div className={`hero-video ${mode === "block" ? "hero-video--block" : ""}`} aria-hidden="true">
      {!videoUnavailable ? (
        <video
          key={currentVideo}
          className="hero-video__media"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          onError={() => {
            if (videoIndex < sources.length - 1) {
              setVideoIndex((prev) => prev + 1);
            } else {
              setVideoUnavailable(true);
            }
          }}
        >
          <source src={currentVideo} type="video/mp4" />
        </video>
      ) : (
        <div className="hero-video__fallback" />
      )}
      <div className="hero-video__overlay" />
    </div>
  );
}
