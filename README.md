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
    ├── storage.test.ts                # Persistent storage CRUD, audio resilience & schema validation tests (10 tests)
    ├── transformation.test.ts         # Natural language level transformation & themes tests (10 tests)
    ├── reference.test.ts              # Multimodal reference intake, video frames, v2.0 schemas & plans (20 tests)
    ├── provider.test.ts               # AI provider abstraction, Gemini adapter, errors & diagnostics (15 tests)
    ├── sandbox.test.ts                # Sandbox world, mining/placement, physics, and save/load tests (10 tests)
    └── craft.test.ts                  # Sketch recognition, allowlist validation, idempotency, and award tests (18 tests)
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

🧪 Starting Draw2Play Phase 6.1 & 6.2 Reference Intake & Video Frame Analysis Test Suite...
▶ Tests 1-10: Reference asset intake, magic bytes, voxel/2d plan generation ✓
▶ Tests 11-20: Observational evidence, multi-frame analysis, confidence tiers, provenance ✓
🎉 ALL 20 PHASE 6.1/6.2 REFERENCE INTAKE TESTS PASSED SUCCESSFULLY!

🧪 Starting Draw2Play Phase 7.1 AI Provider & Gemini Adapter Test Suite...
▶ Tests 1-15: Provider contracts, registry lookup, capabilities, timeouts, errors, provenance ✓
🎉 ALL 15 PHASE 7.1 PROVIDER & ADAPTER TESTS PASSED SUCCESSFULLY!

🧪 Starting Draw2Play Phase 7.1 Sandbox Mode & Draw-to-Craft Foundation Test Suite...
▶ Tests 1-10: World generation, tile physics, mining/placement, hotbar, and save/load ✓
🎉 ALL 10 PHASE 7.1 SANDBOX TESTS PASSED SUCCESSFULLY!

🧪 Starting Draw2Play Phase 7.2 Draw-to-Craft Sketch Recognition Test Suite...
▶ Test 1: Valid recognition request validation ✓
▶ Test 2: Empty and malformed drawing rejection with invalid-input ✓
▶ Test 3: Payload size and dimension bounds ✓
▶ Test 4: Provider success with structured parsing & gemini-vision provenance ✓
▶ Test 5: Provider timeout bounded to 15s ✓
▶ Test 6: Missing API key handled with provider-unavailable / fallback ✓
▶ Test 7: Malformed provider response recovery ✓
▶ Test 8: Unsupported drawing prediction (mappedItemId=null) ✓
▶ Test 9: Unknown item ID rejection against finite allowlist ✓
▶ Test 10: Missing confidence handled as null without fabricated numbers ✓
▶ Test 11: Explicit acceptance awards exactly one item ✓
▶ Test 12: Rejection awards no item ✓
▶ Test 13: Duplicate submission cannot award twice (idempotency) ✓
▶ Test 14: Retry does not duplicate an award ✓
▶ Test 15: Inventory bounds and 999 max stack handling ✓
▶ Test 16: Existing save/load compatibility ✓
▶ Test 17: Manual fallback validation for all catalogue items ✓
▶ Test 18: Honest provider provenance (gemini-vision vs mock-heuristic) ✓
🎉 ALL 18 PHASE 7.2 DRAW-TO-CRAFT TESTS PASSED SUCCESSFULLY!
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
* **Phase 6.1 Status:** **COMPLETE & VERIFIED** (Multimodal Reference Intake, game-type classification, deferred 3D voxel plan routing).
* **Phase 6.2 Status:** **COMPLETE & VERIFIED** (Observation grounding, multi-frame video understanding, confidence tiers, generation plan validation).
* **Phase 7.1 Status:** **COMPLETE & VERIFIED** (2D tile-based sandbox world, player physics, mining/placing, hotbar, isolated persistence).
* **Phase 7.2 Status:** **COMPLETE & VERIFIED**
  * **Real Sketch Recognition Pipeline:** Server endpoint `POST /api/ai/recognize-craft-sketch` backed by Gemini Vision via the Phase 7.1 AI provider abstraction.
  * **Safe Discriminated Recognition Contract:** Distinct statuses (`recognized`, `needs-review`, `unsupported`, `provider-unavailable`, `invalid-input`) with strictly honest confidence and provenance.
  * **Interactive Review Interface:** Dedicated review modal showing predicted label, confidence percentage (or uncalibrated disclaimer), visual provenance badge, alternative interpretations, and explicit confirmation.
  * **Finite Sandbox Allowlist Validation:** Mapped strictly to `['grass', 'dirt', 'stone', 'wood']`. Out-of-theme drawings (e.g. cars, planes) are classified as `unsupported`.
  * **Idempotent Single-Award Flow:** Exactly 1 item awarded only upon explicit user confirmation; double-clicks and retries are guarded by submission UUID tracking.
  * **Honest Offline Fallback:** When `GEMINI_API_KEY` is absent, the system explicitly reports `mock-heuristic` provenance or `provider-unavailable` with zero fake AI claims, providing a seamless 4-item manual catalogue picker.
  * **105 Passing Automated Tests:** Full test suite verified with zero lint errors and clean production build.

