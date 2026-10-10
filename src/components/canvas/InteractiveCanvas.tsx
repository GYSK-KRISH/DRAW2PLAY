import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Mountain,
  Flame,
  Zap,
  Coins,
  Flag,
  Grid,
} from 'lucide-react';
import {
  type CanvasTool,
  type SceneElementType,
  type SketchStroke,
  type NormalizedPoint,
  ELEMENT_DEFINITIONS,
} from '../../types/sketch.js';
import {
  clamp01,
  renderStrokesToCanvas,
  exportSketchToPng,
  exportSketchToBlob,
} from '../../utils/sketchSerializer.js';

export interface InteractiveCanvasHandle {
  getCanvasElement: () => HTMLCanvasElement | null;
  getStrokes: () => SketchStroke[];
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  exportPng: (backgroundColor?: string) => string;
  exportBlob: (backgroundColor?: string) => Promise<Blob>;
  loadSamplePreset: (preset: 'hills' | 'canyon') => void;
  loadStrokes: (strokes: SketchStroke[]) => void;
  getDimensions: () => { width: number; height: number };
}

interface InteractiveCanvasProps {
  currentTool: CanvasTool;
  selectedElement: SceneElementType;
  brushSize: number;
  onStrokesChange: (strokes: SketchStroke[]) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onDrawingStatusChange?: (status: 'idle' | 'drawing') => void;
}

