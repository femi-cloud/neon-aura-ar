import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { ControlPanel } from "@/components/aura/ControlPanel";
import { StartScreen } from "@/components/aura/StartScreen";
import { HUD } from "@/components/aura/HUD";
import { Calibration } from "@/components/aura/Calibration";
import { CaptureControls } from "@/components/aura/CaptureControls";
import {
  COLOR_PRESETS,
  DEFAULT_SETTINGS,
  type AuraSettings,
  type ColorMode,
  type GestureType,
  type HandData,
  type Landmark,
} from "@/lib/aura/types";
import { EffectsEngine } from "@/lib/aura/effects";
import { AuraAudio } from "@/lib/aura/audio";
import { centroid, detectGesture, pinchDistance, isFingersJoined, segmentsIntersect, lineIntersection } from "@/lib/aura/gestures";

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

const PRESET_LABELS: Record<ColorMode, string> = {
  rainbow: "🌈 Rainbow",
  "purple-gold": "🔮 Purple + Gold",
  "neon-cyan": "💠 Neon Cyan",
  fire: "🔥 Fire",
  aurora: "🌌 Aurora",
  custom: "🎨 Custom",
};

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
  const compositeRef = useRef<HTMLCanvasElement | null>(null);
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
  const peaceHoldRef = useRef<{ start: number; fired: boolean }>({ start: 0, fired: false });
  const lastPresetSwitchRef = useRef(0);
  const lastCloneSfxRef = useRef(0);
  const cloneActiveRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AuraSettings>(DEFAULT_SETTINGS);
  const [fps, setFps] = useState(0);
  const [activeGestures, setActiveGestures] = useState<GestureType[]>([]);
  const [handCount, setHandCount] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);

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

  const cyclePreset = useCallback(() => {
    const cur = settingsRef.current.colorMode;
    const idx = COLOR_PRESETS.indexOf(cur as ColorMode);
    const next = COLOR_PRESETS[(idx + 1) % COLOR_PRESETS.length];
    updateSettings({ colorMode: next });
    toast(PRESET_LABELS[next], { description: "Palette switched ✌️", duration: 1500 });
  }, [updateSettings]);

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

  // Build composite canvas (camera + effects) for snapshot/recording
  const getComposite = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    const fx = canvasRef.current;
    if (!video || !fx) return null;
    if (!compositeRef.current) compositeRef.current = document.createElement("canvas");
    const c = compositeRef.current;
    const w = video.videoWidth || window.innerWidth;
    const h = video.videoHeight || window.innerHeight;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.save();
    if (settingsRef.current.mirrorCamera) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    ctx.drawImage(fx, 0, 0, w, h);
    return c;
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const audio = new AuraAudio();
      await audio.init();
      audio.setVolume(settingsRef.current.audioMuted ? 0 : settingsRef.current.audioVolume);
      audioRef.current = audio;

      await loadScript(`${MP_BASE}hands.js`);
      if (!window.Hands) throw new Error("MediaPipe failed to load");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

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
      setShowCalibration(true);

      handleResize();
      engineRef.current = new EffectsEngine(window.innerWidth, window.innerHeight);

      const loop = async () => {
        if (handsRef.current && video.readyState >= 2) {
          try {
            await handsRef.current.send({ image: video });
          } catch {
            // ignore
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

    fpsAccumRef.current.frames += 1;
    if (now - fpsAccumRef.current.t > 500) {
      const f = Math.round((fpsAccumRef.current.frames * 1000) / (now - fpsAccumRef.current.t));
      setFps(f);
      fpsAccumRef.current = { frames: 0, t: now };
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
    let anyPeace = false;

    for (const hand of hands) {
      const palm = engine.toScreen(hand.landmarks[9], s.mirrorCamera);
      const handHue = (hueBase + (hand.handedness === "Left" ? 120 : 0)) % 360;

      if (s.effectTrails && hand.velocity > 0.4) {
        engine.emitTrail(palm.x, palm.y, s, handHue);
      }

      if (s.effectAura && hand.gesture === "open") {
        engine.emitAura(palm.x, palm.y, s, handHue);
        auraActive = true;
      }

      const wasPinching = prevPinchedRef.current.get(hand.handedness) ?? false;
      const isPinching = hand.gesture === "pinch";
      if (s.effectShockwave && isPinching && !wasPinching && now - lastShockwaveRef.current > 200) {
        const tip = engine.toScreen(hand.landmarks[8], s.mirrorCamera);
        engine.emitShockwave(tip.x, tip.y, s, handHue);
        if (!s.audioMuted) audioRef.current?.playShockwave(0.8);
        lastShockwaveRef.current = now;
      }
      prevPinchedRef.current.set(hand.handedness, isPinching);

      if (s.effectOrb && hand.gesture === "fist") {
        const orbPos = { x: palm.x, y: palm.y - 70 };
        engine.drawOrb(ctx, orbPos.x, orbPos.y, handHue, now / 1000);
        orbActive = true;
        orbDepth = 1 - Math.min(1, Math.max(0, hand.landmarks[9].z + 0.5));
      }

      if (hand.gesture === "peace") anyPeace = true;

      if (s.showSkeleton) engine.drawSkeleton(ctx, hand, s.mirrorCamera);
    }

    // Peace sign → cycle palette (hold ~0.6s, debounce 1.2s)
    if (anyPeace) {
      if (peaceHoldRef.current.start === 0) {
        peaceHoldRef.current = { start: now, fired: false };
      } else if (
        !peaceHoldRef.current.fired &&
        now - peaceHoldRef.current.start > 600 &&
        now - lastPresetSwitchRef.current > 1200
      ) {
        peaceHoldRef.current.fired = true;
        lastPresetSwitchRef.current = now;
        cyclePreset();
      }
    } else {
      peaceHoldRef.current = { start: 0, fired: false };
    }

    // Naruto-style cross-seal multi-clone:
    //  - both hands in "peace" (index + middle extended, others curled)
    //  - on each hand, index & middle are GLUED together
    //  - the two finger-pairs (treated as line segments from MCP→tip) actually CROSS in 2D
    let cloneActive = false;
    if (hands.length >= 2 && hands[0].gesture === "peace" && hands[1].gesture === "peace") {
      const h0 = hands[0];
      const h1 = hands[1];
      const joined0 = isFingersJoined(h0.landmarks);
      const joined1 = isFingersJoined(h1.landmarks);
      if (joined0 && joined1) {
        // Build one representative segment per hand: middle of (index_mcp, middle_mcp) → middle of (index_tip, middle_tip)
        const baseScreen = (a: Landmark, b: Landmark) => {
          const sa = engine.toScreen(a, s.mirrorCamera);
          const sb = engine.toScreen(b, s.mirrorCamera);
          return { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 };
        };
        const base0 = baseScreen(h0.landmarks[5], h0.landmarks[9]);
        const tip0 = baseScreen(h0.landmarks[8], h0.landmarks[12]);
        const base1 = baseScreen(h1.landmarks[5], h1.landmarks[9]);
        const tip1 = baseScreen(h1.landmarks[8], h1.landmarks[12]);

        // Extend segments slightly past tips to be lenient with timing
        const extend = (a: { x: number; y: number }, b: { x: number; y: number }, k = 1.25) => ({
          x: a.x + (b.x - a.x) * k,
          y: a.y + (b.y - a.y) * k,
        });
        const tip0Ext = extend(base0, tip0);
        const tip1Ext = extend(base1, tip1);

        const crosses = segmentsIntersect(base0, tip0Ext, base1, tip1Ext);
        if (crosses) {
          cloneActive = true;
          const pivot = lineIntersection(base0, tip0Ext, base1, tip1Ext);
          const baseHue = (hueBase + 200) % 360;

          // Person clones: copies of the live webcam frame placed in a ring around the pivot.
          // Drawn BEFORE the halo/skeletons so they sit behind the glow.
          const video = videoRef.current;
          if (video) {
            const cloneCount = 6;
            const ringRadius = 180; // px offset from pivot
            for (let k = 0; k < cloneCount; k++) {
              const a = (k / cloneCount) * Math.PI * 2 + now / 2200;
              // Offset pivot so each clone appears displaced around the user
              const offX = Math.cos(a) * ringRadius;
              const offY = Math.sin(a) * ringRadius * 0.55; // flatter ellipse
              const clonePivot = { x: pivot.x + offX, y: pivot.y + offY };
              const scale = 0.78 + 0.05 * Math.sin(now / 500 + k);
              const rotation = Math.sin(now / 900 + k) * 0.08;
              const alpha = 0.42;
              const hue = (baseHue + k * 50) % 360;
              engine.drawPersonClone(ctx, video, s.mirrorCamera, clonePivot, rotation, scale, alpha, hue);
            }
          }

          // Halo + skeleton flourishes on top
          engine.drawCloneHalo(ctx, pivot.x, pivot.y, baseHue, now / 1000);
          for (let k = 1; k <= 4; k++) {
            const angle = (k / 4) * Math.PI * 2 + now / 1500;
            const scale = 0.55 + 0.35 * Math.sin(now / 600 + k);
            const alpha = 0.4 - (k / 4) * 0.2;
            const hue = (baseHue + k * 40) % 360;
            engine.drawCloneSkeleton(ctx, h0, s.mirrorCamera, pivot, angle, scale, alpha, hue);
            engine.drawCloneSkeleton(ctx, h1, s.mirrorCamera, pivot, -angle, scale, alpha, (hue + 60) % 360);
          }
          for (let p = 0; p < 3; p++) {
            engine.emitAura(pivot.x, pivot.y, s, baseHue);
          }
          if (!s.audioMuted && now - lastCloneSfxRef.current > 350) {
            audioRef.current?.playClone(0.7);
            lastCloneSfxRef.current = now;
          }
        }
      }
    }
    if (cloneActive && !cloneActiveRef.current) {
      toast("✨ Multi-Clone activé", { description: "Sceau Naruto détecté 🥷", duration: 1400 });
    }
    cloneActiveRef.current = cloneActive;

    if (s.effectLightning && hands.length >= 2 && !cloneActive) {
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
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: settings.mirrorCamera ? "scaleX(-1)" : undefined }}
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {!started && (
        <StartScreen onStart={start} loading={loading} error={error} />
      )}

      {started && (
        <>
          <HUD fps={fps} gestures={activeGestures} hands={handCount} />
          {showCalibration && (
            <Calibration
              activeGestures={activeGestures}
              handCount={handCount}
              onClose={() => setShowCalibration(false)}
            />
          )}
          <CaptureControls getComposite={getComposite} />
          <ControlPanel
            settings={settings}
            onChange={updateSettings}
            onReplayCalibration={() => setShowCalibration(true)}
          />
        </>
      )}
    </div>
  );
}
