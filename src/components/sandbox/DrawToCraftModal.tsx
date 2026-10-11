import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Paintbrush,
  Eraser,
  RotateCcw,
  Sparkles,
  Hammer,
  Eye,
  Info,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { audioService } from '../../services/audioService.js';
import { requestSketchRecognition } from '../../services/craftService.js';
import {
  CRAFTABLE_ITEMS_CATALOGUE,
  CRAFTABLE_ITEM_ALLOWLIST,
  type CraftableItemId,
  type CraftSubmission,
  type RecognizeCraftResponse,
  type CraftRecognitionProvenance,
} from '../../types/sandbox.js';

interface DrawToCraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCraft?: (submission: CraftSubmission) => void;
  onAwardItem: (
    submissionId: string,
    itemId: CraftableItemId,
    provenance: CraftRecognitionProvenance
  ) => void;
}

type ModalTab = 'draw' | 'reviewed' | 'manual';

export const DrawToCraftModal: React.FC<DrawToCraftModalProps> = ({
  isOpen,
  onClose,
  onSubmitCraft,
  onAwardItem,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing state
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Workflow states
  const [activeTab, setActiveTab] = useState<ModalTab>('draw');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isAwarding, setIsAwarding] = useState<boolean>(false);
  const [recognitionResult, setRecognitionResult] = useState<RecognizeCraftResponse | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [selectedManualItem, setSelectedManualItem] = useState<CraftableItemId>('wood');
  const [manualCategoryFilter, setManualCategoryFilter] = useState<'all' | 'block' | 'material' | 'crafted'>('all');
  const [submissionId, setSubmissionId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generate a unique submission ID when modal opens
  const resetCraftSession = useCallback(() => {
    const newId = `craft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setSubmissionId(newId);
    setActiveTab('draw');
    setIsAnalyzing(false);
    setIsAwarding(false);
    setRecognitionResult(null);
    setThumbnailDataUrl(null);
    setErrorMessage(null);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initial]);
    setHistoryIndex(0);
    setStrokeCount(0);
    setErrorMessage(null);
  }, []);

  // Initialize canvas when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      resetCraftSession();
      clearCanvas();
    }, 20);

    return () => clearTimeout(timer);
  }, [isOpen, clearCanvas, resetCraftSession]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setStrokeCount((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    audioService.playClick();
    const targetIndex = historyIndex - 1;
    ctx.putImageData(history[targetIndex], 0, 0);
    setHistoryIndex(targetIndex);
    setStrokeCount((prev) => Math.max(0, prev - 1));
  };

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'brush' ? '#38bdf8' : '#0f172a';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveToHistory();
  };

  // Trigger real backend sketch recognition
  const handleAnalyzeSketch = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokeCount === 0) {
      setErrorMessage('Please draw something on the canvas before submitting.');
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);
    audioService.playClick();

    const dataUrl = canvas.toDataURL('image/png');
    setThumbnailDataUrl(dataUrl);

    try {
      const response = await requestSketchRecognition({
        imageBase64: dataUrl,
        strokeCount,
        allowFallback: true,
        clientTimestamp: new Date().toISOString(),
      });

      setRecognitionResult(response);
      setActiveTab('reviewed');

      // Register craft submission record
      onSubmitCraft?.({
        id: submissionId,
        strokesCount: strokeCount,
        submittedAt: new Date().toISOString(),
        thumbnailDataUrl: dataUrl,
        status: response.status === 'recognized' ? 'recognized' : 'needs-review',
        recognition: {
          predictedLabel: response.predictedLabel,
          mappedItemId: response.mappedItemId,
          confidence: response.confidence,
          confidenceTier: response.confidenceTier,
          provenance: response.provenance,
          isEligibleForCrafting: Boolean(response.mappedItemId),
          explanation: response.explanation,
        },
      });
    } catch (err: unknown) {
      console.error('Recognition error:', err);
      setErrorMessage((err as Error).message || 'Failed to analyze sketch.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Accept prediction and award item to player
  const handleAcceptPrediction = () => {
    if (!recognitionResult || !recognitionResult.mappedItemId || isAwarding) return;

    setIsAwarding(true);
    audioService.playCraft();

    const targetItem = recognitionResult.mappedItemId;
    onAwardItem(submissionId, targetItem, recognitionResult.provenance);

    setTimeout(() => {
      onClose();
    }, 150);
  };

  // Reject prediction: allows user to retry
  const handleRejectPrediction = () => {
    audioService.playClick();
    setRecognitionResult(null);
    setActiveTab('draw');
  };

  // Manual fallback selection submission
  const handleConfirmManualSelection = () => {
    if (isAwarding) return;
    setIsAwarding(true);
    audioService.playCraft();

    onAwardItem(submissionId, selectedManualItem, 'manual-input');

    onSubmitCraft?.({
      id: submissionId,
      strokesCount: strokeCount,
      submittedAt: new Date().toISOString(),
      thumbnailDataUrl: thumbnailDataUrl || undefined,
      status: 'accepted-awarded',
      awardedItemId: selectedManualItem,
      recognition: {
        predictedLabel: CRAFTABLE_ITEMS_CATALOGUE[selectedManualItem].displayName,
        mappedItemId: selectedManualItem,
        confidence: 1.0,
        confidenceTier: 'high',
        provenance: 'manual-input',
        isEligibleForCrafting: true,
        explanation: 'Selected manually by player from craftable catalogue.',
      },
    });

    setTimeout(() => {
      onClose();
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="craft-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-[#0b1329] border border-cyan-800/50 rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-cyan-900/40 bg-gradient-to-r from-[#0d1630] to-[#0b1329]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Hammer className="w-4 h-4" />
            </div>
            <div>
              <h2 id="craft-modal-title" className="text-sm font-bold text-white flex items-center gap-2">
                Draw to Craft
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                  Phase 7.2 AI
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Sketch an item outline to craft materials into your sandbox inventory
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audioService.playClick();
              onClose();
            }}
            aria-label="Close craft modal"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-800/80 bg-slate-900/30 text-xs">
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'draw'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            Sketch Canvas
          </button>
          <button
            onClick={() => setActiveTab('reviewed')}
            disabled={!recognitionResult}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'reviewed'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            AI Review {recognitionResult && '✓'}
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'manual'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Manual Selection
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: DRAWING VIEW */}
          {activeTab === 'draw' && (
            <div className="flex flex-col gap-3">
              {/* Canvas Controls */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => {
                      audioService.playClick();
                      setTool('brush');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      tool === 'brush'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    Brush
                  </button>
                  <button
                    onClick={() => {
                      audioService.playClick();
                      setTool('eraser');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      tool === 'eraser'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Eraser
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Undo stroke"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Undo
                  </button>
                  <button
                    onClick={() => {
                      audioService.playClick();
                      clearCanvas();
                    }}
                    disabled={strokeCount === 0}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Brush Size Slider */}
              <div className="flex items-center gap-3 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400">
                <span>Stroke Size:</span>
                <input
                  type="range"
                  min="2"
                  max="18"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                  className="w-28 accent-cyan-500 cursor-pointer"
                />
                <span className="font-mono text-cyan-400">{brushSize}px</span>
                <span className="text-slate-600">|</span>
                <span>Strokes: {strokeCount}</span>
              </div>

              {/* Canvas Viewport */}
              <div className="relative rounded-xl border border-cyan-900/40 overflow-hidden bg-[#0f172a] shadow-inner flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={250}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="cursor-crosshair touch-none w-full max-w-[500px] h-[250px]"
                />
              </div>

              {/* Helpful Guide Note */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-slate-200">Tip:</strong> Draw outline sketches like a{' '}
                  <span className="text-cyan-300">pickaxe, tree, axe, or log</span> for Wood; a{' '}
                  <span className="text-cyan-300">boulder or anvil</span> for Stone; a{' '}
                  <span className="text-cyan-300">shovel or soil</span> for Dirt; or a{' '}
                  <span className="text-cyan-300">plant or flower</span> for Grass.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: REVIEW RECOGNITION RESULT */}
          {activeTab === 'reviewed' && recognitionResult && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              {/* Top Banner with Provenance */}
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Recognition Pipeline:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                      recognitionResult.provenance === 'gemini-vision'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                        : recognitionResult.provenance === 'mock-heuristic'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                        : 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                    }`}
                  >
                    {recognitionResult.provenance === 'gemini-vision'
                      ? 'Live Gemini 3.8 Flash Vision'
                      : recognitionResult.provenance === 'mock-heuristic'
                      ? 'Offline Deterministic Heuristic'
                      : 'Manual Item Selection'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                      recognitionResult.status === 'recognized'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : recognitionResult.status === 'needs-review'
                        ? 'bg-amber-950 text-amber-400 border-amber-800'
                        : recognitionResult.status === 'unsupported'
                        ? 'bg-rose-950 text-rose-400 border-rose-800'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {recognitionResult.status === 'recognized' && <CheckCircle className="w-3.5 h-3.5" />}
                    {recognitionResult.status === 'needs-review' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {recognitionResult.status === 'unsupported' && <HelpCircle className="w-3.5 h-3.5" />}
                    {recognitionResult.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Drawing Thumbnail + Identification Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {thumbnailDataUrl && (
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-mono mb-1.5">Submitted Drawing</span>
                    <img
                      src={thumbnailDataUrl}
                      alt="Submitted sketch"
                      className="w-full h-28 object-contain rounded-lg border border-slate-800 bg-[#0f172a]"
                    />
                  </div>
                )}

                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  thumbnailDataUrl ? 'sm:col-span-2' : 'sm:col-span-3'
                } ${
                  recognitionResult.mappedItemId
                    ? 'bg-cyan-950/30 border-cyan-800/60'
                    : 'bg-rose-950/20 border-rose-900/50'
                }`}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-cyan-400">Identified Subject:</span>
                      {recognitionResult.confidence !== null && (
                        <span className="text-xs font-mono text-slate-300">
                          Confidence: {Math.round(recognitionResult.confidence * 100)}% ({recognitionResult.confidenceTier})
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>"{recognitionResult.predictedLabel}"</span>
                      {recognitionResult.mappedItemId && (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                      {recognitionResult.mappedItemId && (
                        <span className="text-emerald-400">
                          {CRAFTABLE_ITEMS_CATALOGUE[recognitionResult.mappedItemId].icon}{' '}
                          {CRAFTABLE_ITEMS_CATALOGUE[recognitionResult.mappedItemId].displayName}
                        </span>
                      )}
                    </h3>

                    {/* Confidence Progress Bar */}
                    {recognitionResult.confidence !== null ? (
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full ${
                            recognitionResult.confidence >= 0.75
                              ? 'bg-emerald-500'
                              : recognitionResult.confidence >= 0.5
                              ? 'bg-cyan-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.round(recognitionResult.confidence * 100)}%` }}
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-amber-400/90">
                        ⚡ Heuristic Classification (No calibrated model probability)
                      </span>
                    )}

                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {recognitionResult.explanation}
                    </p>
                  </div>

                  {recognitionResult.alternativeLabels.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-2 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-mono">Alternatives:</span>
                      {recognitionResult.alternativeLabels.map((alt, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {alt.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Limitations & Warnings */}
              {recognitionResult.limitationsAndWarnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-900/40 text-amber-200/90 text-xs flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Notices & Limitations:</span>
                  </div>
                  {recognitionResult.limitationsAndWarnings.map((warning, i) => (
                    <p key={i} className="text-[11px] text-amber-200/80 leading-snug">
                      • {warning}
                    </p>
                  ))}
                </div>
              )}

              {/* Action Buttons for Reviewed Prediction */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRejectPrediction}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    Redraw Sketch
                  </button>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    Select Manually
                  </button>
                </div>

                {recognitionResult.mappedItemId ? (
                  <button
                    onClick={handleAcceptPrediction}
                    disabled={isAwarding}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isAwarding ? 'Crafting...' : `Accept & Craft 1x ${CRAFTABLE_ITEMS_CATALOGUE[recognitionResult.mappedItemId].displayName}`}
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('manual')}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/60 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Sliders className="w-4 h-4" />
                    Choose Supported Item Manually
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL ITEM SELECTION FALLBACK */}
          {activeTab === 'manual' && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-150">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Select any item from the verified sandbox catalogue. Follows the exact same single-award and inventory validation rules.
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'block', 'material', 'crafted'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      audioService.playClick();
                      setManualCategoryFilter(cat);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                      manualCategoryFilter === cat
                        ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-900/50'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
                    }`}
                  >
                    {cat === 'all' ? 'All Items' : cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {CRAFTABLE_ITEM_ALLOWLIST
                  .filter((id) => manualCategoryFilter === 'all' || CRAFTABLE_ITEMS_CATALOGUE[id].category === manualCategoryFilter)
                  .map((itemId) => {
                    const item = CRAFTABLE_ITEMS_CATALOGUE[itemId];
                    const isSelected = selectedManualItem === itemId;
                    return (
                      <button
                        key={itemId}
                        type="button"
                        onClick={() => {
                          audioService.playClick();
                          setSelectedManualItem(itemId);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500'
                            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span className="text-lg">{item.icon}</span>
                            <span>{item.displayName}</span>
                          </span>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 capitalize">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{item.description}</p>
                      </button>
                    );
                  })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  onClick={() => setActiveTab('draw')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Back to Sketch Canvas
                </button>
                <button
                  onClick={handleConfirmManualSelection}
                  disabled={isAwarding}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAwarding
                    ? 'Crafting...'
                    : `Craft 1x ${CRAFTABLE_ITEMS_CATALOGUE[selectedManualItem].displayName}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Only shown on 'draw' tab) */}
        {activeTab === 'draw' && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-cyan-900/30 bg-slate-900/50">
            <button
              onClick={() => {
                audioService.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  audioService.playClick();
                  setActiveTab('manual');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Manual Fallback
              </button>
              <button
                onClick={handleAnalyzeSketch}
                disabled={strokeCount === 0 || isAnalyzing}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze & Recognize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
