import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Circle, Square } from "lucide-react";
import { toast } from "sonner";

type Props = {
  getComposite: () => HTMLCanvasElement | null;
};

export function CaptureControls({ getComposite }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  const snap = () => {
    const canvas = getComposite();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aura-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Snapshot saved 📸");
    }, "image/png");
  };

  const toggleRecord = () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    const canvas = getComposite();
    if (!canvas) return;
    const stream = canvas.captureStream(30);
    // Prefer MP4 (H.264) so the file opens natively on Windows/macOS without extra codecs.
    // Fall back to WebM only when the browser can't record MP4 (e.g. Firefox).
    const candidates = [
      "video/mp4;codecs=h264",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mime = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
    const isMp4 = mime.startsWith("video/mp4");
    const ext = isMp4 ? "mp4" : "webm";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : { videoBitsPerSecond: 5_000_000 });
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: isMp4 ? "video/mp4" : "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aura-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setRecording(false);
      setElapsed(0);
      toast.success("Recording saved 🎬");
    };
    rec.start(100);
    recorderRef.current = rec;
    startRef.current = performance.now();
    setRecording(true);
    toast("Recording started", { description: "Tap stop when you're done." });
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
