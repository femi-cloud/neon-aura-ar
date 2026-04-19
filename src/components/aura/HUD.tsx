type Props = {
  fps: number;
  gestures: string[];
  hands: number;
};

export function HUD({ fps, gestures, hands }: Props) {
  return (
    <div className="pointer-events-none fixed left-4 top-4 z-30 rounded-lg border border-aura-purple/30 bg-black/50 px-3 py-2 font-mono text-[11px] text-aura-gold/90 backdrop-blur-md">
      <div>FPS <span className="text-aura-gold">{fps}</span></div>
      <div>HANDS <span className="text-aura-gold">{hands}</span></div>
      <div>
        GESTURE{" "}
        <span className="text-aura-purple-glow">
          {gestures.length ? gestures.join(" + ") : "—"}
        </span>
      </div>
    </div>
  );
}
