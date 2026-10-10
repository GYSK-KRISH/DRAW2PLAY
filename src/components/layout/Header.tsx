import React from 'react';
import { Gamepad2, Sparkles } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge.js';

interface HeaderProps {
  serverStatus?: {
    status: string;
    aiProvider: string;
    geminiConfigured: boolean;
  };
}

export const Header: React.FC<HeaderProps> = ({ serverStatus }) => {
  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-50 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo and Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight leading-none m-0">
                Draw2Play <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-indigo-400">AI</span>
              </h1>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                v0.1.0-alpha
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sketch to Playable Browser Game with Image AI
            </p>
          </div>
        </div>

        {/* Badges & Live Status */}
        <div className="flex items-center flex-wrap gap-2.5">
          <StatusBadge label="Banana Hacks 2026" variant="theme" />
          <StatusBadge label="Theme: Image AI" variant="info" />

          {serverStatus ? (
            <StatusBadge
              label={serverStatus.geminiConfigured ? 'Gemini 3.8 Flash Online' : 'Heuristic Engine Active'}
              variant={serverStatus.geminiConfigured ? 'success' : 'warning'}
            />
          ) : (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-spin" /> Connecting to backend...
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
