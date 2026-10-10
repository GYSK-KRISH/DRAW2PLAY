import React, { useRef, useState, useEffect } from 'react';
import { Eraser, RotateCcw, Sparkles, Undo } from 'lucide-react';

interface DrawingCanvasProps {
  onAnalyze: (dataUrl: string) => void;
  isAnalyzing: boolean;
}

const PRESET_COLORS = [
  { name: 'Ink Black', value: '#0f172a' },
  { name: 'Cyber Cyan', value: '#06b6d4' },
  { name: 'Lightning Gold', value: '#eab308' },
  { name: 'Inferno Red', value: '#ef4444' },
  { name: 'Radioactive Green', value: '#22c55e' },
  { name: 'Cosmic Purple', value: '#a855f7' },
  { name: 'Chalk White', value: '#f8fafc' },
];

const BRUSH_SIZES = [
  { label: 'Fine', size: 4 },
  { label: 'Medium', size: 8 },
  { label: 'Bold', size: 14 },
];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onAnalyze, isAnalyzing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#0f172a');
  const [brushSize, setBrushSize] = useState(8);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);

  const saveState = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-15), state]);
  }, []);

  // Initialize Canvas with background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  }, [saveState]);

  const handleUndo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const previous = newHistory[newHistory.length - 1];
    if (previous) {
      ctx.putImageData(previous, 0, 0);
      setHistory(newHistory);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  // Quick Preset Sample
  const handleLoadSample = (sampleType: 'speedster' | 'golem') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (sampleType === 'speedster') {
      // Draw a sleek runner with wings
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Head & body
      ctx.beginPath();
      ctx.arc(200, 140, 45, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.stroke();

      // Wing-shaped ears / horn
      ctx.beginPath();
      ctx.moveTo(200, 95);
      ctx.lineTo(260, 50);
      ctx.lineTo(220, 110);
      ctx.fillStyle = '#eab308';
      ctx.fill();
      ctx.stroke();

      // Body torso
      ctx.strokeStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(200, 185);
      ctx.lineTo(190, 290);
      ctx.stroke();

      // Speedy limbs
      ctx.beginPath();
      ctx.moveTo(190, 290);
      ctx.lineTo(130, 340);
      ctx.moveTo(190, 290);
      ctx.lineTo(270, 340);
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(220, 135, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Draw a chunky armored golem
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#065f46';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.roundRect(110, 120, 180, 170, [25]);
      ctx.fill();
      ctx.stroke();

      // Shoulder plates
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(90, 150, 30, 0, Math.PI * 2);
      ctx.arc(310, 150, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(160, 180, 12, 0, Math.PI * 2);
      ctx.arc(240, 180, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    saveState();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const handleExportAndAnalyze = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onAnalyze(dataUrl);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
      {/* Canvas Toolset */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-lg">
        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.name}
              type="button"
              onClick={() => {
                setCurrentColor(c.value);
                setIsEraser(false);
              }}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                !isEraser && currentColor === c.value
                  ? 'border-white scale-110 shadow-md'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}

          {/* Eraser Button */}
          <button
            type="button"
            title="Eraser"
            onClick={() => setIsEraser(!isEraser)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
              isEraser
                ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Brush Sizes */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {BRUSH_SIZES.map((b) => (
            <button
              key={b.size}
              type="button"
              onClick={() => setBrushSize(b.size)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                brushSize === b.size
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Undo and Clear */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Undo"
            onClick={handleUndo}
            disabled={history.length <= 1}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 rounded-lg text-xs"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Clear Canvas"
            onClick={handleClear}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Drawing Canvas Surface */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair touch-none block"
        />

        {/* Subtle center guide lines for drawing symmetry */}
        <div className="absolute inset-0 pointer-events-none border border-slate-200/30 flex items-center justify-center">
          <div className="w-full h-[1px] bg-slate-200/20" />
          <div className="h-full w-[1px] bg-slate-200/20 absolute" />
        </div>
      </div>

      {/* Preset helpers & Action button */}
      <div className="w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Quick presets:</span>
          <button
            type="button"
            onClick={() => handleLoadSample('speedster')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors"
          >
            ⚡ Speedster
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('golem')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors"
          >
            🛡️ Golem
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportAndAnalyze}
          disabled={isAnalyzing}
          className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analyzing with Image AI...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Transform Character</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
