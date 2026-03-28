import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";

type PromoReelPlayerProps = {
  open: boolean;
  onClose: () => void;
};

type PromoScene = {
  id: string;
  title: string;
  subtitle: string;
  voice: string;
  duration: number;
  accent: [string, string];
};

type PlayerWindowSize = {
  width: number;
  height: number;
};

const PLAYER_ASPECT_RATIO = 16 / 9;
const PLAYER_MAX_WIDTH = 960;
const PLAYER_MAX_HEIGHT_RATIO = 0.82;
const PLAYER_MAX_WIDTH_RATIO = 0.88;

const PROMO_SCENES: PromoScene[] = [
  {
    id: "intro",
    title: "Smeta.Core",
    subtitle: "Предварительный бюджет по системам безопасности за 5-10 минут",
    voice: "Smeta.Core собирает предварительный бюджет по системам безопасности за 5-10 минут.",
    duration: 4.6,
    accent: ["#6de2ff", "#0e79b2"],
  },
  {
    id: "object",
    title: "Объект и зоны",
    subtitle: "Площадь, этажность, защищаемая площадь, состав систем и профиль объекта",
    voice: "Пользователь задает объект, зоны, этажность и состав инженерных систем.",
    duration: 5.2,
    accent: ["#7fffd4", "#0d8f6d"],
  },
  {
    id: "survey",
    title: "AI-обследование",
    subtitle: "Чек-листы, фотофиксация, планы эвакуации, ЗКСПС, зоны оповещения и охраны",
    voice: "AI обследование собирает фото, планы эвакуации и автоматически определяет зоны для технического решения.",
    duration: 5.4,
    accent: ["#ffd36d", "#d96b00"],
  },
  {
    id: "budget",
    title: "Движок расчета",
    subtitle: "Оборудование, материалы, СМР, ПНР, проектирование и рыночная проверка",
    voice: "Расчетный движок собирает оборудование, материалы, работы, проектирование и сверяет рынок.",
    duration: 5.2,
    accent: ["#82b1ff", "#3957ff"],
  },
  {
    id: "risk",
    title: "Risk Guard AI",
    subtitle: "Контроль недооценки, региональные коэффициенты и защитный floor",
    voice: "Отдельный контур проверяет риски недооценки и удерживает бюджет в безопасном диапазоне.",
    duration: 4.8,
    accent: ["#ff8ea1", "#db2b5b"],
  },
  {
    id: "result",
    title: "Результат",
    subtitle: "Готовый бюджет, техрешение и база для ТКП без Excel-хаоса",
    voice: "На выходе команда получает понятный бюджет, техническое решение и базу для коммерческого предложения.",
    duration: 4.8,
    accent: ["#8ef7b8", "#1fa463"],
  },
];

const TOTAL_DURATION = PROMO_SCENES.reduce((sum, scene) => sum + scene.duration, 0);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculatePromoWindowSize(viewportWidth: number, viewportHeight: number): PlayerWindowSize {
  const maxWidth = Math.min(PLAYER_MAX_WIDTH, Math.floor(viewportWidth * PLAYER_MAX_WIDTH_RATIO));
  const maxHeight = Math.floor(viewportHeight * PLAYER_MAX_HEIGHT_RATIO);
  let width = maxWidth;
  let height = Math.round(width / PLAYER_ASPECT_RATIO);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * PLAYER_ASPECT_RATIO);
  }

  return {
    width: Math.max(width, 320),
    height: Math.max(height, 180),
  };
}

function getSceneAtTime(time: number) {
  let cursor = 0;
  for (const scene of PROMO_SCENES) {
    const start = cursor;
    const end = cursor + scene.duration;
    if (time >= start && time <= end) {
      return {
        scene,
        start,
        end,
        localTime: time - start,
        progress: clamp((time - start) / scene.duration, 0, 1),
      };
    }
    cursor = end;
  }

  const last = PROMO_SCENES[PROMO_SCENES.length - 1];
  return {
    scene: last,
    start: TOTAL_DURATION - last.duration,
    end: TOTAL_DURATION,
    localTime: last.duration,
    progress: 1,
  };
}

