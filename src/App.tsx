import { useState, useRef, useMemo } from 'react';
import { TopBar } from './components/studio/TopBar.js';
import { SketchToolbar } from './components/studio/SketchToolbar.js';
import { InteractiveCanvas, type InteractiveCanvasHandle } from './components/canvas/InteractiveCanvas.js';
import { ScenePanel } from './components/studio/ScenePanel.js';
import { BottomStatusBar } from './components/studio/BottomStatusBar.js';
import { ClearConfirmModal } from './components/modals/ClearConfirmModal.js';
import { ExportModal } from './components/modals/ExportModal.js';
import { AnalyzePreparationModal } from './components/modals/AnalyzePreparationModal.js';
import { EmptyCanvasAlertModal } from './components/modals/EmptyCanvasAlertModal.js';
import { HelpModal } from './components/studio/HelpModal.js';

import type {
  CanvasTool,
  SceneElementType,
  SketchStroke,
  SketchDocument,
} from './types/sketch.js';
import { calculateSceneSummary } from './utils/sketchSerializer.js';

const SESSION_START_TIME = new Date().toISOString();

export function App() {
  // Tool & Palette State
  const [currentTool, setCurrentTool] = useState<CanvasTool>('brush');
  const [selectedElement, setSelectedElement] = useState<SceneElementType>('ground');
  const [brushSize, setBrushSize] = useState<number>(8);

  // Canvas Vector Strokes State
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [drawingStatus, setDrawingStatus] = useState<'idle' | 'drawing'>('idle');
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 500,
  });

  // Modals Visibility
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState<boolean>(false);
  const [isEmptyAlertOpen, setIsEmptyAlertOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  // Prepared AI Data Payload
  const [preparedBlobSize, setPreparedBlobSize] = useState<number>(0);

  // Canvas Handle Ref
  const canvasRef = useRef<InteractiveCanvasHandle>(null);

  // Compute Scene Summary Deterministically
  const sceneSummary = useMemo(() => calculateSceneSummary(strokes), [strokes]);

  // Construct Active Sketch Document
  const sketchDocument: SketchDocument = useMemo(() => {
    return {
      id: 'doc-current-session',
      name: 'Draw2Play Level Sketch',
      canvasWidth: canvasDimensions.width,
      canvasHeight: canvasDimensions.height,
      strokes,
      createdAt: SESSION_START_TIME,
      updatedAt: SESSION_START_TIME,
      schemaVersion: '1.0',
    };
  }, [strokes, canvasDimensions]);

  // Handle Analyze Action (Validates prerequisites without faking AI)
  const handleAnalyzeClick = async () => {
    if (strokes.length === 0) {
      setIsEmptyAlertOpen(true);
      return;
    }

    try {
      if (canvasRef.current) {
        const blob = await canvasRef.current.exportBlob();
        setPreparedBlobSize(blob.size);
        setIsAnalyzeModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to prepare sketch image blob:', err);
    }
  };

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        canvasRef.current?.redo();
      } else {
        canvasRef.current?.undo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      canvasRef.current?.redo();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black outline-none"
    >
      {/* 1. TOP BAR */}
      <TopBar
        canUndo={canUndo}
        canRedo={canRedo}
        strokeCount={strokes.length}
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        onClearClick={() => setIsClearModalOpen(true)}
        onExportClick={() => setIsExportModalOpen(true)}
        onAnalyzeClick={handleAnalyzeClick}
        onHelpClick={() => setIsHelpModalOpen(true)}
      />

      {/* 2. MAIN APPLICATION WORKSPACE */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          {/* Left Toolbar: Canvas Tools, Sizes, and Semantic Element Palette */}
          <SketchToolbar
            currentTool={currentTool}
            onSelectTool={setCurrentTool}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            brushSize={brushSize}
            onSelectBrushSize={setBrushSize}
          />

          {/* Center Canvas: Responsive HTML5 Canvas with normalized vector strokes */}
          <InteractiveCanvas
            ref={canvasRef}
            currentTool={currentTool}
            selectedElement={selectedElement}
            brushSize={brushSize}
            onStrokesChange={(newStrokes) => {
              setStrokes(newStrokes);
              if (canvasRef.current) {
                setCanvasDimensions(canvasRef.current.getDimensions());
              }
            }}
            onHistoryChange={(undoable, redoable) => {
              setCanUndo(undoable);
              setCanRedo(redoable);
            }}
            onDrawingStatusChange={setDrawingStatus}
          />

          {/* Right Scene Panel: Element Counts, Technical Specs, Future AI Placeholder */}
          <ScenePanel
            summary={sceneSummary}
            canvasDimensions={canvasDimensions}
          />
        </div>
      </main>

      {/* 3. BOTTOM STATUS BAR */}
      <BottomStatusBar
        currentTool={currentTool}
        selectedElement={selectedElement}
        canvasDimensions={canvasDimensions}
        drawingStatus={drawingStatus}
        summary={sceneSummary}
      />

      {/* 4. MODALS & POPUPS */}
      <ClearConfirmModal
        isOpen={isClearModalOpen}
        strokeCount={strokes.length}
        onConfirm={() => canvasRef.current?.clear()}
        onClose={() => setIsClearModalOpen(false)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        document={sketchDocument}
        onGetPngDataUrl={() => canvasRef.current?.exportPng() || ''}
        onClose={() => setIsExportModalOpen(false)}
      />

      <AnalyzePreparationModal
        isOpen={isAnalyzeModalOpen}
        blobSize={preparedBlobSize}
        document={sketchDocument}
        summary={sceneSummary}
        onClose={() => setIsAnalyzeModalOpen(false)}
      />

      <EmptyCanvasAlertModal
        isOpen={isEmptyAlertOpen}
        onClose={() => setIsEmptyAlertOpen(false)}
        onLoadPreset={(preset) => canvasRef.current?.loadSamplePreset(preset)}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
}

export default App;
