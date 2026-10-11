import React, { useState, useRef, useEffect } from 'react';
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
  Eye,
  Sliders,
  FileCode,
  Layers,
  Film,
  TrendingUp,
  RotateCw,
  Ban,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
  Gamepad2,
  Palette,
  Wand2,
} from 'lucide-react';
import type {
  ReferenceAnalysis,
  GameGenerationPlan,
  GameCategory,
  TargetEngine,
  AnalysisConfidenceTier,
} from '../../types/reference.js';
import type { GameTemplateId, GameAssetBundle, AssetRole } from '../../types/plan.js';
import {
  generateAssetBundle,
  generateSingleAsset,
} from '../../services/assetGenerationService.js';
import {
  checkTemplateCompatibility,
  TEMPLATE_REGISTRY,
  type TemplateCompatibilityReport,
} from '../../templates/templateRegistry.js';
import type { PlayableGameScene } from '../../types/scene.js';
import {
  analyzeMultipleFrames,
  requestGamePlan,
} from '../../services/api.js';
import {
  loadImageFile,
  extractVideoFrame,
  type LoadedImageMedia,
} from '../../utils/mediaExtractor.js';
import {
  analysisLifecycleManager,
  type AnalysisLifecycleSnapshot,
} from '../../services/analysisLifecycle.js';
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
export type IntakeStep = 'intake' | 'plan-studio' | 'generation-results';

