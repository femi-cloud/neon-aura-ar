import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings2, GraduationCap } from "lucide-react";
import type { AuraSettings, ColorMode } from "@/lib/aura/types";

type Props = {
  settings: AuraSettings;
  onChange: (patch: Partial<AuraSettings>) => void;
  onReplayCalibration?: () => void;
};

const PRESETS: { id: ColorMode; label: string }[] = [
  { id: "rainbow", label: "🌈" },
  { id: "purple-gold", label: "🔮" },
  { id: "neon-cyan", label: "💠" },
  { id: "fire", label: "🔥" },
  { id: "aurora", label: "🌌" },
  { id: "custom", label: "🎨" },
];

export function ControlPanel({ settings, onChange, onReplayCalibration }: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full border-aura-gold/40 bg-black/50 text-aura-gold backdrop-blur-md hover:bg-black/70 hover:text-aura-gold-glow"
          aria-label="Open controls"
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] overflow-y-auto border-aura-purple/30 bg-black/85 text-foreground backdrop-blur-xl sm:w-[380px]">
        <SheetHeader>
          <SheetTitle className="bg-gradient-to-r from-aura-gold to-aura-purple-glow bg-clip-text text-transparent">
            Aura Controls
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Tip: hold ✌️ peace sign to cycle palettes.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-1">
          <Section title="Effects">
            <Toggle label="🖐 Aura particles" checked={settings.effectAura} onChange={(v) => onChange({ effectAura: v })} />
            <Toggle label="🤏 Pinch shockwave" checked={settings.effectShockwave} onChange={(v) => onChange({ effectShockwave: v })} />
            <Toggle label="✊ Fist orb" checked={settings.effectOrb} onChange={(v) => onChange({ effectOrb: v })} />
            <Toggle label="💨 Motion trails" checked={settings.effectTrails} onChange={(v) => onChange({ effectTrails: v })} />
            <Toggle label="⚡ Lightning (2 hands)" checked={settings.effectLightning} onChange={(v) => onChange({ effectLightning: v })} />
          </Section>

          <Separator className="bg-aura-purple/20" />

          <Section title="Particles & Mandalas">
            <SliderRow label="Particle intensity" value={settings.particleIntensity} onChange={(v) => onChange({ particleIntensity: v })} />
            <SliderRow label="Mandala speed" value={settings.mandalaSpeed} onChange={(v) => onChange({ mandalaSpeed: v })} />
            <SliderRow label="Mandala overlay" value={settings.mandalaOpacity} onChange={(v) => onChange({ mandalaOpacity: v })} />
          </Section>

          <Separator className="bg-aura-purple/20" />

          <Section title="Color preset (✌️ to cycle)">
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={settings.colorMode === p.id ? "default" : "outline"}
                  onClick={() => onChange({ colorMode: p.id })}
                  className={
                    settings.colorMode === p.id
                      ? "bg-gradient-to-r from-aura-purple to-aura-gold text-black hover:opacity-90"
                      : "border-aura-purple/40 bg-transparent text-foreground hover:bg-aura-purple/20"
                  }
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {settings.colorMode === "custom" && (
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Custom hue: {Math.round(settings.customHue)}°</Label>
                <Slider
                  value={[settings.customHue]}
                  onValueChange={([v]) => onChange({ customHue: v })}
                  min={0} max={360} step={1}
                  className="mt-2"
                />
              </div>
            )}
          </Section>

          <Separator className="bg-aura-purple/20" />

          <Section title="Audio">
            <Toggle label="Mute" checked={settings.audioMuted} onChange={(v) => onChange({ audioMuted: v })} />
            <SliderRow label="Volume" value={settings.audioVolume} onChange={(v) => onChange({ audioVolume: v })} />
          </Section>

          <Separator className="bg-aura-purple/20" />

          <Section title="Camera">
            <Toggle label="Mirror camera" checked={settings.mirrorCamera} onChange={(v) => onChange({ mirrorCamera: v })} />
            <Toggle label="Show hand skeleton" checked={settings.showSkeleton} onChange={(v) => onChange({ showSkeleton: v })} />
          </Section>

          {onReplayCalibration && (
            <>
              <Separator className="bg-aura-purple/20" />
              <Button
                variant="outline"
                onClick={onReplayCalibration}
                className="w-full border-aura-gold/40 bg-transparent text-aura-gold hover:bg-aura-gold/10"
              >
                <GraduationCap className="mr-2 h-4 w-4" /> Replay calibration
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-aura-gold/80">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm text-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-sm text-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{Math.round(value * 100)}%</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={0} max={1} step={0.01} />
    </div>
  );
}
