import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { Maximize2, Minimize2, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";

type PromoReelPlayerProps = {
  open: boolean;
  onClose: () => void;
};

type PromoScene = {
  id: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  body: string;
  bullets: string[];
  voice: string;
  duration: number;
  accent: [string, string];
  mediaType: "video" | "image";
  mediaPath: string;
};

const ASSET_BASE = import.meta.env.BASE_URL || "/";

function assetUrl(path: string) {
  const normalizedBase = ASSET_BASE.endsWith("/") ? ASSET_BASE : `${ASSET_BASE}/`;
  return `${normalizedBase}${String(path).replace(/^\/+/, "")}`;
}

const PROMO_SCENES: PromoScene[] = [
  {
    id: "purpose",
    eyebrow: "Стратегическая цель",
    title: "Зачем создана платформа",
    subtitle: "Project.Core убирает Excel-хаос и превращает подготовку бюджета систем безопасности в управляемый цифровой процесс.",
    body:
      "Платформа нужна для того, чтобы за считанные минуты собрать структуру объекта, понять инженерный контекст, проверить рынок и получить аргументированный предварительный бюджет без ручного свода десятков таблиц.",
    bullets: [
      "Сокращает время подготовки бюджета и ТКП.",
      "Снижает риск недооценки оборудования и работ.",
      "Дает единый контур для пресейла, проектирования и защиты бюджета.",
    ],
    voice:
      "Project Core создан для того, чтобы заменить хаотичный ручной расчет по таблицам управляемым цифровым процессом и быстро готовить аргументированный бюджет систем безопасности.",
    duration: 7,
    accent: ["#84d4ff", "#1b6dc9"],
    mediaType: "video",
    mediaPath: "assets/background/manhattan-loop-2min.mp4",
  },
  {
    id: "audience",
    eyebrow: "Для кого",
    title: "Кому платформа дает эффект",
    subtitle: "Интеграторам, пресейлу, проектировщикам, техдиректорам, сметчикам и заказчикам, которым нужен прозрачный бюджет и внятная логика цифр.",
    body:
      "Модуль помогает быстро сравнивать сценарии оснащения объекта, готовить коммерческое предложение, валидировать проектную спецификацию и заранее видеть точки, где возможны удорожание или сдвиг сроков.",
    bullets: [
      "Пресейл и продажи: быстрее готовят ТКП.",
      "Проектные команды: раньше видят узкие места.",
      "Финансовый контур: понимает, откуда взялась каждая сумма.",
    ],
    voice:
      "Платформа рассчитана на интеграторов, проектные команды, технических директоров, сметчиков и заказчиков, которым нужен прозрачный бюджет и понятная логика его формирования.",
    duration: 7,
    accent: ["#8ff7d3", "#118a67"],
    mediaType: "image",
    mediaPath: "assets/background/development-lab.jpg",
  },
  {
    id: "survey",
    eyebrow: "AI-обследование",
    title: "Как система собирает инженерный контекст",
    subtitle: "Адаптивные чек-листы, фотофиксация помещений и коридоров, анализ маршрутов прокладки кабеля и учет ограничений монтажа.",
    body:
      "Платформа спрашивает не только про объект, но и про реальные условия работ. Она анализирует коридоры, уточняет наличие лотков, фальш-полов, запотолочного пространства и использует эти данные в техрешении, спецификации, СМР и сроках.",
    bullets: [
      "Определяет вероятный способ трассировки кабельных линий.",
      "Учитывает доступы, отделку, высоты и сложность монтажа.",
      "Собирает данные для более точного техрешения и плана работ.",
    ],
    voice:
      "AI обследование собирает реальные условия монтажа: фотографии помещений и коридоров, ответы по лоткам, фальш-полам и запотолочному пространству, после чего уточняет техническое решение, стоимость и сроки.",
    duration: 8,
    accent: ["#ffd27d", "#d96b00"],
    mediaType: "image",
    mediaPath: "assets/object-types/warehouse.jpg",
  },
  {
    id: "algorithms",
    eyebrow: "Уникальные алгоритмы",
    title: "Что делает платформу сильной",
    subtitle: "Параметрический расчет, AI-аудит рынка, Risk Guard AI, PDF-распознавание спецификаций и полная рассчитываемая спецификация по каждой системе.",
    body:
      "Внутри Project.Core работает не одна формула, а набор связанных алгоритмов: от классификации объекта и расчета объемов до выбора ценовых источников, проверки трудозатрат и формирования детальной спецификации оборудования и материалов.",
    bullets: [
      "AI-аудит цен по поставщикам и сайтам производителей.",
      "Risk Guard AI для защиты от недооценки.",
      "Импорт APS PDF и автоматическое определение вендора по проекту.",
    ],
    voice:
      "Платформа объединяет несколько уникальных алгоритмов: расчет инженерных объемов, AI аудит рынка, защиту от недооценки, распознавание проектных спецификаций и автоматическое формирование полной спецификации по системе.",
    duration: 8,
    accent: ["#9bb4ff", "#4357ff"],
    mediaType: "image",
    mediaPath: "assets/metrics/risk-guard.jpg",
  },
  {
    id: "planning",
    eyebrow: "AI-планирование",
    title: "От бюджета к плану проекта",
    subtitle: "Платформа теперь строит и детальный план реализации: мероприятия, фазы, сроки и оговорки по допущениям.",
    body:
      "По одной кнопке система выпускает план проекта в PowerPoint или MS Project XML. Верхнеуровневые сроки синхронизированы с ТКП, а каждая фаза декомпозируется на понятные мероприятия: обследование, техрешение, закупку, поставку, монтаж, ПНР и сдачу материалов.",
    bullets: [
      "График совпадает по фазам с экспортом ТКП.",
      "Есть оговорка о предварительном характере сроков.",
      "Подходит для согласования и дальнейшей календарной проработки.",
    ],
    voice:
      "После расчета платформа может сразу выпустить детальный план проекта в формате PowerPoint или MS Project, синхронизированный по фазам со сроками, указанными в коммерческой презентации.",
    duration: 7.5,
    accent: ["#ff9ec1", "#b83280"],
    mediaType: "image",
    mediaPath: "assets/metrics/time-window.jpg",
  },
  {
    id: "result",
    eyebrow: "Что получает пользователь",
    title: "Результат на выходе",
    subtitle: "Не просто цифру, а полный пакет для принятия решения: бюджет, техрешение, спецификацию, риски, сравнение цен и план проекта.",
    body:
      "На выходе команда получает готовую основу для коммерческого предложения и внутренней защиты проекта: расчет по системам, объяснимую структуру затрат, полную спецификацию, выявленные риски, сравнительный анализ по вендорам и детальный проектный план.",
    bullets: [
      "Бюджет и ТКП с объяснимой логикой.",
      "Полная спецификация и выгрузки.",
      "AI-риски проекта и план реализации.",
    ],
    voice:
      "На выходе пользователь получает не просто предварительную сумму, а готовую основу для коммерческого предложения: бюджет, техническое решение, полную спецификацию, проектные риски и детальный план реализации.",
    duration: 7,
    accent: ["#94f7bd", "#1f9b63"],
    mediaType: "video",
    mediaPath: "assets/background/city-loop.mp4",
  },
];

const TOTAL_DURATION = PROMO_SCENES.reduce((sum, scene) => sum + scene.duration, 0);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(value: number) {
  const safe = Math.max(Math.floor(value), 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
    progress: 1,
  };
}

function choosePreferredMaleVoice(voices: SpeechSynthesisVoice[]) {
  const lowerPriority = [
    "male",
    "man",
    "dmitry",
    "alek",
    "alex",
    "pavel",
    "yuri",
    "maxim",
    "nikolay",
    "ru-ru",
    "russian",
  ];

  const russianVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("ru"));
  const preferred = russianVoices.find((voice) => {
    const descriptor = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    return lowerPriority.some((token) => descriptor.includes(token));
  });

  return preferred || russianVoices[0] || voices[0] || null;
}

function stopSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

function speakScene(scene: PromoScene, enabled: boolean, voice: SpeechSynthesisVoice | null) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(scene.voice);
  utterance.lang = "ru-RU";
  utterance.rate = 0.96;
  utterance.pitch = 0.88;
  utterance.volume = 0.9;
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function playAmbientTone(audioContext: AudioContext, frequency: number, when: number, duration: number, volume: number) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, when);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.08);
  gain.gain.exponentialRampToValueAtTime(volume * 0.65, when + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.06);
}

function startMusicLoop(audioContext: AudioContext) {
  const progression = [
    [220, 329.63, 440],
    [246.94, 369.99, 493.88],
    [196, 293.66, 392],
    [174.61, 261.63, 349.23],
  ];
  let step = 0;
  const interval = window.setInterval(() => {
    const now = audioContext.currentTime + 0.02;
    const chord = progression[step % progression.length];
    chord.forEach((freq, index) => {
      playAmbientTone(audioContext, freq, now + index * 0.02, 2.8, index === 0 ? 0.028 : 0.018);
    });
    step += 1;
  }, 2200);
  return () => window.clearInterval(interval);
}

export function PromoReelPlayer({ open, onClose }: PromoReelPlayerProps) {
  const frameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const lastSceneIdRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopMusicRef = useRef<null | (() => void)>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const sceneInfo = useMemo(() => getSceneAtTime(currentTime), [currentTime]);
  const selectedVoice = useMemo(() => choosePreferredMaleVoice(voices), [voices]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;

    const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", updateVoices);

    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", updateVoices);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      setCurrentTime(0);
      timeRef.current = 0;
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
        speakScene(activeScene, !muted, selectedVoice);
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
  }, [open, playing, muted, selectedVoice]);

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

  useEffect(
    () => () => {
      stopSpeech();
      if (stopMusicRef.current) stopMusicRef.current();
      audioContextRef.current?.close().catch(() => undefined);
    },
    []
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || sceneInfo.scene.mediaType !== "video") return;
    video.currentTime = sceneInfo.progress * Math.max(video.duration || sceneInfo.scene.duration, 0);
  }, [sceneInfo]);

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
      speakScene(sceneInfo.scene, !muted, selectedVoice);
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
      speakScene(PROMO_SCENES[0], !muted, selectedVoice);
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

  const currentScene = sceneInfo.scene;
  const mediaUrl = assetUrl(currentScene.mediaPath);

  return (
    <div className="promo-reel" role="dialog" aria-modal="true" aria-label="Видео о возможностях платформы">
      <div className="promo-reel__backdrop" onClick={onClose} />
      <div className={`promo-reel__window ${isFullscreen ? "is-fullscreen" : ""}`} ref={containerRef}>
        <div className="promo-reel__frame">
          <div className="promo-reel__media">
            {currentScene.mediaType === "video" ? (
              <video ref={videoRef} key={currentScene.id} src={mediaUrl} muted playsInline preload="auto" />
            ) : (
              <div className="promo-reel__image" key={currentScene.id} style={{ backgroundImage: `url(${mediaUrl})` }} />
            )}
            <div
              className="promo-reel__media-overlay"
              style={
                {
                  "--promo-accent-start": currentScene.accent[0],
                  "--promo-accent-end": currentScene.accent[1],
                } as CSSProperties
              }
            />
          </div>

          <div className="promo-reel__hud">
            <div className="promo-reel__eyebrow">Обзор платформы Project.Core</div>
            <button className="promo-reel__close" type="button" onClick={onClose} aria-label="Закрыть ролик">
              <X size={20} />
            </button>
          </div>

          <div className="promo-reel__content">
            <div className="promo-reel__chapter">{currentScene.eyebrow}</div>
            <h3>{currentScene.title}</h3>
            <p className="promo-reel__subtitle">{currentScene.subtitle}</p>
            <p className="promo-reel__body">{currentScene.body}</p>
            <ul className="promo-reel__bullets">
              {currentScene.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="promo-reel__caption">
            <strong>{currentScene.title}</strong>
            <span>{currentScene.subtitle}</span>
          </div>
        </div>

        <div className="promo-reel__controls">
          <div className="promo-reel__buttons">
            <button type="button" className="btn btn--primary" onClick={handlePlayPause}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? "Пауза" : "Старт ролика"}
            </button>
            <button type="button" className="btn btn--ghost-light" onClick={handleRestart}>
              <RotateCcw size={16} /> Сначала
            </button>
            <button type="button" className="btn btn--ghost-light" onClick={() => setMuted((value) => !value)}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {muted ? "Звук выкл." : "Звук вкл."}
            </button>
            <button type="button" className="btn btn--ghost-light" onClick={handleFullscreen}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {isFullscreen ? "Свернуть" : "Полный экран"}
            </button>
          </div>

          <div className="promo-reel__timeline">
            <span>{formatTime(currentTime)}</span>
            <input type="range" min={0} max={TOTAL_DURATION} step={0.1} value={currentTime} onChange={handleSeek} aria-label="Позиция ролика" />
            <span>{formatTime(TOTAL_DURATION)}</span>
          </div>

          <div className="promo-reel__chapters">
            {PROMO_SCENES.map((scene) => (
              <button
                key={scene.id}
                type="button"
                className={`promo-reel__chapter-chip ${scene.id === currentScene.id ? "is-active" : ""}`}
                onClick={() => {
                  const start = PROMO_SCENES.slice(0, PROMO_SCENES.findIndex((item) => item.id === scene.id)).reduce((sum, item) => sum + item.duration, 0);
                  timeRef.current = start;
                  setCurrentTime(start);
                  lastTickRef.current = null;
                  lastSceneIdRef.current = "";
                }}
              >
                {scene.eyebrow}
              </button>
            ))}
          </div>

          <div className="promo-reel__meta">
            <span>Формат: 16:9</span>
            <span>Озвучка: приятный мужской голос браузера, если доступен</span>
            <span>Подложка: мягкий ambient score</span>
          </div>
        </div>
      </div>
    </div>
  );
}
