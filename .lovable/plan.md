
## Neon Aura AR — Mystical Rainbow Edition

A full-screen, immersive AR experience in the browser that uses your webcam + MediaPipe Hands to turn gestures into reactive neon visuals and sound.

### Visual identity
- **Palette**: Deep purple/indigo base with gold accents, *plus* particle hues that cycle through the full rainbow based on hand position and velocity.
- **Background**: Slowly rotating sacred-geometry mandalas (multiple layered rings) with subtle matrix-like rain woven in.
- **Foreground**: Glowing skeleton overlay on detected hands (joints + connections) with a soft golden bloom.

### Gesture → Effect mapping
- 🖐 **Open palm** → continuous rainbow particle aura pouring from the palm
- 🤏 **Pinch (thumb + index)** → expanding shockwave ring with radial distortion
- ✊ **Fist** → contained energy orb that hovers above the hand
- 💨 **Fast movement** → glowing motion trails that fade
- ⚡ **Two hands close together** → animated lightning bolts arcing between them

### Audio (pure reactive SFX, Web Audio API)
- Synthesized in-browser (no audio files needed): whoosh on shockwave, crackle on lightning, airy pad on aura, low hum on orb.
- Pitch and volume modulated by hand depth (Z) and speed.
- Starts after first user interaction (browser autoplay rule).

### Full control panel (collapsible side drawer)
- Master on/off for each effect (aura, shockwave, orb, trails, lightning)
- Particle intensity slider
- Mandala speed + opacity sliders
- Color mode: rainbow / purple-gold only / custom hue
- Audio master volume + mute
- Mirror camera toggle
- Show/hide hand skeleton
- FPS + detected-gesture readout (mini HUD top-left)

### Structure
- Single immersive route at `/` — full-viewport `<canvas>` layered over the webcam `<video>`.
- MediaPipe Hands loaded via CDN (`@mediapipe/hands` + `@mediapipe/camera_utils`).
- Custom render loop driving particles, shockwaves, trails, lightning, mandala background.
- Control panel as a Shadcn `Sheet` slide-out triggered by a floating gear icon.
- Permissions screen with a clear "Start Experience" button (handles camera permission + audio context unlock in one click).

### UX details
- Loading state while MediaPipe model downloads.
- Friendly fallback if camera is denied or unavailable.
- Mobile-aware: works in portrait, taps the gear to open controls.
- Performance guardrail: auto-reduce particle count if FPS drops below 25.
