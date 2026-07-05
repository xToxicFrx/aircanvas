# AirCanvas

Draw in the air with your finger — no stylus, no touchscreen, just your webcam.

AirCanvas tracks your hand in real time (MediaPipe HandLandmarker, running fully
in the browser — no video ever leaves your device) and turns your index finger
into a pen. Sketch UI wireframes or diagrams in the air, then let an AI clean
them up into polished diagrams or working HTML/CSS code.

## Status

Work in progress — built over a 10-day sprint.

- [x] **Day 1:** Vite + React + TS + Tailwind scaffold, live webcam hand tracking
      with landmark overlay
- [x] **Day 2:** Pinch gesture (thumb + index) as pen down/up — draw strokes in the air,
      with hysteresis thresholds, undo/clear, PWA install + offline model caching
- [x] **Day 3:** One-Euro filter smoothing + Ramer-Douglas-Peucker simplification,
      smooth curve rendering, unit tests (Vitest) for pinch/RDP/filter
- [x] **Day 4:** Air toolbar — hover-dwell tool selection (colors + eraser) with
      progress ring, stroke-level eraser with segment hit testing, snapshot undo history
- [x] **Day 5:** PNG + SVG export — SVG paths use the same midpoint-quadratic
      smoothing as the canvas renderer, so exports match the live drawing exactly
- [x] **Day 6:** AI cleanup — sketch → validated diagram JSON → clean SVG, and
      UI sketch → HTML/CSS with sandboxed live preview (OpenAI vision via
      serverless function, zod validation with one retry-on-invalid)
- [ ] **Day 7:** Diagram renderer + live preview of generated UI code
- [ ] **Day 8:** Local persistence (IndexedDB), export as PNG/SVG/code
- [ ] **Day 9:** Robustness (bad lighting, lost tracking, AI fallbacks) + unit tests
- [ ] **Day 10:** Polish, docs, demo video

## Development

```bash
npm install
npm run dev
```

Requires a browser with webcam access. The hand-tracking model (~7 MB) is
loaded from a CDN on first start.

The AI cleanup feature runs through a Vercel serverless function
(`api/cleanup.ts`) and needs an `OPENAI_API_KEY` environment variable in the
Vercel project settings (optionally `OPENAI_MODEL`, default `gpt-4o-mini`).
Note: `npm run dev` serves only the frontend — the `/api` route runs on Vercel
(or locally via `vercel dev`).

## Tech

- React 19 + TypeScript + Vite + Tailwind CSS v4
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) `HandLandmarker` (GPU delegate, video mode)
