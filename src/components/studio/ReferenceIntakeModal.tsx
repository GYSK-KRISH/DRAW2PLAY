import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Video,
  Paintbrush,
  Sparkles,
  Cpu,
  AlertTriangle,
  Play,
  Save,
  Download,
  CheckCircle2,
  Boxes,
  Compass,
  Eye,
  Sliders,
  FileCode,
  Layers,
  Film,
  Info,
  TrendingUp,
} from 'lucide-react';
import type {
  ReferenceAnalysis,
  GameGenerationPlan,
  GameCategory,
  TargetEngine,
  AnalysisConfidenceTier,
} from '../../types/reference.js';
import type { PlayableGameScene } from '../../types/scene.js';
import {
  uploadReferenceMedia,
  analyzeReferenceVision,
  analyzeMultipleFrames,
  requestGamePlan,
} from '../../services/api.js';
import { loadImageFile, extractVideoFrame } from '../../utils/mediaExtractor.js';
import { convertPlanToPlayableScene } from '../../game/sceneConverter.js';
import { audioService } from '../../services/audioService.js';

interface ReferenceIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayLevel: (scene: PlayableGameScene) => void;
  onSavePlanCreation?: (plan: GameGenerationPlan) => void;
  getCurrentCanvasPng?: () => string;
  hasCanvasStrokes?: boolean;
}

type TabMode = 'upload-image' | 'video-frame' | 'canvas-sketch';

/** Phase 6.2: Maximum frames to collect for multi-frame analysis */
const MAX_CAPTURE_FRAMES = 5;

/** Confidence tier display config */
const CONFIDENCE_TIER_CONFIG: Record<
  AnalysisConfidenceTier,
  { label: string; color: string; bg: string; border: string }
