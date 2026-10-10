# 🍌 Draw2Play AI — Hackathon Project Foundation

> **From Sketch to Playable Hero with Image AI.**  
> Built for the **Banana Hacks 2026** Hackathon | **Theme:** Image AI (October 9–12, 2026)

---

## 📖 1. Project Vision

**Draw2Play AI** empowers players to draw a character, pass it to an Image-AI vision model to analyze its visual traits, and immediately transform that drawing into a playable hero inside an interactive browser 2D game.

### The Core Player Journey:
```
[ 1. DRAW ] ➔ [ 2. ANALYZE WITH IMAGE AI ] ➔ [ 3. TRANSFORM ] ➔ [ 4. PLAY ] ➔ [ 5. CUSTOMIZE ]
```

1. **DRAW:** Hand-sketch your hero character on the interactive canvas with custom brush sizes, color palettes, and reference guidelines (or pick a quick preset).
2. **ANALYZE WITH IMAGE AI:** An Image-AI vision pipeline (Google Gemini 3.8 Flash Vision via `@google/genai` SDK) analyzes visual attributes (silhouette, spikes, roundness, density, accessories, dominant colors).
3. **TRANSFORM:** The AI categorizes your character into a game archetype (`speedster`, `brawler`, `tank`, `mystic`, `balanced`) and computes physics attributes (movement speed, jump power, gravity, vitality).
4. **PLAY:** Jump directly into a responsive Phaser 2D platformer game where your hand-drawn sketch is the active player sprite colliding with platforms, dodging hazards, and collecting coins at 60 FPS.
5. **CUSTOMIZE:** Fine-tune physics attributes (speed, jump force, gravity) in real time and see changes reflected instantly in the physics engine.

---

## 📜 2. Hackathon Compliance & Event Window Verification

* **Hackathon:** **Banana Hacks 2026**
* **Event Window:** October 9, 2026 – October 12, 2026
* **Authorized Start Window:** Development and commits initiated strictly within the authorized hackathon timeframe (Current timestamp: October 10, 2026).
* **Theme Alignment:** **Image AI** — Integrating multimodal computer vision and image understanding to drive core gameplay mechanics.
* **Code Integrity:** All code in this repository was initiated and developed from scratch during the hackathon window. No legacy project files or pre-event code were used.

---

## 🛠 3. Technical Direction & Architecture

