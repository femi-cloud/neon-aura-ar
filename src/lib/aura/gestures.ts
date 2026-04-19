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
