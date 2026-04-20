import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Hand, Zap } from "lucide-react";
import type { GestureType } from "@/lib/aura/types";

type Step = {
  gesture: GestureType | "two-hands";
  emoji: string;
  title: string;
  hint: string;
};

const STEPS: Step[] = [
  { gesture: "open", emoji: "🖐", title: "Open palm", hint: "Spread your fingers facing the camera." },
  { gesture: "fist", emoji: "✊", title: "Make a fist", hint: "Curl all fingers into your palm." },
  { gesture: "pinch", emoji: "🤏", title: "Pinch", hint: "Touch your thumb and index together." },
  { gesture: "peace", emoji: "✌️", title: "Peace sign", hint: "Index + middle up — cycles palette!" },
  { gesture: "two-hands", emoji: "⚡", title: "Two hands", hint: "Show both hands to summon lightning." },
];

const HOLD_MS = 700;

type Props = {
  activeGestures: GestureType[];
  handCount: number;
  onClose: () => void;
};

export function Calibration({ activeGestures, handCount, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [holdStart, setHoldStart] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>(STEPS.map(() => false));

  const current = STEPS[step];
  const matches =
    current.gesture === "two-hands"
      ? handCount >= 2
      : activeGestures.includes(current.gesture as GestureType);

  useEffect(() => {
    if (matches) {
      if (holdStart === null) setHoldStart(performance.now());
    } else {
      setHoldStart(null);
      setProgress(0);
    }
  }, [matches, holdStart]);

  useEffect(() => {
    if (holdStart === null) return;
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        setCompleted((c) => {
          const n = [...c];
          n[step] = true;
          return n;
        });
        setHoldStart(null);
        setProgress(0);
        if (step < STEPS.length - 1) setStep(step + 1);
      }
    }, 50);
    return () => clearInterval(id);
  }, [holdStart, step]);

  const allDone = completed.every(Boolean);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-aura-purple/40 bg-black/70 p-5 text-center backdrop-blur-xl">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-aura-gold/30 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-aura-gold">
          <Hand className="h-3 w-3" /> Calibration · {step + 1} / {STEPS.length}
        </div>

        <div className="my-2 text-6xl transition-transform duration-300" style={{ transform: matches ? "scale(1.15)" : "scale(1)" }}>
          {current.emoji}
        </div>

        <h2 className="text-xl font-bold text-foreground">{current.title}</h2>
        <p className="mt-1 text-sm text-foreground/70">{current.hint}</p>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-100 ${matches ? "bg-gradient-to-r from-aura-purple to-aura-gold" : "bg-white/20"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-3 text-xs text-foreground/60">
          {matches ? (
            <span className="inline-flex items-center gap-1 text-aura-gold"><Zap className="h-3 w-3" /> Detected — hold…</span>
          ) : (
            <span>Waiting for gesture…</span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full ${
                completed[i] ? "bg-aura-gold" : i === step ? "bg-aura-purple-glow" : "bg-white/15"
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-foreground/70 hover:text-foreground"
          >
            Skip
          </Button>
          {allDone && (
            <Button
              size="sm"
              onClick={onClose}
              className="bg-gradient-to-r from-aura-purple to-aura-gold text-black"
            >
              <Check className="mr-1 h-4 w-4" /> Begin
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
