# Draw2Play AI — Stage 0: Deep Repository Audit & Baseline Report

**Audit Date:** October 11, 2026  
**Auditor:** Senior Software Architect, Game Engine & AI Integration Specialist  
**Repository Path:** `E:/PROJECT/DRAW2PLAY`  
**Git Branch:** `main`  
**Starting Baseline Commit:** `9023cd2` (`feat(phase-11): production deployment, docker, and release engineering`)  
**Working Tree Status:** Clean  

---

## 1. Executive Summary

This audit establishes an evidence-based baseline for **Draw2Play AI**, a multimodal sketch-to-playable-game web application built with React 19, Vite 8, Phaser 4 (Arcade Physics), Express 5, and Google Gemini 3.8 Flash.

The application possesses an exceptionally robust core engine spanning 13 automated test suites (153/153 passing tests), clean linting (0 errors, 0 warnings), and an optimized multi-stage Docker deployment build.

However, an audit of the user experience and AI status pipeline reveals **five distinct defects** causing user confusion, stale UI messaging, and network errors:
1. **Hardcoded Obsolete Phase 3 Vision Hand-off Text:** `ScenePanel.tsx` contained static text written during early prototyping claiming the app was "Awaiting Phase 3 Vision Hand-off" despite Phase 3 through Phase 11 being fully implemented.
2. **Binary & Misleading AI Pipeline Status:** The UI collapsed AI state into a simple boolean check (`geminiConfigured ? 'Gemini 3.8 Flash' : 'Offline Mock-Heuristic'`) without distinguishing backend reachability, active request states, or specific fallback provenance.
3. **Inflexible Level Readiness Diagnostics:** `ScenePanel.tsx` reported a static `"Needs Ground & Goal"` error regardless of whether the user was missing ground, goal, or both, without explaining how to fix the sketch.
4. **Reference Image Intake Network Failures (HTTP 502/413):** When users run the frontend in isolation (`npm run dev:client`), Vite proxies `/api/*` to a dormant backend on port 3001, resulting in HTTP 502 Bad Gateway errors. Large image payloads exceeding body limits trigger HTTP 413.
5. **Stale Phase Version Badges across UI:** Vestigial labels such as "Phase 3" (My Creations), "Phase 6.2" (Reference Intake), "Phase 7.2" (Draw-to-Craft), and "Phase 8" (Crafting) remain scattered across modal headers and tooltips.

---

## 2. Git & Repository Baseline Inspection

### 2.1 Git Status & Commit History
```text
Branch: main
Commit: 9023cd2 (feat(phase-11): production deployment, docker, and release engineering)
Preceding commits:
  3cd9431 feat(phase-10): production polish, reliability, and integration hardening
  fe91970 feat(phase-9): add secure MCP server integration
  bc491d5 feat(phase-8): add sandbox expansion and crafting progression
  9e76e9d feat(phase-7.2): add real sketch recognition and draw-to-craft integration
Working Tree: Clean (0 modified, 0 untracked files prior to audit)
```

