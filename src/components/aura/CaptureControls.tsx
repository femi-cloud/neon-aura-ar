import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Circle, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

type Props = {
  getComposite: () => HTMLCanvasElement | null;
};

type GifFrame = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

const GIF_FPS = 8;
const GIF_FRAME_DELAY = 1000 / GIF_FPS;
const GIF_MAX_WIDTH = 480;
const GIF_MAX_FRAMES = GIF_FPS * 10;

export function CaptureControls({ getComposite }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const framesRef = useRef<GifFrame[]>([]);
  const captureTimerRef = useRef<number | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    return () => {
      if (captureTimerRef.current !== null) window.clearInterval(captureTimerRef.current);
    };
  }, []);

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

  const captureGifFrame = () => {
    const source = getComposite();
    if (!source || framesRef.current.length >= GIF_MAX_FRAMES) return;

    const scale = Math.min(1, GIF_MAX_WIDTH / source.width);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const frameCanvas = frameCanvasRef.current ?? document.createElement("canvas");
    frameCanvasRef.current = frameCanvas;
    frameCanvas.width = width;
    frameCanvas.height = height;
    const ctx = frameCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    framesRef.current.push({ data: new Uint8ClampedArray(image.data), width, height });
  };

  const encodeGif = async () => {
    const frames = framesRef.current;
    if (!frames.length) {
      toast.error("Aucune image enregistrée");
      return;
    }

    setProcessing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 50));

    try {
      const gif = GIFEncoder({ initialCapacity: frames.length * frames[0].width * frames[0].height });
      frames.forEach((frame, index) => {
        const palette = quantize(frame.data, 256, { format: "rgb565" });
        const indexed = applyPalette(frame.data, palette, "rgb565");
        gif.writeFrame(indexed, frame.width, frame.height, {
          palette,
          delay: GIF_FRAME_DELAY,
          repeat: index === 0 ? 0 : undefined,
        });
      });
      gif.finish();
      const bytes = gif.bytes();
      downloadBlob(new Blob([bytes], { type: "image/gif" }), `aura-${Date.now()}.gif`);
      toast.success("Clip GIF sauvegardé ✅", { description: "Format compatible avec Windows et macOS." });
    } catch (error) {
      console.error(error);
      toast.error("Impossible de générer le GIF");
    } finally {
      framesRef.current = [];
      setProcessing(false);
    }
  };

  const stopGifRecording = () => {
    if (captureTimerRef.current !== null) {
      window.clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    setRecording(false);
    setElapsed(0);
    void encodeGif();
  };

  const startGifRecording = () => {
    framesRef.current = [];
    captureGifFrame();
    captureTimerRef.current = window.setInterval(captureGifFrame, GIF_FRAME_DELAY);
    startRef.current = performance.now();
    setRecording(true);
    toast("Recording started", { description: "Tap stop to save a PC-compatible GIF." });
  };

  const toggleRecord = () => {
    if (processing) return;
    if (recording) {
      if (recorderRef.current) recorderRef.current.stop();
      else stopGifRecording();
      return;
    }

    startGifRecording();
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
        {recording ? <Square className="h-5 w-5 fill-current" /> : <Circle className="h-5 w-5 fill-current" />}
      </Button>
      {recording && (
        <span className="rounded-full bg-red-500/20 px-3 py-1 font-mono text-xs text-red-200 backdrop-blur-md">
          ● REC {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
