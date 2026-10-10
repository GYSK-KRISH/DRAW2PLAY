# 🍌 Draw2Play AI — Hackathon Project Foundation

> **From Sketch to Playable 2D Game with Real Image AI & Arcade Physics.**  
> Built for the **Banana Hacks 2026** Hackathon | **Theme:** Image AI (October 9–12, 2026)

---

## 📖 1. Project Vision

**Draw2Play AI** empowers players to draw a custom 2D platformer level by hand, optionally analyze the sketch with Google Gemini Vision AI to interpret visual theme, geometry, and physics tuning, and immediately play the level in an interactive 60 FPS physics engine.

### The Core Player Journey:
```
[ 1. DRAW ] ➔ [ 2. ANALYZE WITH IMAGE AI / INSTANT LOCAL ] ➔ [ 3. REVIEW SCENE ] ➔ [ 4. PLAY LEVEL ] ➔ [ 5. RETRY / EDIT ]
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
4. **PLAY LEVEL:** Jump directly into a responsive Phaser 4 2D platformer running Arcade Physics. Control the player with `[A]/[D]` or `[←]/[→]`, jump with `[W]`, `[Space]`, or `[↑]`, collect coins, bounce on trampolines, dodge hazards, and reach the finish flag.
5. **RETRY / EDIT AGAIN:** Win and defeat overlays provide instant level restart or a one-click return to the studio editor to refine the sketch.

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
| **Backend API** | [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) | REST API for image receiving, processing, and CORS management |
| **Schema Validation** | [Zod](https://zod.dev/) | Strict end-to-end runtime validation for scene contracts and env configs |
| **Image-AI Service** | [`@google/genai`](https://www.npmjs.com/package/@google/genai) | Official Google GenAI SDK powered by `gemini-3.8-flash` |
| **Local Physics Converter** | `sceneConverter.ts` | Deterministic stroke segmentation and world scaling with fallback safety floors and goals |

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
│   │   │   └── InteractiveCanvas.tsx  # HTML5 Canvas with DPR, normalized vectors & blueprints
│   │   ├── game/
│   │   │   └── PhaserGameView.tsx     # Phaser 4 game lifecycle, HUD, Win/Lose overlays & restart
│   │   ├── modals/                    # Studio Dialogs & Confirmation Modals
│   │   │   ├── AnalyzePreparationModal.tsx  # Synthesis modal (Gemini Vision vs. Instant Local Physics)
│   │   │   ├── ClearConfirmModal.tsx        # Destructive clear action confirmation
│   │   │   ├── EmptyCanvasAlertModal.tsx    # Empty sketch alert with starter blueprints
│   │   │   └── ExportModal.tsx              # PNG & JSON structured export dialog
│   │   ├── studio/                    # Studio Components
│   │   │   ├── BottomStatusBar.tsx    # Live tool, element, dimensions, and drawing status
│   │   │   ├── ScenePanel.tsx         # Real-time stroke counts, specs & AI configuration status
│   │   │   ├── SketchToolbar.tsx      # Select, Brush, Eraser, sizes & 5 semantic elements
│   │   │   └── TopBar.tsx             # Studio wordmark, undo/redo, clear, export, quick play & analyze
│   ├── game/                          # Phaser 4 Game Engine & Physics
│   │   ├── config.ts                  # Phaser 4 Arcade Physics configuration factory
│   │   ├── sceneConverter.ts          # Deterministic sketch-to-game scene geometry converter
│   │   └── scenes/
│   │       └── MainScene.ts           # Playable Phaser scene with platforms, hero, coins, trampolines, hazards
│   ├── services/
│   │   └── api.ts                     # Frontend API client (health check & level analysis)
│   ├── types/
│   │   ├── game.ts                    # Shared game types & character schemas
│   │   ├── scene.ts                   # Validated Playable 2D Game Scene contract & Zod schemas
│   │   └── sketch.ts                  # Typed vector model (NormalizedPoint, SketchStroke, Document)
│   ├── utils/
│   │   ├── geometryExtractor.ts       # Geometric bounding boxes, centroids, and contour lengths
│   │   └── sketchSerializer.ts        # Vector rendering, normalization, PNG/JSON export & deterministic summaries
│   ├── App.tsx                        # Root React studio & game view coordinator
│   ├── main.tsx                       # React DOM entry point
│   └── index.css                      # Tailwind CSS v4 entry point & design tokens
│
└── test/
    ├── sanity.test.ts                 # Sanity test suite for schemas, mock AI, and server config (5 tests)
    ├── sketch.test.ts                 # Vector geometry, undo/redo, normalization, JSON export tests (12 tests)
    └── scene.test.ts                  # Playable physics scene conversion, segmentation & provenance tests (10 tests)
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

# 2. Run Complete Test Suite (27 automated tests across 3 suites)
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

## 🔑 7. Environment Variables & Gemini API Configuration

Create a `.env` file in the project root (see [`.env.example`](file:///.env.example)):

```ini
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
FRONTEND_URL=http://localhost:5173
```

### Security Rules:
- `GEMINI_API_KEY` is read **exclusively on the backend server** (`server/config.ts`).
- It is never exposed in client bundles or Vite environment variables (`VITE_*`).
- `.env` is listed in `.gitignore` and never committed to source control.

### Feature Availability:
- **With `GEMINI_API_KEY` configured:** Clicking "Analyze Sketch" ➔ "Analyze with Gemini Vision" sends the sketch image to Google Gemini 3.8 Flash, which enriches the level with thematic naming, custom difficulty rating, player physics tuning, and visual feedback (`source: gemini-vision`).
- **Without `GEMINI_API_KEY`:** 
  - **Quick Play button:** Instantly launches the level with local vector physics in <5ms (`source: local-vector`).
  - **Analyze Sketch modal:** Provides an "Instant Local Physics" button to play immediately with local vector conversion, or demonstrates the backend mock fallback path (`source: mock-fallback`).

---

## 🎮 8. How to Draw and Play a Level

1. **Draw Your Level:**
   - Select **Ground** (green) and draw horizontal or terraced platforms.
   - Select **Hazard** (red) and draw spikes or danger zones.
   - Select **Trampoline** (cyan) to draw bounce pads for extra jump height.
   - Select **Coin** (gold) to place collectible reward tokens.
   - Select **Goal** (purple) to place the victory finish flag.
   - *(Optional: Click preset blueprints like "Rolling Hills" or "Spike Canyon" from the Empty Sketch dialog)*.
2. **Launch the Game:**
   - **Method A (Instant):** Click the green **"Quick Play"** button in the top bar to play immediately with local physics.
   - **Method B (AI Synthesis):** Click **"Analyze Sketch"** in the top bar ➔ Choose **"Analyze with Gemini Vision"** or **"Instant Local Physics"** ➔ Click **"Play Level Now!"**.
3. **Control Your Hero:**
   - **Move Left / Right:** `[A]` / `[D]` or `[←]` / `[→]`
   - **Jump:** `[W]`, `[Space]`, or `[↑]`
   - **Collect Coins:** Walk or jump through coins to increase your score (+10 pts each).
   - **Bounce:** Land on top of trampolines to trigger a high-velocity upward launch.
   - **Avoid Hazards:** Touching a hazard triggers a crash state and camera shake. Click "Retry Level" to try again.
   - **Reach the Goal:** Touch the purple Goal portal to trigger the "Level Complete!" victory overlay.
   - **Back to Editor:** Click "Back to Editor" to modify or extend your drawing anytime.

---

## 🧪 9. Automated Test Suite Results

Run `npm test` to execute all 3 test suites (**27/27 automated tests passing**):

```
> tsx test/sanity.test.ts && tsx test/sketch.test.ts && tsx test/scene.test.ts

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
```

---

## 🛑 10. Phase Status & Limitations

* **Phase 0 Status:** **COMPLETE & VERIFIED** (Scaffolding, schemas, health route).
* **Phase 1 Status:** **COMPLETE & VERIFIED** (Studio interface, layouts, navigation).
* **Phase 2 Status:** **COMPLETE & VERIFIED** (Interactive canvas, 5 element types, vector normalization, history, presets).
* **Phase 3 Status:** **COMPLETE & VERIFIED**
  * Playable 2D platformer engine built with Phaser 4 Arcade Physics.
  * Ground stroke segmentation: freehand strokes are broken into connected platform slabs rather than a single giant bounding box.
  * Hazard collision triggering screen shake and defeat overlay.
  * Elastic trampoline pads with dynamic restitution boost when landed on from above.
  * Overlap-based collectible coins updating live score and coins collected HUD.
  * Goal detection with victory overlay and score recap.
  * Seamless switching between Studio Editor and Playable Game View.
  * Provenance-tracked Gemini Vision backend route (`gemini-3.8-flash`) via official `@google/genai` SDK.
  * Zero-latency Local Vector physics conversion ensuring 100% playable game without an API key.
  * 27 automated unit tests passing, Oxlint clean (0 warnings), and production build verified with code-split Phaser bundle.

### Known Limitations:
- Real-time Gemini Vision requires an active `GEMINI_API_KEY` with Google AI Studio quota. When absent, the application gracefully provides the local vector and mock fallback paths with explicit notices.
- Curved strokes with high point counts are segmented into linear platform segments (maximum 40 physics slabs per stroke to preserve 60 FPS performance).
- Player jump is restricted to grounded state or bounce surfaces (no infinite double jumps).

### Recommended Next Step (Phase 4):
- **User Playtesting, Audio & Polish:** Add procedural Web Audio effects (jump, bounce, coin chime, defeat buzzer, victory fanfare), particle trails on hero movement, and level blueprint saving/loading to browser LocalStorage.
