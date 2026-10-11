import React, { useState } from 'react';
import {
  X,
  Ghost,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Globe,
} from 'lucide-react';
import type { PlayableGameScene } from '../../types/scene.js';
import type { ReplayData } from '../../types/replay.js';
import { galleryService } from '../../services/galleryService.js';

interface PublishLevelModalProps {
  scene: PlayableGameScene;
  replay?: ReplayData;
  isOpen: boolean;
  onClose: () => void;
  onPublishedSuccess?: (levelId: string) => void;
}

export const PublishLevelModal: React.FC<PublishLevelModalProps> = ({
  scene,
  replay,
  isOpen,
  onClose,
  onPublishedSuccess,
}) => {
  const [title, setTitle] = useState(scene.name || scene.levelName || 'My Custom Level');
  const [description, setDescription] = useState(
    scene.hudInstructions ? `Clear the challenge: ${scene.hudInstructions}` : 'A fun community creation.'
  );
  const [creatorName, setCreatorName] = useState('Player 1');
  const [attachGhost, setAttachGhost] = useState(Boolean(replay));
  const [visibility, setVisibility] = useState<'published' | 'unlisted'>('published');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await galleryService.publish({
        title,
        description,
        creatorName,
        playableScene: scene,
        replayData: attachGhost ? replay : undefined,
        visibility,
        existingId: scene.id,
      });

      if (!res.success || !res.item) {
        throw new Error(res.error || 'Failed to publish');
      }

      setPublishedId(res.item.id);
      onPublishedSuccess?.(res.item.id);
    } catch (err: any) {
      setError(err.message || 'Error publishing level to gallery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-violet-500/30 rounded-2xl p-6 shadow-2xl text-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl text-violet-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Publish to Community Gallery</h3>
            <p className="text-xs text-slate-400">Share your playable creation and ghost speedrun with other players.</p>
          </div>
        </div>

        {publishedId ? (
          <div className="py-6 text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h4 className="text-base font-bold text-emerald-300">Level Successfully Published!</h4>
              <p className="text-xs text-slate-300 mt-1">
                Your creation is now live in the community gallery for everyone to play.
              </p>
              <div className="mt-3 p-2 rounded-lg bg-slate-950 font-mono text-xs text-violet-300 border border-slate-800">
                Level ID: {publishedId}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-600/30"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handlePublish} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Level Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-violet-400 focus:outline-none text-sm text-white"
                placeholder="e.g. Gravity Gauntlet Run"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-violet-400 focus:outline-none text-sm text-white resize-none"
                placeholder="Give players hints or describe your level..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Creator Name</label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  maxLength={40}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-violet-400 focus:outline-none text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-violet-400 focus:outline-none text-sm text-white"
                >
                  <option value="published">Public (In Gallery)</option>
                  <option value="unlisted">Unlisted (Direct Link)</option>
                </select>
              </div>
            </div>

            {/* Attach Ghost Run Checkbox */}
            {replay && (
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Ghost className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-semibold text-cyan-200">Include Best Ghost Run</div>
                    <div className="text-[10px] text-slate-400">
                      Time: {(replay.summary.durationMs / 1000).toFixed(1)}s • Score: {replay.summary.finalScore}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={attachGhost}
                  onChange={(e) => setAttachGhost(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>
            )}

            {/* Template Info Pill */}
            <div className="p-2.5 rounded-xl bg-slate-950 text-xs text-slate-400 border border-slate-800 flex items-center justify-between">
              <span>Template: <strong className="text-violet-300 font-mono">{scene.templateId}</strong></span>
              <span>Platforms: <strong className="text-slate-200">{scene.platforms.length}</strong></span>
              <span>Coins: <strong className="text-amber-300">{scene.coins.length}</strong></span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>Publishing...</>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Publish Level
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
