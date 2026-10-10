import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Gamepad2,
  Trash2,
  Copy,
  Edit2,
  Check,
  Search,
  Cpu,
  ShieldAlert,
  Layers,
  Calendar,
  AlertTriangle,
  PenTool,
} from 'lucide-react';
import type { SavedCreation } from '../../types/creation.js';
import {
  getAllCreations,
  deleteCreation,
  renameCreation,
  duplicateCreation,
} from '../../services/creationStorage.js';
import type { PlayableGameScene } from '../../types/scene.js';
import type { SketchDocument } from '../../types/sketch.js';
import { audioService } from '../../services/audioService.js';

interface MyCreationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSketch: (document: SketchDocument) => void;
  onPlayLevel: (scene: PlayableGameScene) => void;
  onSaveCurrentSketch?: () => void;
  canSaveCurrentSketch?: boolean;
}

export const MyCreationsModal: React.FC<MyCreationsModalProps> = ({
  isOpen,
  onClose,
  onLoadSketch,
  onPlayLevel,
  onSaveCurrentSketch,
  canSaveCurrentSketch = false,
}) => {
  const [creations, setCreations] = useState<SavedCreation[]>(() => (isOpen ? getAllCreations() : []));
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setCreations(getAllCreations());
      setEditingId(null);
      setDeletingId(null);
    }
  }

  const refreshCreations = () => {
    setCreations(getAllCreations());
  };

  if (!isOpen) return null;

  const filteredCreations = creations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRename = (creation: SavedCreation) => {
    audioService.playClick();
    setEditingId(creation.id);
    setEditNameText(creation.name);
  };

  const handleSaveRename = (id: string) => {
    if (editNameText.trim()) {
      renameCreation(id, editNameText.trim());
      audioService.playClick();
      refreshCreations();
    }
    setEditingId(null);
  };

  const handleDuplicate = (id: string) => {
    audioService.playClick();
    duplicateCreation(id);
    refreshCreations();
  };

  const handleDeleteConfirm = (id: string) => {
    audioService.playHazard();
    deleteCreation(id);
    setDeletingId(null);
    refreshCreations();
  };

  const handlePlay = (creation: SavedCreation) => {
    audioService.playClick();
    if (creation.playableScene) {
      onPlayLevel(creation.playableScene);
      onClose();
    } else {
      // Load sketch first if no pre-generated scene
      onLoadSketch(creation.document);
      onClose();
    }
  };

  const handleLoad = (creation: SavedCreation) => {
    audioService.playClick();
    onLoadSketch(creation.document);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="creations-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#0a0e1c] border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl relative text-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-[#080b16]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 id="creations-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                My Saved Creations
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {creations.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Persistent hand-drawn levels stored locally in your browser
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canSaveCurrentSketch && onSaveCurrentSketch && (
              <button
                type="button"
                onClick={() => {
                  audioService.playClick();
                  onSaveCurrentSketch();
                  refreshCreations();
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-950/40"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Current Sketch</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                audioService.playClick();
                onClose();
              }}
              aria-label="Close"
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        {creations.length > 0 && (
          <div className="px-4 py-2.5 border-b border-slate-800/80 bg-[#070913] flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your saved levels by name..."
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Creations List View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {creations.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-[#060813] rounded-2xl border border-slate-800/60">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-500 flex items-center justify-center mb-3">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Saved Creations Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Draw platforms, hazards, and coins on the canvas, then click "Save Level" in the studio toolbar to preserve your custom blueprints!
              </p>
              {canSaveCurrentSketch && onSaveCurrentSketch && (
                <button
                  type="button"
                  onClick={() => {
                    audioService.playClick();
                    onSaveCurrentSketch();
                    refreshCreations();
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-cyan-950/40"
                >
                  <PenTool className="w-4 h-4" />
                  <span>Save Current Sketch Now</span>
                </button>
              )}
            </div>
          ) : filteredCreations.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No creations matching "{searchQuery}"
            </div>
          ) : (
            filteredCreations.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#0e1424] border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
              >
                {/* Level Info & Thumbnail Preview */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {item.thumbnailDataUrl ? (
                    <img
                      src={item.thumbnailDataUrl}
                      alt={item.name}
                      className="w-14 h-11 object-contain bg-white/5 rounded-lg border border-slate-700/50 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-11 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-cyan-400 shrink-0">
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editNameText}
                          onChange={(e) => setEditNameText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(item.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(item.id)}
                          className="p-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[220px]">
                          {item.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleStartRename(item)}
                          title="Rename Level"
                          className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>{item.document.strokes.length} strokes</span>
                      <span>•</span>
                      {/* Provenance Badge */}
                      {item.provenance === 'gemini-vision' && (
                        <span className="text-purple-300 font-mono flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> Gemini
                        </span>
                      )}
                      {item.provenance === 'local-vector' && (
                        <span className="text-cyan-300 font-mono flex items-center gap-0.5">
                          <Cpu className="w-2.5 h-2.5" /> Vector
                        </span>
                      )}
                      {item.provenance === 'mock-fallback' && (
                        <span className="text-amber-300 font-mono flex items-center gap-0.5">
                          <ShieldAlert className="w-2.5 h-2.5" /> Mock
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions per Card */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                  {/* Delete Confirmation Alert inline */}
                  {deletingId === item.id ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <span className="text-[10px] text-rose-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Delete?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteConfirm(item.id)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-1 rounded-lg text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(item.id)}
                        title="Duplicate Creation"
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingId(item.id)}
                        title="Delete Creation"
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoad(item)}
                        title="Load into Studio Canvas"
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePlay(item)}
                        title="Launch Level in Game Engine"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
                      >
                        <Gamepad2 className="w-3.5 h-3.5" />
                        <span>Play</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#080b16] flex justify-between items-center text-xs text-slate-400">
          <span className="text-[11px] text-slate-500">
            Levels are safely stored in browser localStorage.
          </span>
          <button
            type="button"
            onClick={() => {
              audioService.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
export default MyCreationsModal;
