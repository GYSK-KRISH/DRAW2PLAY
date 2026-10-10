import React from 'react';
import { Sparkles, HelpCircle, FolderLock, RefreshCw } from 'lucide-react';

interface StudioHeaderProps {
  currentTab: 'studio' | 'creations' | 'help';
  onTabChange: (tab: 'studio' | 'creations' | 'help') => void;
  serverStatus?: {
    status: string;
    aiProvider: string;
    geminiConfigured: boolean;
  };
  isRefreshingStatus?: boolean;
  onRefreshStatus?: () => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  currentTab,
  onTabChange,
  serverStatus,
  isRefreshingStatus = false,
  onRefreshStatus,
}) => {
  return (
    <header className="w-full bg-[#070a13]/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40 px-4 sm:px-6 py-2.5">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Left: Original Wordmark & Icon */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => onTabChange('studio')}>
            {/* Original Stylized Logo Icon */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-purple-900/30">
              <div className="w-full h-full bg-[#0a0e1c] rounded-[11px] flex items-center justify-center relative overflow-hidden">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform duration-300"
                >
                  <path
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19.5 4.5l-2.25 2.25 3.75 3.75L23.25 8.25a2.121 2.121 0 000-3l-0.75-0.75a2.121 2.121 0 00-3 0z"
                    fill="currentColor"
                    fillOpacity="0.8"
                  />
                  <circle cx="8" cy="18" r="1.5" fill="#a855f7" />
                </svg>
              </div>
            </div>
            <div className="absolute -inset-0.5 rounded-xl bg-cyan-400/20 blur opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-white">
                Draw2Play <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">AI</span>
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                Studio
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block -mt-0.5">
              Sketch-to-Game Intelligent Physics Engine
            </p>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav aria-label="Main Studio Navigation" className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => onTabChange('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              currentTab === 'studio'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>Studio</span>
            {currentTab === 'studio' && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('creations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              currentTab === 'creations'
                ? 'bg-slate-800 text-white border border-slate-700/80'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FolderLock className="w-3.5 h-3.5 text-slate-400" />
            <span>My Creations</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hidden md:inline-block">
              Phase 3
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('help')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              currentTab === 'help'
                ? 'bg-slate-800 text-white border border-slate-700/80'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Help</span>
          </button>
        </nav>

        {/* Right: API / Backend Connection Status Pill */}
        <div className="flex items-center gap-2">
          {serverStatus ? (
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-mono transition-all ${
                serverStatus.geminiConfigured
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
              title={
                serverStatus.geminiConfigured
                  ? 'Connected to Google Gemini 3.8 Flash Vision Model'
                  : 'Running in offline deterministic heuristic mode. Add GEMINI_API_KEY in .env to activate Gemini 3.8 Flash.'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  serverStatus.geminiConfigured
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : 'bg-amber-400'
                } animate-pulse`}
              />
              <span className="hidden lg:inline font-sans text-[11px] font-medium">
                {serverStatus.geminiConfigured ? 'Gemini 3.8 Flash Online' : 'Heuristic Engine'}
              </span>
              <span className="lg:hidden text-[11px]">
                {serverStatus.geminiConfigured ? 'Gemini' : 'Heuristic'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400">
              <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
              <span className="hidden sm:inline">Connecting API...</span>
            </div>
          )}

          {onRefreshStatus && (
            <button
              type="button"
              onClick={onRefreshStatus}
              disabled={isRefreshingStatus}
              title="Refresh connection status"
              aria-label="Refresh connection status"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStatus ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
