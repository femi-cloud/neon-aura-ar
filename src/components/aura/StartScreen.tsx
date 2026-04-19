import { Button } from "@/components/ui/button";
import { Sparkles, Hand, Zap } from "lucide-react";

type Props = {
  onStart: () => void;
  loading: boolean;
  error: string | null;
};

export function StartScreen({ onStart, loading, error }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_oklch(0.18_0.1_290),_oklch(0.04_0.04_285))]" />
      {/* Decorative mandalas */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30">
        <div className="h-[600px] w-[600px] animate-spin rounded-full border border-aura-gold/40" style={{ animationDuration: "60s" }} />
        <div className="absolute h-[420px] w-[420px] animate-spin rounded-full border border-aura-purple/50" style={{ animationDuration: "40s", animationDirection: "reverse" }} />
        <div className="absolute h-[260px] w-[260px] animate-spin rounded-full border border-aura-gold/60" style={{ animationDuration: "25s" }} />
      </div>

      <div className="relative z-10 mx-4 max-w-lg text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-aura-gold/30 bg-black/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-aura-gold backdrop-blur-md">
          <Sparkles className="h-3 w-3" /> Neon Aura AR
        </div>

        <h1 className="bg-gradient-to-br from-aura-gold via-aura-purple-glow to-aura-magenta bg-clip-text font-serif text-5xl font-bold leading-tight text-transparent sm:text-6xl">
          Conjure light<br />with your hands
        </h1>

        <p className="mx-auto mt-5 max-w-md text-base text-foreground/80">
          A real-time AR ritual powered by computer vision. Open your palms,
          pinch the air, and clench your fists to summon particles, shockwaves,
          and lightning.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-foreground/70">
          <span className="inline-flex items-center gap-1.5"><Hand className="h-3.5 w-3.5 text-aura-gold" /> Hand tracking</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-aura-purple-glow" /> Reactive visuals</span>
          <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-aura-magenta" /> Live audio</span>
        </div>

        <Button
          size="lg"
          onClick={onStart}
          disabled={loading}
          className="mt-10 h-14 rounded-full bg-gradient-to-r from-aura-purple to-aura-gold px-10 text-base font-semibold text-black shadow-[0_0_40px_oklch(0.7_0.28_300/0.5)] hover:opacity-95 hover:shadow-[0_0_60px_oklch(0.7_0.28_300/0.7)]"
        >
          {loading ? "Loading model..." : "Begin the ritual"}
        </Button>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        <p className="mt-8 text-[10px] uppercase tracking-widest text-foreground/50">
          Requires camera access · Best with good lighting
        </p>
      </div>
    </div>
  );
}
