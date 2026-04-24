import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Circle, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

type Props = {
  getComposite: () => HTMLCanvasElement | null;
};

const TARGET_FPS = 30;
const MAX_DURATION_SEC = 30;
const MAX_WIDTH = 1280;

type WebCodecsRecorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
};

// Build an MP4 (H.264) recorder using WebCodecs + mp4-muxer.
// Falls back to null if the browser lacks support.
async function startWebCodecsRecorder(
  getComposite: () => HTMLCanvasElement | null,
): Promise<WebCodecsRecorder | null> {
  // Feature detect.
  if (typeof window === "undefined") return null;
  const VEncoder = (window as unknown as { VideoEncoder?: typeof VideoEncoder }).VideoEncoder;
  const VFrameCtor = (window as unknown as { VideoFrame?: typeof VideoFrame }).VideoFrame;
  if (!VEncoder || !VFrameCtor) return null;

  const source = getComposite();
  if (!source) return null;

  // Even dimensions are required for H.264.
  const scale = Math.min(1, MAX_WIDTH / source.width);
  const width = Math.max(2, Math.round((source.width * scale) / 2) * 2);
  const height = Math.max(2, Math.round((source.height * scale) / 2) * 2);

  // Try a few common H.264 codec strings (baseline/main profiles).
  const codecCandidates = ["avc1.42E01F", "avc1.4D401F", "avc1.640028"];
  let chosenCodec: string | null = null;
  for (const codec of codecCandidates) {
    try {
      const support = await VEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 5_000_000,
        framerate: TARGET_FPS,
        avc: { format: "avc" },
      });
      if (support.supported) {
        chosenCodec = codec;
        break;
      }
    } catch {
      // try next
    }
  }
  if (!chosenCodec) return null;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width,
      height,
      frameRate: TARGET_FPS,
    },
    fastStart: "in-memory",
  });

  let encoderError: Error | null = null;
  const encoder = new VEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (err) => {
      encoderError = err instanceof Error ? err : new Error(String(err));
      console.error("VideoEncoder error", err);
    },
  });

  encoder.configure({
    codec: chosenCodec,
    width,
    height,
    bitrate: 5_000_000,
    framerate: TARGET_FPS,
    avc: { format: "avc" },
  });

  // Offscreen canvas used to scale frames to the target size.
  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const scratchCtx = scratch.getContext("2d");
  if (!scratchCtx) {
    encoder.close();
    return null;
  }

  const startTime = performance.now();
  let frameCount = 0;
  let stopped = false;
  let cancelled = false;

  const interval = 1000 / TARGET_FPS;
  let nextFrameAt = startTime;

  const tick = () => {
    if (stopped || cancelled) return;
    const now = performance.now();
    if (now < nextFrameAt) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    const elapsedSec = (now - startTime) / 1000;
    if (elapsedSec >= MAX_DURATION_SEC) {
      // auto-stop handled by caller via stop()
      rafId = requestAnimationFrame(tick);
      return;
    }
    const src = getComposite();
    if (src) {
      try {
        scratchCtx.drawImage(src, 0, 0, width, height);
        const timestamp = Math.round((frameCount * 1_000_000) / TARGET_FPS);
        const frame = new VFrameCtor(scratch, {
          timestamp,
          duration: Math.round(1_000_000 / TARGET_FPS),
        });
        const keyFrame = frameCount % (TARGET_FPS * 2) === 0;
        encoder.encode(frame, { keyFrame });
        frame.close();
        frameCount += 1;
        nextFrameAt += interval;
      } catch (err) {
        console.error("frame encode failed", err);
      }
    }
    rafId = requestAnimationFrame(tick);
  };

  let rafId = requestAnimationFrame(tick);

  return {
    cancel: () => {
      cancelled = true;
      stopped = true;
      cancelAnimationFrame(rafId);
      try {
        encoder.close();
      } catch {
        // ignore
      }
    },
    stop: async () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      await encoder.flush();
      encoder.close();
      if (encoderError) throw encoderError;
      muxer.finalize();
      const { buffer } = muxer.target as ArrayBufferTarget;
      return new Blob([buffer], { type: "video/mp4" });
    },
  };
}

