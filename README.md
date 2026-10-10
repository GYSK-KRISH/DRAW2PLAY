# 🍌 Draw2Play AI — Hackathon Project Foundation

> **From Sketch to Playable 2D Game with Real Image AI, Arcade Physics, Audio & Saved Creations.**  
> Built for the **Banana Hacks 2026** Hackathon | **Theme:** Image AI (October 9–12, 2026)

---

## 📖 1. Project Vision

**Draw2Play AI** empowers players to draw a custom 2D platformer level by hand, optionally analyze the sketch with Google Gemini Vision AI to interpret visual theme, geometry, and physics tuning, save and manage custom creations locally, and immediately play the level in an interactive 60 FPS physics engine with procedural sound effects and particle polish.

### The Core Player Journey:
```
[ 1. DRAW ] ➔ [ 2. ANALYZE / QUICK PLAY ] ➔ [ 3. REVIEW SCENE ] ➔ [ 4. PLAY LEVEL ] ➔ [ 5. SAVE / RETRY / EDIT ]
```

1. **DRAW:** Hand-sketch your game level on the interactive studio canvas with 5 semantic element types:
   - **Ground (Emerald):** Solid walkable terrain and collidable platforms.
   - **Hazard (Crimson):** Spikes, traps, and lethal danger zones that trigger level restart.
   - **Trampoline (Cyan):** High-restitution bounce surfaces launching the player into the air.
   - **Coin (Gold):** Collectible rewards tracked in real-time on the game HUD.
   - **Goal (Purple):** Level finish flag / portal triggering the victory state.
2. **ANALYZE WITH IMAGE AI OR INSTANT LOCAL PHYSICS:**
   - **Live Gemini Vision (`gemini-vision`):** Sends the serialized PNG and stroke blueprint to Google Gemini 3.8 Flash via the `@google/genai` SDK on the backend to assess visual style, level difficulty, player tuning, and semantic geometry.
   - **Instant Local Vector (`local-vector`):** Zero-latency deterministic conversion directly converting normalized stroke coordinates into segmented Phaser physics platforms, bounce pads, and obstacles without needing an API key or internet access.
   - **Deterministic Fallback (`mock-fallback`):** Transparently used on the server if `GEMINI_API_KEY` is omitted or API calls fail, with explicit disclaimers.
3. **REVIEW SCENE:** Inspect detected elements, bounding boxes, level diagnostics, and safety assumptions before launching.
4. **PLAY LEVEL WITH SOUND & PARTICLES:** Jump directly into a responsive Phaser 4 2D platformer running Arcade Physics. Control the player with `[A]/[D]` or `[←]/[→]` (or on-screen touch controls), jump with `[W]`, `[Space]`, or `[↑]`, collect coins with celebratory chimes and sparkle bursts, bounce on trampolines with boing sounds and shockwave rings, avoid hazards, and reach the finish flag with victory fanfare and confetti.
5. **SAVE, RETRY & MANAGE CREATIONS:** Save your custom sketches and levels to browser `localStorage` in the **My Creations** gallery. Load any level back into the editor, play saved levels directly, duplicate levels, or rename them.

---

## 📜 2. Hackathon Compliance & Event Window Verification

* **Hackathon:** **Banana Hacks 2026**
* **Event Window:** October 9, 2026 – October 12, 2026
* **Authorized Start Window:** Development and commits initiated strictly within the authorized hackathon timeframe (Current timestamp: October 10, 2026).
* **Theme Alignment:** **Image AI** — Integrating multimodal computer vision and sketch image understanding to generate playable 2D game levels.
* **Code Integrity:** All code in this repository was initiated and developed from scratch during the hackathon window. No legacy project files or pre-event code were used.

---

## 🛠 3. Technical Direction & Architecture