export const InteractiveCanvas = forwardRef<InteractiveCanvasHandle, InteractiveCanvasProps>(({
  currentTool,
  selectedElement,
  brushSize,
  onStrokesChange,
  onHistoryChange,
  onDrawingStatusChange,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Vector strokes history
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const [undoStack, setUndoStack] = useState<SketchStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<SketchStroke[][]>([]);

  // Active stroke being drawn
  const currentStrokeRef = useRef<SketchStroke | null>(null);
  const isPointerDownRef = useRef<boolean>(false);

  // Viewport / Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 500,
  });

  // Notify parent of stroke changes
  useEffect(() => {
    onStrokesChange(strokes);
  }, [strokes, onStrokesChange]);

  // Notify parent of history status
  useEffect(() => {
    if (onHistoryChange) {
      onHistoryChange(undoStack.length > 0 || strokes.length > 0, redoStack.length > 0);
    }
  }, [undoStack.length, strokes.length, redoStack.length, onHistoryChange]);

  // Full re-render from normalized vector strokes
  const redrawAllStrokes = useCallback((customStrokes?: SketchStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const strokeList = customStrokes !== undefined ? customStrokes : strokes;
    renderStrokesToCanvas(ctx, strokeList, canvas.width, canvas.height, {
      backgroundColor: '#ffffff',
      clearBeforeRender: true,
    });
  }, [strokes]);

  // Responsive Canvas Sizing & DPR scaling via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width <= 0) continue;

        // Maintain 16:10 aspect ratio
        const logicalWidth = Math.min(1000, Math.max(480, Math.floor(width - 32)));
        const logicalHeight = Math.round((logicalWidth * 10) / 16);

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(logicalWidth * dpr);
        canvas.height = Math.round(logicalHeight * dpr);

        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;

        setCanvasDimensions({ width: logicalWidth, height: logicalHeight });

        // Redraw all normalized strokes at new scale
        redrawAllStrokes();
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [redrawAllStrokes]);

  // Redraw when strokes change
  useEffect(() => {
    redrawAllStrokes();
  }, [strokes, redrawAllStrokes]);

  // History: Undo
  const handleUndo = useCallback(() => {
    if (strokes.length === 0 && undoStack.length === 0) return;

    if (strokes.length > 0) {
      const lastStroke = strokes[strokes.length - 1];
      const newStrokes = strokes.slice(0, -1);
      setRedoStack((prev) => [...prev, [lastStroke]]);
      setStrokes(newStrokes);
    }
  }, [strokes, undoStack]);

  // History: Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const lastUndoneList = redoStack[redoStack.length - 1];
    if (lastUndoneList && lastUndoneList.length > 0) {
      setRedoStack((prev) => prev.slice(0, -1));
      setStrokes((prev) => [...prev, ...lastUndoneList]);
    }
  }, [redoStack]);

  // Clear
  const handleClear = useCallback(() => {
    if (strokes.length > 0) {
      setUndoStack((prev) => [...prev, strokes]);
      setRedoStack([]);
      setStrokes([]);
    }
  }, [strokes]);

  // Sample Preset Level Generation
  const handleLoadSample = useCallback((preset: 'hills' | 'canyon') => {
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);

    if (preset === 'hills') {
      // Rolling Hills level
      const newStrokes: SketchStroke[] = [
        // Solid Ground
        {
          id: `sample-ground-1`,
          elementType: 'ground',
          color: ELEMENT_DEFINITIONS.ground.color,
          width: 14,
          timestamp: Date.now(),
          points: [
            { x: 0.05, y: 0.82 },
            { x: 0.25, y: 0.82 },
            { x: 0.45, y: 0.72 },
            { x: 0.65, y: 0.72 },
            { x: 0.85, y: 0.82 },
            { x: 0.95, y: 0.82 },
          ],
        },
        // Floating platform
        {
          id: `sample-ground-2`,
          elementType: 'ground',
          color: ELEMENT_DEFINITIONS.ground.color,
          width: 12,
          timestamp: Date.now(),
          points: [
            { x: 0.35, y: 0.48 },
            { x: 0.55, y: 0.48 },
          ],
        },
        // Trampoline
        {
          id: `sample-tramp-1`,
          elementType: 'trampoline',
          color: ELEMENT_DEFINITIONS.trampoline.color,
          width: 14,
          timestamp: Date.now(),
          points: [
            { x: 0.22, y: 0.81 },
            { x: 0.32, y: 0.81 },
          ],
        },
        // Coins
        {
          id: `sample-coin-1`,
          elementType: 'coin',
          color: ELEMENT_DEFINITIONS.coin.color,
          width: 16,
          timestamp: Date.now(),
          points: [{ x: 0.45, y: 0.38 }],
        },
        {
          id: `sample-coin-2`,
          elementType: 'coin',
          color: ELEMENT_DEFINITIONS.coin.color,
          width: 16,
          timestamp: Date.now(),
          points: [{ x: 0.50, y: 0.38 }],
        },
        // Goal Portal
        {
          id: `sample-goal-1`,
          elementType: 'goal',
          color: ELEMENT_DEFINITIONS.goal.color,
          width: 18,
          timestamp: Date.now(),
          points: [
            { x: 0.88, y: 0.76 },
            { x: 0.88, y: 0.68 },
          ],
        },
      ];
      setStrokes(newStrokes);
    } else {
      // Spike Canyon level
      const newStrokes: SketchStroke[] = [
        // Left ledge
        {
          id: `sample-canyon-ground-1`,
          elementType: 'ground',
          color: ELEMENT_DEFINITIONS.ground.color,
          width: 14,
          timestamp: Date.now(),
          points: [
            { x: 0.05, y: 0.65 },
            { x: 0.28, y: 0.65 },
          ],
        },
        // Right ledge
        {
          id: `sample-canyon-ground-2`,
          elementType: 'ground',
          color: ELEMENT_DEFINITIONS.ground.color,
          width: 14,
          timestamp: Date.now(),
          points: [
            { x: 0.72, y: 0.65 },
            { x: 0.95, y: 0.65 },
          ],
        },
        // Pit Hazard Spikes
        {
          id: `sample-canyon-spike-1`,
          elementType: 'hazard',
          color: ELEMENT_DEFINITIONS.hazard.color,
          width: 12,
          timestamp: Date.now(),
          points: [
            { x: 0.32, y: 0.88 },
            { x: 0.38, y: 0.82 },
            { x: 0.44, y: 0.88 },
            { x: 0.50, y: 0.82 },
            { x: 0.56, y: 0.88 },
            { x: 0.62, y: 0.82 },
            { x: 0.68, y: 0.88 },
          ],
        },
        // Trampoline Launcher in pit
        {
          id: `sample-canyon-tramp`,
          elementType: 'trampoline',
          color: ELEMENT_DEFINITIONS.trampoline.color,
          width: 14,
          timestamp: Date.now(),
          points: [
            { x: 0.45, y: 0.86 },
            { x: 0.55, y: 0.86 },
          ],
        },
        // Goal
        {
          id: `sample-canyon-goal`,
          elementType: 'goal',
          color: ELEMENT_DEFINITIONS.goal.color,
          width: 18,
          timestamp: Date.now(),
          points: [
            { x: 0.88, y: 0.58 },
            { x: 0.88, y: 0.48 },
          ],
        },
      ];
      setStrokes(newStrokes);
    }
  }, [strokes]);

  const handleLoadStrokes = useCallback((newStrokes: SketchStroke[]) => {
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);
    setStrokes(newStrokes);
  }, [strokes]);

  // Expose Imperative API via ref
  useImperativeHandle(ref, () => ({
    getCanvasElement: () => canvasRef.current,
    getStrokes: () => strokes,
    undo: handleUndo,
    redo: handleRedo,
    clear: handleClear,
    canUndo: () => strokes.length > 0,
    canRedo: () => redoStack.length > 0,
    exportPng: (backgroundColor = '#ffffff') => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas element not available.');
      return exportSketchToPng(canvas, backgroundColor);
    },
    exportBlob: (backgroundColor = '#ffffff') => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas element not available.');
      return exportSketchToBlob(canvas, backgroundColor);
    },
    loadSamplePreset: handleLoadSample,
    loadStrokes: handleLoadStrokes,
    getDimensions: () => canvasDimensions,
  }), [handleUndo, handleRedo, handleClear, handleLoadSample, handleLoadStrokes, strokes, redoStack.length, canvasDimensions]);

  // Pointer Event Handlers (High Accuracy & Normalization)
  const getNormalizedCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): NormalizedPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    return {
      x: clamp01(clientX / rect.width),
      y: clamp01(clientY / rect.height),
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (currentTool === 'select') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return; // Left click only

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture pointer to receive drag events even outside canvas boundaries
    canvas.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;
    if (onDrawingStatusChange) onDrawingStatusChange('drawing');

    const point = getNormalizedCoordinates(e);
    if (!point) return;

    const isEraser = currentTool === 'eraser';
    const color = isEraser ? '#ffffff' : ELEMENT_DEFINITIONS[selectedElement].color;
    const strokeWidth = isEraser ? brushSize * 2 : brushSize;

    const newStroke: SketchStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      elementType: isEraser ? 'ground' : selectedElement,
      color,
      width: strokeWidth,
      points: [point],
      timestamp: Date.now(),
    };

    currentStrokeRef.current = newStroke;

    // Direct draw first dot on canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, strokeWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = getNormalizedCoordinates(e);
    if (!point) return;

    const stroke = currentStrokeRef.current;
    const prevPoint = stroke.points[stroke.points.length - 1];

    stroke.points.push(point);

    // Draw active smooth segment in real time
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(prevPoint.x * canvas.width, prevPoint.y * canvas.height);
    ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
    ctx.stroke();
    ctx.restore();
  };

  const finishDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    if (onDrawingStatusChange) onDrawingStatusChange('idle');

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer might already be released
      }
    }

    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      const finishedStroke = currentStrokeRef.current;
      currentStrokeRef.current = null;

      // Commit stroke
      setUndoStack((prev) => [...prev, strokes]);
      setRedoStack([]);
      setStrokes((prev) => [...prev, finishedStroke]);
    }
  };

  return (
    <section
      ref={containerRef}
      aria-label="Central Sketch Canvas Viewport"
      className="flex-1 bg-[#0a0e1c]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col items-center justify-between min-h-[580px] relative overflow-hidden"
    >
      {/* Top Viewport Header */}
      <div className="w-full flex items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="font-bold text-slate-200">Level Drawing Viewport</span>
          <span className="text-[11px] text-slate-500 font-mono">
            {canvasDimensions.width} × {canvasDimensions.height} px
          </span>
        </div>

        {/* Zoom & Grid Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#060914] rounded-lg p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.1))}
              title="Zoom out"
              aria-label="Zoom out"
              className="p-1 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
              title="Zoom in"
              aria-label="Zoom in"
              className="p-1 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              title="Reset 100% Zoom"
              aria-label="Reset Zoom"
              className="px-1.5 py-0.5 text-[10px] hover:text-cyan-400 text-slate-400 border-l border-slate-800"
            >
              100%
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Alignment Grid"
            aria-pressed={showGrid}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              showGrid
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                : 'bg-[#060914] text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Grid</span>
          </button>
        </div>
      </div>

      {/* Quick Sample Presets Strip */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3 bg-[#060914] p-2 rounded-xl border border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 pl-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Starter Level Blueprints:</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleLoadSample('hills')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Mountain className="w-3 h-3" />
            <span>Rolling Hills</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('canyon')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Flame className="w-3 h-3" />
            <span>Spike Canyon</span>
          </button>
        </div>
      </div>

      {/* The Central Canvas Frame */}
      <div
        className="relative my-auto rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-white transition-transform duration-200"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          tabIndex={0}
          aria-label="Level sketch canvas. Draw platforms, hazards, trampolines, coins, and goals."
          style={{ touchAction: 'none' }}
          className={`block ${
            currentTool === 'eraser'
              ? 'cursor-cell'
              : currentTool === 'select'
              ? 'cursor-grab'
              : 'cursor-crosshair'
          } focus-visible:ring-4 focus-visible:ring-cyan-400 focus-visible:outline-none`}
        />

        {/* Toggleable Subtle Grid Overlay */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />
        )}

        {/* Center Symmetry Reference Guidelines */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-15">
          <div className="w-full h-[1px] bg-slate-500" />
          <div className="h-full w-[1px] bg-slate-500 absolute" />
        </div>

        {/* Empty-State Overlay (Guides User before any stroke is drawn) */}
        {strokes.length === 0 && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center bg-white/70 backdrop-blur-[1px] animate-in fade-in duration-300">
            <div className="max-w-sm p-5 rounded-2xl bg-[#090e1c]/90 border border-slate-700/80 text-white shadow-2xl">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                Canvas Ready
              </span>
              <h3 className="text-sm font-extrabold text-white mb-2">
                Draw Your Playable Game Level
              </h3>
              <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                Click and drag to sketch. Select elements from the left palette to define physical surfaces:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-left">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Mountain className="w-3 h-3" /> Ground terrain
                </div>
                <div className="flex items-center gap-1.5 text-rose-400">
                  <Flame className="w-3 h-3" /> Hazard spikes
                </div>
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Zap className="w-3 h-3" /> Bouncy trampoline
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Coins className="w-3 h-3" /> Collectible coins
                </div>
                <div className="flex items-center gap-1.5 text-purple-400 col-span-2">
                  <Flag className="w-3 h-3" /> Goal portal
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Viewport Bottom Info Ribbon */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-[11px]">
          <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
          <span>
            Active Element: <strong className="text-white capitalize">{selectedElement}</strong>
          </span>
          <span>•</span>
          <span>Strokes: <strong className="text-cyan-400 font-mono">{strokes.length}</strong></span>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Pointer Input: Mouse / Stylus / Touch (Normalized Vector Model)
        </div>
      </div>
    </section>
  );
});

InteractiveCanvas.displayName = 'InteractiveCanvas';