// Fallback recorder using MediaRecorder with the best WebM codec available.
function startMediaRecorderFallback(
  getComposite: () => HTMLCanvasElement | null,
): { stop: () => Promise<{ blob: Blob; ext: string }>; cancel: () => void } | null {
  const source = getComposite();
  if (!source) return null;
  const stream = source.captureStream(TARGET_FPS);
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mime = candidates.find((c) => MediaRecorder.isTypeSupported(c));
  if (!mime) return null;
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);
  return {
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          resolve({ blob, ext: "webm" });
        };
        recorder.stop();
      }),
  };
}

export function CaptureControls({ getComposite }: Props) {
  const webCodecsRef = useRef<WebCodecsRecorder | null>(null);
  const fallbackRef = useRef<ReturnType<typeof startMediaRecorderFallback> | null>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - startRef.current) / 1000));
      if ((performance.now() - startRef.current) / 1000 >= MAX_DURATION_SEC) {
        // auto-stop at max duration
        void stopRecording();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const snap = () => {
    const canvas = getComposite();
    if (!canvas) {
      toast.error("Capture indisponible");
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `aura-${Date.now()}.png`);
      toast.success("Snapshot saved 📸");
    }, "image/png");
  };

  const startRecording = async () => {
    setProcessing(true);
    try {
      const wc = await startWebCodecsRecorder(getComposite);
      if (wc) {
        webCodecsRef.current = wc;
        startRef.current = performance.now();
        setRecording(true);
        toast("Recording started", { description: "MP4 H.264 — lisible partout." });
        return;
      }
      const fb = startMediaRecorderFallback(getComposite);
      if (fb) {
        fallbackRef.current = fb;
        startRef.current = performance.now();
        setRecording(true);
        toast("Recording started", {
          description: "Format WebM (votre navigateur ne supporte pas l'export MP4).",
        });
        return;
      }
      toast.error("Enregistrement non supporté par ce navigateur");
    } finally {
      setProcessing(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);
    setElapsed(0);
    setProcessing(true);
    try {
      if (webCodecsRef.current) {
        const blob = await webCodecsRef.current.stop();
        webCodecsRef.current = null;
        downloadBlob(blob, `aura-${Date.now()}.mp4`);
        toast.success("Clip MP4 sauvegardé ✅", {
          description: "Lisible sur Windows, macOS, iOS et Android.",
        });
      } else if (fallbackRef.current) {
        const { blob, ext } = await fallbackRef.current.stop();
        fallbackRef.current = null;
        downloadBlob(blob, `aura-${Date.now()}.${ext}`);
        toast.success(`Clip .${ext} sauvegardé ✅`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Impossible de finaliser la vidéo");
    } finally {
      setProcessing(false);
    }
  };

  const toggleRecord = () => {
    if (processing) return;
    if (recording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
      <Button
        size="icon"
        variant="outline"
        onClick={snap}
        className="h-12 w-12 rounded-full border-aura-gold/40 bg-black/50 text-aura-gold backdrop-blur-md hover:bg-black/70"
        aria-label="Take snapshot"
      >
        <Camera className="h-5 w-5" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        onClick={toggleRecord}
        className={`h-12 w-12 rounded-full backdrop-blur-md ${
          recording
            ? "border-red-500/60 bg-red-500/20 text-red-300 hover:bg-red-500/30"
            : "border-aura-gold/40 bg-black/50 text-aura-gold hover:bg-black/70"
        }`}
        aria-label={recording ? "Stop recording" : "Start recording"}
      >
        {processing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : recording ? (
          <Square className="h-5 w-5 fill-current" />
        ) : (
          <Circle className="h-5 w-5 fill-current" />
        )}
      </Button>
      {recording && (
        <span className="rounded-full bg-red-500/20 px-3 py-1 font-mono text-xs text-red-200 backdrop-blur-md">
          ● REC {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