/** Maximum frames to collect for multi-frame analysis */
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
  // Workflow Step Management (Intake -> Plan Studio -> Generation Results)
  const [currentStep, setCurrentStep] = useState<IntakeStep>('intake');
  const [activeTab, setActiveTab] = useState<TabMode>('upload-image');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Input Media State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loadedMedia, setLoadedMedia] = useState<LoadedImageMedia | null>(null);
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

  // Multi-frame state
  const [capturedFrames, setCapturedFrames] = useState<{ dataUrl: string; timestampS: number }[]>([]);
  const [useMultiFrame, setUseMultiFrame] = useState<boolean>(false);
  const [isAnalyzingMultiFrame, setIsAnalyzingMultiFrame] = useState<boolean>(false);

  // User Prompt & Seed
  const [userPrompt, setUserPrompt] = useState<string>(
    'Create an original playable platformer or exploration game inspired by this reference.'
  );
  const [planTitle, setPlanTitle] = useState<string>('Reference Inspired Level');
  const [seedVariation, setSeedVariation] = useState<number>(42);

  // Central Analysis Lifecycle State
  const [lifecycle, setLifecycle] = useState<AnalysisLifecycleSnapshot>(
    analysisLifecycleManager.getState()
  );

  // Process States
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Output State
  const [referenceId, setReferenceId] = useState<string>('ref-local');
  const [analysis, setAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [editedCategory, setEditedCategory] = useState<GameCategory>('2d-platformer');
  const [editedPipeline, setEditedPipeline] = useState<TargetEngine>('phaser-2d');
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);

  // Visual Asset Generation State (Stage 5)
  const [assetBundle, setAssetBundle] = useState<GameAssetBundle | null>(null);
  const [isGeneratingAssets, setIsGeneratingAssets] = useState<boolean>(false);
  const [regeneratingRole, setRegeneratingRole] = useState<AssetRole | null>(null);
  const [assetNotice, setAssetNotice] = useState<string | null>(null);

  // Plan Studio State
  const [analysisSubTab, setAnalysisSubTab] = useState<'observed' | 'proposed' | 'template-plan'>('observed');
  const [selectedTemplateId, setSelectedTemplateId] = useState<GameTemplateId>('phaser-2d-platformer');
  const [planWorldWidth, setPlanWorldWidth] = useState<number>(800);
  const [planWorldHeight, setPlanWorldHeight] = useState<number>(480);
  const [planGravity, setPlanGravity] = useState<number>(750);
  const [planTheme, setPlanTheme] = useState<'default' | 'forest' | 'ice' | 'lava' | 'space' | 'cyberpunk'>('default');
  const [planPlayerSpeed, setPlanPlayerSpeed] = useState<number>(240);
  const [planPlayerJump, setPlanPlayerJump] = useState<number>(440);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to AnalysisLifecycleManager
  useEffect(() => {
    const unsubscribe = analysisLifecycleManager.subscribe((snapshot) => {
      setLifecycle(snapshot);
      if (snapshot.analysis) {
        setAnalysis(snapshot.analysis);
        setEditedCategory(snapshot.analysis.category);
        setEditedPipeline(snapshot.analysis.recommendedPipeline);

        // Initialize matching template ID and physics
        let tmpl: GameTemplateId = 'phaser-2d-platformer';
        if (snapshot.analysis.category === 'top-down-2d') {
          tmpl = 'phaser-2d-topdown';
        } else if (snapshot.analysis.category === 'puzzle') {
          tmpl = 'phaser-2d-puzzle';
        } else if (
          snapshot.analysis.category === 'voxel' ||
          snapshot.analysis.category === '3d-world' ||
          snapshot.analysis.recommendedPipeline === 'future-3d-engine'
        ) {
          tmpl = 'voxel-3d-deferred';
        }
        setSelectedTemplateId(tmpl);
        setPlanGravity(tmpl === 'phaser-2d-topdown' ? 0 : 750);
        setPlanTitle(`${snapshot.analysis.category.toUpperCase()} — Level`);
        setCurrentStep('plan-studio');
      }
      if (snapshot.referenceId) {
        setReferenceId(snapshot.referenceId);
      }
      if (snapshot.notice) {
        setNoticeMessage(snapshot.notice);
      }
    });
    return () => unsubscribe();
  }, []);

  const isLifecycleBusy = [
    'validating',
    'uploading',
    'analyzing',
    'validating_result',
  ].includes(lifecycle.state);

  // Handle Image File Selection
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      const loaded = await loadImageFile(file);
      setLoadedMedia(loaded);
      setPreviewImage(loaded.dataUrl);
      setImageMeta({
        name: loaded.fileName,
        width: loaded.width,
        height: loaded.height,
        sizeBytes: loaded.fileSizeBytes,
      });
      setAnalysis(null);
      setGeneratedPlan(null);
      setCurrentStep('intake');
      analysisLifecycleManager.reset();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    }
  };

  // Handle Drag & Drop on Intake Zone
  const handleDropFile = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      const loaded = await loadImageFile(file);
      setLoadedMedia(loaded);
      setPreviewImage(loaded.dataUrl);
      setImageMeta({
        name: loaded.fileName,
        width: loaded.width,
        height: loaded.height,
        sizeBytes: loaded.fileSizeBytes,
      });
      setAnalysis(null);
      setGeneratedPlan(null);
      setCurrentStep('intake');
      analysisLifecycleManager.reset();
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
      const media: LoadedImageMedia = {
        dataUrl: frame.dataUrl,
        originalDataUrl: frame.dataUrl,
        fileName: `${file.name}-frame-${seekTime.toFixed(1)}s.png`,
        mimeType: 'image/png',
        fileSizeBytes: Math.round(frame.dataUrl.length * 0.75),
        width: frame.width,
        height: frame.height,
        originalWidth: frame.width,
        originalHeight: frame.height,
        wasResized: false,
      };
      setLoadedMedia(media);
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
      analysisLifecycleManager.reset();
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
      const media: LoadedImageMedia = {
        dataUrl: frame.dataUrl,
        originalDataUrl: frame.dataUrl,
        fileName: `${videoFile.name}-frame-${time.toFixed(1)}s.png`,
        mimeType: 'image/png',
        fileSizeBytes: Math.round(frame.dataUrl.length * 0.75),
        width: frame.width,
        height: frame.height,
        originalWidth: frame.width,
        originalHeight: frame.height,
        wasResized: false,
      };
      setLoadedMedia(media);
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
      const media: LoadedImageMedia = {
        dataUrl,
        originalDataUrl: dataUrl,
        fileName: 'Active Studio Sketch.png',
        mimeType: 'image/png',
        fileSizeBytes: Math.round(dataUrl.length * 0.75),
        width: 800,
        height: 500,
        originalWidth: 800,
        originalHeight: 500,
        wasResized: false,
      };
      setLoadedMedia(media);
      setPreviewImage(dataUrl);
      setImageMeta({
        name: 'Active Studio Sketch.png',
        width: 800,
        height: 500,
        sizeBytes: Math.round(dataUrl.length * 0.75),
      });
      setAnalysis(null);
      setGeneratedPlan(null);
      analysisLifecycleManager.reset();
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

  // Run AI Reference Analysis via Lifecycle Manager
  const handleAnalyze = async () => {
    if (!previewImage) {
      setErrorMessage('Please provide a reference image, video frame, or sketch first.');
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    audioService.playClick();

    const media: LoadedImageMedia = loadedMedia || {
      dataUrl: previewImage,
      originalDataUrl: previewImage,
      fileName: imageMeta?.name || 'reference.png',
      mimeType: 'image/png',
      fileSizeBytes: imageMeta?.sizeBytes || Math.round(previewImage.length * 0.75),
      width: imageMeta?.width || 800,
      height: imageMeta?.height || 600,
      originalWidth: imageMeta?.width || 800,
      originalHeight: imageMeta?.height || 600,
      wasResized: false,
    };

    await analysisLifecycleManager.startAnalysis({
      media,
      userPrompt,
      category: editedCategory,
      engine: editedPipeline,
      mode: 'auto',
      allowFallback: false,
    });
  };

  const handleRetry = async () => {
    audioService.playClick();
    setErrorMessage(null);
    await analysisLifecycleManager.retry();
  };

  const handleUseHeuristic = async () => {
    audioService.playClick();
    setErrorMessage(null);
    await analysisLifecycleManager.runHeuristicFallback();
  };

  const handleCancelAnalysis = () => {
    audioService.playClick();
    analysisLifecycleManager.cancel();
  };

  const handleEditInput = () => {
    audioService.playClick();
    analysisLifecycleManager.editInputs({ prompt: userPrompt });
    setErrorMessage(null);
    promptInputRef.current?.focus();
  };

  // Generate Structured Plan
  const handleGeneratePlan = async () => {
    if (!analysis) return;

    setIsGeneratingPlan(true);
    setErrorMessage(null);
    audioService.playClick();

    try {
      const templateSpec = TEMPLATE_REGISTRY[selectedTemplateId];
      const targetCategory = templateSpec?.category || editedCategory;
      const targetEngine = templateSpec?.targetEngine || editedPipeline;

      // Create clone with template settings
      const updatedAnalysis: ReferenceAnalysis = {
        ...analysis,
        category: targetCategory,
        recommendedPipeline: targetEngine,
      };

      const planRes = await requestGamePlan(
        referenceId,
        userPrompt,
        updatedAnalysis,
        targetEngine,
        selectedTemplateId
      );

      const planToUpdate = { ...planRes.plan };
      planToUpdate.templateId = selectedTemplateId;
      planToUpdate.title = planTitle;
      if (planToUpdate.world) {
        planToUpdate.world.width = planWorldWidth;
        planToUpdate.world.height = planWorldHeight;
        planToUpdate.world.gravity = planGravity;
      }
      if (planToUpdate.theme) {
        planToUpdate.theme.name = planTheme;
      }
      if (planToUpdate.player) {
        planToUpdate.player.speed = planPlayerSpeed;
        planToUpdate.player.jumpPower = planPlayerJump;
      }
      if (planToUpdate.difficulty) {
        planToUpdate.difficulty.seed = seedVariation;
      }
      if (planToUpdate.suggested2DConfig) {
        planToUpdate.suggested2DConfig.theme = planTheme;
        planToUpdate.suggested2DConfig.playerSpeed = planPlayerSpeed;
        planToUpdate.suggested2DConfig.playerJump = planPlayerJump;
        planToUpdate.suggested2DConfig.gravity = planGravity;
      }

      setGeneratedPlan(planToUpdate);
      setAssetBundle((planToUpdate as any).assets || null);
      setCurrentStep('generation-results');
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to generate plan');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Generate All AI Visual Assets (Stage 5)
  const handleGenerateAssets = async () => {
    if (!generatedPlan) return;
    setIsGeneratingAssets(true);
    setAssetNotice(null);
    setErrorMessage(null);
    audioService.playClick();
    try {
      const bundle = await generateAssetBundle(generatedPlan, previewImage || undefined, true);
      setAssetBundle(bundle);
      const updatedPlan = { ...generatedPlan, assets: bundle };
      setGeneratedPlan(updatedPlan);
      audioService.playCoin();
      setAssetNotice(`Generated ${bundle.assets.length} visual assets (${bundle.provenance}). Ready for gameplay!`);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to generate visual assets');
    } finally {
      setIsGeneratingAssets(false);
    }
  };

  // Re-roll a single visual asset without regenerating the level
  const handleRetrySingleAsset = async (role: AssetRole) => {
    if (!generatedPlan) return;
    setRegeneratingRole(role);
    setAssetNotice(null);
    setErrorMessage(null);
    audioService.playClick();
    try {
      const newAsset = await generateSingleAsset(role, generatedPlan, previewImage || undefined);
      setAssetBundle((prev) => {
        const baseAssets = prev ? prev.assets : [];
        const existingIdx = baseAssets.findIndex((a) => a.role === role);
        const newAssets = [...baseAssets];
        if (existingIdx >= 0) {
          newAssets[existingIdx] = newAsset;
        } else {
          newAssets.push(newAsset);
        }
        const updatedBundle: GameAssetBundle = {
          bundleId: prev?.bundleId || `bundle-${generatedPlan.id}`,
          planId: generatedPlan.id,
          generatedAt: new Date().toISOString(),
          createdAt: prev?.createdAt || new Date().toISOString(),
          palette: prev?.palette || [],
          overallStatus: 'ready',
          provenance: prev?.provenance || newAsset.provenance,
          artStyle: generatedPlan.theme?.artStyle || 'pixel-art',
          assets: newAssets,
        };
        setGeneratedPlan((p: any) => ({ ...p, assets: updatedBundle }));
        return updatedBundle;
      });
      audioService.playCoin();
      setAssetNotice(`Regenerated ${role} sprite (${newAsset.provenance}).`);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || `Failed to re-roll asset for ${role}`);
    } finally {
      setRegeneratingRole(null);
    }
  };

  const handleRegenerate = async () => {
    setSeedVariation((prev) => prev + 1);
    await handleGeneratePlan();
  };

  const handleEditPlan = () => {
    audioService.playClick();
    setCurrentStep('plan-studio');
  };

  const handleBackToIntake = () => {
    audioService.playClick();
    setCurrentStep('intake');
  };

  // Launch Playable 2D Level
  const handlePlay2D = () => {
    if (!generatedPlan) return;
    audioService.playVictory();
    const planToPlay = assetBundle ? { ...generatedPlan, assets: assetBundle } : generatedPlan;
    const scene = convertPlanToPlayableScene(planToPlay);
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

  const compatibilityReport: TemplateCompatibilityReport | null = React.useMemo(() => {
    if (!analysis) return null;
    const isTopDown = selectedTemplateId === 'phaser-2d-topdown';
    const previewPlan = {
      schemaVersion: '2.0' as const,
      generationId: 'preview-gen',
      id: 'preview-plan',
      referenceId,
      title: `${selectedTemplateId} Plan`,
      description: userPrompt || 'Plan preview',
      sourceType: 'image-upload' as const,
      provenance: analysis.provenance,
      provider: { id: 'preview', model: 'preview', isFallback: false },
      templateId: selectedTemplateId,
      targetEngine: TEMPLATE_REGISTRY[selectedTemplateId]?.targetEngine || 'phaser-2d',
      category: TEMPLATE_REGISTRY[selectedTemplateId]?.category || '2d-platformer',
      userPrompt: userPrompt || 'Plan preview',
      theme: {
        name: planTheme,
        palette: analysis.colorPalette?.length > 0 ? analysis.colorPalette : ['#38bdf8', '#22c55e', '#ef4444'],
        background: '#070a13',
      },
      world: {
        width: planWorldWidth,
        height: planWorldHeight,
        gravity: planGravity,
        coordinateSystem: selectedTemplateId === 'voxel-3d-deferred' ? ('cartesian-3d' as const) : ('screen-top-left-2d' as const),
        friction: 0.8,
      },
      terrain: {
        platforms: [{ id: 'p1', x: 0, y: planWorldHeight - 36, width: planWorldWidth, height: 36 }],
        walls: [],
        hazards: [],
      },
      player: {
        spawn: { x: 60, y: planWorldHeight - 110 },
        speed: planPlayerSpeed,
        jumpPower: planPlayerJump,
        size: 36,
        supportedAbilities: isTopDown ? (['walk', 'run', 'dash'] as const) : (['walk', 'run', 'jump'] as const),
      },
      entities: { enemies: [], collectibles: [], interactives: [] },
      objectives: {
        primary: { type: 'reach_goal' as const, targetRef: 'goal-1' },
        winConditions: ['Reach the goal'],
        loseConditions: ['Fall into hazards'],
        checkpoints: [],
        goal: { id: 'goal-1', x: planWorldWidth - 75, y: planWorldHeight - 110, width: 36, height: 48 },
      },
      difficulty: { tier: 'medium' as const, seed: 42, enemySpeedMultiplier: 1.0 },
      mechanics: {
        allowedMechanics: isTopDown
          ? (['topdown_4way_movement', 'coin_collection'] as const)
          : (['jump_and_run', 'hazard_evasion', 'coin_collection'] as const),
        rejectedMechanics: [],
      },
      confidenceAndWarnings: {
        overallConfidence: (analysis.analysisConfidenceTier?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
        confidenceReasoning: 'Preview plan check',
        warnings: [],
        unsupportedFeatures: [],
      },
      status: 'ready-for-2d-generation' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    return checkTemplateCompatibility(previewPlan as any, selectedTemplateId);
  }, [
    analysis,
    selectedTemplateId,
    planWorldWidth,
    planWorldHeight,
    planGravity,
    planTheme,
    planPlayerSpeed,
    planPlayerJump,
    referenceId,
    userPrompt,
  ]);

  if (!isOpen) return null;

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
                  Reference-to-Playable Game Studio
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  Multimodal AI Pipeline
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transform visual references, screenshots, and concept sketches into validated, playable Phaser levels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reference Studio"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Breadcrumb */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-[#070a13] border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep('intake')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                currentStep === 'intake'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>1. Reference Intake</span>
              {previewImage && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
            <span className="text-slate-600 font-bold">›</span>
            <button
              type="button"
              disabled={!analysis}
              onClick={() => analysis && setCurrentStep('plan-studio')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none ${
                !analysis
                  ? 'text-slate-600 cursor-not-allowed opacity-50'
                  : currentStep === 'plan-studio'
                  ? 'bg-purple-600 text-white shadow-md cursor-pointer'
                  : 'text-slate-400 hover:text-slate-200 cursor-pointer hover:bg-slate-900'
              }`}
            >
              <span>2. Plan Studio</span>
              {analysis && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
            </button>
            <span className="text-slate-600 font-bold">›</span>
            <button
              type="button"
              disabled={!generatedPlan}
              onClick={() => generatedPlan && setCurrentStep('generation-results')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                !generatedPlan
                  ? 'text-slate-600 cursor-not-allowed opacity-50'
                  : currentStep === 'generation-results'
                  ? 'bg-emerald-500 text-black shadow-md cursor-pointer'
                  : 'text-slate-400 hover:text-slate-200 cursor-pointer hover:bg-slate-900'
              }`}
            >
              <span>3. Generation Results</span>
              {generatedPlan && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          </div>
          {currentStep === 'intake' && previewImage && (
            <span className="text-[11px] text-emerald-400 font-mono hidden md:inline">
              ✓ Reference Ready
            </span>
          )}
          {currentStep === 'plan-studio' && analysis && (
            <span className="text-[11px] text-purple-300 font-mono hidden md:inline">
              ✓ Analysis Verified
            </span>
          )}
          {currentStep === 'generation-results' && generatedPlan && (
            <span className="text-[11px] text-emerald-300 font-mono hidden md:inline">
              ✓ Level Ready to Play
            </span>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-200">
          {/* ================================================================ */}
          {/* STEP 1: REFERENCE INTAKE                                        */}
          {/* ================================================================ */}
          {currentStep === 'intake' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Input Source Tabs */}
              <div className="flex items-center gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload-image')}
                  className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
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
                  className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
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
                  className={`flex-1 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
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
                    <div className="space-y-3">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(true);
                        }}
                        onDragLeave={() => setIsDraggingOver(false)}
                        onDrop={handleDropFile}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer min-h-[170px] ${
                          isDraggingOver
                            ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-400/30 scale-[1.01]'
                            : 'border-slate-700 hover:border-cyan-400 bg-slate-900/40 hover:bg-slate-900/60'
                        }`}
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
                          <p className="font-semibold text-white">Click to browse or drag &amp; drop image here</p>
                          <p className="text-xs text-slate-400 mt-1">Supports PNG, JPEG, or WebP up to 10MB</p>
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">PNG</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">JPEG</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">WebP</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800/60 text-slate-500">Max 10MB</span>
                        </div>
                      </div>

                      {/* Image Validation Feedback Badges */}
                      {previewImage && imageMeta && (
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-200">Loaded Image Status</span>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Replace Image
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Valid Format
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Decoded ({imageMeta.width}×{imageMeta.height}px)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {(imageMeta.sizeBytes / 1024).toFixed(0)} KB (&lt;10MB)
                            </span>
                          </div>
                        </div>
                      )}
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
                  ref={promptInputRef}
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
                  {/* Working Game-Template Selection */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">Target Game Template</label>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {TEMPLATE_REGISTRY[selectedTemplateId]?.category}
                      </span>
                    </div>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        const newTmpl = e.target.value as GameTemplateId;
                        setSelectedTemplateId(newTmpl);
                        const spec = TEMPLATE_REGISTRY[newTmpl];
                        if (spec) {
                          const targetGravity =
                            spec.allowedWorldSettings.minGravity === 0 &&
                            spec.allowedWorldSettings.maxGravity === 0
                              ? 0
                              : spec.allowedWorldSettings.minGravity || 750;
                          setPlanGravity(targetGravity);
                          setPlanPlayerSpeed(240);
                          setPlanPlayerJump(spec.requiredPlayerConfiguration.requiresJump ? 400 : 0);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      {Object.values(TEMPLATE_REGISTRY).map((tmpl) => (
                        <option key={tmpl.id} value={tmpl.id}>
                          {tmpl.name} ({tmpl.category})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {TEMPLATE_REGISTRY[selectedTemplateId]?.description}
                    </p>
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

                <div className="flex-1 min-h-[220px] flex items-center justify-center p-3 bg-[#05070e]">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Reference preview"
                      className="max-h-[240px] max-w-full object-contain rounded-lg border border-slate-800 shadow-md"
                    />
                  ) : (
                    <div className="text-center text-slate-500 text-xs">
                      <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-40" />
                      <p>No reference loaded yet</p>
                      <p className="text-[10px] text-slate-600 mt-1">Upload an image or scrub a video frame</p>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
                  {isLifecycleBusy ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RotateCw className="w-4 h-4 text-cyan-400 animate-spin" />
                          <span className="font-semibold text-xs text-cyan-300">
                            {lifecycle.state === 'validating'
                              ? 'Stage 1/4: Validating Image Integrity...'
                              : lifecycle.state === 'uploading'
                              ? 'Stage 2/4: Preparing Safe Reference Intake...'
                              : lifecycle.state === 'analyzing'
                              ? 'Stage 3/4: Vision Analysis via Gemini Provider...'
                              : 'Stage 4/4: Validating Output Contract...'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCancelAnalysis}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-[11px] font-bold text-rose-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Ban className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>

                      {/* Real progress bar tied to actual backend stages */}
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60">
                        <div
                          className="bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 h-full transition-all duration-300 ease-out"
                          style={{
                            width: `${
                              lifecycle.state === 'validating'
                                ? 25
                                : lifecycle.state === 'uploading'
                                ? 50
                                : lifecycle.state === 'analyzing'
                                ? 75
                                : lifecycle.state === 'validating_result'
                                ? 90
                                : 10
                            }%`,
                          }}
                        />
                      </div>

                      {lifecycle.correlationId && (
                        <div className="font-mono text-[10px] text-slate-500 truncate">
                          Request ID: {lifecycle.correlationId}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={!previewImage || isLifecycleBusy || isExtractingFrame || (useMultiFrame && activeTab === 'video-frame')}
                        className="flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-950/40 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                        <span>
                          {useMultiFrame && activeTab === 'video-frame'
                            ? 'Use Multi-Frame Button Above ↑'
                            : 'Analyze Reference & Detect Type'}
                        </span>
                      </button>

                      {analysis && (
                        <button
                          type="button"
                          onClick={() => setCurrentStep('plan-studio')}
                          className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none"
                        >
                          <span>Plan Studio</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cancelled Banner */}
          {lifecycle.state === 'cancelled' && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Analysis request was cancelled. Original image and prompt were preserved.</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="px-2.5 py-1 rounded bg-amber-800 hover:bg-amber-700 text-white font-semibold text-[11px] cursor-pointer"
              >
                Restart Analysis
              </button>
            </div>
          )}

          {/* Structured Error Banner */}
          {lifecycle.state === 'error' && lifecycle.error && (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-rose-200">Analysis Request Failed</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 border border-rose-700/50">
                        {lifecycle.error.code}
                      </span>
                      {lifecycle.error.correlationId && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          Corr: {lifecycle.error.correlationId}
                        </span>
                      )}
                    </div>
                    <p className="text-rose-300 text-xs leading-relaxed">{lifecycle.error.message}</p>
                  </div>
                </div>
              </div>

              {/* Recovery Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-rose-900/60 flex-wrap">
                {lifecycle.error.isRetryable && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Retry Live Analysis
                  </button>
                )}

                {lifecycle.error.canFallbackToHeuristic && (
                  <button
                    type="button"
                    onClick={handleUseHeuristic}
                    className="px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    Use Offline Heuristic
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleEditInput}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Edit Input
                </button>
              </div>
            </div>
          )}

          {/* Fallback Error / Notice Banners */}
          {errorMessage && lifecycle.state !== 'error' && (
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
        </div>
      )}

      {/* ================================================================ */}
      {/* STEP 2: PLAN STUDIO                                             */}
      {/* ================================================================ */}
      {currentStep === 'plan-studio' && analysis && (
            <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white">Visual Reference Analysis</span>
                  {/* Truthful Provenance badge */}
                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                      analysis.provenance === 'gemini-vision'
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        : analysis.provenance === 'mock-heuristic'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {analysis.provenance === 'gemini-vision' ? (
                      <>
                        <Sparkles className="w-3 h-3 text-cyan-300" />
                        <span>Google Gemini Vision (Live AI)</span>
                      </>
                    ) : analysis.provenance === 'mock-heuristic' ? (
                      <>
                        <Cpu className="w-3 h-3 text-amber-300" />
                        <span>Deterministic Local Heuristic (Offline)</span>
                      </>
                    ) : (
                      <span>Development Mock</span>
                    )}
                    {analysis.frameCount > 1 ? ` · ${analysis.frameCount} frames` : ''}
                  </span>

                  {/* Correlation ID badge */}
                  {analysis.correlationId && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      ID: {analysis.correlationId}
                    </span>
                  )}

                  {/* Token Usage badge */}
                  {analysis.usage && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {analysis.usage.totalTokens} tokens
                    </span>
                  )}

                  {/* Confidence tier badge */}
                  {confidenceCfg && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${confidenceCfg.bg} ${confidenceCfg.color} ${confidenceCfg.border}`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      {confidenceCfg.label}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBackToIntake}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Intake</span>
                  </button>
                  <span className="text-[11px] text-slate-400">
                    {new Date(analysis.analyzedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Detected Metrics Grid */}
              {/* Stage 2: Sub-navigation Tabs */}
              <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAnalysisSubTab('observed')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    analysisSubTab === 'observed'
                      ? 'bg-cyan-500 text-black shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Observed Evidence</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisSubTab('proposed')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    analysisSubTab === 'proposed'
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Proposed Game Design</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisSubTab('template-plan')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    analysisSubTab === 'template-plan'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Template & Plan Studio</span>
                </button>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* SUBTAB 1: OBSERVED EVIDENCE (FACTUAL VISIBLE PROOF)           */}
              {/* ------------------------------------------------------------ */}
              {analysisSubTab === 'observed' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/40 text-xs text-cyan-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      Factual observations directly visible in reference image
                    </span>
                    <span className="text-[10px] font-mono bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-200">
                      Truthful Grounding
                    </span>
                  </div>

                  {/* Visual Style & Palette */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Visual Style</span>
                      <p className="font-semibold text-slate-200 text-xs">{analysis.visualStyle}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Palette Swatches</span>
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

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Perspective Proof</span>
                      <p className="font-semibold text-slate-200 text-xs capitalize">{analysis.cameraPerspective.replace(/-/g, ' ')}</p>
                    </div>
                  </div>

                  {/* Shapes, Platforms, Walls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                        Platforms, Floors & Ledges
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(analysis.observedEvidence?.platformsAndFloors || [analysis.terrainLayout]).map((p, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-[11px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                        Walls, Corridors & Boundaries
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(analysis.observedEvidence?.wallsAndCorridors || ['Boundary edges']).map((w, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Visible Objects, Hazards & Collectibles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                        Visible Characters / Objects
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.visibleObjects.map((obj, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 text-[11px]">
                            {obj}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block text-rose-300">
                        Visible Hazard Cues
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(analysis.observedEvidence?.visibleHazards || analysis.suggestedRoles.obstacles || ['None confirmed']).map((h, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px]">
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block text-amber-300">
                        Visible Collectible Cues
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(analysis.observedEvidence?.visibleCollectibles || analysis.suggestedRoles.collectibles || ['None confirmed']).map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-900/60 text-amber-300 text-[11px]">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Relative Spatial Layout */}
                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1 text-xs">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Relative Spatial Layout</span>
                    <p className="text-slate-300 text-xs">
                      {analysis.observedEvidence?.relativeSpatialLayout || analysis.terrainLayout}
                    </p>
                  </div>

                  {/* Occlusions & Ambiguities */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-900/40 space-y-1 text-xs">
                    <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Occlusions, Ambiguities & Model Limitations
                    </span>
                    <p className="text-[11px] text-slate-400 italic mb-1">
                      A static reference image cannot prove hidden collision rules, acceleration constants, or level boundaries beyond visible frame.
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                      {(analysis.observedEvidence?.uncertainAndOccludedRegions || analysis.uncertaintiesAndWarnings).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------ */}
              {/* SUBTAB 2: PROPOSED GAME DESIGN (CREATIVE HYPOTHESES)         */}
              {/* ------------------------------------------------------------ */}
              {analysisSubTab === 'proposed' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/20 border border-purple-800/40 text-xs text-purple-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Creative choices & mechanic proposals (hypotheses, not proven facts)
                    </span>
                    <span className="text-[10px] font-mono bg-purple-500/20 px-2 py-0.5 rounded text-purple-200">
                      Design Proposals
                    </span>
                  </div>

                  {/* Genre, Movement & Loop */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Proposed Genre</span>
                      <p className="font-bold text-cyan-300 capitalize">{analysis.category.replace('-', ' ')}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Movement Style</span>
                      <p className="font-semibold text-slate-200">
                        {analysis.proposedDesign?.playerAbilitiesAndMovement?.movementType || 'Run and Jump 2D'}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(analysis.proposedDesign?.playerAbilitiesAndMovement?.abilities || ['walk', 'run', 'jump']).map((a, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-mono">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Audio Mood</span>
                      <p className="font-semibold text-slate-200">
                        {analysis.proposedDesign?.audioVisualFeedback?.suggestedAudioMood || 'Chiptune retro upbeat'}
                      </p>
                    </div>
                  </div>

                  {/* Core Gameplay Loop */}
                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1 text-xs">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Core Gameplay Loop</span>
                    <p className="text-slate-300 text-xs">
                      {analysis.proposedDesign?.coreGameplayLoop ||
                        'Traverse platform obstacles, evade hazards, collect items, and reach the exit portal.'}
                    </p>
                  </div>

                  {/* Objectives & Conditions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">
                        Win Conditions
                      </span>
                      <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                        {(analysis.proposedDesign?.objectivesAndConditions?.winConditions || ['Reach the goal flag']).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-rose-400 uppercase tracking-wider font-bold">
                        Lose Conditions
                      </span>
                      <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                        {(analysis.proposedDesign?.objectivesAndConditions?.loseConditions || ['Fall into hazard void']).map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Inferred Mechanics Cards with Evidence Citations */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Inferred Mechanic Hypotheses
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {analysis.inferredMechanics.map((mech, i) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{mech.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                              Proposed Mechanic
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 italic">{mech.description}</p>
                          {mech.observationalEvidence && mech.observationalEvidence.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-800/80">
                              <span className="text-[9px] uppercase tracking-wider text-cyan-400 font-bold block mb-1">
                                Cited Visual Proof:
                              </span>
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
                </div>
              )}

              {/* ------------------------------------------------------------ */}
              {/* SUBTAB 3: TEMPLATE COMPATIBILITY & PLAN STUDIO               */}
              {/* ------------------------------------------------------------ */}
              {analysisSubTab === 'template-plan' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-xs text-emerald-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      Runtime Template Compatibility & Plan Configuration
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-200">
                      Contract Governance
                    </span>
                  </div>

                  {/* Template Selector */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-200">
                        Target Engine Template
                      </label>
                      <span className="text-[10px] font-mono text-cyan-400">
                        Registry: {Object.keys(TEMPLATE_REGISTRY).length} templates
                      </span>
                    </div>

                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        const newTmpl = e.target.value as GameTemplateId;
                        setSelectedTemplateId(newTmpl);
                        const spec = TEMPLATE_REGISTRY[newTmpl];
                        if (spec) {
                          const targetGravity = (spec.allowedWorldSettings.minGravity === 0 && spec.allowedWorldSettings.maxGravity === 0)
                            ? 0
                            : (spec.allowedWorldSettings.minGravity || 750);
                          setPlanGravity(targetGravity);
                          setPlanPlayerSpeed(240);
                          setPlanPlayerJump(spec.requiredPlayerConfiguration.requiresJump ? 400 : 0);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none cursor-pointer"
                    >
                      {Object.values(TEMPLATE_REGISTRY).map((tmpl) => (
                        <option key={tmpl.id} value={tmpl.id}>
                          {tmpl.name} ({tmpl.category})
                        </option>
                      ))}
                    </select>

                    <div className="space-y-1.5">
                      <p className="text-[11px] text-slate-300">
                        {TEMPLATE_REGISTRY[selectedTemplateId]?.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 font-mono text-[10px]">
                          Movement: {TEMPLATE_REGISTRY[selectedTemplateId]?.movementModel}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-mono text-[10px]">
                          Controls: {TEMPLATE_REGISTRY[selectedTemplateId]?.controlsHelp}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60 text-purple-300 font-mono text-[10px]">
                          Gravity: {TEMPLATE_REGISTRY[selectedTemplateId]?.allowedWorldSettings.minGravity === 0 && TEMPLATE_REGISTRY[selectedTemplateId]?.allowedWorldSettings.maxGravity === 0 ? '0 (Zero-G)' : `${TEMPLATE_REGISTRY[selectedTemplateId]?.allowedWorldSettings.minGravity} px/s²`}
                        </span>
                      </div>
                    </div>

                    {/* Compatibility Check Report */}
                    {compatibilityReport && (
                      <div className="pt-2 border-t border-slate-800">
                        {compatibilityReport.isCompatible ? (
                          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 space-y-1 text-xs">
                            <div className="flex items-center gap-2 text-emerald-300 font-bold">
                              <ShieldCheck className="w-4 h-4" />
                              <span>Plan is fully compatible with {compatibilityReport.templateName}!</span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Physics gravity, boundaries, and mechanic allowlists are satisfied.
                            </p>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 space-y-2.5 text-xs">
                            <div className="flex items-center gap-2 text-rose-300 font-bold">
                              <AlertTriangle className="w-4 h-4 text-rose-400" />
                              <span>Incompatible with {compatibilityReport.templateName}</span>
                            </div>
                            <ul className="list-disc list-inside text-rose-200 text-[11px] space-y-1">
                              {compatibilityReport.errors.map((err, ei) => (
                                <li key={ei}>{err}</li>
                              ))}
                            </ul>

                            {/* Suggested Alternatives */}
                            {compatibilityReport.suggestedAlternatives.length > 0 && (
                              <div className="pt-2 border-t border-rose-900/60 space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                                  Supported Alternatives (Never Silently Switched):
                                </span>
                                {compatibilityReport.suggestedAlternatives.map((alt, ai) => (
                                  <div key={ai} className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-800/40 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-amber-200 text-xs">{alt.templateName}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedTemplateId(alt.templateId);
                                          const spec = TEMPLATE_REGISTRY[alt.templateId];
                                          if (spec) {
                                            const targetGravity = (spec.allowedWorldSettings.minGravity === 0 && spec.allowedWorldSettings.maxGravity === 0)
                                              ? 0
                                              : (spec.allowedWorldSettings.minGravity || 750);
                                            setPlanGravity(targetGravity);
                                            setPlanPlayerSpeed(240);
                                            setPlanPlayerJump(spec.requiredPlayerConfiguration.requiresJump ? 400 : 0);
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[10px] cursor-pointer"
                                      >
                                        Switch to {alt.templateName}
                                      </button>
                                    </div>
                                    <p className="text-[10px] text-slate-300">{alt.rationale}</p>
                                    <div className="text-[10px] text-slate-400">
                                      <span className="font-semibold text-slate-300">What would change: </span>
                                      {alt.whatWouldChange.join(' ')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Interactive Plan Parameters Editor */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-200 block">
                      Plan Dimension & Physics Tuning
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          World Width (px)
                        </label>
                        <input
                          type="number"
                          value={planWorldWidth}
                          min={480}
                          max={6000}
                          onChange={(e) => setPlanWorldWidth(Math.max(480, Math.min(6000, Number(e.target.value) || 800)))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          World Height (px)
                        </label>
                        <input
                          type="number"
                          value={planWorldHeight}
                          min={320}
                          max={4000}
                          onChange={(e) => setPlanWorldHeight(Math.max(320, Math.min(4000, Number(e.target.value) || 480)))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          Gravity Physics
                        </label>
                        <input
                          type="number"
                          value={planGravity}
                          min={0}
                          max={2000}
                          onChange={(e) => setPlanGravity(Math.max(0, Math.min(2000, Number(e.target.value) || 0)))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          Visual Theme
                        </label>
                        <select
                          value={planTheme}
                          onChange={(e) => setPlanTheme(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                        >
                          <option value="default">Default Dark</option>
                          <option value="forest">Emerald Forest</option>
                          <option value="ice">Frost Ice</option>
                          <option value="lava">Molten Lava</option>
                          <option value="space">Deep Space</option>
                          <option value="cyberpunk">Cyberpunk Neon</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          Player Speed
                        </label>
                        <input
                          type="number"
                          value={planPlayerSpeed}
                          min={80}
                          max={500}
                          onChange={(e) => setPlanPlayerSpeed(Math.max(80, Math.min(500, Number(e.target.value) || 240)))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          Jump Power
                        </label>
                        <input
                          type="number"
                          value={planPlayerJump}
                          min={200}
                          max={700}
                          onChange={(e) => setPlanPlayerJump(Math.max(200, Math.min(700, Number(e.target.value) || 440)))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGeneratePlan}
                      disabled={isGeneratingPlan || (compatibilityReport !== null && !compatibilityReport.isCompatible)}
                      className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{isGeneratingPlan ? 'Validating & Synthesizing Intermediate Plan...' : 'Generate Validated Game Plan'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ================================================================ */}
          {/* STEP 3: GENERATION RESULTS                                      */}
          {/* ================================================================ */}
          {currentStep === 'generation-results' && generatedPlan && (
            <div className="border border-slate-800 rounded-xl bg-slate-900/60 p-5 space-y-5 animate-in fade-in duration-200">
              {/* Header Info */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      {generatedPlan.title || 'Generated Playable Level'}
                    </h3>
                    <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-400">
                      <span>Template:</span>
                      <span className="font-semibold text-cyan-300">
                        {TEMPLATE_REGISTRY[generatedPlan.templateId as GameTemplateId]?.name || generatedPlan.templateId}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-[11px] text-purple-300">
                        {TEMPLATE_REGISTRY[generatedPlan.templateId as GameTemplateId]?.movementModel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold px-3 py-1 rounded-full uppercase border ${
                      generatedPlan.status === 'ready-for-2d-generation'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {generatedPlan.status === 'ready-for-2d-generation' ? '✓ Ready to Play' : generatedPlan.status}
                  </span>
                </div>
              </div>

              {/* Condition 1: Deferred 3D / Voxel Engine Banner */}
              {generatedPlan.targetEngine === 'future-3d-engine' ? (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-800/60 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                      <Boxes className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-amber-200">Dedicated 3D Engine Required</h4>
                      <p className="text-xs text-slate-300">
                        A single 2D screenshot cannot reconstruct 3D voxel coordinate chunk managers, raymarching
                        shaders, or depth buffers. Draw2Play has successfully structured and preserved this voxel
                        generation plan for dedicated 3D engines.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-800/40 text-xs space-y-1">
                    <span className="font-bold text-amber-300">Required Architecture:</span>
                    <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                      {(generatedPlan.missingRequirements || []).map((req: string, i: number) => (
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
                /* Condition 2: Playable 2D Game Results View */
                <div className="space-y-5">
                  {/* Split Visual & Structural Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Left 1/3: Reference Image & Intent Summary */}
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                          <span className="font-bold uppercase tracking-wider text-[10px]">Reference Source</span>
                          <span className="font-mono text-[10px] text-cyan-400">Seed #{generatedPlan.difficulty?.seed ?? seedVariation}</span>
                        </div>
                        {previewImage && (
                          <img
                            src={previewImage}
                            alt="Reference Source"
                            className="w-full h-32 object-contain rounded-lg bg-[#05070e] border border-slate-800"
                          />
                        )}
                        <p className="text-[11px] text-slate-300 mt-2 line-clamp-3 italic">
                          &ldquo;{userPrompt}&rdquo;
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                        <span>Theme: {planTheme}</span>
                        <span>Gravity: {generatedPlan.world?.gravity ?? planGravity}</span>
                      </div>
                    </div>

                    {/* Right 2/3: Generated Level Entity Breakdown */}
                    <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-400">
                          Generated Level Structure
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          Size: {Number(generatedPlan.world?.width ?? planWorldWidth)} × {Number(generatedPlan.world?.height ?? planWorldHeight)} px
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Platforms</span>
                          <span className="font-bold text-cyan-300 text-sm">
                            {generatedPlan.terrain?.platforms?.length ?? generatedPlan.layout?.platforms?.length ?? 1} blocks
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-rose-400 uppercase font-bold block">Hazards</span>
                          <span className="font-bold text-rose-300 text-sm">
                            {generatedPlan.terrain?.hazards?.length ?? generatedPlan.layout?.hazards?.length ?? 0} active
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-amber-400 uppercase font-bold block">Coins / Items</span>
                          <span className="font-bold text-amber-300 text-sm">
                            {generatedPlan.entities?.collectibles?.length ?? generatedPlan.layout?.collectibles?.length ?? 0} gems
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-purple-400 uppercase font-bold block">Enemies</span>
                          <span className="font-bold text-purple-300 text-sm">
                            {generatedPlan.entities?.enemies?.length ?? generatedPlan.layout?.enemies?.length ?? 0} patrolling
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-cyan-400 uppercase font-bold block">Switches</span>
                          <span className="font-bold text-cyan-300 text-sm">
                            {generatedPlan.entities?.interactives?.filter((o: any) => o.type === 'switch')?.length ?? generatedPlan.layout?.interactiveObjects?.filter((o: any) => o.type === 'switch')?.length ?? 0} triggers
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-emerald-400 uppercase font-bold block">Doors / Gates</span>
                          <span className="font-bold text-emerald-300 text-sm">
                            {generatedPlan.terrain?.walls?.filter((w: any) => w.id?.includes('door'))?.length ?? generatedPlan.layout?.interactiveObjects?.filter((o: any) => o.type === 'door')?.length ?? 0} barriers
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Player Spawn</span>
                          <span className="font-mono text-slate-200 text-xs">
                            ({Number(generatedPlan.player?.spawn?.x ?? generatedPlan.layout?.spawnPoint?.x ?? 60)}, {Number(generatedPlan.player?.spawn?.y ?? generatedPlan.layout?.spawnPoint?.y ?? 380)})
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-emerald-400 uppercase font-bold block">Goal Exit</span>
                          <span className="font-mono text-emerald-300 text-xs">
                            ({Number(generatedPlan.objectives?.goal?.x ?? generatedPlan.layout?.goal?.x ?? 720)}, {Number(generatedPlan.objectives?.goal?.y ?? generatedPlan.layout?.goal?.y ?? 370)})
                          </span>
                        </div>
                      </div>

                      {/* Mechanics and Rules */}
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-300">Supported Mechanics:</span>
                          <span className="text-[10px] text-slate-400">
                            Controls: {TEMPLATE_REGISTRY[generatedPlan.templateId as GameTemplateId]?.controlsHelp || 'Arrow Keys / WASD'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(generatedPlan.mechanics?.allowedMechanics) ? generatedPlan.mechanics.allowedMechanics : ['jump_and_run', 'coin_collection']).map((m: any, i: number) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                              {String(m)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STAGE 5: AI SPRITE & TEXTURE ASSET GENERATION PANEL */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          <Palette className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                              Visual Asset Pipeline (AI Sprites & Textures)
                            </h4>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/50">
                              Stage 5 Live
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Custom visual art conditioned on reference silhouette & palette. Independent from collision physics.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {assetBundle && (
                          <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${
                            assetBundle.provenance === 'gemini-imagen'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                              : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                          }`}>
                            {assetBundle.provenance === 'gemini-imagen' ? '✦ AI Generated Art' : '⟐ Procedural Pixel Art'}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={handleGenerateAssets}
                          disabled={isGeneratingAssets || !generatedPlan}
                          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-950/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Wand2 className={`w-3.5 h-3.5 ${isGeneratingAssets ? 'animate-spin' : ''}`} />
                          <span>{isGeneratingAssets ? 'Generating 7 Assets...' : assetBundle ? 'Regenerate All Assets' : 'Generate Visual Assets'}</span>
                        </button>
                      </div>
                    </div>

                    {assetNotice && (
                      <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-300 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                        <span>{assetNotice}</span>
                      </div>
                    )}

                    {/* 7 Asset Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                      {(
                        [
                          { role: 'player', label: 'Player Hero', dim: '36×36' },
                          { role: 'enemy', label: 'Hostile Enemy', dim: '32×32' },
                          { role: 'collectible', label: 'Gem / Coin', dim: '24×24' },
                          { role: 'hazard', label: 'Hazard Spike', dim: '24×24' },
                          { role: 'goal', label: 'Goal Portal', dim: '36×48' },
                          { role: 'platform', label: 'Terrain Tile', dim: '48×48' },
                          { role: 'background', label: 'Backdrop', dim: '480×270' },
                        ] as const
                      ).map(({ role, label, dim }) => {
                        const asset = assetBundle?.assets.find((a) => a.role === role);
                        const isRetryingThis = regeneratingRole === role;

                        return (
                          <div
                            key={role}
                            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-2 transition-colors"
                          >
                            <div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                <span className="font-bold uppercase tracking-wider">{label}</span>
                                <span className="font-mono text-[9px] text-slate-500">{dim}</span>
                              </div>

                              {/* Thumbnail preview */}
                              <div className="w-full aspect-square bg-[#05070e] rounded-lg border border-slate-800/80 flex items-center justify-center overflow-hidden relative group">
                                {asset?.dataUrl ? (
                                  <img
                                    src={asset.dataUrl}
                                    alt={label}
                                    className="w-full h-full object-contain pixelated p-1"
                                    style={{ imageRendering: 'pixelated' }}
                                  />
                                ) : (
                                  <div className="text-[10px] text-slate-600 font-mono text-center p-1">
                                    <span>Procedural</span>
                                  </div>
                                )}

                                {isRetryingThis && (
                                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                    <RotateCw className="w-4 h-4 text-cyan-400 animate-spin" />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1.5 pt-1">
                              {/* Provenance Badge */}
                              <div className="text-center">
                                <span
                                  className={`inline-block text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                    asset?.provenance === 'gemini-imagen'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-600/30'
                                      : asset?.provenance === 'procedural-fallback'
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-600/30'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {asset?.provenance === 'gemini-imagen'
                                    ? 'AI'
                                    : asset?.provenance === 'procedural-fallback'
                                    ? 'Fallback'
                                    : 'Default'}
                                </span>
                              </div>

                              {/* Single-asset retry button */}
                              <button
                                type="button"
                                onClick={() => handleRetrySingleAsset(role)}
                                disabled={isRetryingThis || isGeneratingAssets || !generatedPlan}
                                className="w-full py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-40"
                                title="Re-roll this sprite without altering level layout"
                              >
                                <RotateCw className={`w-2.5 h-2.5 ${isRetryingThis ? 'animate-spin' : ''}`} />
                                <span>Re-roll</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Primary Action Buttons Suite (Section D Requirements) */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-900 border border-emerald-800/60 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Play Now CTA */}
                      <button
                        type="button"
                        onClick={handlePlay2D}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Play Now (Launch Level)</span>
                      </button>

                      {/* Edit Plan */}
                      <button
                        type="button"
                        onClick={handleEditPlan}
                        className="px-3.5 py-2.5 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Edit Plan</span>
                      </button>

                      {/* Regenerate Level */}
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        disabled={isGeneratingPlan}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isGeneratingPlan ? 'animate-spin' : ''}`} />
                        <span>Regenerate Level</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Save to Creations */}
                      {onSavePlanCreation && (
                        <button
                          type="button"
                          onClick={() => {
                            onSavePlanCreation(generatedPlan);
                            audioService.playCoin();
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                        >
                          <Save className="w-3.5 h-3.5 text-purple-400" />
                          <span>Save to Creations</span>
                        </button>
                      )}

                      {/* Export Plan JSON */}
                      <button
                        type="button"
                        onClick={handleExportPlanJson}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                      >
                        <Download className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Export Plan JSON</span>
                      </button>
                    </div>
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
            <span>Multimodal AI Reference Studio · Truthful Provenance &amp; Structured Contract</span>
          </div>

          <div className="flex items-center gap-2">
            {currentStep === 'plan-studio' && (
              <button
                type="button"
                onClick={handleBackToIntake}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold cursor-pointer transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Intake</span>
              </button>
            )}

            {currentStep === 'generation-results' && (
              <button
                type="button"
                onClick={handleEditPlan}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold cursor-pointer transition-colors flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>Plan Studio</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
            >
              Return to Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferenceIntakeModal;
