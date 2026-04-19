export type Landmark = { x: number; y: number; z: number };
export type HandData = {
  landmarks: Landmark[];
  handedness: "Left" | "Right";
  gesture: GestureType;
  velocity: number;
  centroid: { x: number; y: number };
  pinchDistance: number;
};

export type GestureType = "open" | "fist" | "pinch" | "point" | "unknown";

export type ColorMode = "rainbow" | "purple-gold" | "custom";

export type AuraSettings = {
  effectAura: boolean;
  effectShockwave: boolean;
  effectOrb: boolean;
  effectTrails: boolean;
  effectLightning: boolean;
  particleIntensity: number; // 0..1
  mandalaSpeed: number; // 0..1
  mandalaOpacity: number; // 0..1
  colorMode: ColorMode;
  customHue: number; // 0..360
  audioVolume: number; // 0..1
  audioMuted: boolean;
  mirrorCamera: boolean;
  showSkeleton: boolean;
};

export const DEFAULT_SETTINGS: AuraSettings = {
  effectAura: true,
  effectShockwave: true,
  effectOrb: true,
  effectTrails: true,
  effectLightning: true,
  particleIntensity: 0.7,
  mandalaSpeed: 0.5,
  mandalaOpacity: 0.55,
  colorMode: "rainbow",
  customHue: 290,
  audioVolume: 0.6,
  audioMuted: false,
  mirrorCamera: true,
  showSkeleton: true,
};
