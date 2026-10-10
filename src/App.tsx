import { useState, useEffect } from 'react';
import { Header } from './components/layout/Header.js';
import { TabNavigation } from './components/layout/TabNavigation.js';
import { DrawingCanvas } from './components/canvas/DrawingCanvas.js';
import { PhaserGameView } from './components/game/PhaserGameView.js';
import { Card } from './components/ui/Card.js';
import { Button } from './components/ui/Button.js';
import { fetchHealth, analyzeCharacterImage } from './services/api.js';
import type { CharacterConfig, JourneyStep, CharacterAttributes } from './types/game.js';
import {
  Sparkles,
  Play,
  RotateCcw,
  Zap,
  Shield,
  Heart,
  Sliders,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export function App() {
  const [currentStep, setCurrentStep] = useState<JourneyStep>('draw');
  const [characterConfig, setCharacterConfig] = useState<CharacterConfig | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalysisSource, setLastAnalysisSource] = useState<'gemini' | 'mock-heuristic' | null>(null);
  const [serverHealth, setServerHealth] = useState<{
    status: string;
    aiProvider: string;
    geminiConfigured: boolean;
  } | undefined>(undefined);

  // Poll backend health on initial mount
  useEffect(() => {
    fetchHealth()
      .then((data) => setServerHealth(data))
      .catch((err) => console.warn('Could not connect to backend healthcheck:', err.message));
  }, []);

  // Handle Canvas Drawing submission
  const handleAnalyzeDrawing = async (dataUrl: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setCurrentStep('analyze');

    try {
      const response = await analyzeCharacterImage(dataUrl);

      const newConfig: CharacterConfig = {
        id: `hero-${Date.now()}`,
        attributes: response.attributes,
        drawingDataUrl: dataUrl,
        createdAt: new Date().toISOString(),
      };

      setCharacterConfig(newConfig);
      setLastAnalysisSource(response.source);
      setCurrentStep('transform');
    } catch (err: unknown) {
      console.error('Character analysis failed:', err);
      setAnalysisError((err as Error).message || 'Failed to analyze character drawing.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Modify attributes in customization step
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header serverStatus={serverHealth} />

      {/* Main 5-Step Journey Navigation */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pb-12 flex flex-col items-center">
        <TabNavigation
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          hasDrawnCharacter={Boolean(characterConfig)}
        />

        {/* STEP 1: DRAW */}
        {currentStep === 'draw' && (
          <div className="w-full max-w-3xl flex flex-col items-center animate-in fade-in duration-300">
            <div className="text-center mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                Phase 1: Character Creation
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
                Draw Your Hero Sketch
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto mt-1">
                Sketch your character using the palette below. Sharp angles, round shapes, or bright colors will be interpreted by Image AI into physics traits!
              </p>
            </div>

            <DrawingCanvas
              onAnalyze={handleAnalyzeDrawing}
              isAnalyzing={isAnalyzing}
            />
          </div>
        )}

        {/* STEP 2: ANALYZE */}
        {currentStep === 'analyze' && (
          <div className="w-full max-w-xl py-12 flex flex-col items-center text-center animate-in fade-in duration-300">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-2xl animate-pulse">
                <Sparkles className="w-10 h-10" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-indigo-500/20 blur-xl -z-10 animate-ping" />
            </div>

            <h2 className="text-2xl font-bold text-white">Analyzing Image with AI...</h2>
            <p className="text-sm text-slate-400 mt-2 max-w-md">
              Extracting contours, determining visual archetype, classifying density, and calculating physics coefficients.
            </p>

            {analysisError && (
              <div className="mt-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5 max-w-md text-left">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <strong className="block font-semibold">Analysis Failed</strong>
                  <span>{analysisError}</span>
                  <div className="mt-3">
                    <Button size="sm" variant="secondary" onClick={() => setCurrentStep('draw')}>
                      Return to Canvas
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: TRANSFORM */}
        {currentStep === 'transform' && characterConfig && (
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-in fade-in duration-300">
            {/* Visual Preview */}
            <Card title="Player Sketch Render" icon={<Sparkles className="w-4 h-4" />}>
              <div className="w-full aspect-square max-w-[280px] mx-auto rounded-2xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-center shadow-inner relative overflow-hidden group">
                <img
                  src={characterConfig.drawingDataUrl}
                  alt="Drawn Hero"
                  className="w-full h-full object-contain filter drop-shadow-[0_10px_15px_rgba(59,130,246,0.3)]"
                />
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[10px] text-slate-400">
                  Source: {lastAnalysisSource === 'gemini' ? 'Gemini 3.8 Flash' : 'Deterministic Heuristic'}
                </div>
              </div>

              <div className="mt-4 text-center">
                <h3 className="text-xl font-extrabold text-white">
                  {characterConfig.attributes.name}
                </h3>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {characterConfig.attributes.archetype}
                </span>
                <p className="text-xs text-slate-400 mt-2 italic px-4">
                  "{characterConfig.attributes.visualDescription}"
                </p>
              </div>
            </Card>

            {/* AI Attributes & Stats Card */}
            <Card title="Generated Game Physics Traits" icon={<Zap className="w-4 h-4" />}>
              <div className="space-y-4">
                {/* Speed Metric */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <Zap className="w-3.5 h-3.5" /> Movement Speed
                    </span>
                    <span className="text-slate-300 font-mono">{characterConfig.attributes.speed} px/s</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(characterConfig.attributes.speed / 400) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Jump Power */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Shield className="w-3.5 h-3.5" /> Jump Force
                    </span>
                    <span className="text-slate-300 font-mono">{characterConfig.attributes.jumpPower} imp</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(characterConfig.attributes.jumpPower / 600) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Health Points */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <Heart className="w-3.5 h-3.5" /> Vitality
                    </span>
                    <span className="text-slate-300 font-mono">{characterConfig.attributes.health} HP</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(characterConfig.attributes.health / 200) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Detected Features Chips */}
                {characterConfig.attributes.detectedFeatures.length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-xs font-semibold text-slate-400 block mb-1.5">
                      Identified Visual Features:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {characterConfig.attributes.detectedFeatures.map((feat, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300 border border-slate-700/80"
                        >
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA Buttons */}
                <div className="pt-4 flex items-center gap-3">
                  <Button
                    variant="accent"
                    size="lg"
                    className="flex-1 flex items-center justify-center gap-2"
                    onClick={() => setCurrentStep('play')}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play With Character</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setCurrentStep('customize')}
                  >
                    <Sliders className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* STEP 4: PLAY (PHASER GAME ENGINE) */}
        {currentStep === 'play' && (
          <div className="w-full max-w-4xl flex flex-col items-center gap-4 animate-in fade-in duration-300">
            {/* Phaser Game Container */}
            <PhaserGameView characterConfig={characterConfig || undefined} />

            {/* Quick Actions Under Game */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Physics loop running at 60 FPS
                </span>
                <span>•</span>
                <span>Use <strong>A / D</strong> or <strong>Arrow Keys</strong> to run</span>
                <span>•</span>
                <span><strong>W</strong> or <strong>Space</strong> to jump</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentStep('customize')}
                >
                  <Sliders className="w-3.5 h-3.5 mr-1.5" />
                  Tune Stats
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentStep('draw')}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Draw New Hero
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: CUSTOMIZE */}
        {currentStep === 'customize' && characterConfig && (
          <div className="w-full max-w-2xl animate-in fade-in duration-300">
            <Card title="Hero Physics Customization" icon={<Sliders className="w-4 h-4" />}>
              <p className="text-xs text-slate-400 mb-6">
                Fine-tune your character's engine attributes in real time. Changes take effect instantly in the Phaser 2D game.
              </p>

              <div className="space-y-6">
                {/* Speed Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-sky-400">Run Speed</span>
                    <span className="font-mono text-slate-200">{characterConfig.attributes.speed} px/s</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="400"
                    value={characterConfig.attributes.speed}
                    onChange={(e) => handleAttributeChange('speed', Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>100 (Heavy)</span>
                    <span>400 (Supersonic)</span>
                  </div>
                </div>

                {/* Jump Force Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-amber-400">Jump Power</span>
                    <span className="font-mono text-slate-200">{characterConfig.attributes.jumpPower} imp</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="600"
                    value={characterConfig.attributes.jumpPower}
                    onChange={(e) => handleAttributeChange('jumpPower', Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>200 (Low Hop)</span>
                    <span>600 (Moon Leap)</span>
                  </div>
                </div>

                {/* Gravity Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-purple-400">Gravity Pull</span>
                    <span className="font-mono text-slate-200">{characterConfig.attributes.gravity} px/s²</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="1200"
                    value={characterConfig.attributes.gravity}
                    onChange={(e) => handleAttributeChange('gravity', Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>400 (Low Gravity)</span>
                    <span>1200 (Heavy Gravity)</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <Button variant="accent" onClick={() => setCurrentStep('play')}>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Back to Game
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