The application is structured into decoupled, modular layers:

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Declarative UI, state machines, and reactive controls |
| **Build Tooling** | [Vite 8](https://vite.dev/) | Sub-second HMR and optimized bundler with code-split Phaser chunk |
| **Styling & Design System** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern glassmorphism, responsive canvas HUD, dark theme |
| **2D Game Engine** | [Phaser 4](https://phaser.io/) (Arcade Physics) | 60 FPS platformer physics, segmented platforms, restitution trampolines, coins, hazards |
| **Procedural Audio** | Web Audio API (`audioService.ts`) | Zero-asset retro synthesizer for jumps, bounces, coins, hazards, fanfare, and clicks |
| **Visual Particles** | Phaser Procedural Particle Emitters | Footstep dust puffs, landing bursts, trampoline rings, coin sparkles, victory confetti |
| **Persistence Layer** | `localStorage` + Zod (`creationStorage.ts`) | Local level gallery with schema validation, recovery from bad records, and CRUD |
| **Backend API** | [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) | REST API for image receiving, processing, and CORS management |
| **Schema Validation** | [Zod](https://zod.dev/) | Strict end-to-end runtime validation for scene contracts and env configs |
| **Image-AI Service** | [`@google/genai`](https://www.npmjs.com/package/@google/genai) | Official Google GenAI SDK powered by `gemini-3.8-flash` |

---

## 📁 4. Folder Structure

```text
DRAW2PLAY/
├── .env.example                       # Example environment variables (GEMINI_API_KEY, PORT, etc.)
├── .gitignore                         # Git exclusion rules (ignores .env, node_modules, dist)
├── .oxlintrc.json                     # Oxlint configuration
├── README.md                          # Full specification, concept, setup, stack, AI disclosure
├── index.html                         # Web entry point
├── package.json                       # Dependencies & scripts
├── tsconfig.json                      # Root TypeScript configuration with references
├── tsconfig.app.json                  # Frontend TypeScript settings
├── tsconfig.node.json                 # Tooling TypeScript settings
├── tsconfig.server.json               # Backend TypeScript settings
├── vite.config.ts                     # Vite + Tailwind + /api proxy + Phaser chunking
│
├── server/                            # Node.js + Express Backend API
│   ├── config.ts                      # Zod-validated environment configuration
│   ├── index.ts                       # Express server entry point & middleware
│   ├── routes/
│   │   ├── ai.routes.ts               # POST /api/ai/analyze-level & /analyze-character
│   │   └── health.routes.ts           # GET /api/health
│   ├── services/
│   │   ├── gemini.service.ts          # Gemini 3.8 Flash Multimodal Vision integration
│   │   └── mock.service.ts            # Deterministic heuristic service for offline dev/test
│   └── schemas/
│       ├── character.schema.ts        # Zod schema for character analysis output
│       └── level.schema.ts            # Zod schema for level vision analysis output
│
├── src/                               # Frontend Application
│   ├── assets/                        # Static SVG and image assets
│   ├── components/                    # Modular React components
│   │   ├── canvas/
│   │   │   └── InteractiveCanvas.tsx  # HTML5 Canvas with DPR, normalized vectors & loadStrokes
│   │   ├── game/
│   │   │   └── PhaserGameView.tsx     # Phaser 4 game lifecycle, HUD, Win/Lose overlays & touch D-pad
│   │   ├── modals/                    # Studio Dialogs & Confirmation Modals
│   │   │   ├── AnalyzePreparationModal.tsx  # Synthesis modal (Gemini Vision vs. Instant Local Physics)
│   │   │   ├── ClearConfirmModal.tsx        # Destructive clear action confirmation
│   │   │   ├── EmptyCanvasAlertModal.tsx    # Empty sketch alert with starter blueprints
│   │   │   └── ExportModal.tsx              # PNG & JSON structured export dialog
│   │   ├── studio/                    # Studio Components
│   │   │   ├── BottomStatusBar.tsx    # Live tool, element, dimensions, and drawing status
│   │   │   ├── MyCreationsModal.tsx   # Persistent level gallery with search, play, duplicate, delete
│   │   │   ├── ScenePanel.tsx         # Real-time stroke counts, specs & AI configuration status
│   │   │   ├── SketchToolbar.tsx      # Select, Brush, Eraser, sizes & 5 semantic elements
│   │   │   └── TopBar.tsx             # Studio wordmark, undo/redo, clear, export, quick play, creations
│   ├── game/                          # Phaser 4 Game Engine & Physics
│   │   ├── config.ts                  # Phaser 4 Arcade Physics configuration factory
│   │   ├── sceneConverter.ts          # Deterministic sketch-to-game scene geometry converter
│   │   └── scenes/
│   │       └── MainScene.ts           # Playable Phaser scene with particles, audio, hero, coins, hazards
│   ├── services/
│   │   ├── api.ts                     # Frontend API client (health check & level analysis)
│   │   ├── audioService.ts            # Procedural Web Audio API sound synthesizer
│   │   └── creationStorage.ts         # Persistent browser storage with Zod schema validation
│   ├── types/
│   │   ├── creation.ts                # Saved creation Zod schema and TypeScript contract
│   │   ├── game.ts                    # Shared game types & character schemas
│   │   ├── scene.ts                   # Validated Playable 2D Game Scene contract & Zod schemas
│   │   └── sketch.ts                  # Typed vector model (NormalizedPoint, SketchStroke, Document)
│   ├── utils/
│   │   ├── geometryExtractor.ts       # Geometric bounding boxes, centroids, and contour lengths
│   │   └── sketchSerializer.ts        # Vector rendering, normalization, PNG/JSON export & deterministic summaries
│   ├── App.tsx                        # Root React studio & game view coordinator with save toasts
│   ├── main.tsx                       # React DOM entry point
│   └── index.css                      # Tailwind CSS v4 entry point & design tokens
│
└── test/
    ├── sanity.test.ts                 # Sanity test suite for schemas, mock AI, and server config (5 tests)
    ├── sketch.test.ts                 # Vector geometry, undo/redo, normalization, JSON export tests (12 tests)
    ├── scene.test.ts                  # Playable physics scene conversion, segmentation & provenance tests (10 tests)
    └── storage.test.ts                # Persistent storage CRUD, audio resilience & schema validation tests (10 tests)
```

---

## 🤖 5. AI-Tool Disclosure & Provenance Integrity

In accordance with official hackathon rules and fair play policies:
- **Development Assistant:** Developed with the assistance of Google DeepMind's Antigravity AI coding assistant for project scaffolding and pair-programming.
- **In-Game Image AI:** Powered by the official Google Gemini Vision SDK (`@google/genai`) using `gemini-3.8-flash` for multimodal sketch analysis.
- **Strict Provenance Labeling:**
  - `gemini-vision`: Only returned and displayed when a genuine successful Google Gemini Vision API response is received.
  - `local-vector`: Explicitly displayed when the user plays using instant deterministic local vector conversion.
  - `mock-fallback`: Returned when the mock service is used due to an unconfigured or failing API key, clearly labelled with an explanatory notice. We never present mock output as Gemini analysis.

---

## 🚀 6. Installation & Execution Commands

### Prerequisites
- Node.js (v18.0 or higher, tested on Node v25)
- npm (v9.0+)

### Commands

```bash
# 1. Install all dependencies
npm install

# 2. Run Complete Test Suite (37 automated tests across 4 suites)
npm test

# 3. Run Code Linter (Oxlint with 0 warnings)
npm run lint

# 4. Build for Production (TypeScript typecheck + Vite code-split bundle)
npm run build

# 5. Start Full Development Environment (Frontend + Backend concurrently)
npm run dev

# Or start frontend and backend independently:
npm run dev:client   # Runs Vite on http://localhost:5173
npm run dev:server   # Runs Express API on http://localhost:3001
```

---

## 🔊 7. Procedural Game Audio & Controls

Draw2Play AI uses the browser **Web Audio API** to generate all sound effects synthetically without loading any external MP3 or WAV files:

- **Jump (`playJump`):** Dynamic rising frequency sweep (160Hz ➔ 460Hz) with triangle wave.
- **Trampoline Bounce (`playBounce`):** Springy boing modulation (180Hz ➔ 680Hz ➔ 320Hz) with sine wave.
- **Coin Collection (`playCoin`):** Bell-like two-tone chime (B5 at 987Hz ➔ E6 at 1318Hz).
- **Hazard Collision (`playHazard`):** Downward crunchy buzz (220Hz ➔ 55Hz) with lowpass filter sweep.
- **Victory Fanfare (`playVictory`):** Celebratory major arpeggio (C5 ➔ E5 ➔ G5 ➔ C6).
- **Button Clicks (`playClick`):** Subtle soft micro-pop for UI controls.

### Audio Settings:
- Click the **Volume** icon in the TopBar or in the Game View HUD to toggle Mute/Unmute.
- Mute preferences are persisted in browser `localStorage`.
- Sound is initialized strictly after the first user gesture to comply with browser autoplay policies.

---

## 💾 8. My Creations Persistent Gallery

Every custom level you draw can be saved directly in your browser:
- **Save Level Button:** Click "Save Level" in the studio TopBar, press `Ctrl+S`, or click "Save Creation" on the game victory overlay.
- **My Creations Modal:** Click "Creations" in the studio TopBar to open the gallery.
  - **Play:** Launch any saved level directly in Phaser with one click.
  - **Edit:** Load the saved vector strokes back into the interactive canvas to modify them.
  - **Rename:** Edit level names inline.
  - **Duplicate:** Clone a level to experiment with variations without losing the original.
  - **Delete:** Remove levels with an inline confirmation prompt.
  - **Search:** Instant filter by level name.
- **Data Integrity:** All stored records are strictly validated against `SavedCreationSchema` using Zod. Corrupted records are isolated without wiping other creations.

---

## 🎮 9. Responsive Gameplay & Controls

The game is optimized for both desktop and mobile/touch devices:
- **Desktop Keyboard:**
  - Move: `[A]` / `[D]` or `[←]` / `[→]`
  - Jump: `[W]`, `[Space]`, or `[↑]`
- **Mobile & Touch Controls:**
  - On-screen touch D-Pad (`◀` / `▶`) and Jump button (`▲ JUMP`) with `touch-action: none` to prevent accidental mobile page scrolling.
  - Toggle on-screen touch controls anytime via the Gamepad icon in the HUD.

---

## 🧪 10. Automated Test Suite Results

Run `npm test` to execute all 4 test suites (**37/37 automated tests passing**):

```
> tsx test/sanity.test.ts && tsx test/sketch.test.ts && tsx test/scene.test.ts && tsx test/storage.test.ts

🧪 Starting Draw2Play AI Phase 0 Sanity Test Suite...
▶ Test 1: CharacterAttributesSchema validates correctly ✓
▶ Test 2: AnalyzeCharacterRequestSchema validation ✓
▶ Test 3: Server CharacterAnalysisOutputSchema validation ✓
▶ Test 4: Mock heuristic service generation ✓
▶ Test 5: Server configuration values ✓
🎉 ALL 5 SANITY TESTS PASSED SUCCESSFULLY!

🧪 Starting Draw2Play Phase 1 Advanced Vector & Geometry Test Suite...
▶ Test 1: Bounding-box calculations ✓
▶ Test 2: Normalized coordinate validation ✓
▶ Test 3: Centroid calculation ✓
▶ Test 4: Stroke-length calculation ✓
▶ Test 5: Empty and malformed strokes ✓
▶ Test 6: Single-point and two-point strokes ✓
▶ Test 7: Semantic type preservation ✓
▶ Test 8: Undo/redo data integrity ✓
▶ Test 9: Serialization and parsing ✓
▶ Test 10: Exported coordinate bounds ✓
▶ Test 11: Empty-canvas image preparation rejection ✓
▶ Test 12: Canvas resize preserving the document ✓
🎉 ALL 12 DRAW2PLAY GEOMETRY & SKETCH TESTS PASSED SUCCESSFULLY!

🧪 Starting Draw2Play Phase 3 Playable Physics & Level Scene Test Suite...
▶ Test 1: PlayableGameSceneSchema validates contract ✓
▶ Test 2: Invalid Scene Schema Rejection ✓
▶ Test 3: Ground Stroke Segmentation (prevents giant bounding boxes) ✓
▶ Test 4: Full Multi-Element Level Conversion ✓
▶ Test 5: Fallback & Diagnostics Warnings (missing Ground & Goal) ✓
▶ Test 6: Player Spawn Placement Logic ✓
▶ Test 7: Normalized to World Coordinate Scaling ✓
▶ Test 8: Strict Provenance Labeling (gemini-vision, local-vector, mock-fallback) ✓
▶ Test 9: Server Gemini Level Analysis Output Schema ✓
▶ Test 10: Server Mock Level Analysis Generator ✓
🎉 ALL 10 PHASE 3 PLAYABLE PHYSICS & SCENE TESTS PASSED SUCCESSFULLY!

🧪 Starting Draw2Play Phase 4 Storage, Audio & Polish Test Suite...
▶ Test 1: Save Creation and validate stored record ✓
▶ Test 2: Update Existing Creation ✓
▶ Test 3: Rename Creation ✓
▶ Test 4: Duplicate Creation ✓
▶ Test 5: Delete Creation ✓
▶ Test 6: Export Creation as JSON ✓
▶ Test 7: Schema Validation Rejection on Corrupted Record ✓
▶ Test 8: Procedural Audio Service Resilience ✓
▶ Test 9: Saved Playable Scene Ready for Immediate Launch ✓
▶ Test 10: Clean Storage Reset ✓
🎉 ALL 10 PHASE 4 STORAGE & POLISH TESTS PASSED SUCCESSFULLY!

🧪 Starting Draw2Play Phase 5 Natural Language Transformation Test Suite...
▶ Test 1: Transformation Operation Schema Validation ✓
▶ Test 2: Invalid Operations Rejection ✓
▶ Test 3: Original Scene Immutability ✓
▶ Test 4: Real Ice Friction & Acceleration Physics ✓
▶ Test 5: Difficulty Presets Mechanics ✓
▶ Test 6: Coin and Hazard Placement Boundaries ✓
▶ Test 7: Deterministic Natural Language Local Rule Parser ✓
▶ Test 8: Unsupported Instruction Handling ✓
▶ Test 9: Saving Transformed Level in My Creations ✓
▶ Test 10: Backward Compatibility with Existing Un-themed Scenes ✓
🎉 ALL 10 PHASE 5 TRANSFORMATION TESTS PASSED SUCCESSFULLY!
```

---

## 🎨 11. Phase 5: Natural Language Level Transformation & AI Polish

Draw2Play AI enables creators to transform playable levels using plain English instructions without modifying the underlying vector sketch.

### Transformation Loop:
1. **Draw** on the interactive studio canvas.
2. **Play** immediately with Quick Play or Vision synthesis.
3. **Describe a Change** in plain English (e.g. *"Make this level icy and slippery with falling snow"*).
4. **Preview** the side-by-side comparison of themes, friction, coins, and difficulty.
5. **Apply & Play** the transformed level immediately, or **Apply & Save** as a new creation.

### Supported Visual Themes:
- **Default / Studio:** Emerald platforms, dark navy grid, balanced physics.
- **Forest:** Earthy mossy platforms, canopy background, ambient falling leaves.
- **Ice:** Crystalline sapphire platforms, arctic gradient, ambient snow, and **authentic low-friction (0.12) ice sliding physics**.
- **Lava:** Volcanic basalt platforms, obsidian gradient, ambient floating embers, molten lava hazards.
- **Space:** Lunar surface platforms, deep cosmic void, ambient twinkling stardust, floaty low gravity (380).
- **Cyberpunk:** Neon grid steel platforms, magenta/cyan rims, ambient cyber sparks, enhanced run speed.

### Difficulty Presets:
- **Easy:** Reduces lethal hazards by 50%, buffs player jump clearance, adds bonus coins.
- **Normal:** Balanced standard challenge.
- **Hard:** Adds 2-3 additional hazard obstacles along platform surfaces, tightens player tempo.

### Provenance Transparency:
- **`gemini-transformed`:** Produced by live Gemini API call on the server.
- **`local-rules-transformed`:** Produced by the deterministic local natural language rule engine.

---

## 🛑 12. Phase Status & Limitations

* **Phase 0 Status:** **COMPLETE & VERIFIED** (Scaffolding, schemas, health route).
* **Phase 1 Status:** **COMPLETE & VERIFIED** (Studio interface, layouts, navigation).
* **Phase 2 Status:** **COMPLETE & VERIFIED** (Interactive canvas, 5 element types, vector normalization, history, presets).
* **Phase 3 Status:** **COMPLETE & VERIFIED** (Playable physics engine, stroke segmentation, Gemini Vision integration, local vector fallback).
* **Phase 4 Status:** **COMPLETE & VERIFIED** (Procedural Web Audio API sound engine, Phaser particle systems, persistent My Creations gallery, mobile touch controls).
* **Phase 5 Status:** **COMPLETE & VERIFIED** (Natural language level transformation, 5 themes with ambient particles, ice friction, difficulty presets).
* **Phase 6.1 Status:** **COMPLETE & VERIFIED**
  * **Multimodal Intake Workflow:** Upload game screenshots, concept art, or extract selected video frames directly in-browser using HTML5 `<video>` and `<canvas>`.
  * **Safe Upload Service (`upload.service.ts`):** Magic byte sniff validation (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF..WEBP`), dimension bounds (max 4096px), file size limits (max 10MB), path traversal neutralization, and internal asset abstraction.
  * **Reference Vision Analysis (`referenceAnalysis.service.ts`):** Deduces game category (`voxel`, `2d-platformer`, `isometric`, `3d-world`, `top-down-2d`, `puzzle`), camera perspective, visual style, palette, visible objects, and inferred mechanics with observation grounding.
  * **Truth in Advertising:** Never fabricates AI analysis; clearly labels provenance (`gemini-vision`, `mock-heuristic`, `manual-input`). Acknowledges single reference frames cannot reconstruct full 3D voxel worlds, interior chunk generation, or hidden source physics.
  * **Plan Routing & Execution:**
    * **2D Platformers:** Generates validated `GameGenerationPlan` and immediately launches playable levels into the active Phaser 2D engine.
    * **Voxel / 3D Games:** Formulates a structured `GameGenerationPlan` with `deferred-future-engine` status, documents missing 3D pipeline requirements (voxel coordinate managers, raymarching, depth buffer), enables JSON export, and preserves the plan in My Creations for the upcoming 3D engine phase.
  * **Verification:** 57 automated tests passing (100%), Oxlint clean (0 warnings, 0 errors), production build passes in 645ms.

### Known Limitations:
- AudioContext requires an initial user interaction (click or tap) to unlock audio playback per standard browser security policies.
- Without a valid `GEMINI_API_KEY` in `.env`, the system automatically falls back to deterministic heuristic reference analysis (`mock-heuristic`), clearly indicated in the UI.
- Browser `localStorage` is subject to device storage quotas (typically ~5MB); levels and plans are stored as compact vector coordinates to maximize capacity.
- Phase 6.1 focuses on reference intake, game-type detection, and plan formulation. Full 3D voxel rendering requires a dedicated 3D engine scheduled for a subsequent phase.

### Recommended Next Step (Phase 6.2):
- **Structured 3D Voxel Engine Pipeline:** Three.js / WebGL raymarching voxel prototype to consume deferred Phase 6.1 generation plans.
