# 🍌 Draw2Play — Banana Hacks 2026

> **Turn Hand-Drawn Sketches into Playable Physics Games in Real Time.**  
> Built for the **Banana Hacks 2026** Hackathon | **Theme:** Image AI

---

## 📖 Project Overview

**Draw2Play** is an interactive web experience where players sketch physical levels, characters, and obstacles on an interactive canvas (or upload a photo of a pen-and-paper sketch), and an intelligent Image AI vision pipeline parses, classifies, and translates those visual strokes into a dynamic, playable 2D physics game.

Instead of writing level code or using complex level editors, anyone—from kids doodling on paper to level designers—can draw a ramp, loop-the-loop, bouncy trampolines, danger zones, and treasure coins, and immediately jump into the game with physics-driven gameplay.

---

## 🎨 Hackathon Theme & Chosen Image-AI Use Case

* **Event:** Banana Hacks 2026 (October 9–12, 2026)
* **Official Theme:** **Image AI**
* **Chosen Use Cases:**
  1. **Visual Sketch Recognition & Computer Vision:** Real-time semantic parsing and contour extraction of drawn strokes into game physics primitives (solid platforms, ramps, bouncy surfaces, hazard spikes, coins, start/finish goals).
  2. **Multimodal Image Understanding:** Analyzing full-canvas hand-drawn game levels (or uploaded paper drawings) using multimodal vision AI (Gemini Vision API) to extract semantic scene layout, gameplay objectives, and entity metadata.
  3. **Synthetic Asset Generation:** Optional generative AI stylization to transform rough hand-drawn doodles into stylized game sprites and themed game environments.

---

## 🛠 Planned Technologies

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Type-safe modular UI and state management |
| **Build Tool & Bundler** | [Vite 6](https://vite.dev/) | Ultra-fast local development and production bundling |
| **Canvas & Physics** | HTML5 Canvas 2D + [Matter.js](https://brm.io/matter-js/) | Smooth 60fps vector drawing canvas & rigid-body 2D physics simulation |
| **AI Vision Engine** | Gemini 2.5 Flash Multimodal Vision API + Edge Heuristics | Real-time sketch parsing, object classification, and level scene understanding |
| **Styling** | Vanilla Modern CSS | Sleek responsive UI, glassmorphic HUD controls, dark mode aesthetic |

---

## 🤖 AI-Tool Disclosure

In accordance with official hackathon rules and integrity policies:
- **Assisted Tools:** This project utilizes Google DeepMind's Antigravity AI coding assistant for project setup, boilerplate scaffolding, and pair-programming guidance.
- **Model / Vision Processing:** The application plans to integrate the Google Gemini Vision API for multimodal sketch interpretation.
- **Originality Guarantee:** All code in this repository was initiated and developed from scratch strictly within the official Banana Hacks 2026 competition window (October 9–12, 2026). No pre-existing codebase or copied implementations were used.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0 or higher recommended, tested on Node v25+)
- npm (v9.0+)

### Quick Start Commands

```bash
# 1. Clone the repository
git clone https://github.com/KrishSingh01/DRAW2PLAY.git
cd DRAW2PLAY

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Build for production
npm run build
```

---

## 🗺 Development Roadmap & Phases

- [x] **Phase 1: Project Scaffolding & Setup (Current Phase)**
  - Initialize React + TypeScript + Vite environment
  - Setup clean project structure and dependencies
  - Document project idea, Image-AI use case, technology stack, and AI disclosure in README
  - Create initial repository commit within official hackathon window
- [ ] **Phase 2: Interactive Sketch Canvas**
  - Implement fluid drawing surface with pen, eraser, color coding, and stroke smoothing
  - Level element palette (Ground, Bounce, Hazard, Coin, Player, Goal)
- [ ] **Phase 3: Image-AI & Computer Vision Processing**
  - Extract stroke contours, bounding boxes, and geometric shapes
  - Integrate multimodal AI vision parsing for uploaded/drawn levels
- [ ] **Phase 4: 2D Physics Engine & Game Loop**
  - Convert parsed geometry into Matter.js rigid bodies and colliders
  - Character controller (run, jump, roll) and win/loss conditions
- [ ] **Phase 5: UI Polish, Presets, and Demo Showcase**
  - Pre-drawn example levels, sound effects, particle feedback
  - Record demo video for Banana Hacks submission

---

## 📜 License
MIT License. Created during Banana Hacks 2026.