### 2.2 Directory Structure
```text
DRAW2PLAY/
├── .dockerignore                       # Container build exclusions
├── .env.example                        # Documented environment template
├── .oxlintrc.json                      # Linter rules configuration
├── Dockerfile                          # Multi-stage node:22-alpine production container
├── compose.yaml                        # Docker Compose service definition
├── package.json                        # Dependencies, scripts, and test suite runner
├── package-lock.json                   # Deterministic dependency lockfile
├── tsconfig.json                       # Composite TypeScript root configuration
├── tsconfig.app.json                   # Client-side React/Vite TypeScript settings
├── tsconfig.server.json                # Server-side Node/Express TypeScript settings
├── tsconfig.node.json                  # Vite configuration TypeScript settings
├── vite.config.ts                      # Bundler, Tailwind v4 plugin, and /api proxy
│
├── server/                             # Express 5 Backend API
│   ├── config.ts                       # Zod-validated environment configuration
│   ├── index.ts                        # HTTP server, static serving, and shutdown lifecycle
│   ├── mcp/                            # Model Context Protocol Stdio Server
│   │   ├── index.ts                    # MCP CLI entrypoint
│   │   ├── server.ts                   # Stdio transport server instance
│   │   ├── schemas/                    # Zod schemas for MCP tools
│   │   ├── services/                   # Authoritative in-memory SandboxSessionManager
│   │   └── tools/                      # 8 typed tools (inspection, crafting, mining, placing)
│   ├── providers/                      # Pluggable AI Provider Architecture
│   │   ├── types.ts                    # Provider interfaces, capabilities, and error categories
│   │   ├── registry.ts                 # Central AIProviderRegistry
│   │   └── gemini.provider.ts          # Official GoogleGenAI SDK adapter
│   ├── routes/                         # REST Endpoints
│   │   ├── ai.routes.ts                # /api/ai (level, character, transform, craft)
│   │   ├── health.routes.ts            # /api/health (zero-leak health probe)
│   │   ├── reference.routes.ts         # /api/reference (upload, analyze, frames, plan)
│   │   └── sandboxSession.routes.ts    # /api/sandbox/session (bridge connect, sync, close)
│   ├── schemas/                        # Server Zod validation schemas
│   └── services/                       # Business logic services
│       ├── craftRecognition.service.ts # Sketch feature matching & Gemini fallback
│       ├── gemini.service.ts           # Level and character Gemini Vision calls
│       ├── mock.service.ts             # Deterministic offline mock heuristics
│       ├── referenceAnalysis.service.ts# Visual reference analysis & plan generation
│       └── upload.service.ts           # Magic-byte validation & in-memory media storage
│
├── src/                                # Frontend React 19 Client
│   ├── App.tsx                         # Main state coordinator & view switcher
│   ├── main.tsx                        # React DOM mounting
│   ├── components/                     # Component tree
│   │   ├── canvas/InteractiveCanvas.tsx# Normalized vector stroke HTML5 canvas
│   │   ├── game/PhaserGameView.tsx     # Phaser 4 2D platformer host & HUD
│   │   ├── layout/StudioHeader.tsx     # Navigation header (legacy Phase 3 badge)
│   │   ├── modals/                     # Modal dialogs (AnalyzePreparation, Clear, Export, etc.)
│   │   ├── sandbox/                    # Draw-to-Craft Sandbox (Phaser 4 sandbox view)
│   │   │   ├── SandboxGameView.tsx     # Sandbox HUD, inventory, crafting modal, session sync
│   │   │   ├── DrawToCraftModal.tsx    # Dedicated tool sketching canvas
│   │   │   └── CraftingWorkshopModal.tsx# Recipe crafting UI
│   │   └── studio/                     # Studio UI (TopBar, SketchToolbar, ScenePanel, etc.)
│   │       ├── ScenePanel.tsx          # Geometry stats, element counts, AI status
│   │       ├── SketchToolbar.tsx       # Active drawing tool & palette selector
│   │       ├── TopBar.tsx              # Quick play, reference intake, analyze buttons
│   │       ├── BottomStatusBar.tsx     # Live status, cursor coordinates, readiness
│   │       └── ReferenceIntakeModal.tsx# Reference upload, frame scrubber, plan generator
│   ├── game/                           # Game engine logic
│   │   ├── config.ts                   # Phaser game configurations
│   │   ├── sceneConverter.ts           # SketchDocument -> PlayableGameScene conversion
│   │   ├── transformationEngine.ts     # Natural language level modification engine
│   │   ├── sandbox/                    # Sandbox catalogue (13 items), recipes, world math
│   │   └── scenes/                     # MainScene.ts (Platformer) & SandboxScene.ts (Sandbox)
│   ├── services/                       # Client services
│   │   ├── api.ts                      # API client with getApiUrl base resolver
│   │   ├── audioService.ts             # Procedural Web Audio API sound synthesizer
│   │   ├── craftService.ts             # Draw-to-Craft recognition client
│   │   ├── creationStorage.ts          # Studio level localStorage persistence
│   │   ├── localRuleParser.ts          # Offline level transformation rule parser
│   │   └── sandboxStorage.ts           # Sandbox world & inventory localStorage persistence
│   ├── types/                          # Shared domain TypeScript contracts & Zod schemas
│   └── utils/                          # Geometry extraction, stroke serialization
│
├── test/                               # 13 Deterministic Test Suites (153 tests total)
└── dist/                               # Production build output
```

---

## 3. Baseline Verification Results

Every standard project command was executed directly on the host environment:

| Step / Command | Command Executed | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Linting** | `npm run lint` (`oxlint`) | **PASS (0 warnings, 0 errors)** | Scanned 97 files in 69ms across 116 lint rules. |
| **Type Check & Build** | `npm run build` (`tsc -b && vite build`) | **PASS** | Clean compilation. Produced client bundle in 821ms (`dist/index.html` 0.53 kB, `phaser` chunk 1.37 MB). |
| **Test Suite** | `npm test` (`tsx test/*.test.ts`) | **PASS (153 / 153 tests)** | 13/13 test suites completed with 0 failures: |
| - Sanity Suite | `test/sanity.test.ts` | 14/14 pass | Math, bounds, basic data structures. |
| - Sketch Suite | `test/sketch.test.ts` | 15/15 pass | Serialization, geometry extraction. |
| - Scene Suite | `test/scene.test.ts` | 12/12 pass | Scene schema contracts, platform conversion. |
| - Storage Suite | `test/storage.test.ts` | 12/12 pass | LocalStorage CRUD, corrupted save handling. |
| - Transformation Suite | `test/transformation.test.ts` | 13/13 pass | Natural language level mutations. |
| - Reference Suite | `test/reference.test.ts` | 11/11 pass | Magic byte sniffing, plan generation, frame analysis. |
| - Provider Suite | `test/provider.test.ts` | 10/10 pass | GeminiProvider contract, error classification. |
| - Sandbox Suite | `test/sandbox.test.ts` | 10/10 pass | Terrain generation, block mining/placing. |
| - Craft Suite | `test/craft.test.ts` | 18/18 pass | Draw-to-Craft recognition, feature extraction. |
| - Progression Suite | `test/craftingProgression.test.ts` | 15/15 pass | 13-item catalogue, batch crafting, recipe atomicity. |
| - MCP Suite | `test/mcp.test.ts` | 17/17 pass | Stdio transport, 8 tools, reach bounds (220px). |
| - Phase 10 Hardening | `test/phase10.test.ts` | 8/8 pass | Bridge sync, revision conflicts, idle timeout. |
| - Phase 11 Deployment | `test/phase11.test.ts` | 8/8 pass | Health endpoint, SPA routing, graceful shutdown. |

