import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  Play,
  Ghost,
  Trash2,
  X,
  RotateCcw,
} from 'lucide-react';
import type { PublicGalleryItem } from '../../types/gallery.js';
import type { PlayableGameScene } from '../../types/scene.js';
import type { ReplayData } from '../../types/replay.js';
import { galleryService } from '../../services/galleryService.js';

interface CommunityGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayLevel: (scene: PlayableGameScene, ghostReplay?: ReplayData) => void;
}

export const CommunityGalleryModal: React.FC<CommunityGalleryModalProps> = ({
  isOpen,
  onClose,
  onPlayLevel,
}) => {
  const [levels, setLevels] = useState<PublicGalleryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'best_score' | 'fastest'>('newest');
  const [hasGhostOnly, setHasGhostOnly] = useState(false);

  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      queueMicrotask(() => {
        if (active) setLoading(true);
      });
      galleryService.fetchLevels({
        search: search.trim() || undefined,
        templateId: templateFilter as any,
        sortBy,
        hasGhostOnly,
        limit: 50,
      }).then((res) => {
        if (!active) return;
        if (!res.success) {
          setError(res.error || 'Failed to load community gallery');
        } else {
          setLevels(res.items);
          setTotal(res.total);
        }
      }).catch((err: any) => {
        if (!active) return;
        setError(err.message || 'Network error');
      }).finally(() => {
        if (active) setLoading(false);
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen, search, templateFilter, sortBy, hasGhostOnly, refreshIndex]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRefreshIndex((prev) => prev + 1);
  };

  const handleUnpublish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to unpublish this level from the community?')) {
      return;
    }

    const res = await galleryService.unpublish(id);
    if (res.success) {
      setLevels((prev) => prev.filter((item) => item.id !== id));
    } else {
      alert(res.error || 'Could not unpublish level.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl h-[85vh] bg-slate-900 border border-violet-500/30 rounded-2xl shadow-2xl text-slate-100 flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/10 border border-violet-500/30 rounded-xl text-violet-400">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Community Level Gallery
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-700/50">
                  {total} Playable Creations
                </span>
              </h2>
              <p className="text-xs text-slate-400">Browse and play games crafted by players with live ghost speedruns.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Discovery Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[220px] max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, creator..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-violet-400 focus:outline-none text-white text-xs"
            />
          </form>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Template Filter */}
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none text-xs"
            >
              <option value="all">All Templates</option>
              <option value="physics-platformer">Physics Platformer</option>
              <option value="precision-platformer">Precision Platformer</option>
              <option value="physics-puzzle">Physics Puzzle</option>
              <option value="top-down-exploration">Top-Down Exploration</option>
              <option value="maze-exploration">Maze Exploration</option>
              <option value="gravity-switch-puzzle">Gravity-Switch Puzzle</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none text-xs"
            >
              <option value="newest">Newest First</option>
              <option value="popular">Most Played</option>
              <option value="best_score">Highest Score</option>
              <option value="fastest">Fastest Time</option>
            </select>

            {/* Ghost Only Filter */}
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 cursor-pointer select-none text-slate-300 hover:text-cyan-300 transition-colors">
              <input
                type="checkbox"
                checked={hasGhostOnly}
                onChange={(e) => setHasGhostOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-cyan-500 rounded"
              />
              <Ghost className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ghost Only</span>
            </label>

            <button
              type="button"
              onClick={() => setRefreshIndex((prev) => prev + 1)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Gallery"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mr-3" />
              Loading creations...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-center text-xs">
              {error}
            </div>
          ) : levels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Globe className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-300">No published levels match your query.</p>
              <p className="text-xs text-slate-500 mt-1">Try clearing your search filters or publish your own level!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {levels.map((item) => {
                const isOwned = galleryService.isOwnedByMe(item.id);
                const hasGhost = Boolean(item.hasGhostReplay && item.bestReplay);
                const bestDurationSec = item.bestDurationMs ? (item.bestDurationMs / 1000).toFixed(1) : null;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-violet-500/40 transition-all shadow-md group"
                  >
                    <div>
                      {/* Top Bar: Template Badge & Ghost availability */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-800 text-violet-300 border border-slate-700 truncate max-w-[150px]">
                          {item.templateId}
                        </span>

                        {hasGhost && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                            <Ghost className="w-3 h-3 text-cyan-400" />
                            {bestDurationSec ? `${bestDurationSec}s` : 'Ghost Run'}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                        {item.title}
                      </h3>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                        {item.description || 'No description provided.'}
                      </p>

                      {/* Creator & Metrics */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-800/80">
                        <span className="truncate max-w-[130px]">By {item.creatorName}</span>
                        <div className="flex items-center gap-2">
                          <span title="Plays">🎮 {item.playCount}</span>
                          {item.bestScore !== undefined && (
                            <span title="Best Score">🏆 {item.bestScore}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-4 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          onPlayLevel(item.playableScene);
                          galleryService.recordPlay(item.id);
                          onClose();
                        }}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-violet-600/20"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Play
                      </button>

                      {hasGhost && (
                        <button
                          type="button"
                          onClick={() => {
                            onPlayLevel(item.playableScene, item.bestReplay);
                            galleryService.recordPlay(item.id);
                            onClose();
                          }}
                          className="py-1.5 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                          title="Race against creator's ghost run"
                        >
                          <Ghost className="w-3.5 h-3.5 text-cyan-400" />
                          Race Ghost
                        </button>
                      )}

                      {isOwned && (
                        <button
                          type="button"
                          onClick={(e) => handleUnpublish(item.id, e)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-400 border border-slate-700 transition-colors"
                          title="Unpublish Level (Owner Only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
