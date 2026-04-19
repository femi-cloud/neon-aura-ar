import { useEffect, useRef, useState, useCallback } from "react";
import { ControlPanel } from "@/components/aura/ControlPanel";
import { StartScreen } from "@/components/aura/StartScreen";
import { HUD } from "@/components/aura/HUD";
import { DEFAULT_SETTINGS, type AuraSettings, type HandData, type Landmark } from "@/lib/aura/types";
import { EffectsEngine } from "@/lib/aura/effects";
import { AuraAudio } from "@/lib/aura/audio";
import { centroid, detectGesture, pinchDistance } from "@/lib/aura/gestures";

// Loaded dynamically from CDN
type MPHandsResults = {
  multiHandLandmarks?: Landmark[][];
  multiHandedness?: { label: string }[];
};
type MPHands = {
  setOptions: (o: Record<string, unknown>) => void;
  onResults: (cb: (r: MPHandsResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close: () => void;
};

declare global {
  interface Window {
    Hands?: new (config: { locateFile: (f: string) => string }) => MPHands;
  }
}

const MP_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function AuraExperience() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EffectsEngine | null>(null);
  const audioRef = useRef<AuraAudio | null>(null);
  const handsRef = useRef<MPHands | null>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(performance.now());
  const fpsAccumRef = useRef<{ frames: number; t: number }>({ frames: 0, t: performance.now() });
  const handsDataRef = useRef<HandData[]>([]);
  const prevCentroidRef = useRef<Map<string, { x: number; y: number; t: number }>>(new Map());
  const settingsRef = useRef<AuraSettings>(DEFAULT_SETTINGS);
  const auraOpenActiveRef = useRef(false);
  const orbActiveRef = useRef(false);
  const lastShockwaveRef = useRef(0);
  const lastLightningRef = useRef(0);
  const prevPinchedRef = useRef<Map<string, boolean>>(new Map());
  const autoIntensityRef = useRef(1);

  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AuraSettings>(DEFAULT_SETTINGS);
  const [fps, setFps] = useState(0);
  const [activeGestures, setActiveGestures] = useState<string[]>([]);
  const [handCount, setHandCount] = useState(0);

  const updateSettings = useCallback((patch: Partial<AuraSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      settingsRef.current = next;
      if (audioRef.current) {
        audioRef.current.setVolume(next.audioMuted ? 0 : next.audioVolume);
      }
      return next;
    });
  }, []);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (engineRef.current) {
      engineRef.current.resize(window.innerWidth, window.innerHeight);
    }
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Init audio (must happen on user gesture)
      const audio = new AuraAudio();
      await audio.init();
      audio.setVolume(settingsRef.current.audioMuted ? 0 : settingsRef.current.audioVolume);
      audioRef.current = audio;

      // Load MediaPipe
      await loadScript(`${MP_BASE}hands.js`);
      if (!window.Hands) throw new Error("MediaPipe failed to load");

      // Camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // Hands
      const hands = new window.Hands({
        locateFile: (file: string) => `${MP_BASE}${file}`,
      });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
      hands.onResults(onResults);
      handsRef.current = hands;

      setStarted(true);
      setLoading(false);

      // Setup canvas
      handleResize();
      engineRef.current = new EffectsEngine(window.innerWidth, window.innerHeight);

      // Frame loop
      const loop = async () => {
        if (handsRef.current && video.readyState >= 2) {
          try {
            await handsRef.current.send({ image: video });
          } catch {
            // ignore transient errors
          }
        }
        renderFrame();
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Couldn't start: ${msg}. Please allow camera access and try again.`);
      setLoading(false);
    }
  }, [handleResize]);

  const onResults = (results: MPHandsResults) => {
    const lmList = results.multiHandLandmarks ?? [];
    const handedness = results.multiHandedness ?? [];
    const out: HandData[] = [];
    const now = performance.now();
    for (let i = 0; i < lmList.length; i++) {
      const lm = lmList[i];
      const c = centroid(lm);
      const labelRaw = handedness[i]?.label ?? (i === 0 ? "Right" : "Left");
      const label: "Left" | "Right" = labelRaw === "Left" ? "Left" : "Right";
      const key = label + i;
      const prev = prevCentroidRef.current.get(key);
      let velocity = 0;
      if (prev) {
        const dt = Math.max(1, now - prev.t);
        velocity = Math.hypot(c.x - prev.x, c.y - prev.y) / (dt / 1000);
      }
      prevCentroidRef.current.set(key, { x: c.x, y: c.y, t: now });

      out.push({
        landmarks: lm,
        handedness: label,
        gesture: detectGesture(lm),
        velocity,
        centroid: c,
        pinchDistance: pinchDistance(lm),
      });
    }
    handsDataRef.current = out;
    setHandCount(out.length);
    setActiveGestures(out.map((h) => h.gesture).filter((g) => g !== "unknown"));
  };

  const renderFrame = () => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
    lastFrameRef.current = now;

    // FPS
    fpsAccumRef.current.frames += 1;
    if (now - fpsAccumRef.current.t > 500) {
      const f = Math.round((fpsAccumRef.current.frames * 1000) / (now - fpsAccumRef.current.t));
      setFps(f);
      fpsAccumRef.current = { frames: 0, t: now };
      // Auto-reduce intensity if low FPS
      if (f < 25) autoIntensityRef.current = Math.max(0.3, autoIntensityRef.current - 0.1);
      else if (f > 45) autoIntensityRef.current = Math.min(1, autoIntensityRef.current + 0.05);
    }

    const s = settingsRef.current;
    engine.drawBackground(ctx, s, dt);

    const hands = handsDataRef.current;
    const hueBase = (now / 30) % 360;

    let auraActive = false;
    let orbActive = false;
    let orbDepth = 0.5;

    for (const hand of hands) {
      const palm = engine.toScreen(hand.landmarks[9], s.mirrorCamera);
      const handHue = (hueBase + (hand.handedness === "Left" ? 120 : 0)) % 360;

      // Trails on fast movement
      if (s.effectTrails && hand.velocity > 0.4) {
        engine.emitTrail(palm.x, palm.y, s, handHue);
      }

      // Aura on open palm
      if (s.effectAura && hand.gesture === "open") {
        engine.emitAura(palm.x, palm.y, s, handHue);
        auraActive = true;
      }

      // Shockwave on pinch (edge-triggered)
      const wasPinching = prevPinchedRef.current.get(hand.handedness) ?? false;
      const isPinching = hand.gesture === "pinch";
      if (s.effectShockwave && isPinching && !wasPinching && now - lastShockwaveRef.current > 200) {
        const tip = engine.toScreen(hand.landmarks[8], s.mirrorCamera);
        engine.emitShockwave(tip.x, tip.y, s, handHue);
        if (!s.audioMuted) audioRef.current?.playShockwave(0.8);
        lastShockwaveRef.current = now;
      }
      prevPinchedRef.current.set(hand.handedness, isPinching);

      // Orb on fist
      if (s.effectOrb && hand.gesture === "fist") {
        const orbPos = { x: palm.x, y: palm.y - 70 };
        engine.drawOrb(ctx, orbPos.x, orbPos.y, handHue, now / 1000);
        orbActive = true;
        orbDepth = 1 - Math.min(1, Math.max(0, hand.landmarks[9].z + 0.5));
      }

      // Skeleton overlay
      if (s.showSkeleton) engine.drawSkeleton(ctx, hand, s.mirrorCamera);
    }

    // Lightning between two hands
    if (s.effectLightning && hands.length >= 2) {
      const a = engine.toScreen(hands[0].landmarks[9], s.mirrorCamera);
      const b = engine.toScreen(hands[1].landmarks[9], s.mirrorCamera);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 600) {
        const lhue = (hueBase + 180) % 360;
        engine.drawLightning(ctx, a, b, lhue);
        if (!s.audioMuted && now - lastLightningRef.current > 120) {
          audioRef.current?.playLightning(0.5);
          lastLightningRef.current = now;
        }
      }
    }

    // Audio state machines
    if (auraActive !== auraOpenActiveRef.current) {
      auraOpenActiveRef.current = auraActive;
      if (!s.audioMuted) audioRef.current?.setAuraActive(auraActive, ((hueBase % 360) / 360));
      else audioRef.current?.setAuraActive(false);
    }
    if (orbActive !== orbActiveRef.current) {
      orbActiveRef.current = orbActive;
      if (!s.audioMuted) audioRef.current?.setOrbActive(orbActive, orbDepth);
      else audioRef.current?.setOrbActive(false);
    }

    engine.update(dt);
    engine.cap(Math.floor(800 * autoIntensityRef.current * s.particleIntensity + 100));
    engine.drawForeground(ctx);
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafRef.current);
      handsRef.current?.close();
      audioRef.current?.dispose();
      const v = videoRef.current;
      const stream = v?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [handleResize]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover opacity-60"
        style={{ transform: settings.mirrorCamera ? "scaleX(-1)" : undefined }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {!started && (
        <StartScreen onStart={start} loading={loading} error={error} />
      )}

      {started && (
        <>
          <HUD fps={fps} gestures={activeGestures} hands={handCount} />
          <ControlPanel settings={settings} onChange={updateSettings} />
        </>
      )}
    </div>
  );
}