---

## 4. Root Cause Analysis of Reported Defects

### Defect A: "Image-AI Pipeline Status: Offline Mock-Heuristic" & "Awaiting Phase 3 Vision Hand-off"
* **Location:** [`src/components/studio/ScenePanel.tsx:251-284`](file:///E:/PROJECT/DRAW2PLAY/src/components/studio/ScenePanel.tsx#L251-L284)
* **Root Cause:**
  1. `ScenePanel.tsx` receives `geminiConfigured: boolean` from `App.tsx`.
  2. If the backend is running without `GEMINI_API_KEY`, or if only `npm run dev:client` is active (backend offline), `geminiConfigured` evaluates to `false`.
  3. When `false`, line 268 displays `'Offline Mock-Heuristic'`.
  4. Lines 274–277 contain **hardcoded static JSX** written during Phase 2 that was never refactored:
     ```tsx
     <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90 font-mono">
       <Clock className="w-3 h-3 shrink-0" />
       <span>Awaiting Phase 3 Vision Hand-off</span>
     </div>
     <p className="text-[11px] text-slate-400 leading-relaxed">
       In Phase 3, this canvas connects with Gemini Vision to interpret freehand doodles...
     </p>
     ```
  5. Even when Gemini Vision is online and active, the component previously displayed this stale Phase 3 text!

### Defect B: "Extracted Vectors: 2 elements" & "Level Readiness: Needs Ground & Goal"
* **Location:** [`src/components/studio/ScenePanel.tsx:211-222`](file:///E:/PROJECT/DRAW2PLAY/src/components/studio/ScenePanel.tsx#L211-L222) and [`src/utils/sketchSerializer.ts:71-107`](file:///E:/PROJECT/DRAW2PLAY/src/utils/sketchSerializer.ts#L71-L107)
* **Root Cause:**
  1. `calculateSceneSummary(strokes)` computes `summary.hasGround = counts.ground > 0` and `summary.hasGoal = counts.goal > 0`.
  2. `ScenePanel.tsx` rendered:
     ```tsx
     {summary.hasGround && summary.hasGoal ? (
       <><CheckCircle2 className="w-3 h-3" /> Ready</>
     ) : (
       <span className="text-amber-400">Needs Ground & Goal</span>
     )}
     ```
  3. If a user drew 2 Ground platforms, `extractedElements.length` was 2, but because Goal was 0, the text unconditionally displayed `"Needs Ground & Goal"`.
  4. The UI gave no indication of which specific element was present versus missing, and provided no guidance on which toolbar tool to select to make the level playable.

### Defect C: Reference-Image Analysis & Network Failures (HTTP 502 / 413 / 503)
* **Location:** [`src/components/studio/ReferenceIntakeModal.tsx:254-294`](file:///E:/PROJECT/DRAW2PLAY/src/components/studio/ReferenceIntakeModal.tsx#L254-L294) & [`server/routes/reference.routes.ts`](file:///E:/PROJECT/DRAW2PLAY/server/routes/reference.routes.ts)
* **Root Cause:**
  1. **HTTP 502 Bad Gateway:** Occurs when running `npm run dev:client` without `npm run dev:server`. Vite runs on port 5173 and proxies `/api/*` to `localhost:3001`. If port 3001 is closed, the proxy fails with 502.
  2. **HTTP 413 Payload Too Large:** Occurs when uploading high-resolution uncompressed images or video frames exceeding Express `bodyLimit: '15mb'` in `server/config.ts`.
  3. **HTTP 503 Service Unavailable:** The multi-frame analysis endpoint (`POST /api/reference/analyze-frames`) strictly requires Gemini Vision; if `GEMINI_API_KEY` is not set on the server, it responds with HTTP 503.
  4. **Silent Upload Bypass:** In `ReferenceIntakeModal.tsx`, if `/api/reference/upload` failed, the error was silently swallowed in a `try/catch` and proceeded directly to `/api/reference/analyze`, masking the underlying upload error.

---

## 5. Security & Secret Protection Verification

1. **Client Bundle Auditing:** No private credentials (`GEMINI_API_KEY`, internal tokens) are present in `src/`, client bundle builds, or `VITE_*` variables.
2. **Health Check Probing:** `GET /api/health` reports status, provider availability, and model name without exposing environment values, internal paths, or API key prefixes.
3. **CORS Hardening:** Configurable via `CORS_ORIGIN` in `server/config.ts`, defaulting to safe origin checking.
4. **Stdio MCP Isolation:** The Draw2Play MCP server operates exclusively over Node.js Stdio transport and is never exposed over unauthenticated public network endpoints.
