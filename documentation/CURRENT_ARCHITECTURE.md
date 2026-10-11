# Draw2Play AI — Current Architecture & Execution Flow Map

**Document Version:** 1.0  
**Audit Baseline Commit:** `9023cd2`  
**Application Architecture:** Decoupled React 19 Frontend + Phaser 4 Game Engine + Express 5 Backend + In-Memory MCP Session Bridge + Google Gemini 3.8 Flash Adapter

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph Browser ["React 19 Client (Browser Context)"]
        UI[Studio UI / TopBar / SketchToolbar]
        Canvas[InteractiveCanvas (HTML5 Canvas)]
        ScenePanel[ScenePanel (Diagnostics & Status)]
        PhaserGame[Phaser 4 Arcade Engine (PhaserGameView)]
        SandboxGame[Phaser 4 Sandbox Engine (SandboxGameView)]
        LocalStorage[(Browser localStorage)]
    end

    subgraph NetworkProxy ["Vite Dev Server (Port 5173)"]
        ViteProxy["/api/* Proxy -> http://localhost:3001"]
    end

    subgraph Backend ["Node.js Express Server (Port 3001)"]
        HealthRoute["/api/health"]
        AIRoutes["/api/ai/* (Level, Character, Craft)"]
        RefRoutes["/api/reference/* (Upload, Analyze, Plan)"]
        SessionRoutes["/api/sandbox/session/* (Heartbeat & Sync)"]
        UploadSvc[Upload & Magic Byte Service]
        RefSvc[Reference Analysis Service]
        CraftSvc[Craft Recognition Service]
        ProviderReg[AI Provider Registry]
        GeminiAdapter[Gemini Provider (Google GenAI SDK)]
        MockSvc[Mock Heuristic Services]
        SessionMgr[(Authoritative SandboxSessionManager)]
    end

    subgraph ExternalMCP ["External AI Client (Claude / Antigravity)"]
        MCPAgent[AI Assistant]
        MCPStdio["server/mcp/index.ts (Stdio Transport)"]
    end

    UI --> Canvas
    Canvas --> ScenePanel
    UI --> PhaserGame
    UI --> SandboxGame
    SandboxGame <--> LocalStorage
    UI <--> LocalStorage

    Canvas -.->|POST /api/*| ViteProxy
    ViteProxy -.->|HTTP| Backend

    Backend --> HealthRoute
    Backend --> AIRoutes
    Backend --> RefRoutes
    Backend --> SessionRoutes

    RefRoutes --> UploadSvc
    RefRoutes --> RefSvc
    AIRoutes --> CraftSvc
    RefSvc --> ProviderReg
    CraftSvc --> ProviderReg
    AIRoutes --> ProviderReg

    ProviderReg --> GeminiAdapter
    ProviderReg --> MockSvc

    SessionRoutes <--> SessionMgr
    MCPAgent <-->|Stdio JSON-RPC| MCPStdio
    MCPStdio <-->|In-Memory Service| SessionMgr
    SandboxGame <-->|HTTP Sync (1 Hz)| SessionRoutes
```

---

## 2. The 12 Concrete Execution Flows

### Flow 1: Application Startup & Baseline Initialization
1. User loads `http://localhost:5173` (dev) or `http://localhost:3001` (production container).
2. `src/main.tsx` mounts `<App />` in React 19 concurrent mode.
3. `App.tsx` initializes state:
   - `viewMode`: `'studio'`
   - `currentTool`: `'brush'`, `selectedElement`: `'ground'`, `brushSize`: `8`
   - `strokes`: `[]`, `canvasDimensions`: `{ width: 800, height: 500 }`
   - `savedCreationsCount`: read from `localStorage` (`getAllCreations().length`)
4. In `useEffect`, `App.tsx` calls `fetchHealth()` to probe `GET /api/health`:
   - If Express responds: `data.geminiConfigured` sets `geminiConfigured` state.
   - If network fails or times out: catches cleanly and sets `geminiConfigured = false`.

---

### Flow 2: Sketch Creation, Editing, Undo, and Redo
1. User interacts with `<InteractiveCanvas />` using pointer down/move/up events.
2. Coordinates are sampled, normalized to `[0.0, 1.0]` against device pixel ratio (DPR) scaled dimensions.
3. On pointer up, the finalized `SketchStroke` (id, tool, elementType, points, width, color) is appended to `strokes` array.
4. History stacks (`undoStack`, `redoStack`) record stroke snapshots:
   - `undo()`: pops last stroke to `redoStack`, triggers `onStrokesChange`.
   - `redo()`: pushes stroke back to canvas.
5. `calculateSceneSummary(strokes)` computes element counts (`ground`, `hazard`, `trampoline`, `coin`, `goal`).
6. `extractSceneGeometry(strokes)` computes bounding boxes, centroids, and length metrics.

---

### Flow 3: Reference Image Upload and Preview
1. User clicks **Reference Intake** in TopBar; `<ReferenceIntakeModal />` opens.
2. User provides reference via file picker, drag-and-drop, or video scrubber.
3. Client-side validation:
   - Verifies file size `< 10MB`.
   - Reads image dimensions via `Image()` object.
   - For video, draws seek frame to hidden canvas to extract PNG data URL.
4. Sets `previewImage` data URL in modal state; displays visual metadata.

---

### Flow 4: Image Analysis Request Routing
1. User triggers analysis (e.g., clicks **Analyze Reference** or **Analyze Level**).
2. Client sends HTTP POST with base64 payload to backend:
   - Level sketch: `POST /api/ai/analyze-level`
   - Reference image: `POST /api/reference/analyze`
   - Video frames (2–5): `POST /api/reference/analyze-frames`
   - Tool sketch: `POST /api/ai/recognize-craft-sketch`
3. Express parses JSON body up to `bodyLimit` (`15mb`).
4. Route validates payload structure using strict Zod schemas (`LevelRequestSchema`, `AnalyzeReferenceRequestSchema`, etc.).

---

### Flow 5: Gemini AI Provider Execution
1. Route queries `aiProviderRegistry.getProviderForCapability('image-understanding', 'gemini')`.
2. Provider checks `isConfigured()` (checks `GEMINI_API_KEY`).
3. If configured:
   - Calls official `@google/genai` SDK `models.generateContent()`.
   - Wraps call in a hard 18-second timeout (`withTimeout`).
   - Formats content parts with `inlineData` (MIME type + base64) and structured prompt.
4. If unconfigured or call fails:
   - Caught gracefully; logs sanitized warning without printing secrets.
   - Routes to deterministic fallback service (`generateMockLevelAnalysis`, `generateHeuristicReferenceAnalysis`).

---

### Flow 6: AI Response Parsing and Validation
1. Gemini response text is stripped of any markdown code fences.
2. Response is parsed as JSON.
3. Validated against authoritative Zod schemas:
   - `LevelAnalysisSchema` for level sketches.
   - `ReferenceAnalysisSchema` (v2.0) for visual reference analysis.
   - `ServerRecognizeCraftResponseSchema` for craft sketches.
4. If schema parsing succeeds, returns HTTP 200 with `source: 'gemini-vision'`.
5. If schema parsing fails, logs warning, invokes deterministic fallback, and returns HTTP 200 with `source: 'mock-fallback'` and an explicit notice explaining the fallback reason.

---

### Flow 7: Game-Plan Creation
1. In Reference Intake, user reviews analysis and clicks **Generate Game Plan**.
2. Client calls `POST /api/reference/generate-plan`.
3. `buildGameGenerationPlan()`:
   - Inspects `ReferenceAnalysis` category (`2d-platformer`, `voxel`, `top-down-2d`, `isometric`).
   - If `2d-platformer`: outputs `targetEngine: 'phaser-2d'` with `suggested2DConfig` (theme, gravity, platform count, hazard density).
   - If `voxel`: flags `targetEngine: 'future-3d-engine'` and adds notice that full 3D voxel rendering is deferred to a future phase.
4. Returns validated `GameGenerationPlan` (schema v2.0).

---

### Flow 8: Procedural Level Generation & Geometry Segmentation
1. When user clicks **Quick Play** or finishes **Analyze Level**:
2. `convertSketchToPlayableScene(document, options)` in `src/game/sceneConverter.ts`:
   - Converts normalized Ground strokes into segmented `PlatformElement` collision boxes.
   - Converts Hazard strokes into `HazardElement` spike traps.
   - Converts Trampoline strokes into `TrampolineElement` bounce pads.
   - Converts Coin strokes into `CoinElement` collectibles.
   - Converts Goal stroke into `GoalElement` flag, or places default goal if omitted.
   - Spawns player above the leftmost ground platform.
3. Validates complete structure with `PlayableGameSceneSchema`.

---

### Flow 9: Phaser Scene Creation, Physics, Audio, and Particles
1. `App.tsx` switches `viewMode = 'playing'`.
2. `<PhaserGameView />` initializes Phaser 4 Game instance using `MainScene.ts`:
   - World bounds set to `800x480` with Arcade Physics gravity (`750 px/s²`).
   - Platforms created as static physics group.
   - Player sprite created with 60 FPS running, jumping, and falling physics.
   - Trampolines configured with bounce overlap and `audioService.playTrampoline()` boing audio.
   - Coins configured with collection overlap, floating HUD score, and `audioService.playCoin()` chimes.
   - Hazards trigger level restart with `audioService.playHazard()`.
   - Goal triggers victory confetti particle emitter and `audioService.playVictory()` fanfare.

---

### Flow 10: Save, Load, Export, and Quick Play
1. **Save:** Player clicks Save in Studio or Game HUD. `saveCreation()` writes level to `localStorage` key `draw2play_saved_creations`.
2. **Load:** Player opens **My Creations** modal, selects a saved level. Loads strokes back into canvas or launches directly into Phaser.
3. **Export:** `<ExportModal />` exports PNG with transparent/white background or downloads JSON blueprint.
4. **Quick Play:** Bypasses remote AI analysis and converts vector strokes directly to local physics level in `< 10ms`.

---

### Flow 11: Sandbox World, Inventory, Crafting, and Draw-to-Craft
1. Player clicks **Sandbox** in TopBar; switches to `<SandboxGameView />`.
2. Loads or generates `64x36` tile world (dirt, stone, grass, wood, leaves) with player position and 13-item inventory.
3. Mining: Left-click solid tile within 220px reachmines tile to air and adds block to inventory.
4. Placing: Right-click air tile places selected hotbar block.
5. Crafting Workshop: Press `[C]` to open recipe workshop; produces wooden planks, torches, workbenches, etc.
6. Draw-to-Craft: Press `[E]` to open sketch canvas. Player sketches an item (sword, pickaxe, torch, workbench). Sends to `/api/ai/recognize-craft-sketch`. On confirmation, awards crafted item.

---

### Flow 12: MCP Server Integration, Stdio Transport & Session Bridge
1. External AI assistant runs `npm run mcp` (`server/mcp/index.ts`).
2. MCP server connects via Stdio JSON-RPC transport and registers 8 tools.
3. In browser, `SandboxGameView.tsx` establishes a live session via `POST /api/sandbox/session/connect`.
4. Browser sends regular heartbeats with player coordinates and inventory via `POST /api/sandbox/session/sync`.
5. AI tool requests (`mine_block`, `place_block`, `craft_item`) are validated, queued in `SandboxSessionManager`, and executed in the browser world on the next sync heartbeat.