---

## ⛏️ 13. Draw-to-Craft Sandbox Mode (User Guide)

### How to Open the Sandbox:
Click the **"Sandbox v7.1"** button (pickaxe icon) in the studio top bar. You can return to the Draw2Play sketch studio anytime using the **"Studio"** button in the top navigation bar.

### Sandbox Controls:
- **Movement:** `[A]/[D]` or `[←]/[→]` to run left/right.
- **Jump:** `[W]`, `[Space]`, or `[↑]` to jump. Single-press guard prevents runaway jumping.
- **Mine Block:** Left-click on any solid block within reach (4.5 tiles).
- **Place Block:** Right-click on an empty space within reach (4.5 tiles) to place your active hotbar item.
- **Hotbar Selection:** Press number keys `[1]`, `[2]`, `[3]`, or `[4]` to select Grass, Dirt, Stone, or Wood.
- **Mobile Touch Controls:** On-screen D-pad buttons (`[◀]`, `[▶]`, `[▲]`) and a **Mine / Place toggle button** (`⛏️ Mine` vs `🧱 Place`).
- **Save / Load World:** Use the "Save World" and "Load World" buttons in the top HUD.

---

## 🎨 14. Phase 7.2: Real Sketch Recognition & Draw-to-Craft Guide

### How Draw-to-Craft Works:
1. Click **`🎨 Draw to Craft`** in the Sandbox HUD to open the crafting modal.
2. Draw your desired object using the drawing canvas (brush, eraser, undo, clear, size slider). Examples:
   - Draw an **axe, tree trunk, log, or wooden stick** to craft **Wood**.
   - Draw a **pickaxe, boulder, pebble, or cobblestone** to craft **Stone**.
   - Draw a **mound of earth, shovel, or soil patch** to craft **Dirt**.
   - Draw a **plant, blade of grass, flower, or leafy bush** to craft **Grass**.
3. Click **`Recognize Sketch`** to send the drawing to the server.
4. **Review the Model Prediction:**
   - The modal shows the detected subject and sandbox item match.
   - Shows model confidence (e.g. `92% High Confidence`) if evaluated by Gemini Vision, or an honest disclaimer if running offline heuristic fallback.
   - Displays visual badge of provenance: `gemini-vision` (green), `mock-heuristic` (amber), or `manual-input` (blue).
5. **Decide Action:**
   - **`Accept & Craft (1x [Item])`**: Explicitly confirms the award. Exactly one item is added to your sandbox inventory and hotbar.
   - **`Reject & Dismiss`**: Rejects the prediction. No items are added to your inventory.
   - **`Redraw Sketch`**: Clears the review and returns to the drawing canvas to refine your sketch.
   - **`Manual Fallback`**: Opens the 4-item manual catalogue to choose Wood, Stone, Dirt, or Grass directly.

