import type { AuraSettings, HandData, Landmark } from "./types";

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; hue: number;
};

type Shockwave = { x: number; y: number; r: number; maxR: number; life: number; hue: number };
type TrailPoint = { x: number; y: number; life: number; hue: number };

// MediaPipe hand connections
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export class EffectsEngine {
  particles: Particle[] = [];
  shockwaves: Shockwave[] = [];
  trails: TrailPoint[] = [];
  mandalaAngle = 0;
  matrixDrops: { x: number; y: number; speed: number; char: string }[] = [];
  time = 0;

  constructor(public width: number, public height: number) {
    this.initMatrix();
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.initMatrix();
  }

  private initMatrix() {
    const cols = Math.floor(this.width / 24);
    this.matrixDrops = Array.from({ length: cols }, (_, i) => ({
      x: i * 24,
      y: Math.random() * this.height,
      speed: 0.5 + Math.random() * 1.5,
      char: String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96)),
    }));
  }

  hueFor(settings: AuraSettings, base: number): number {
    if (settings.colorMode === "purple-gold") {
      // Oscillate between purple (~290) and gold (~50)
      return base % 2 < 1 ? 290 + (Math.random() * 30 - 15) : 50 + (Math.random() * 20 - 10);
    }
    if (settings.colorMode === "custom") {
      return settings.customHue + (Math.random() * 30 - 15);
    }
    return base;
  }

  emitAura(x: number, y: number, settings: AuraSettings, baseHue: number) {
    const count = Math.floor(4 * settings.particleIntensity);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        life: 1,
        maxLife: 60 + Math.random() * 40,
        size: 2 + Math.random() * 4,
        hue: this.hueFor(settings, baseHue),
      });
    }
  }

  emitShockwave(x: number, y: number, settings: AuraSettings, baseHue: number) {
    this.shockwaves.push({
      x, y, r: 10, maxR: 200 + Math.random() * 100, life: 1,
      hue: this.hueFor(settings, baseHue),
    });
  }

  emitTrail(x: number, y: number, settings: AuraSettings, baseHue: number) {
    this.trails.push({ x, y, life: 1, hue: this.hueFor(settings, baseHue) });
  }

  drawBackground(ctx: CanvasRenderingContext2D, settings: AuraSettings, dt: number) {
    // Deep gradient backdrop
    ctx.fillStyle = "rgba(8, 4, 20, 0.85)";
    ctx.fillRect(0, 0, this.width, this.height);

    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 0,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) / 1.5
    );
    grad.addColorStop(0, "rgba(80, 30, 140, 0.18)");
    grad.addColorStop(1, "rgba(8, 4, 20, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Matrix rain (subtle)
    ctx.font = "16px monospace";
    ctx.fillStyle = `rgba(180, 140, 60, ${0.15 * settings.mandalaOpacity})`;
    for (const d of this.matrixDrops) {
      ctx.fillText(d.char, d.x, d.y);
      d.y += d.speed * dt * 30;
      if (d.y > this.height) {
        d.y = -20;
        d.char = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96));
      }
    }

    // Mandalas
    this.mandalaAngle += dt * settings.mandalaSpeed * 0.3;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const op = settings.mandalaOpacity;

    for (let ring = 0; ring < 4; ring++) {
      const radius = 80 + ring * 70;
      const petals = 8 + ring * 4;
      const dir = ring % 2 === 0 ? 1 : -1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.mandalaAngle * dir);
      ctx.strokeStyle = ring % 2 === 0
        ? `rgba(200, 160, 80, ${0.35 * op})`
        : `rgba(170, 100, 220, ${0.3 * op})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner circle
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSkeleton(ctx: CanvasRenderingContext2D, hand: HandData, mirror: boolean) {
    const pts = hand.landmarks.map((l) => this.toScreen(l, mirror));
    ctx.save();
    ctx.shadowColor = "rgba(255, 215, 100, 0.9)";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "rgba(255, 220, 130, 0.85)";
    ctx.lineWidth = 2;
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 240, 180, 0.95)";
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  toScreen(l: Landmark, mirror: boolean) {
    const x = (mirror ? 1 - l.x : l.x) * this.width;
    const y = l.y * this.height;
    return { x, y };
  }

  drawLightning(
    ctx: CanvasRenderingContext2D,
    a: { x: number; y: number },
    b: { x: number; y: number },
    hue: number,
  ) {
    ctx.save();
    ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = `hsl(${hue}, 100%, 80%)`;
    ctx.lineWidth = 2;
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const segs = 12;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const x = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 30;
        const y = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, hue: number, t: number) {
    const pulse = 1 + Math.sin(t * 4) * 0.15;
    const r = 40 * pulse;
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `hsla(${hue}, 100%, 75%, 0.95)`);
    grad.addColorStop(0.5, `hsla(${hue}, 100%, 55%, 0.5)`);
    grad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // inner core
    ctx.shadowColor = `hsla(${hue}, 100%, 80%, 0.9)`;
    ctx.shadowBlur = 30;
    ctx.fillStyle = `hsla(${hue}, 100%, 85%, 0.9)`;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  update(dt: number) {
    this.time += dt;
    // particles
    this.particles = this.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.life -= 1 / p.maxLife;
      return p.life > 0;
    });
    // shockwaves
    this.shockwaves = this.shockwaves.filter((s) => {
      s.r += (s.maxR - s.r) * 0.08;
      s.life -= 0.025;
      return s.life > 0;
    });
    // trails
    this.trails = this.trails.filter((t) => {
      t.life -= 0.04;
      return t.life > 0;
    });
  }

  drawForeground(ctx: CanvasRenderingContext2D) {
    // trails
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const t of this.trails) {
      ctx.fillStyle = `hsla(${t.hue}, 100%, 65%, ${t.life * 0.6})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 8 * t.life, 0, Math.PI * 2);
      ctx.fill();
    }
    // particles
    for (const p of this.particles) {
      ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${p.life})`;
      ctx.shadowColor = `hsla(${p.hue}, 100%, 70%, ${p.life})`;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    // shockwaves
    for (const s of this.shockwaves) {
      ctx.strokeStyle = `hsla(${s.hue}, 100%, 70%, ${s.life})`;
      ctx.lineWidth = 4 * s.life + 1;
      ctx.shadowColor = `hsla(${s.hue}, 100%, 70%, ${s.life})`;
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Cap particles for performance
  cap(max: number) {
    if (this.particles.length > max) {
      this.particles.splice(0, this.particles.length - max);
    }
  }
}
