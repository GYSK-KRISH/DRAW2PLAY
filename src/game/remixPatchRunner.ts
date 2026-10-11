import type { PlayableGameScene } from '../types/scene.js';

export interface HotPatchTargetScene {
  sceneData?: PlayableGameScene;
  score: number;
  coinsCollected: number;
  switchesActivated: number;
  totalCoins: number;
  gravityDirection?: number;
  player?: {
    x: number;
    y: number;
    setPosition?: (x: number, y: number) => void;
    setGravityY?: (g: number) => void;
    gravityY?: number;
  };
  cameras?: {
    main?: {
      setBackgroundColor?: (color: string | number) => void;
    };
  };
  coins?: any;
  hazards?: any;
  textures?: {
    exists: (key: string) => boolean;
  };
  tweens?: {
    add: (config: any) => any;
  };
  restartGame?: (sceneData?: PlayableGameScene) => void;
  showMessage?: (msg: string) => void;
  updateHud?: () => void;
}

/**
 * Stage 7: Applies a validated remix patch to a Phaser scene target.
 * Determines whether the changes can be applied live (hot) without scene restage,
 * or routes through a clean, progress-preserving restage.
 */
export function applySceneHotPatch(
  scene: HotPatchTargetScene,
  patchedScene: PlayableGameScene,
  affectedSystems: string[] = []
): { success: boolean; appliedHot: boolean; reason?: string } {
  try {
    const isStructural =
      affectedSystems.includes('structural') ||
      (patchedScene.platforms && patchedScene.platforms.length !== (scene.sceneData?.platforms?.length ?? 0));

    if (isStructural) {
      // -----------------------------------------------------------------------
      // STRUCTURAL PATH: Safe, Progress-Preserving Restage
      // -----------------------------------------------------------------------
      const preservedScore = scene.score;
      const preservedCoins = scene.coinsCollected;
      const preservedSwitches = scene.switchesActivated;
      const currentPx = scene.player?.x;
      const currentPy = scene.player?.y;

      if (currentPx !== undefined && currentPy !== undefined) {
        patchedScene.player.spawnX = currentPx;
        patchedScene.player.spawnY = currentPy;
      }

      if (typeof scene.restartGame === 'function') {
        scene.restartGame(patchedScene);
      }
      scene.score = preservedScore;
      scene.coinsCollected = preservedCoins;
      scene.switchesActivated = preservedSwitches;

      if (typeof scene.showMessage === 'function') {
        scene.showMessage('Remix Applied (Restaged with state preserved)');
      }
      return { success: true, appliedHot: false, reason: 'Structural changes required clean restage.' };
    }

    // -------------------------------------------------------------------------
    // HOT UPDATE PATH: In-place runtime mutations without scene restage
    // -------------------------------------------------------------------------
    scene.sceneData = patchedScene;

    // 1. Presentation & Theme
    if (affectedSystems.includes('presentation') || patchedScene.world.theme) {
      const bgHex = patchedScene.world.backgroundColor || '#070a13';
      if (scene.cameras?.main?.setBackgroundColor) {
        scene.cameras.main.setBackgroundColor(bgHex);
      }
      if (typeof scene.updateHud === 'function') {
        scene.updateHud();
      }
    }

    // 2. Physics & Gravity
    if (affectedSystems.includes('physics') || patchedScene.world.gravity !== undefined) {
      const newGrav = patchedScene.world.gravity ?? 750;
      const gravDir = scene.gravityDirection ?? 1;
      if (scene.player?.setGravityY) {
        scene.player.setGravityY(newGrav > 0 ? newGrav * gravDir : 0);
      }
      if (scene.player && 'gravityY' in scene.player) {
        scene.player.gravityY = newGrav;
      }
    }

    // 3. Collectibles / Coins
    if (affectedSystems.includes('entities') && patchedScene.coins && scene.coins) {
      const existingCoinIds = new Set<string>();
      if (typeof scene.coins.getChildren === 'function') {
        for (const child of scene.coins.getChildren()) {
          const cid = child?.getData ? child.getData('id') : child?.id;
          if (cid) existingCoinIds.add(cid);
        }
      }

      for (const c of patchedScene.coins) {
        if (!existingCoinIds.has(c.id)) {
          const coinTexture = scene.textures?.exists('custom-asset-collectible')
            ? 'custom-asset-collectible'
            : 'coin-sprite';
          if (typeof scene.coins.create === 'function') {
            const cSprite = scene.coins.create(c.x, c.y, coinTexture);
            if (cSprite) {
              if (cSprite.setDisplaySize) cSprite.setDisplaySize(c.size || 24, c.size || 24);
              if (cSprite.setData) {
                cSprite.setData('id', c.id);
                cSprite.setData('value', c.value || 10);
              }
              if (cSprite.setCollideWorldBounds) cSprite.setCollideWorldBounds(true);
              if (cSprite.setBounce) cSprite.setBounce(0.3);

              if (scene.tweens?.add) {
                scene.tweens.add({
                  targets: cSprite,
                  y: c.y - 6,
                  duration: 800 + Math.random() * 400,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                });
              }
            }
          }
        }
      }
      scene.totalCoins = patchedScene.coins.length;
      if (typeof scene.updateHud === 'function') {
        scene.updateHud();
      }
    }

    // 4. Hazards (with player proximity collision safety)
    if (affectedSystems.includes('entities') && patchedScene.hazards && scene.hazards) {
      const existingHazardIds = new Set<string>();
      if (typeof scene.hazards.getChildren === 'function') {
        for (const child of scene.hazards.getChildren()) {
          const hid = child?.getData ? child.getData('id') : child?.id;
          if (hid) existingHazardIds.add(hid);
        }
      }

      for (const h of patchedScene.hazards) {
        if (!existingHazardIds.has(h.id)) {
          // Safety check: ensure newly remixed hazard does not overlap current player!
          if (scene.player) {
            const playerDist = Math.hypot(
              scene.player.x - (h.x + h.width / 2),
              scene.player.y - (h.y + h.height / 2)
            );
            if (playerDist < 48) {
              const safeY = Math.max(50, h.y - h.height - 30);
              if (scene.player.setPosition) {
                scene.player.setPosition(scene.player.x, safeY);
              } else {
                scene.player.y = safeY;
              }
            }
          }

          const hTexture = scene.textures?.exists('custom-asset-hazard')
            ? 'custom-asset-hazard'
            : 'hazard-spike-texture';
          if (typeof scene.hazards.create === 'function') {
            const hSprite = scene.hazards.create(h.x + h.width / 2, h.y + h.height / 2, hTexture);
            if (hSprite) {
              if (hSprite.setDisplaySize) hSprite.setDisplaySize(h.width, h.height);
              if (hSprite.setData) hSprite.setData('id', h.id);
              if (hSprite.refreshBody) hSprite.refreshBody();
            }
          }
        }
      }
    }

    if (typeof scene.showMessage === 'function') {
      scene.showMessage('Remix Applied Live (Phaser Hot Update)');
    }
    return { success: true, appliedHot: true };
  } catch (err: any) {
    console.warn('[RemixPatchRunner] Live hot-update encountered error, falling back to restage:', err);
    if (typeof scene.restartGame === 'function') {
      scene.restartGame(patchedScene);
    }
    return { success: true, appliedHot: false, reason: err.message };
  }
}