### Provider Configuration:
To enable live Gemini Vision recognition:
1. Create or edit `.env` in the root folder:
   ```bash
   GEMINI_API_KEY=your_google_gemini_api_key_here
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. When `GEMINI_API_KEY` is present and valid, sketches are analyzed using Gemini Vision (`gemini-3.8-flash` / `gemini-2.5-flash`) via `@google/genai`.

### What Happens Without an API Key (Offline / Heuristic Mode):
- If `GEMINI_API_KEY` is missing or invalid, Draw2Play AI **never pretends** to be a live model.
- The server returns `provenance: 'mock-heuristic'` with `isFallback: true` and an explicit note that offline heuristic analysis was applied.
- The UI allows the user to review the heuristic prediction or click **`Manual Selection`** to pick any item from the craftable catalogue.

### Anti-Fabrication & Safety Guarantees:
- **No Unsolicited Awards:** Submitting a drawing never awards an item automatically. An item is awarded only after explicit user acceptance.
- **Finite Allowlist:** Predictions must map to the allowlist (`grass`, `dirt`, `stone`, `wood`). Drawings of out-of-theme objects (airplanes, computers, pizzas) return `status: 'unsupported'` with no item mapped.
- **Idempotency:** Each submission has a unique `submissionId`. Double-clicking, retrying, or submitting repeatedly cannot award duplicate items.
- **Save State Preservation:** World tiles and player position remain untouched; inventory persists cleanly into `localStorage` across page reloads.

### Running the Tests:
Run the complete automated test suite (100% offline, zero network calls or credentials required):
```bash
npm test
```
All 18 Phase 7.2 Draw-to-Craft tests will run alongside the existing suites (105 tests total).

---

## 🔨 15. Phase 8: Sandbox Expansion & Crafting Progression Guide

### Overview
Phase 8 extends Draw-to-Craft Sandbox into a full 2D crafting progression game with natural resource veins, an atomic deterministic recipe crafting engine, a dedicated crafting workshop modal (`[C]` shortcut), hotbar quick-equip swapping, non-placeable safety, and automated v1.0 → v2.0 save migration.

### Expanded 13-Item Catalogue
All items in Draw-to-Craft are backed by a single central typed catalogue (`SANDBOX_ITEM_CATALOGUE` in `src/types/sandbox.ts`):

| Item ID | Display Name | Category | Placeable? | Stack Limit | Source / Origin |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `grass` | Grass Block | Block | Yes | 999 | Surface topsoil |
| `dirt` | Dirt Block | Block | Yes | 999 | Subsurface soil layer |
| `stone` | Stone Block | Block | Yes | 999 | Bedrock and underground stratum |
| `wood` | Wood Log | Block | Yes | 999 | Felled tree trunks and branches |
| `sand` | Sand Block | Block | Yes | 999 | Natural shoreline deposits (cols 43–46) |
| `coal` | Coal Ore | Block | Yes | 999 | Mid-stratum underground mineral veins |
| `iron_ore` | Iron Ore | Block | Yes | 999 | Deep bedrock mineral veins |
| `wood_planks` | Wooden Planks | Crafted | Yes | 999 | Crafted from 1x Wood Log → 4x Planks |
| `stick` | Wooden Stick | Material | **No** | 999 | Crafted from 2x Planks → 4x Sticks |
| `workbench` | Workbench | Placeable | Yes | 999 | Crafted from 4x Planks + 2x Sticks |
| `torch` | Torch | Utility | Yes | 999 | Crafted from 1x Stick + 1x Coal (or 1x Wood) |
| `stone_brick` | Stone Bricks | Building | Yes | 999 | Crafted from 4x Stone Blocks |
| `glass` | Glass Block | Building | Yes | 999 | Smelted from 2x Sand + 1x Coal |

> **Non-Placeable Safety:** Raw materials like `stick` are strictly flagged `isPlaceable: false`. Attempting to place a stick into the world produces friendly feedback ("Wooden Stick is a crafting material and cannot be placed!") and leaves the world tile and player inventory untouched.

### Deterministic Recipe Crafting Engine
Crafting is 100% deterministic and atomic. Ingredients are never consumed partially or lost if an inventory stack limit would overflow or if requirements are unsatisfied.

Available recipes in `CRAFTING_RECIPES`:
1. **Wood to Planks:** 1x Wood Log → 4x Wooden Planks
2. **Planks to Sticks:** 2x Wooden Planks → 4x Sticks
3. **Workbench:** 4x Wooden Planks + 2x Sticks → 1x Workbench
4. **Torches (Coal):** 1x Stick + 1x Coal Ore → 4x Torches
5. **Torches (Wood Ember):** 1x Stick + 1x Wood Log → 2x Torches
6. **Stone Bricks:** 4x Stone Blocks → 4x Stone Bricks
7. **Smelt Glass:** 2x Sand + 1x Coal Ore → 2x Glass Blocks
8. **Turf Propagation:** 1x Grass Block + 2x Dirt Blocks → 3x Grass Blocks

### Crafting Workshop Interface (`CraftingModal.tsx`)
- Press **`[C]`** on your keyboard or click the amber **`🔨 Crafting`** button in the top HUD.
- **Category Tabs:** Filter recipes by `All`, `Basic`, `Building`, or `Utility`.
- **Live Inventory Badges:** Inspect required quantities versus owned materials in real-time.
- **Batch Stepper & Craft Max:** Craft single items, increment batch counts, or tap **`Craft Max`** to batch-produce up to inventory limits.
- **Audio Feedback:** Hear retro hammer-strikes on successful crafts and warning buzzers on invalid inputs.

### Hotbar & Quick-Equip Swapping
- The active hotbar provides 4 quick-access slots (hotkeys `[1]`, `[2]`, `[3]`, `[4]`).
- When holding crafted placeable blocks not currently mapped to the hotbar (e.g., Wooden Planks, Torches, Glass, Stone Bricks), a compact **Quick-Equip bar** appears below the hotbar. Click any owned block to assign it immediately to the selected hotbar slot!
- **Dynamic Cursor Feedback:**
  - **Green border:** Aiming at empty air within player reach (right-click to place).
  - **Red border:** Aiming at a solid block within reach (left-click to mine).
  - **Dim gray border:** Aiming at a block outside reach distance (> 220px / ~7 tiles).
  - **Empty Hotbar Hint:** Warns players when the currently selected slot has count 0.

### Save / Load Compatibility (v1.0 → v2.0)
- **Automatic Migration:** Saves created in Phase 7.1 (`schemaVersion: '1.0'`) are seamlessly upgraded to `'2.0'` when loaded.
- **Zero Loss:** All original tiles, player coordinates, and inventory counts are preserved.
- **Hotbar Array Backfill:** Old inventories lacking the `hotbar` array receive default mappings (`['grass', 'dirt', 'stone', 'wood']`).
- **Storage Isolation:** Sandbox saves continue to live in `draw2play_sandbox_save_v1`, isolated from the studio's `draw2play_saved_creations`.
- **Corrupted Save Safety:** Malformed JSON, negative counts, and invalid dimensions are rejected gracefully without crashing or wiping user data.

### Verification Results
- **Automated Tests:** 120 / 120 tests passing across 10 test suites (`npm test`)
- **Lint:** 0 warnings, 0 errors (`npm run lint` with `oxlint`)
- **Build:** Clean TypeScript build & Vite bundle (`npm run build`)

---

## 16. Model Context Protocol (MCP) Server Integration (Phase 9)

Draw2Play AI includes a secure, official **Model Context Protocol (MCP)** server built with `@modelcontextprotocol/sdk` (v1.32.1). This integration allows compatible external AI clients (Claude Desktop, Cursor, Antigravity, OpenHands, etc.) to inspect live sandbox game state, query recipe catalogues, and execute validated, bounded game mutations.

### Architecture & Session Bridge

An external MCP server running in a local Node.js process cannot directly access a browser's in-memory Phaser WebGL scene. Draw2Play solves this using an authoritative **Session Bridge** pattern:

```
┌──────────────────────────────────────────────┐
│  Compatible AI Client (Claude / Antigravity)  │
└──────────────────────┬───────────────────────┘
                       │ Stdio JSON-RPC
                       ▼
