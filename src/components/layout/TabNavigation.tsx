import React from 'react';
import { Pencil, Sparkles, Wand2, Play, Sliders } from 'lucide-react';
import type { JourneyStep } from '../../types/game.js';

interface TabNavigationProps {
  currentStep: JourneyStep;
  onStepChange: (step: JourneyStep) => void;
  hasDrawnCharacter: boolean;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  currentStep,
  onStepChange,
  hasDrawnCharacter,
}) => {
  const steps: { id: JourneyStep; label: string; icon: React.ReactNode; description: string }[] = [
    {
      id: 'draw',
      label: '1. Draw',
      icon: <Pencil className="w-4 h-4" />,
      description: 'Sketch Hero',
    },
    {
      id: 'analyze',
      label: '2. Analyze AI',
      icon: <Sparkles className="w-4 h-4" />,
      description: 'Image AI Vision',
    },
    {
      id: 'transform',
      label: '3. Transform',
      icon: <Wand2 className="w-4 h-4" />,
      description: 'Generated Stats',
    },
    {
      id: 'play',
      label: '4. Play',
      icon: <Play className="w-4 h-4" />,
      description: '2D Game',
    },
    {
      id: 'customize',
      label: '5. Customize',
      icon: <Sliders className="w-4 h-4" />,
      description: 'Fine-tune Physics',
    },
  ];

  return (
    <nav className="w-full max-w-4xl mx-auto my-6 px-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isAccessible = step.id === 'draw' || hasDrawnCharacter;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!isAccessible}
              onClick={() => onStepChange(step.id)}
              className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                {step.icon}
                <span>{step.label}</span>
              </div>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                {step.description}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