The application is structured into decoupled, modular layers:

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Declarative UI, state machines, and reactive controls |
| **Build Tooling** | [Vite 6](https://vite.dev/) | Sub-second HMR and optimized bundler |
| **Styling & Design System** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern glassmorphism, responsive canvas HUD, dark theme |
| **2D Game Engine** | [Phaser](https://phaser.io/) (Arcade Physics) | 60 FPS platformer physics, tile collisions, camera follow |
| **Backend API** | [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) | REST API for image receiving, processing, and CORS management |
| **Schema Validation** | [Zod](https://zod.dev/) | End-to-end runtime validation for character data and env configs |
| **Image-AI Service** | [`@google/genai`](https://www.npmjs.com/package/@google/genai) | Official Google GenAI SDK powered by `gemini-3.8-flash` |
| **Offline Fallback** | Deterministic Heuristic Engine | Safe, testable offline development without requiring API keys |

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
├── vite.config.ts                     # Vite + Tailwind + /api proxy configuration
│
├── server/                            # Node.js + Express Backend API
│   ├── config.ts                      # Zod-validated environment configuration
│   ├── index.ts                       # Express server entry point & middleware
│   ├── routes/
│   │   ├── ai.routes.ts               # POST /api/ai/analyze-character
│   │   └── health.routes.ts           # GET /api/health
│   ├── services/
│   │   ├── gemini.service.ts          # Gemini 3.8 Flash Multimodal Vision integration
│   │   └── mock.service.ts            # Deterministic heuristic service for offline dev/test
│   └── schemas/
│       └── character.schema.ts        # Zod schema for character analysis output
│
├── src/                               # Frontend Application
│   ├── assets/                        # Static SVG and image assets
│   ├── components/                    # Modular React components
│   │   ├── canvas/
│   │   │   ├── DrawingCanvas.tsx      # Interactive 2D drawing canvas
│   │   │   └── InteractiveCanvas.tsx  # Phase 2 HTML5 2D Canvas engine with DPR, normalized vectors & blueprints
│   │   ├── game/
│   │   │   └── PhaserGameView.tsx     # Phaser game container lifecycle
│   │   ├── layout/
│   │   │   ├── Header.tsx             # Header with hackathon badge and live AI status
│   │   │   └── TabNavigation.tsx      # 5-step journey navigation tabs
│   │   ├── modals/                    # Studio Dialogs & Confirmation Modals
│   │   │   ├── AnalyzePreparationModal.tsx  # Prepares image Blob & JSON without faking AI
│   │   │   ├── ClearConfirmModal.tsx        # Destructive clear action confirmation
│   │   │   ├── EmptyCanvasAlertModal.tsx    # Empty sketch alert with starter blueprints
│   │   │   └── ExportModal.tsx              # PNG & JSON structured export dialog
│   │   ├── studio/                    # Phase 2 Studio Components
│   │   │   ├── BottomStatusBar.tsx    # Live tool, element, dimensions, and drawing status
│   │   │   ├── ScenePanel.tsx         # Real-time stroke counts, specs & future AI placeholder
│   │   │   ├── SketchToolbar.tsx      # Select, Brush, Eraser, sizes & 5 semantic elements
│   │   │   └── TopBar.tsx             # Studio wordmark, undo/redo, clear, export & analyze actions
│   │   └── ui/
│   │       ├── Button.tsx             # Reusable styled button
│   │       ├── Card.tsx               # Glassmorphic card container
│   │       └── StatusBadge.tsx        # Status pills and theme badges
│   ├── game/                          # Phaser Game Engine
│   │   ├── config.ts                  # Phaser 3 game configuration factory
│   │   └── scenes/
│   │       └── MainScene.ts           # Playable Phaser scene with platforms, player, coins, hazards
│   ├── services/
│   │   └── api.ts                     # Frontend API client
│   ├── types/
│   │   ├── game.ts                    # Shared game types, Zod schemas, and JourneyStep types
│   │   └── sketch.ts                  # Phase 2 typed vector model (NormalizedPoint, SketchStroke, Document)
│   ├── utils/
│   │   └── sketchSerializer.ts        # Vector rendering, normalization, PNG/JSON export & deterministic summaries
│   ├── App.tsx                        # Root React studio coordinator with shortcuts & state
│   ├── main.tsx                       # React DOM entry point
│   └── index.css                      # Tailwind CSS v4 entry point & design tokens
│
└── test/
    ├── sanity.test.ts                 # Sanity test suite for schemas, mock AI, and server config
    └── sketch.test.ts                 # Phase 2 unit tests (normalization, summaries, JSON export)
```

---

## 🤖 5. AI-Tool Disclosure

In accordance with official hackathon rules and fair play policies:
- **Development Assistant:** Developed with the assistance of Google DeepMind's Antigravity AI coding assistant for project scaffolding and pair-programming.
- **In-Game Image AI:** Powered by the official Google Gemini Vision SDK (`@google/genai`) using `gemini-3.8-flash` for multimodal sketch analysis.
- **Fair Play Guarantee:** The project includes a transparent fallback engine (`mock-heuristic`) when no API key is provided, clearly indicating whether an analysis came from real `gemini` or `mock-heuristic`. We never pretend AI is integrated before a real request executes.

---

## 🚀 6. Installation & Execution Commands

### Prerequisites
- Node.js (v18.0 or higher, tested on Node v25)
- npm (v9.0+)

### Commands

```bash
# 1. Install all dependencies
npm install

# 2. Run Sanity Tests (Verifies Zod schemas, server config, and mock engine)
npm test

# 3. Run Code Linter
npm run lint

# 4. Build for Production (Verifies TypeScript and Vite bundling)
npm run build

# 5. Start Full Development Environment (Frontend + Backend concurrently)
npm run dev

# Or start frontend and backend independently:
npm run dev:client   # Runs Vite on http://localhost:5173
npm run dev:server   # Runs Express API on http://localhost:3001
```

---

## 🔑 7. Environment Variables

Create a `.env` file in the project root (see [`.env.example`](file:///.env.example)):

```ini
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
FRONTEND_URL=http://localhost:5173
```

> **Note:** If `GEMINI_API_KEY` is not provided, the server gracefully activates the deterministic heuristic service, allowing full testing of the game loop and canvas without an API key.

---

## 🧪 8. Test Suite Results

Run `npm test` to execute both test suites (10/10 tests passing):

### Suite A: Sanity & Server Architecture (`test/sanity.test.ts`)
* **Test 1:** `CharacterAttributesSchema` validates valid/invalid attributes
* **Test 2:** `AnalyzeCharacterRequestSchema` checks base64 payload boundaries
* **Test 3:** `CharacterAnalysisOutputSchema` validates server output format
* **Test 4:** Deterministic heuristic mock generates consistent attributes
* **Test 5:** Server configuration correctly parses environment variables

### Suite B: Phase 2 Interactive Sketch & Vector Engine (`test/sketch.test.ts`)
* **Test 1:** Coordinate normalization & clamping ($0 \le x, y \le 1$)
* **Test 2:** Element definitions structure (Ground, Hazard, Trampoline, Coin, Goal)
* **Test 3:** Deterministic scene summary calculation (stroke counts & percentages)
* **Test 4:** Empty scene summary handling
* **Test 5:** Structured JSON document serialization & schema compliance

---

## 🛑 9. Current Phase Status & Next Step

* **Phase 0 Status:** **COMPLETE & VERIFIED**
  * Project initialized with React 19 + TypeScript + Vite + Tailwind CSS v4 + Phaser + Express + Zod.
  * Verified with `npm test`, `npm run lint`, and `npm run build`.
* **Phase 1 Status:** **COMPLETE & VERIFIED**
  * Premium AI Game Studio layout built with dark navy, purple & cyan accents, glassmorphic panels, and crisp typography.
  * Top navigation with original wordmark emblem, Studio tab, My Creations, and Help modal.
  * Main workspace comprising Left Toolbar, Center Canvas Viewport, Right Analysis Panel, and Bottom Status Bar.
  * Lint (0 errors, 0 warnings), sanity tests (all 5 passed), and production build verified.
* **Phase 2 Status:** **COMPLETE & VERIFIED**
  * HTML5 2D Canvas engine with DPR scaling, pointer capture for mouse/stylus/touch, and `touch-action: none`.
  * Normalized vector stroke model ($x, y \in [0, 1]$) preserving precision during responsive window resizes.
  * 5 semantic element types with distinct accessible colors, icons, and descriptions: Ground (solid), Hazard (spikes), Trampoline (bounce), Coin (collectible), Goal (destination).
  * Full deterministic Undo/Redo history stack with shortcut support (`Ctrl+Z`, `Ctrl+Y`).
  * Destructive Clear action with confirmation modal protecting user artwork.
  * Export modal supporting both high-resolution PNG downloads and structured JSON scene descriptors.
  * "Analyze Sketch" action that strictly verifies non-empty canvas, extracts PNG blob and structured metrics, and presents prepared payload metrics without faking AI results or calling nonexistent APIs.
  * Starter blueprints (Rolling Hills, Spike Canyon) for rapid level drafting.
  * 10/10 automated tests passing, 0 lint errors/warnings, and production bundle verified (`dist/`).
* **Next Implementation Step (Phase 3):**
  * **Playable Physics-Game Engine:** Transform normalized vector strokes into active 2D physics colliders, platforms, trampolines, and collectible coins.
  * **Real Image-AI Vision Integration:** Connect prepared sketch image Blob to Google Gemini Vision (`gemini-3.8-flash`) to semantically classify freehand geometry, detect visual intent, and synthesize level theme attributes.