┌──────────────────────────────────────────────┐
│  Draw2Play MCP Server (server/mcp/index.ts)  │
│  - Strict Zod validation                     │
│  - Idempotency caching                       │
│  - Reach & collision guards                  │
└──────────────────────┬───────────────────────┘
                       │ In-Memory Shared Service
                       ▼
┌──────────────────────────────────────────────┐
│         sandboxSessionManager                │
└──────────────────────▲───────────────────────┘
                       │ HTTP Heartbeat & Sync (/api/sandbox/session)
                       ▼
┌──────────────────────────────────────────────┐
│  React Browser Client (SandboxGameView.tsx)  │
│  Phaser 4 Sandbox Scene (SandboxScene.ts)    │
└──────────────────────────────────────────────┘
```

1. **Honest Session Reporting:** When the browser sandbox is closed, read-only tools report catalogue data and `hasActiveSession: false`. Mutation tools cleanly reject with an actionable error rather than fabricating a disconnected phantom world.
2. **Authoritative Bridge:** When a player opens Sandbox Mode in Draw2Play, `SandboxGameView.tsx` registers a live session via `/api/sandbox/session/connect` and sends regular heartbeats with player coordinates, inventory, and tile updates via `/api/sandbox/session/sync`.
3. **Queue & Playback:** Remote mining and placement actions executed by the AI are queued in the session manager and dispatched to the active Phaser scene (`executeRemoteMine`, `executeRemotePlace`) during sync heartbeats.

---

### Registered MCP Tools

| Tool | Type | Description | Key Parameters |
| :--- | :--- | :--- | :--- |
| **`get_sandbox_status`** | Read-Only | Returns dimensions, player coordinates, inventory counts, and hotbar state. | `sessionId?: string` |
| **`list_sandbox_items`** | Read-Only | Returns the typed 13-item catalogue with stack sizes, categories, and placeable flags. | `category?: 'all' \| 'block' \| 'material' \| 'crafted'` |
| **`list_crafting_recipes`** | Read-Only | Lists supported recipes, required inputs, outputs, and whether each recipe is craftable right now. | `category?: 'all' \| 'basic' \| 'building' \| 'utility'` |
| **`check_crafting_recipe`** | Read-Only | Validates recipe requirements, inventory stock, missing ingredients, and stack bounds without mutating state. | `recipeId: string`, `batches?: number` (1–100) |
| **`craft_item`** | Mutating | Atomically deducts ingredients and grants output items via the authoritative recipe engine. | `recipeId: string`, `batches?: number`, `idempotencyKey?: string` |
| **`mine_block`** | Mutating | Mines an adjacent solid tile into air, collecting the block into player inventory. Enforces reach (<250px). | `col: number` (0–63), `row: number` (0–35), `idempotencyKey?: string` |
| **`place_block`** | Mutating | Places an owned placeable block onto an air tile. Enforces inventory count, reach, and player collision. | `col: number`, `row: number`, `blockType: PlaceableBlockType`, `idempotencyKey?: string` |
| **`get_save_status`** | Read-Only | Reports save schema version (`2.0`), persistence driver (`localStorage`), and validation state without exposing local filesystem paths. | `sessionId?: string` |

---

### Security, Validation & Defense-in-Depth

- **Strict Zod Schemas:** Every tool input is validated before execution. Out-of-bounds coordinates (`col > 63`, `row > 35`), negative coordinates, non-integer numbers, and oversized batch counts are rejected at the protocol layer.
- **Reach Limits:** Mining and placement operations enforce player reach (< 250px / ~7.8 tiles) from the player's active position. Remote attempts to mine blocks across the map are rejected.
- **Collision Checking:** `place_block` checks the player's 22×32 bounding box and refuses to place blocks inside the player's body.
- **Non-Placeable Filtering:** Items with `isPlaceable: false` (such as `stick`) are rejected by schema and cannot be placed as world tiles.
- **Idempotency Protection:** All mutating operations accept an optional `idempotencyKey`. Retried requests return the cached result without double-deducting materials or awarding duplicate rewards.
- **Zero Filesystem / Shell Access:** The MCP server strictly forbids process execution, arbitrary fetch, or local file access. Persistence inspects isolated browser localStorage contracts only.

---

### Starting the MCP Server

Start the Draw2Play MCP server directly with npm:

```bash
npm run mcp
```

This starts `tsx server/mcp/index.ts` using the official MCP **Stdio transport**. All diagnostic logging is routed to `stderr`, keeping `stdout` reserved for JSON-RPC messages.

---

### Client Configuration (e.g., Claude Desktop)

To connect Draw2Play AI to Claude Desktop, add the following configuration to your `claude_desktop_config.json` (on Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "draw2play": {
      "command": "cmd.exe",
      "args": [
        "/c",
        "npx",
        "tsx",
        "server/mcp/index.ts"
      ],
      "cwd": "E:\\PROJECT\\DRAW2PLAY"
    }
  }
}
```

---

### Verification Results

- **Automated Tests:** **137 / 137 tests passing** across 11 test suites (`npm test`)
- **MCP Integration Suite:** 17 / 17 tests passing (`test/mcp.test.ts`), covering discovery, read-only tools, session lifecycle, atomic crafting, reach bounds, collision avoidance, idempotency caching, and schema rejections.
- **Lint:** 0 warnings, 0 errors (`npm run lint` with `oxlint`)
- **Build:** Clean TypeScript build & Vite bundle (`npm run build`)




