import { useState, useEffect, useRef, useCallback } from 'react';
import { StudioHeader } from './components/layout/StudioHeader.js';
import { PrimaryActionBar } from './components/studio/PrimaryActionBar.js';
import { DrawingToolbar, type ToolMode } from './components/studio/DrawingToolbar.js';
import { CanvasViewport, type CanvasViewportHandle } from './components/studio/CanvasViewport.js';
import { AnalysisPanel } from './components/studio/AnalysisPanel.js';
import { GamePreviewSection } from './components/studio/GamePreviewSection.js';
import { HelpModal } from './components/studio/HelpModal.js';
import { MyCreationsModal } from './components/studio/MyCreationsModal.js';
import { fetchHealth, analyzeCharacterImage } from './services/api.js';
import type { CharacterConfig, CharacterAttributes } from './types/game.js';

export function App() {
  // Navigation State
  const [currentTab, setCurrentTab] = useState<'studio' | 'creations' | 'help'>('studio');
  const [activeStage, setActiveStage] = useState<'draw' | 'analyzing' | 'play'>('draw');

  // Drawing Tools State
  const [currentTool, setCurrentTool] = useState<ToolMode>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#0f172a');
  const [brushSize, setBrushSize] = useState<number>(8);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [hasStrokes, setHasStrokes] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Character & Analysis State
  const [characterConfig, setCharacterConfig] = useState<CharacterConfig | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<'gemini' | 'mock-heuristic' | null>(null);

  // Server & Connection State
  const [serverStatus, setServerStatus] = useState<{
    status: string;
    aiProvider: string;
    geminiConfigured: boolean;
  } | undefined>(undefined);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState<boolean>(false);

  // Refs
  const canvasRef = useRef<CanvasViewportHandle>(null);
  const gameSectionRef = useRef<HTMLDivElement>(null);

  // Fetch Backend Status
  const refreshStatus = useCallback(() => {
    setIsRefreshingStatus(true);
    fetchHealth()
      .then((data) => setServerStatus(data))
      .catch((err) => {
        console.warn('Backend status check error:', (err as Error).message);
      })
      .finally(() => {
        setIsRefreshingStatus(false);
      });
  }, []);

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((data) => {
        if (active) setServerStatus(data);
      })
      .catch((err) => {
        console.warn('Backend status check error on mount:', (err as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  // Analyze Handler
  const handleAnalyze = async (dataUrl?: string) => {
    const imagePayload = dataUrl || canvasRef.current?.getCanvasDataUrl();
    if (!imagePayload) {
      setAnalysisError('No sketch data available to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setActiveStage('analyzing');

    try {
      const response = await analyzeCharacterImage(imagePayload);

      const newConfig: CharacterConfig = {
        id: `hero-${Date.now()}`,
        attributes: response.attributes,
        drawingDataUrl: imagePayload,
        createdAt: new Date().toISOString(),
      };

      setCharacterConfig(newConfig);
      setAnalysisSource(response.source);
      setActiveStage('play');

      // Smooth scroll to preview if on mobile/smaller screens
      setTimeout(() => {
        gameSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 200);
    } catch (err: unknown) {
      console.error('Character analysis failed:', err);
      setAnalysisError((err as Error).message || 'Failed to analyze character sketch.');
      setActiveStage('draw');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fine-tune Attributes
  const handleAttributeChange = (key: keyof CharacterAttributes, value: number) => {
    if (!characterConfig) return;
    setCharacterConfig({
      ...characterConfig,
      attributes: {
        ...characterConfig.attributes,
        [key]: value,
      },
    });
  };

  // Primary Action Bar triggers
  const handleDrawClick = () => {
    setActiveStage('draw');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlayClick = () => {
    setActiveStage('play');
    gameSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* 1. TOP NAVIGATION */}
      <StudioHeader
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        serverStatus={serverStatus}
        isRefreshingStatus={isRefreshingStatus}
        onRefreshStatus={refreshStatus}
      />

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
        {/* Primary Action Bar */}
        <PrimaryActionBar
          activeStage={activeStage}
          hasStrokes={hasStrokes}
          hasAnalyzedCharacter={Boolean(characterConfig)}
          isAnalyzing={isAnalyzing}
          onDrawClick={handleDrawClick}
          onAnalyzeClick={() => handleAnalyze()}
          onPlayClick={handlePlayClick}
        />

        {/* 3-Column Studio Workspace */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          {/* Left: Drawing Tools */}
          <DrawingToolbar
            currentTool={currentTool}
            onSelectTool={setCurrentTool}
            currentColor={currentColor}
            onSelectColor={setCurrentColor}
            brushSize={brushSize}
            onSelectBrushSize={setBrushSize}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(!showGrid)}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={() => canvasRef.current?.undo()}
            onRedo={() => canvasRef.current?.redo()}
            onClear={() => canvasRef.current?.clear()}
          />

          {/* Center: Canvas Viewport */}
          <CanvasViewport
            ref={canvasRef}
            currentTool={currentTool}
            currentColor={currentColor}
            brushSize={brushSize}
            showGrid={showGrid}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
            onStrokesChange={setHasStrokes}
            onHistoryChange={(undoable, redoable) => {
              setCanUndo(undoable);
              setCanRedo(redoable);
            }}
          />

          {/* Right: AI Analysis Panel */}
          <AnalysisPanel
            characterConfig={characterConfig}
            isAnalyzing={isAnalyzing}
            analysisError={analysisError}
            analysisSource={analysisSource}
            onAttributeChange={handleAttributeChange}
            onPlayClick={handlePlayClick}
            onClearError={() => setAnalysisError(null)}
          />
        </div>

        {/* 3. SECONDARY BOTTOM AREA: 2D GAME PREVIEW */}
        <div ref={gameSectionRef} className="pt-2">
          <GamePreviewSection
            characterConfig={characterConfig}
            onDrawNewClick={handleDrawClick}
          />
        </div>
      </main>

      {/* MODALS */}
      <HelpModal
        isOpen={currentTab === 'help'}
        onClose={() => setCurrentTab('studio')}
      />

      <MyCreationsModal
        isOpen={currentTab === 'creations'}
        onClose={() => setCurrentTab('studio')}
      />
    </div>
  );
}

export default App;