> = {
  high: { label: 'High Confidence', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  medium: { label: 'Medium Confidence', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  low: { label: 'Low Confidence', color: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
};

export const ReferenceIntakeModal: React.FC<ReferenceIntakeModalProps> = ({
  isOpen,
  onClose,
  onPlayLevel,
  onSavePlanCreation,
  getCurrentCanvasPng,
  hasCanvasStrokes = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('upload-image');

  // Input Media State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{
    name: string;
    width: number;
    height: number;
    sizeBytes: number;
  } | null>(null);

  // Video Specific State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [seekTime, setSeekTime] = useState<number>(0.5);
  const [isExtractingFrame, setIsExtractingFrame] = useState<boolean>(false);

  // Phase 6.2: Multi-frame state
  const [capturedFrames, setCapturedFrames] = useState<{ dataUrl: string; timestampS: number }[]>([]);
  const [useMultiFrame, setUseMultiFrame] = useState<boolean>(false);
  const [isAnalyzingMultiFrame, setIsAnalyzingMultiFrame] = useState<boolean>(false);

  // User Prompt
  const [userPrompt, setUserPrompt] = useState<string>(
    'Create an original playable voxel exploration game inspired by this reference.'
  );

  // Process States
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Output State
  const [referenceId, setReferenceId] = useState<string>('ref-local');
  const [analysis, setAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [editedCategory, setEditedCategory] = useState<GameCategory>('voxel');
  const [editedPipeline, setEditedPipeline] = useState<TargetEngine>('future-3d-engine');
  const [generatedPlan, setGeneratedPlan] = useState<GameGenerationPlan | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Image File Selection
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      const loaded = await loadImageFile(file);
      setPreviewImage(loaded.dataUrl);
      setImageMeta({
        name: loaded.fileName,
        width: loaded.width,
        height: loaded.height,
        sizeBytes: loaded.fileSizeBytes,
      });
      setAnalysis(null);
      setGeneratedPlan(null);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    }
  };

  // Handle Video File Selection
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      setVideoFile(file);
      setIsExtractingFrame(true);
      setCapturedFrames([]);

      const frame = await extractVideoFrame(file, seekTime);
      setPreviewImage(frame.dataUrl);
      setVideoDuration(frame.videoDurationSeconds || 5);
      setImageMeta({
        name: `${file.name} (frame at ${seekTime.toFixed(1)}s)`,
        width: frame.width,
        height: frame.height,
        sizeBytes: Math.round(frame.dataUrl.length * 0.75),
      });
      setAnalysis(null);
      setGeneratedPlan(null);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsExtractingFrame(false);
    }
  };

  // Scrub Video Frame
  const handleSeekFrame = async (time: number) => {
    if (!videoFile) return;
    setSeekTime(time);
    setIsExtractingFrame(true);
    try {
      const frame = await extractVideoFrame(videoFile, time);
      setPreviewImage(frame.dataUrl);
      setImageMeta((prev) =>
        prev
          ? {
              ...prev,
              name: `${videoFile.name} (frame at ${time.toFixed(1)}s)`,
            }
          : null
      );
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsExtractingFrame(false);
    }
  };

  // Phase 6.2: Capture current frame for multi-frame batch
  const handleCaptureFrame = async () => {
    if (!previewImage || capturedFrames.length >= MAX_CAPTURE_FRAMES) return;
    setCapturedFrames((prev) => [...prev, { dataUrl: previewImage, timestampS: seekTime }]);
  };

  const handleRemoveCapturedFrame = (idx: number) => {
    setCapturedFrames((prev) => prev.filter((_, i) => i !== idx));
  };

  // Load Current Sketch from Studio
  const handleUseCurrentSketch = () => {
    if (!getCurrentCanvasPng || !hasCanvasStrokes) return;
    try {
      setErrorMessage(null);
      const dataUrl = getCurrentCanvasPng();
      setPreviewImage(dataUrl);
      setImageMeta({
        name: 'Active Studio Sketch.png',
        width: 800,
        height: 500,
        sizeBytes: Math.round(dataUrl.length * 0.75),
      });
      setAnalysis(null);
      setGeneratedPlan(null);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    }
  };

  // Phase 6.2: Run multi-frame analysis
  const handleAnalyzeMultiFrame = async () => {
    if (capturedFrames.length < 2) {
      setErrorMessage('Capture at least 2 frames to use multi-frame analysis.');
      return;
    }

    setIsAnalyzingMultiFrame(true);
    setErrorMessage(null);
    setNoticeMessage(null);
    audioService.playClick();

    try {
      const res = await analyzeMultipleFrames(
        capturedFrames.map((f) => f.dataUrl),
        userPrompt
      );
      setAnalysis(res.analysis);
      setEditedCategory(res.analysis.category);
      setEditedPipeline(res.analysis.recommendedPipeline);
      setNoticeMessage(
        `Multi-frame analysis complete: ${res.frameCount} frames processed by Gemini Vision.`
      );
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Multi-frame analysis failed');
    } finally {
      setIsAnalyzingMultiFrame(false);
    }
  };

  // Run AI Reference Analysis (single image)
  const handleAnalyze = async () => {
    if (!previewImage) {
      setErrorMessage('Please provide a reference image, video frame, or sketch first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setNoticeMessage(null);
    audioService.playClick();

    try {
      // 1. Upload & validate via safe server upload service
      let refId = 'ref-temp';
      try {
        const uploadRes = await uploadReferenceMedia(
          previewImage,
          imageMeta?.name || 'reference.png',
          activeTab === 'video-frame' ? 'video-frame' : activeTab === 'canvas-sketch' ? 'sketch' : 'image',
          userPrompt
        );
        refId = uploadRes.reference.id;
        setReferenceId(refId);
      } catch (uploadErr) {
        console.warn('Server upload storage warning:', uploadErr);
      }

      // 2. Perform vision analysis
      const analysisRes = await analyzeReferenceVision(previewImage, userPrompt);
      setAnalysis(analysisRes.analysis);
      setEditedCategory(analysisRes.analysis.category);
      setEditedPipeline(analysisRes.analysis.recommendedPipeline);
      if (analysisRes.notice) {
        setNoticeMessage(analysisRes.notice);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Reference analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate Structured Plan
  const handleGeneratePlan = async () => {
    if (!analysis) return;

    setIsGeneratingPlan(true);
    setErrorMessage(null);
    audioService.playClick();

    try {
      // Create clone with user edits
      const updatedAnalysis: ReferenceAnalysis = {
        ...analysis,
        category: editedCategory,
        recommendedPipeline: editedPipeline,
      };

      const planRes = await requestGamePlan(
        referenceId,
        userPrompt,
        updatedAnalysis,
        editedPipeline
      );

      setGeneratedPlan(planRes.plan);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to generate plan');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Launch Playable 2D Level
  const handlePlay2D = () => {
    if (!generatedPlan) return;
    audioService.playVictory();
    const scene = convertPlanToPlayableScene(generatedPlan);
    onPlayLevel(scene);
    onClose();
  };

  // Export Plan JSON
  const handleExportPlanJson = () => {
    if (!generatedPlan) return;
    const jsonStr = JSON.stringify(
      {
        generationPlan: generatedPlan,
        analysis,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `draw2play-plan-${generatedPlan.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confidenceCfg = analysis?.analysisConfidenceTier
    ? CONFIDENCE_TIER_CONFIG[analysis.analysisConfidenceTier]
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl bg-[#0a0e1c] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#070a13]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[1px]">
              <div className="w-full h-full bg-[#0a0e1c] rounded-[11px] flex items-center justify-center">
                <Boxes className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Multimodal Reference Intake & Game-Type Detection
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">
                  Phase 6.2
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transform screenshots, video frames, and concept art into validated game generation plans
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-200">
          {/* Input Source Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('upload-image')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'upload-image'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Screenshot / Image</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('video-frame')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'video-frame'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Frame Grabber</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('canvas-sketch');
                handleUseCurrentSketch();
              }}
              disabled={!hasCanvasStrokes}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'canvas-sketch'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Use Current Canvas Sketch</span>
            </button>
          </div>

          {/* Media Input Viewport */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Input Selection & File Controls */}
            <div className="flex flex-col gap-3">
              {activeTab === 'upload-image' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-cyan-400 rounded-xl p-6 flex flex-col items-center justify-center gap-3 bg-slate-900/40 hover:bg-slate-900/60 transition-all cursor-pointer min-h-[180px]"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-cyan-400" />
                  <div className="text-center">
                    <p className="font-semibold text-white">Click or drag image file here</p>
                    <p className="text-xs text-slate-400 mt-1">Supports PNG, JPEG, or WebP up to 10MB</p>
                  </div>
                </div>
              )}

              {activeTab === 'video-frame' && (
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Choose Short Gameplay Video:</span>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-semibold cursor-pointer"
                    >
                      {videoFile ? 'Change Video' : 'Browse Video (MP4/WebM)'}
                    </button>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={handleVideoFileChange}
                      className="hidden"
                    />
                  </div>

                  {videoFile && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Selected Frame Timestamp:</span>
                        <span className="font-mono text-cyan-400">{seekTime.toFixed(1)}s / {videoDuration.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={videoDuration}
                        step="0.1"
                        value={seekTime}
                        onChange={(e) => handleSeekFrame(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />

                      {/* Phase 6.2: Multi-frame capture controls */}
                      <div className="pt-2 border-t border-slate-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Film className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-xs font-semibold text-slate-300">Multi-Frame Analysis</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Phase 6.2</span>
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={useMultiFrame}
                              onChange={(e) => setUseMultiFrame(e.target.checked)}
                              className="accent-purple-400"
                            />
                            <span className="text-xs text-slate-400">Enable</span>
                          </label>
                        </div>

                        {useMultiFrame && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-slate-400">
                                Capture frames from different timestamps to improve mechanic detection.
                                Min 2, max {MAX_CAPTURE_FRAMES}.
                              </p>
                              <button
                                type="button"
                                onClick={handleCaptureFrame}
                                disabled={!previewImage || capturedFrames.length >= MAX_CAPTURE_FRAMES || isExtractingFrame}
                                className="ml-2 shrink-0 px-2 py-1 rounded bg-purple-600/80 hover:bg-purple-600 text-[10px] font-bold text-white disabled:opacity-40 cursor-pointer"
                              >
                                + Capture {seekTime.toFixed(1)}s
                              </button>
                            </div>

                            {capturedFrames.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {capturedFrames.map((f, idx) => (
                                  <div key={idx} className="relative group">
                                    <img
                                      src={f.dataUrl}
                                      alt={`Frame ${idx + 1}`}
                                      className="w-14 h-10 object-cover rounded border border-slate-700 group-hover:border-rose-500 transition-colors"
                                    />
                                    <div className="absolute -top-1.5 -left-1 bg-purple-600 text-white text-[9px] font-mono px-1 rounded">
                                      {f.timestampS.toFixed(1)}s
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCapturedFrame(idx)}
                                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {capturedFrames.length >= 2 && (
                              <button
                                type="button"
                                onClick={handleAnalyzeMultiFrame}
                                disabled={isAnalyzingMultiFrame}
                                className="w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white disabled:opacity-40 cursor-pointer"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                {isAnalyzingMultiFrame
                                  ? `Analyzing ${capturedFrames.length} frames...`
                                  : `Analyze ${capturedFrames.length} Frames with Gemini Vision`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'canvas-sketch' && (
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 space-y-2">
                  <p className="text-xs text-slate-300">
                    Using the current vector drawing from the Draw2Play canvas editor as the multimodal reference.
                  </p>
                  <button
                    type="button"
                    onClick={handleUseCurrentSketch}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 cursor-pointer"
                  >
                    Refresh Canvas Snapshot
                  </button>
                </div>
              )}

              {/* User Prompt Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Generation Prompt</span>
                  <span className="text-[10px] text-slate-500 font-normal">Intent guidance</span>
                </label>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  rows={3}
                  placeholder="e.g. Create an original playable voxel exploration game inspired by this reference."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-cyan-400 text-xs text-slate-100 placeholder-slate-500 resize-none outline-none"
                />

                {/* Preset Prompt Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setUserPrompt('Create an original playable voxel exploration game inspired by this reference.')
                    }
                    className="text-[10px] px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                  >
                    ⛏️ Voxel Game
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setUserPrompt('Generate a challenging 2D platformer level based on this terrain and obstacles.')
                    }
                    className="text-[10px] px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                  >
                    🍄 2D Platformer
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setUserPrompt('Design an isometric puzzle dungeon matching this aesthetic and perspective.')
                    }
                    className="text-[10px] px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                  >
                    📐 Isometric Dungeon
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Media Preview Frame */}
            <div className="flex flex-col border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  Reference Preview
                </span>
                {imageMeta && (
                  <span className="font-mono text-[10px] text-slate-400">
                    {imageMeta.width}x{imageMeta.height}px ({(imageMeta.sizeBytes / 1024).toFixed(0)} KB)
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-[200px] flex items-center justify-center p-3 bg-[#05070e]">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Reference preview"
                    className="max-h-[220px] max-w-full object-contain rounded-lg border border-slate-800 shadow-md"
                  />
                ) : (
                  <div className="text-center text-slate-500 text-xs">
                    <p>No reference loaded yet</p>
                    <p className="text-[10px] text-slate-600 mt-1">Upload an image or scrub a video frame</p>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!previewImage || isAnalyzing || isExtractingFrame || (useMultiFrame && activeTab === 'video-frame')}
                  className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-950/40 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                  <span>
                    {isAnalyzing
                      ? 'Analyzing Reference Vision...'
                      : useMultiFrame && activeTab === 'video-frame'
                      ? 'Use Multi-Frame Button Above ↑'
                      : 'Analyze Reference & Detect Type'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Error / Notice Banners */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {noticeMessage && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{noticeMessage}</span>
            </div>
          )}

          {/* Phase 6.2: Analysis Results Section */}
          {analysis && (
            <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white">Visual Reference Analysis</span>
                  {/* Provenance badge */}
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      analysis.provenance === 'gemini-vision'
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {analysis.provenance}
                    {analysis.frameCount > 1 ? ` · ${analysis.frameCount} frames` : ''}
                  </span>
                  {/* Phase 6.2: Confidence tier badge */}
                  {confidenceCfg && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${confidenceCfg.bg} ${confidenceCfg.color} ${confidenceCfg.border}`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      {confidenceCfg.label}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(analysis.analyzedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* Detected Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Category Card */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Detected Category</span>
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <Boxes className="w-4 h-4 text-cyan-400" />
                    <span className="capitalize">{analysis.category.replace('-', ' ')}</span>
                  </div>
                </div>

                {/* Camera Perspective */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Camera Perspective</span>
                  <div className="flex items-center gap-1.5 font-bold text-purple-300">
                    <Compass className="w-4 h-4 text-purple-400" />
                    <span className="capitalize">{analysis.cameraPerspective.replace(/-/g, ' ')}</span>
                  </div>
                </div>

                {/* Visual Style */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Visual Style</span>
                  <p className="font-semibold text-slate-200 text-xs truncate" title={analysis.visualStyle}>
                    {analysis.visualStyle}
                  </p>
                </div>

                {/* Color Palette */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Palette Swatches</span>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {analysis.colorPalette.map((color, idx) => (
                      <span
                        key={idx}
                        className="w-4 h-4 rounded-full border border-slate-700"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase 6.2: Visible Objects (Direct Observations) & Terrain */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      Direct Observations
                    </span>
                    <span className="text-[9px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">
                      Factual
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.visibleObjects.map((obj, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px]">
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Terrain & Elevation Layout
                  </span>
                  <p className="text-slate-300 text-xs">{analysis.terrainLayout}</p>
                </div>
              </div>

              {/* Phase 6.2: Inferred Mechanics with Observation Grounding */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Inferred Mechanics
                  </span>
                  <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                    Hypothesis — Not Confirmed Fact
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.inferredMechanics.map((mech, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{mech.name}</span>
                        <span className="font-mono text-cyan-400 text-[10px]">
                          {(mech.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full"
                          style={{ width: `${mech.confidence * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 italic">{mech.description}</p>
                      {/* Phase 6.2: Observation Evidence */}
                      {mech.observationalEvidence && mech.observationalEvidence.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-800">
                          <div className="flex items-center gap-1 mb-1">
                            <Info className="w-3 h-3 text-cyan-400" />
                            <span className="text-[9px] uppercase tracking-wider text-cyan-400 font-bold">
                              Supporting Visual Evidence
                            </span>
                          </div>
                          <ul className="space-y-0.5">
                            {mech.observationalEvidence.map((ev, ei) => (
                              <li key={ei} className="text-[10px] text-slate-300 flex items-start gap-1">
                                <span className="text-cyan-500 mt-0.5">›</span>
                                <span>{ev}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase 6.2: Multi-frame results summary */}
              {analysis.frameResults && analysis.frameResults.length > 0 && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-bold text-purple-200 uppercase text-[10px] tracking-wider">
                      Multi-Frame Analysis Summary ({analysis.frameCount} frames)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {analysis.frameResults.map((fr, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-900/60 border border-purple-800/30 space-y-1">
                        <span className="text-[10px] font-mono text-purple-300">Frame {fr.frameIndex + 1} — {fr.timestampSeconds.toFixed(1)}s</span>
                        <p className="text-[10px] text-slate-400">{fr.terrainNotes}</p>
                        {fr.uniqueObservations.length > 0 && (
                          <ul className="space-y-0.5">
                            {fr.uniqueObservations.slice(0, 2).map((obs, oi) => (
                              <li key={oi} className="text-[9px] text-slate-500 flex items-start gap-1">
                                <span className="text-purple-500">›</span>
                                <span>{obs}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Uncertainties & Warnings */}
              {analysis.uncertaintiesAndWarnings.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 text-xs">
                  <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Model Limitations & Boundary Notes
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
                    {analysis.uncertaintiesAndWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editable Analysis & Target Pipeline Configuration */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>Customize Generation Target & Output Engine</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                      Target Game Category
                    </label>
                    <select
                      value={editedCategory}
                      onChange={(e) => {
                        const cat = e.target.value as GameCategory;
                        setEditedCategory(cat);
                        if (cat === 'voxel' || cat === '3d-world' || cat === 'isometric') {
                          setEditedPipeline('future-3d-engine');
                        } else {
                          setEditedPipeline('phaser-2d');
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 outline-none"
                    >
                      <option value="voxel">Voxel (Minecraft-style 3D cubes)</option>
                      <option value="2d-platformer">2D Platformer (Supported by Phaser Engine)</option>
                      <option value="top-down-2d">Top-Down 2D</option>
                      <option value="3d-world">3D World</option>
                      <option value="isometric">Isometric</option>
                      <option value="puzzle">Puzzle</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                      Engine Pipeline
                    </label>
                    <select
                      value={editedPipeline}
                      onChange={(e) => setEditedPipeline(e.target.value as TargetEngine)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 outline-none"
                    >
                      <option value="future-3d-engine">Dedicated 3D Engine (Future Phase)</option>
                      <option value="phaser-2d">Phaser 2D Physics Engine (Playable Now)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={isGeneratingPlan}
                  className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{isGeneratingPlan ? 'Generating Structured Plan...' : 'Generate Game Generation Plan'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Generated Plan Output Modal Section */}
          {generatedPlan && (
            <div className="border-2 border-cyan-500/30 rounded-xl bg-slate-900/60 p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      Validated Game Generation Plan: <span className="font-mono text-cyan-300">{generatedPlan.id}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Target Engine: {generatedPlan.targetEngine}</p>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full uppercase border ${
                    generatedPlan.status === 'ready-for-2d-generation'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {generatedPlan.status}
                </span>
              </div>

              {/* Condition 1: 3D Engine / Voxel Deferred Banner */}
              {generatedPlan.targetEngine === 'future-3d-engine' ? (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-800/60 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                      <Boxes className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-amber-200">Dedicated 3D Engine Required (Future Phase)</h4>
                      <p className="text-xs text-slate-300">
                        A single 2D screenshot cannot reconstruct 3D voxel coordinate chunk managers, raymarching
                        shaders, or depth buffers. Draw2Play AI Phase 6.2 has successfully detected and structured
                        this voxel generation plan, preserving it for the upcoming 3D Engine release.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-800/40 text-xs space-y-1">
                    <span className="font-bold text-amber-300">Required Architecture for Phase 7+:</span>
                    <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                      {generatedPlan.missingRequirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleExportPlanJson}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Export Plan JSON</span>
                    </button>
                    {onSavePlanCreation && (
                      <button
                        type="button"
                        onClick={() => {
                          onSavePlanCreation(generatedPlan);
                          audioService.playCoin();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Voxel Plan to Creations</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Condition 2: 2D Playable Engine Compatible */
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-900 border border-emerald-800/60 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Play className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-emerald-200">
                        Compatible with Draw2Play 2D Physics Engine!
                      </h4>
                      <p className="text-xs text-slate-300">
                        This reference matches a 2D platforming layout. Draw2Play can immediately generate a
                        playable level inside the active Phaser engine!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handlePlay2D}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Launch Playable 2D Level Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPlanJson}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Export Plan JSON</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#070a13] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Draw2Play AI Multimodal Intake Pipeline — Phase 6.2</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferenceIntakeModal;
