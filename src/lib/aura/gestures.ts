import type { GestureType, Landmark } from "./types";

function dist(a: Landmark, b: Landmark) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// Detect if a finger is extended by comparing tip vs PIP joint distance from wrist
function fingerExtended(lm: Landmark[], tip: number, pip: number, mcp: number): boolean {
  const wrist = lm[0];
  const tipD = dist(lm[tip], wrist);
  const pipD = dist(lm[pip], wrist);
  const mcpD = dist(lm[mcp], wrist);
  return tipD > pipD && pipD > mcpD * 0.9;
}

export function detectGesture(lm: Landmark[]): GestureType {
  if (!lm || lm.length < 21) return "unknown";

  const thumbExt = fingerExtended(lm, 4, 3, 2);
  const indexExt = fingerExtended(lm, 8, 6, 5);
  const middleExt = fingerExtended(lm, 12, 10, 9);
  const ringExt = fingerExtended(lm, 16, 14, 13);
  const pinkyExt = fingerExtended(lm, 20, 18, 17);

  const palmSize = dist(lm[0], lm[9]);
  const pinch = dist(lm[4], lm[8]) / palmSize;

  if (pinch < 0.35 && !middleExt && !ringExt && !pinkyExt) return "pinch";

  const extCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;
  // Peace: index + middle extended, ring + pinky curled
  if (indexExt && middleExt && !ringExt && !pinkyExt) return "peace";
  if (extCount >= 3) return "open";
  if (extCount === 0) return "fist";
  if (indexExt && !middleExt && !ringExt && !pinkyExt) return "point";

  return "unknown";
}

export function pinchDistance(lm: Landmark[]): number {
  if (!lm || lm.length < 21) return 1;
  const palmSize = dist(lm[0], lm[9]) || 0.001;
  return dist(lm[4], lm[8]) / palmSize;
}

export function centroid(lm: Landmark[]): { x: number; y: number } {
  let sx = 0, sy = 0;
  for (const p of lm) { sx += p.x; sy += p.y; }
  return { x: sx / lm.length, y: sy / lm.length };
}

// Returns true if index + middle fingers are extended AND glued together
// (Naruto-style "ram seal" half: tips close to each other relative to palm size).
export function isFingersJoined(lm: Landmark[]): boolean {
  if (!lm || lm.length < 21) return false;
  const palmSize = dist(lm[0], lm[9]) || 0.001;
  const tipsGap = dist(lm[8], lm[12]) / palmSize;
  const pipsGap = dist(lm[6], lm[10]) / palmSize;
  // Tips and PIPs should be close → fingers are pressed together
  return tipsGap < 0.45 && pipsGap < 0.55;
}

// 2D segment-segment intersection test (returns true if [p1,p2] crosses [p3,p4]).
export function segmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-6) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Approximate intersection point of two infinite lines (caller ensures they cross).
export function lineIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): { x: number; y: number } {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-6) return { x: (p1.x + p3.x) / 2, y: (p1.y + p3.y) / 2 };
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}