function formatTime(value: number) {
  const safe = Math.max(Math.floor(value), 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, accent: [string, string], pulse: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#07111c");
  gradient.addColorStop(0.5, "#0f1e32");
  gradient.addColorStop(1, "#081421");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const radial = ctx.createRadialGradient(width * 0.78, height * 0.22, 10, width * 0.78, height * 0.22, width * 0.45);
  radial.addColorStop(0, `${accent[0]}90`);
  radial.addColorStop(1, "transparent");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = `${accent[1]}55`;
  ctx.beginPath();
  ctx.arc(width * 0.15, height * 0.18, 42 + pulse * 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawStatsCard(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, title: string, value: string) {
  roundedRect(ctx, x, y, width, height, 18);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.fillStyle = "#9fc0db";
  ctx.font = "600 15px Manrope, sans-serif";
  ctx.fillText(title, x + 18, y + 28);

  ctx.fillStyle = "#f4fbff";
  ctx.font = "800 28px Manrope, sans-serif";
  ctx.fillText(value, x + 18, y + 66);
}

function drawBars(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, values: number[], colors: string[], labels: string[], progress: number) {
  values.forEach((value, index) => {
    const barHeight = 14;
    const rowY = y + index * 34;
    roundedRect(ctx, x, rowY, width, barHeight, 8);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    roundedRect(ctx, x, rowY, width * clamp(value * progress, 0, 1), barHeight, 8);
    ctx.fillStyle = colors[index];
    ctx.fill();
    ctx.fillStyle = "#d7e8fb";
    ctx.font = "600 14px Manrope, sans-serif";
    ctx.fillText(labels[index], x, rowY - 8);
  });
}

function renderScene(ctx: CanvasRenderingContext2D, width: number, height: number, currentTime: number) {
  const { scene, progress } = getSceneAtTime(currentTime);
  const pulse = Math.sin(currentTime * 2.2) * 0.5 + 0.5;

  drawBackdrop(ctx, width, height, scene.accent, pulse);

  ctx.fillStyle = "rgba(4,12,20,0.62)";
  roundedRect(ctx, width * 0.06, height * 0.08, width * 0.88, height * 0.84, 30);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.fillStyle = "#9fdfff";
  ctx.font = "700 16px Manrope, sans-serif";
  ctx.fillText("Smeta.Core Promo Reel", width * 0.1, height * 0.16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 44px Manrope, sans-serif";
  ctx.fillText(scene.title, width * 0.1, height * 0.27);

  ctx.fillStyle = "#d8e8f8";
  ctx.font = "600 22px Manrope, sans-serif";
  const subtitleLines = scene.subtitle.match(/.{1,44}(\s|$)/g) || [scene.subtitle];
  subtitleLines.slice(0, 2).forEach((line, index) => {
    ctx.fillText(line.trim(), width * 0.1, height * (0.35 + index * 0.06));
  });

  if (scene.id === "object") {
    drawStatsCard(ctx, width * 0.1, height * 0.48, width * 0.22, height * 0.18, "Площадь", "15 000 м²");
    drawStatsCard(ctx, width * 0.35, height * 0.48, width * 0.22, height * 0.18, "Этажность", "5 этажей");
    drawStatsCard(ctx, width * 0.6, height * 0.48, width * 0.22, height * 0.18, "Систем", "6");
  } else if (scene.id === "survey") {
    drawBars(
      ctx,
      width * 0.1,
      height * 0.52,
      width * 0.46,
      [0.92, 0.84, 0.76],
      ["#6de2ff", "#ffd36d", "#8ef7b8"],
      ["Планы эвакуации", "Фото поверхностей", "Чек-листы зон"],
      progress
    );
    drawStatsCard(ctx, width * 0.64, height * 0.48, width * 0.2, height * 0.18, "ЗКСПС", "9");
  } else if (scene.id === "budget") {
    drawBars(
      ctx,
      width * 0.1,
      height * 0.5,
      width * 0.58,
      [0.82, 0.68, 0.56, 0.34],
      ["#6de2ff", "#7fffd4", "#ffd36d", "#ff8ea1"],
      ["Оборудование", "Материалы", "Работы", "Проектирование"],
      progress
    );
    drawStatsCard(ctx, width * 0.72, height * 0.48, width * 0.15, height * 0.18, "Итого", "15,6 млн");
  } else if (scene.id === "risk") {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(width * 0.18, height * 0.72);
    ctx.lineTo(width * 0.18, height * 0.48);
    ctx.lineTo(width * 0.3, height * 0.38);
    ctx.lineTo(width * 0.42, height * 0.48);
    ctx.lineTo(width * 0.42, height * 0.72);
    ctx.lineTo(width * 0.3, height * 0.82);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `${scene.accent[0]}55`;
    ctx.fill();
    drawStatsCard(ctx, width * 0.52, height * 0.48, width * 0.16, height * 0.18, "Risk AI", "12%");
    drawStatsCard(ctx, width * 0.7, height * 0.48, width * 0.16, height * 0.18, "Floor", "включен");
  } else if (scene.id === "result") {
    drawStatsCard(ctx, width * 0.1, height * 0.5, width * 0.24, height * 0.18, "ТКП", "готово");
    drawStatsCard(ctx, width * 0.38, height * 0.5, width * 0.24, height * 0.18, "AI-решение", "уточнено");
    drawStatsCard(ctx, width * 0.66, height * 0.5, width * 0.18, height * 0.18, "Срок", "минуты");
  } else {
    drawBars(
      ctx,
      width * 0.1,
      height * 0.54,
      width * 0.54,
      [0.9, 0.74, 0.64],
      ["#6de2ff", "#82b1ff", "#8ef7b8"],
      ["Пресейл", "Бюджет", "Защита рисков"],
      progress
    );
  }

  const progressBarY = height * 0.88;
  roundedRect(ctx, width * 0.1, progressBarY, width * 0.8, 10, 8);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  roundedRect(ctx, width * 0.1, progressBarY, width * 0.8 * clamp(currentTime / TOTAL_DURATION, 0, 1), 10, 8);
  ctx.fillStyle = scene.accent[0];
  ctx.fill();
}

function stopSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

function speakScene(scene: PromoScene, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(scene.voice);
  utterance.lang = "ru-RU";
  utterance.rate = 1.02;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;
  window.speechSynthesis.speak(utterance);
}

function playAccentTone(audioContext: AudioContext, frequency: number, when: number, duration: number, volume: number) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.04);
}

function startMusicLoop(audioContext: AudioContext) {
  const notes = [220, 261.63, 329.63, 293.66, 392, 329.63, 261.63, 246.94];
  let step = 0;
  const interval = window.setInterval(() => {
    const now = audioContext.currentTime + 0.02;
    playAccentTone(audioContext, notes[step % notes.length], now, 0.34, 0.03);
    playAccentTone(audioContext, notes[(step + 2) % notes.length] / 2, now, 0.42, 0.018);
    step += 1;
  }, 420);
  return () => window.clearInterval(interval);
}

export function PromoReelPlayer({ open, onClose }: PromoReelPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const lastSceneIdRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopMusicRef = useRef<null | (() => void)>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<PlayerWindowSize>(() =>
    typeof window === "undefined" ? { width: 1280, height: 800 } : { width: window.innerWidth, height: window.innerHeight }
  );

  const sceneInfo = useMemo(() => getSceneAtTime(currentTime), [currentTime]);
  const baseWindowSize = useMemo(
    () => calculatePromoWindowSize(viewportBounds.width, viewportBounds.height),
    [viewportBounds.height, viewportBounds.width]
  );
  const playerSize = useMemo(
    () =>
      isFullscreen
        ? {
            width: Math.max(viewportBounds.width, 320),
            height: Math.max(viewportBounds.height - 116, 180),
          }
        : baseWindowSize,
    [baseWindowSize, isFullscreen, viewportBounds.height, viewportBounds.width]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setViewportBounds({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    canvas.width = Math.round(playerSize.width * pixelRatio);
    canvas.height = Math.round(playerSize.height * pixelRatio);
    canvas.style.width = `${playerSize.width}px`;
    canvas.style.height = `${playerSize.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    renderScene(ctx, playerSize.width, playerSize.height, currentTime);
  }, [playerSize.height, playerSize.width, currentTime]);

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      timeRef.current = 0;
      setCurrentTime(0);
      lastTickRef.current = null;
      lastSceneIdRef.current = "";
      stopSpeech();
      if (stopMusicRef.current) {
        stopMusicRef.current();
        stopMusicRef.current = null;
      }
      return;
    }

    const tick = (now: number) => {
      if (!playing) return;
      if (lastTickRef.current == null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      timeRef.current = Math.min(timeRef.current + delta, TOTAL_DURATION);
      setCurrentTime(timeRef.current);

      const activeScene = getSceneAtTime(timeRef.current).scene;
      if (activeScene.id !== lastSceneIdRef.current) {
        lastSceneIdRef.current = activeScene.id;
        if (audioContextRef.current && !muted) {
          playAccentTone(audioContextRef.current, 480, audioContextRef.current.currentTime + 0.01, 0.18, 0.06);
        }
        speakScene(activeScene, !muted);
      }

      if (timeRef.current >= TOTAL_DURATION) {
        setPlaying(false);
        return;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    if (playing) {
      frameRef.current = window.requestAnimationFrame(tick);
    }

    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [open, playing, muted]);

  useEffect(() => {
    if (!open || muted) {
      stopSpeech();
      if (stopMusicRef.current) {
        stopMusicRef.current();
        stopMusicRef.current = null;
      }
      return;
    }

    if (!audioContextRef.current && typeof window !== "undefined" && "AudioContext" in window) {
      audioContextRef.current = new window.AudioContext();
    }

    if (playing && audioContextRef.current && !stopMusicRef.current) {
      stopMusicRef.current = startMusicLoop(audioContextRef.current);
    }

    return undefined;
  }, [open, playing, muted]);

  useEffect(() => () => {
    stopSpeech();
    if (stopMusicRef.current) stopMusicRef.current();
    audioContextRef.current?.close().catch(() => undefined);
  }, []);

  const handlePlayPause = async () => {
    if (!open) return;
    if (!audioContextRef.current && typeof window !== "undefined" && "AudioContext" in window) {
      audioContextRef.current = new window.AudioContext();
    }
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (currentTime >= TOTAL_DURATION) {
      timeRef.current = 0;
      setCurrentTime(0);
    }

    if (!playing) {
      speakScene(sceneInfo.scene, !muted);
    } else {
      stopSpeech();
      if (stopMusicRef.current) {
        stopMusicRef.current();
        stopMusicRef.current = null;
      }
    }

    lastTickRef.current = null;
    setPlaying((value) => !value);
  };

  const handleRestart = () => {
    timeRef.current = 0;
    setCurrentTime(0);
    lastTickRef.current = null;
    lastSceneIdRef.current = "";
    if (playing) {
      speakScene(PROMO_SCENES[0], !muted);
    }
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    timeRef.current = next;
    setCurrentTime(next);
    lastTickRef.current = null;
    lastSceneIdRef.current = "";
  };

  const handleFullscreen = async () => {
    if (!containerRef.current || typeof document === "undefined") return;
    if (document.fullscreenElement === containerRef.current) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    await containerRef.current.requestFullscreen?.().catch(() => undefined);
  };

  if (!open) return null;

  return (
    <div className="promo-reel" role="dialog" aria-modal="true" aria-label="Видео о возможностях системы">
      <div className="promo-reel__backdrop" onClick={onClose} />
      <div
        className={`promo-reel__window ${isFullscreen ? "is-fullscreen" : ""}`}
        ref={containerRef}
        style={
          {
            "--promo-width": `${playerSize.width}px`,
            "--promo-height": `${playerSize.height}px`,
          } as CSSProperties
        }
      >
        <div className="promo-reel__frame">
          <canvas ref={canvasRef} aria-hidden="true" />
          <div className="promo-reel__hud">
            <div className="promo-reel__eyebrow">Видео-обзор платформы</div>
            <button className="promo-reel__close" type="button" onClick={onClose} aria-label="Закрыть ролик">
              ×
            </button>
          </div>
          <div className="promo-reel__caption">
            <strong>{sceneInfo.scene.title}</strong>
            <span>{sceneInfo.scene.subtitle}</span>
          </div>
        </div>

        <div className="promo-reel__controls">
          <div className="promo-reel__buttons">
            <button type="button" className="btn btn--primary" onClick={handlePlayPause}>
              {playing ? "Пауза" : "Старт ролика"}
            </button>
            <button type="button" className="btn btn--ghost-light" onClick={handleRestart}>
              Сначала
            </button>
            <button type="button" className="btn btn--ghost-light" onClick={() => setMuted((value) => !value)}>
              {muted ? "Звук выкл." : "Звук вкл."}
            </button>
            <button type="button" className="btn btn--ghost-light" onClick={handleFullscreen}>
              {isFullscreen ? "Свернуть" : "Полный экран"}
            </button>
          </div>

          <div className="promo-reel__timeline">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={TOTAL_DURATION}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Позиция ролика"
            />
            <span>{formatTime(TOTAL_DURATION)}</span>
          </div>

          <div className="promo-reel__meta">
            <span>Базовое окно: {baseWindowSize.width} × {baseWindowSize.height}</span>
            <span>Формат: 16:9</span>
            <span>Движок: Canvas + WebAudio + Fullscreen API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
