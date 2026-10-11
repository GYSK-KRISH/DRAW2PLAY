import Phaser from 'phaser';
import type { PlayableGameScene, GamePlayState } from '../../types/scene.js';
import type { GameTemplateId } from '../../types/plan.js';
import { audioService } from '../../services/audioService.js';
import { GameDirector } from '../director/index.js';
import { applySceneHotPatch } from '../remixPatchRunner.js';
import type { ReplayData } from '../../types/replay.js';
import { ReplayRecorder } from '../replay/replayRecorder.js';
import { createSceneGhostVisual, type SceneGhostVisual, type PlaybackSpeed } from '../replay/ghostPlayback.js';

export interface MainSceneInitData {
  sceneData?: PlayableGameScene;
  onGameStateChange?: (state: GamePlayState, score: number, coinsCollected: number) => void;
  ghostReplay?: ReplayData;
  onReplayRecorded?: (replay: ReplayData) => void;
}

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private trampolines!: Phaser.Physics.Arcade.StaticGroup;
  private coins!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private switches!: Phaser.Physics.Arcade.StaticGroup;
  private doors!: Phaser.Physics.Arcade.StaticGroup;
  private doorsMap = new Map<string, Phaser.Types.Physics.Arcade.ImageWithStaticBody>();
  private goalObject!: Phaser.Types.Physics.Arcade.ImageWithStaticBody;

  // Particle Emitters
  private dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private bounceEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private hazardEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private ambientEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  private sceneData?: PlayableGameScene;
  private onGameStateChange?: (state: GamePlayState, score: number, coinsCollected: number) => void;

  private score = 0;
  private coinsCollected = 0;
  private totalCoins = 0;
  private switchesActivated = 0;
  private totalSwitches = 0;
  private gameState: GamePlayState = 'ready';

  // Movement & physics states
  private lastDustTime = 0;
  private gravityDirection = 1; // 1 = down, -1 = up (for gravity-switch)
  private driftAngle = 0;
  private driftSpeed = 0;

  // Objective & Timer governance
  private remainingTime = 0;
  private timerEvent?: Phaser.Time.TimerEvent;
  private hudText?: Phaser.GameObjects.Text;
  private messageBanner?: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;
  private director?: GameDirector;

  // Stage 8: Replay Recording and Ghost Playback
  private recorder: ReplayRecorder = new ReplayRecorder();
  private ghostVisual?: SceneGhostVisual | null;
  private ghostReplayData?: ReplayData;
  private onReplayRecorded?: (replay: ReplayData) => void;
  private runStartTime = 0;

  // Virtual mobile touch controls
  private virtualInput = { left: false, right: false, up: false, down: false, jump: false, action: false };

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: MainSceneInitData) {
    this.director?.shutdown();
    this.director = undefined;
    this.ghostVisual?.destroy();
    this.ghostVisual = null;
    this.recorder.reset();
    this.ghostReplayData = data.ghostReplay;
    this.onReplayRecorded = data.onReplayRecorded;
    this.runStartTime = 0;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ghostVisual?.destroy();
      this.ghostVisual = null;
      this.recorder.reset();
    });

    this.sceneData = data.sceneData;
    this.onGameStateChange = data.onGameStateChange;
    this.score = 0;
    this.coinsCollected = 0;
    this.totalCoins = this.sceneData?.coins.length ?? 0;
    this.switchesActivated = 0;
    this.totalSwitches = this.sceneData?.switches?.length ?? 0;
    this.gameState = 'ready';
    this.lastDustTime = 0;
    this.gravityDirection = 1;
    this.driftAngle = 0;
    this.driftSpeed = 0;
    this.doorsMap.clear();
    this.remainingTime = this.sceneData?.objective?.timeLimitSeconds ?? 0;
    this.virtualInput = { left: false, right: false, up: false, down: false, jump: false, action: false };
  }

  getTotalCoins(): number {
    return this.totalCoins;
  }

  public setVirtualInput(input: {
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
    jump?: boolean;
    action?: boolean;
  }) {
    if (input.left !== undefined) this.virtualInput.left = input.left;
    if (input.right !== undefined) this.virtualInput.right = input.right;
    if (input.up !== undefined) this.virtualInput.up = input.up;
    if (input.down !== undefined) this.virtualInput.down = input.down;
    if (input.jump !== undefined) this.virtualInput.jump = input.jump;
    if (input.action !== undefined) this.virtualInput.action = input.action;
  }

  preload() {
    // 0. Preload Custom Generated Visual Assets
    const customAssets: Record<string, string> = { ...(this.sceneData?.assets || {}) };
    if (this.sceneData?.assetBundle?.assets) {
      for (const asset of this.sceneData.assetBundle.assets) {
        if (asset.dataUrl && !customAssets[asset.role]) {
          customAssets[asset.role] = asset.dataUrl;
        }
      }
    }

    for (const [role, dataUrl] of Object.entries(customAssets)) {
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        const customKey = `custom-asset-${role}`;
        if (this.textures.exists(customKey)) {
          this.textures.remove(customKey);
        }
        try {
          this.load.image(customKey, dataUrl);
        } catch (e) {
          console.warn(`[MainScene] Failed to load custom texture for ${role}:`, e);
        }
      }
    }

    // 1. Procedural Player Hero Texture (Fallback)
    if (!this.textures.exists('hero-sprite')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x38bdf8, 1);
      g.fillCircle(18, 18, 16);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(14, 14, 4);
      g.fillCircle(22, 14, 4);
      g.fillStyle(0x0f172a, 1);
      g.fillCircle(15, 14, 2);
      g.fillCircle(23, 14, 2);
      g.lineStyle(2, 0x0284c7, 1);
      g.strokeCircle(18, 18, 16);
      g.generateTexture('hero-sprite', 36, 36);
      g.destroy();
    }

    // 2. Procedural Coin Texture
    if (!this.textures.exists('coin-sprite')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xfacc15, 1);
      g.fillCircle(12, 12, 10);
      g.lineStyle(2, 0xeab308, 1);
      g.strokeCircle(12, 12, 10);
      g.fillStyle(0xfffbeb, 1);
      g.fillCircle(10, 9, 3);
      g.generateTexture('coin-sprite', 24, 24);
      g.destroy();
    }

    // 3. Procedural Hazard Spike Texture
    if (!this.textures.exists('hazard-spike-texture')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xef4444, 1);
      g.fillTriangle(0, 24, 12, 0, 24, 24);
      g.lineStyle(2, 0xb91c1c, 1);
      g.strokeTriangle(0, 24, 12, 0, 24, 24);
      g.generateTexture('hazard-spike-texture', 24, 24);
      g.destroy();
    }

    // 4. Procedural Trampoline Pad Texture
    if (!this.textures.exists('trampoline-texture')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x06b6d4, 1);
      g.fillRoundedRect(0, 4, 48, 12, 4);
      g.lineStyle(2, 0x0891b2, 1);
      g.strokeRoundedRect(0, 4, 48, 12, 4);
      g.fillStyle(0xa5f3fc, 1);
      g.fillRect(8, 2, 32, 3);
      g.generateTexture('trampoline-texture', 48, 16);
      g.destroy();
    }

    // 5. Procedural Goal Flag Texture
    if (!this.textures.exists('goal-flag-texture')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x94a3b8, 1);
      g.fillRect(4, 0, 4, 48);
      g.fillStyle(0xa855f7, 1);
      g.fillTriangle(8, 4, 32, 16, 8, 28);
      g.lineStyle(2, 0xd8b4fe, 1);
      g.strokeTriangle(8, 4, 32, 16, 8, 28);
      g.generateTexture('goal-flag-texture', 36, 48);
      g.destroy();
    }

    // 6. Procedural Enemy Texture
    if (!this.textures.exists('enemy-sprite')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xef4444, 1);
      g.fillCircle(16, 16, 14);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(11, 12, 4);
      g.fillCircle(21, 12, 4);
      g.fillStyle(0x0f172a, 1);
      g.fillCircle(12, 12, 2);
      g.fillCircle(20, 12, 2);
      g.lineStyle(2, 0x991b1b, 1);
      g.strokeCircle(16, 16, 14);
      g.generateTexture('enemy-sprite', 32, 32);
      g.destroy();
    }

    // 7. Procedural Switch Texture
    if (!this.textures.exists('switch-texture')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xeab308, 1);
      g.fillRoundedRect(0, 4, 32, 12, 3);
      g.fillStyle(0xfacc15, 1);
      g.fillRect(8, 0, 16, 4);
      g.generateTexture('switch-texture', 32, 16);
      g.destroy();
    }

    if (!this.textures.exists('switch-active-texture')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x10b981, 1);
      g.fillRoundedRect(0, 8, 32, 8, 2);
      g.generateTexture('switch-active-texture', 32, 16);
      g.destroy();
    }

    // 8. Procedural Door Barrier Texture
    if (!this.textures.exists('door-texture')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x334155, 1);
      g.fillRect(0, 0, 24, 80);
      g.fillStyle(0xf59e0b, 1);
      g.fillRect(4, 10, 16, 8);
      g.fillRect(4, 36, 16, 8);
      g.fillRect(4, 62, 16, 8);
      g.lineStyle(2, 0x1e293b, 1);
      g.strokeRect(0, 0, 24, 80);
      g.generateTexture('door-texture', 24, 80);
      g.destroy();
    }

    // 9. Procedural Particle Textures
    if (!this.textures.exists('particle-dust')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x94a3b8, 1);
      g.fillCircle(3, 3, 3);
      g.generateTexture('particle-dust', 6, 6);
      g.destroy();
    }

    if (!this.textures.exists('particle-sparkle')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xfacc15, 1);
      g.fillCircle(3, 3, 3);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(3, 3, 1.5);
      g.generateTexture('particle-sparkle', 6, 6);
      g.destroy();
    }

    if (!this.textures.exists('particle-confetti')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xa855f7, 1);
      g.fillRect(0, 0, 6, 4);
      g.generateTexture('particle-confetti', 6, 4);
      g.destroy();
    }
  }

  create() {
    const width = this.sceneData?.world.width ?? 800;
    const height = this.sceneData?.world.height ?? 480;
    const theme = this.sceneData?.world.theme ?? 'default';

    // Theme color palettes
    const themePalettes: Record<
      string,
      { bgTop: number; bgBottom: number; grid: number; platFill: number; platLine: number; platCap: number }
    > = {
      default: { bgTop: 0x070a13, bgBottom: 0x111827, grid: 0x1f2937, platFill: 0x10b981, platLine: 0x059669, platCap: 0x34d399 },
      forest: { bgTop: 0x052e16, bgBottom: 0x0f172a, grid: 0x14532d, platFill: 0x15803d, platLine: 0x14532d, platCap: 0x4ade80 },
      ice: { bgTop: 0x082f49, bgBottom: 0x0369a1, grid: 0x0284c7, platFill: 0x38bdf8, platLine: 0x0284c7, platCap: 0xe0f2fe },
      lava: { bgTop: 0x1c1917, bgBottom: 0x450a0a, grid: 0x7f1d1d, platFill: 0x292524, platLine: 0x78716c, platCap: 0xf97316 },
      space: { bgTop: 0x030712, bgBottom: 0x1e1b4b, grid: 0x4338ca, platFill: 0x475569, platLine: 0x334155, platCap: 0x818cf8 },
      cyberpunk: { bgTop: 0x09090b, bgBottom: 0x2e1065, grid: 0xd946ef, platFill: 0x18181b, platLine: 0x06b6d4, platCap: 0xd946ef },
    };

    const palette = themePalettes[theme] || themePalettes.default;

    // Background aesthetics with theme gradients
    const bgGradient = this.add.graphics();
    bgGradient.fillGradientStyle(palette.bgTop, palette.bgTop, palette.bgBottom, palette.bgBottom, 1);
    bgGradient.fillRect(0, 0, width, height);

    // Custom AI Generated / Procedural Backdrop (Stage 5)
    if (this.textures.exists('custom-asset-background')) {
      const bgImg = this.add.image(width / 2, height / 2, 'custom-asset-background');
      bgImg.setDisplaySize(width, height);
      bgImg.setDepth(-10);
      bgImg.setAlpha(0.85);
    }

    // Grid lines for aesthetic
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, palette.grid, 0.3);
    for (let x = 0; x <= width; x += 40) {
      gridGraphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 40) {
      gridGraphics.lineBetween(0, y, width, y);
    }

    // -----------------------------------------------------------------------
    // A. SOLID PLATFORMS & WALLS
    // -----------------------------------------------------------------------
    this.platforms = this.physics.add.staticGroup();
    const platData = this.sceneData?.platforms ?? [
      { id: 'floor', x: 0, y: height - 32, width, height: 32 },
    ];

    const hasCustomPlatform = this.textures.exists('custom-asset-platform');

    for (const plat of platData) {
      let platTextureKey = `plat-tex-${plat.id}-${theme}`;
      if (hasCustomPlatform) {
        platTextureKey = 'custom-asset-platform';
      } else if (!this.textures.exists(platTextureKey)) {
        const pg = this.make.graphics({ x: 0, y: 0 });
        pg.fillStyle(palette.platFill, 1);
        pg.fillRoundedRect(0, 0, plat.width, plat.height, 4);
        pg.lineStyle(2, palette.platLine, 1);
        pg.strokeRoundedRect(0, 0, plat.width, plat.height, 4);
        pg.fillStyle(palette.platCap, 1);
        pg.fillRect(2, 1, Math.max(1, plat.width - 4), 3);
        pg.generateTexture(platTextureKey, plat.width, plat.height);
        pg.destroy();
      }

      const pSprite = this.platforms.create(
        plat.x + plat.width / 2,
        plat.y + plat.height / 2,
        platTextureKey
      ) as Phaser.Physics.Arcade.Sprite;
      pSprite.setDisplaySize(plat.width, plat.height);
      pSprite.refreshBody();
    }

    // -----------------------------------------------------------------------
    // B. LETHAL HAZARDS
    // -----------------------------------------------------------------------
    this.hazards = this.physics.add.staticGroup();
    const hazardData = this.sceneData?.hazards ?? [];
    const hazardTextureKey = this.textures.exists('custom-asset-hazard') ? 'custom-asset-hazard' : 'hazard-spike-texture';
    for (const haz of hazardData) {
      const hSprite = this.hazards.create(
        haz.x + haz.width / 2,
        haz.y + haz.height / 2,
        hazardTextureKey
      ) as Phaser.Physics.Arcade.Sprite;
      hSprite.setDisplaySize(haz.width, haz.height);
      hSprite.refreshBody();
    }

    // -----------------------------------------------------------------------
    // C. BOUNCY TRAMPOLINES
    // -----------------------------------------------------------------------
    this.trampolines = this.physics.add.staticGroup();
    const trampData = this.sceneData?.trampolines ?? [];
    for (const t of trampData) {
      const tSprite = this.trampolines.create(
        t.x + t.width / 2,
        t.y + t.height / 2,
        'trampoline-texture'
      ) as Phaser.Physics.Arcade.Sprite;
      tSprite.setDisplaySize(t.width, t.height);
      tSprite.setData('bounceStrength', t.bounceStrength || 620);
      tSprite.refreshBody();
    }

    // -----------------------------------------------------------------------
    // D. COLLECTIBLE COINS
    // -----------------------------------------------------------------------
    this.coins = this.physics.add.group();
    const coinData = this.sceneData?.coins ?? [];
    const coinTextureKey = this.textures.exists('custom-asset-collectible') ? 'custom-asset-collectible' : 'coin-sprite';
    for (const c of coinData) {
      const cSprite = this.coins.create(c.x, c.y, coinTextureKey) as Phaser.Physics.Arcade.Sprite;
      const cSize = c.size || 24;
      cSprite.setDisplaySize(cSize, cSize);
      if (cSprite.body) {
        cSprite.body.setSize(cSize, cSize);
      }
      cSprite.setData('value', c.value || 10);
      cSprite.setCollideWorldBounds(true);
      cSprite.setBounce(0.3);

      this.tweens.add({
        targets: cSprite,
        y: c.y - 6,
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // -----------------------------------------------------------------------
    // E. DOORS AND BARRIERS
    // -----------------------------------------------------------------------
    this.doors = this.physics.add.staticGroup();
    const doorData = this.sceneData?.doors ?? [];
    for (const d of doorData) {
      const dSprite = this.doors.create(
        d.x + d.width / 2,
        d.y + d.height / 2,
        'door-texture'
      ) as Phaser.Types.Physics.Arcade.ImageWithStaticBody;
      dSprite.setDisplaySize(d.width, d.height);
      dSprite.refreshBody();
      this.doorsMap.set(d.id, dSprite);
    }

    // -----------------------------------------------------------------------
    // F. PRESSURE SWITCHES
    // -----------------------------------------------------------------------
    this.switches = this.physics.add.staticGroup();
    const switchData = this.sceneData?.switches ?? [];
    for (const s of switchData) {
      const sSprite = this.switches.create(
        s.x + s.width / 2,
        s.y + s.height / 2,
        'switch-texture'
      ) as Phaser.Physics.Arcade.Sprite;
      sSprite.setDisplaySize(s.width, s.height);
      sSprite.setData('id', s.id);
      sSprite.setData('targetId', s.targetId);
      sSprite.setData('isActivated', false);
      sSprite.refreshBody();
    }

    // -----------------------------------------------------------------------
    // G. DYNAMIC ENEMIES
    // -----------------------------------------------------------------------
    this.enemies = this.physics.add.group();
    const enemyData = this.sceneData?.enemies ?? [];
    const enemyTextureKey = this.textures.exists('custom-asset-enemy') ? 'custom-asset-enemy' : 'enemy-sprite';
    for (const e of enemyData) {
      const eSprite = this.enemies.create(e.x, e.y, enemyTextureKey) as Phaser.Physics.Arcade.Sprite;
      const eWidth = e.width || 32;
      const eHeight = e.height || 32;
      eSprite.setDisplaySize(eWidth, eHeight);
      if (eSprite.body) {
        eSprite.body.setSize(eWidth, eHeight);
      }
      eSprite.setCollideWorldBounds(true);
      eSprite.setData('type', e.type);
      eSprite.setData('speed', e.speed || 100);
      eSprite.setData('patrolRange', e.patrolRange || 120);
      eSprite.setData('initialX', e.x);
      eSprite.setData('direction', 1);

      if (e.type === 'patrol') {
        eSprite.setVelocityX(e.speed || 100);
      }
    }

    // -----------------------------------------------------------------------
    // H. VICTORY GOAL OBJECT
    // -----------------------------------------------------------------------
    const goalData = this.sceneData?.goal ?? {
      id: 'default-goal',
      x: width - 64,
      y: height - 96,
      width: 36,
      height: 48,
    };

    const goalTextureKey = this.textures.exists('custom-asset-goal') ? 'custom-asset-goal' : 'goal-flag-texture';
    this.goalObject = this.physics.add.staticImage(
      goalData.x + goalData.width / 2,
      goalData.y + goalData.height / 2,
      goalTextureKey
    );
    this.goalObject.setDisplaySize(goalData.width, goalData.height);
    this.goalObject.refreshBody();

    this.tweens.add({
      targets: this.goalObject,
      alpha: 0.8,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // -----------------------------------------------------------------------
    // I. PARTICLE EMITTERS
    // -----------------------------------------------------------------------
    this.dustEmitter = this.add.particles(0, 0, 'particle-dust', {
      speed: { min: 20, max: 60 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 250,
      emitting: false,
    });

    this.sparkleEmitter = this.add.particles(0, 0, 'particle-sparkle', {
      speed: { min: 40, max: 120 },
      scale: { start: 1.2, end: 0 },
      lifespan: 300,
      emitting: false,
    });

    this.bounceEmitter = this.add.particles(0, 0, 'particle-sparkle', {
      speed: { min: 60, max: 160 },
      scale: { start: 1.5, end: 0.2 },
      tint: 0x06b6d4,
      lifespan: 350,
      emitting: false,
    });

    this.confettiEmitter = this.add.particles(0, 0, 'particle-confetti', {
      speed: { min: 80, max: 220 },
      gravityY: 200,
      scale: { start: 1.4, end: 0.3 },
      lifespan: 800,
      emitting: false,
    });

    this.hazardEmitter = this.add.particles(0, 0, 'particle-dust', {
      speed: { min: 50, max: 120 },
      scale: { start: 1.8, end: 0 },
      tint: 0xef4444,
      lifespan: 350,
      emitting: false,
    });

    // -----------------------------------------------------------------------
    // J. PLAYER SPAWN & HERO CONFIGURATION
    // -----------------------------------------------------------------------
    const spawnX = this.sceneData?.player.spawnX ?? 80;
    const spawnY = this.sceneData?.player.spawnY ?? height - 100;
    const playerSize = this.sceneData?.player.size ?? 36;
    const grav = this.sceneData?.world.gravity ?? 750;

    const playerTextureKey = this.textures.exists('custom-asset-player') ? 'custom-asset-player' : 'hero-sprite';
    this.player = this.physics.add.sprite(spawnX, spawnY, playerTextureKey);
    this.player.setDisplaySize(playerSize, playerSize);
    if (this.player.body) {
      this.player.body.setSize(playerSize, playerSize);
    }
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.05);

    // Apply gravity only if gravity > 0
    if (grav > 0) {
      this.player.setGravityY(grav * this.gravityDirection);
    } else {
      this.player.setGravityY(0);
    }

    // -----------------------------------------------------------------------
    // K. PHYSICS INTERACTIONS & COLLISIONS
    // -----------------------------------------------------------------------
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.doors);
    this.physics.add.collider(this.coins, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);

    // Trampolines
    this.physics.add.collider(this.player, this.trampolines, (_playerObj, trampObj) => {
      const tramp = trampObj as Phaser.Physics.Arcade.Sprite;
      const isDownBounce = this.gravityDirection > 0 && this.player.body.touching.down;
      const isUpBounce = this.gravityDirection < 0 && this.player.body.touching.up;

      if (isDownBounce || isUpBounce) {
        const strength = tramp.getData('bounceStrength') || 620;
        this.player.setVelocityY(-strength * this.gravityDirection);
        audioService.playBounce();
        this.bounceEmitter?.explode(10, tramp.x, tramp.y);
      }
    });

    // Collect Coins
    this.physics.add.overlap(this.player, this.coins, (_playerObj, coinObj) => {
      const coin = coinObj as Phaser.Physics.Arcade.Sprite;
      const coinVal = coin.getData('value') || 10;
      const coinX = coin.x;
      const coinY = coin.y;
      coin.disableBody(true, true);

      this.score += coinVal;
      this.coinsCollected++;
      this.director?.recordCoinCollected();
      audioService.playCoin();
      this.sparkleEmitter?.explode(12, coinX, coinY);
      this.updateHud();
      this.triggerStateUpdate('playing');
    });

    // Pressure Switches
    this.physics.add.overlap(this.player, this.switches, (_playerObj, switchObj) => {
      const s = switchObj as Phaser.Physics.Arcade.Sprite;
      if (!s.getData('isActivated')) {
        s.setData('isActivated', true);
        s.setTexture('switch-active-texture');
        this.switchesActivated++;
        this.director?.recordSwitchActivated();
        audioService.playCoin();
        this.sparkleEmitter?.explode(8, s.x, s.y);

        const targetId = s.getData('targetId');
        if (targetId && this.doorsMap.has(targetId)) {
          const door = this.doorsMap.get(targetId)!;
          (door.body as Phaser.Physics.Arcade.StaticBody).enable = false;
          this.tweens.add({
            targets: door,
            alpha: 0.15,
            duration: 300,
          });
          this.showMessage(`Switch activated! Barrier opened.`);
        }
        this.updateHud();
      }
    });

    // Hazards
    this.physics.add.overlap(this.player, this.hazards, () => {
      this.handlePlayerDeath('Spike Hazard');
    });

    // Enemies
    this.physics.add.overlap(this.player, this.enemies, () => {
      this.handlePlayerDeath('Enemy Collision');
    });

    // Goal
    this.physics.add.overlap(this.player, this.goalObject, () => {
      if (this.gameState === 'won' || this.gameState === 'lost') return;

      const obj = this.sceneData?.objective;
      if (obj?.type === 'collect_all_coins' && this.coinsCollected < this.totalCoins) {
        this.showMessage(`Exit Locked! Collect all coins (${this.coinsCollected}/${this.totalCoins})`);
        return;
      }

      if (obj?.type === 'activate_switches' && this.switchesActivated < this.totalSwitches) {
        this.showMessage(`Exit Sealed! Activate all switches (${this.switchesActivated}/${this.totalSwitches})`);
        return;
      }

      this.gameState = 'won';
      this.director?.onVictory();
      audioService.playVictory();
      this.confettiEmitter?.explode(32, this.goalObject.x, this.goalObject.y - 10);
      this.player.setVelocity(0, 0);
      this.player.setTint(0xfacc15);
      this.cameras.main.flash(350, 168, 85, 247);
      this.triggerStateUpdate('won');

      if (this.recorder.isRecording()) {
        const elapsed = this.time.now - this.runStartTime;
        const replay = this.recorder.finalize(true, this.score, this.coinsCollected, 0, 'goal_reached', elapsed);
        this.onReplayRecorded?.(replay);
      }
    });

    // -----------------------------------------------------------------------
    // L. KEYBOARD CONTROLS
    // -----------------------------------------------------------------------
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      };
    }

    // -----------------------------------------------------------------------
    // M. OBJECTIVES & COUNTDOWN TIMERS
    // -----------------------------------------------------------------------
    const objType = this.sceneData?.objective?.type;
    if (objType === 'survive_time' || objType === 'timed_race') {
      this.remainingTime = this.sceneData?.objective?.timeLimitSeconds ?? (objType === 'survive_time' ? 20 : 25);
      this.timerEvent = this.time.addEvent({
        delay: 100,
        repeat: -1,
        callback: () => {
          if (this.gameState !== 'playing') return;
          this.remainingTime = Math.max(0, this.remainingTime - 0.1);
          this.updateHud();

          if (this.remainingTime <= 0) {
            if (objType === 'survive_time') {
              // Survived -> Victory!
              this.gameState = 'won';
              audioService.playVictory();
              this.confettiEmitter?.explode(32, this.player.x, this.player.y);
              this.triggerStateUpdate('won');
            } else if (objType === 'timed_race') {
              // Time expired -> Lost!
              this.handlePlayerDeath('Time Expired!');
            }
          }
        },
      });
    }

    // -----------------------------------------------------------------------
    // N. HEADS-UP DISPLAY (HUD)
    // -----------------------------------------------------------------------
    this.createHud(width);

    // -----------------------------------------------------------------------
    // O. ADAPTIVE AI GAME DIRECTOR (Stage 6)
    // -----------------------------------------------------------------------
    this.director = new GameDirector({
      sceneRef: this,
      notifyPlayer: (msg) => this.showMessage(msg),
      templateId: this.sceneData?.templateId as GameTemplateId | undefined,
      movementModel: this.sceneData?.movementModel,
      worldWidth: width,
      worldHeight: height,
      gravity: this.sceneData?.world.gravity ?? 750,
      baselinePlayerSpeed: this.sceneData?.player.speed ?? 220,
      baselineJumpPower: this.sceneData?.player.jumpPower ?? 400,
      spawnX,
      spawnY,
      goalX: goalData.x + goalData.width / 2,
      goalY: goalData.y + goalData.height / 2,
      totalCoins: this.totalCoins,
      totalSwitches: this.totalSwitches,
    });

    this.gameState = 'playing';
    this.triggerStateUpdate('playing');

    // Stage 8: Replay Recording and Ghost Playback Initialization
    this.runStartTime = this.time.now;
    this.recorder.start({
      levelId: this.sceneData?.id || 'level-active',
      levelVersion: 1,
      templateId: this.sceneData?.templateId as GameTemplateId,
      initialX: spawnX,
      initialY: spawnY,
    });

    if (this.ghostReplayData) {
      this.ghostVisual = createSceneGhostVisual(this, this.ghostReplayData);
      const ghostSec = (this.ghostReplayData.summary.durationMs / 1000).toFixed(1);
      this.showMessage(`Ghost Active: Best Run (${ghostSec}s)`);
    }
  }

  private createHud(width: number) {

    this.hudText = this.add.text(14, 12, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#e2e8f0',
      backgroundColor: '#0f172a',
      padding: { x: 8, y: 5 },
    });
    this.hudText.setScrollFactor(0);
    this.hudText.setDepth(100);

    this.messageBanner = this.add.text(width / 2, 60, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fbbf24',
      backgroundColor: '#020617',
      padding: { x: 12, y: 6 },
    });
    this.messageBanner.setOrigin(0.5);
    this.messageBanner.setScrollFactor(0);
    this.messageBanner.setDepth(101);
    this.messageBanner.setVisible(false);

    this.updateHud();
  }

  public showMessage(msg: string) {
    if (!this.messageBanner) return;
    this.messageBanner.setText(msg);
    this.messageBanner.setVisible(true);
    this.messageTimer?.destroy();
    this.messageTimer = this.time.delayedCall(2200, () => {
      this.messageBanner?.setVisible(false);
    });
  }

  private updateHud() {
    if (!this.hudText) return;
    const templateName = (this.sceneData?.templateId || '2D Platformer').toUpperCase();
    const instructions = this.sceneData?.hudInstructions || 'WASD / Arrows to Move';
    const objType = this.sceneData?.objective?.type || 'reach_goal';

    let statusLine = '';
    if (objType === 'survive_time') {
      statusLine = `SURVIVE: ${this.remainingTime.toFixed(1)}s`;
    } else if (objType === 'timed_race') {
      statusLine = `TIME: ${this.remainingTime.toFixed(1)}s`;
    } else if (objType === 'collect_all_coins') {
      statusLine = `KEYS: ${this.coinsCollected}/${this.totalCoins}`;
    } else if (objType === 'activate_switches') {
      statusLine = `SWITCHES: ${this.switchesActivated}/${this.totalSwitches}`;
    } else {
      statusLine = `COINS: ${this.coinsCollected}`;
    }

    this.hudText.setText(`[${templateName}] | ${statusLine} | ${instructions}`);
  }

  private handlePlayerDeath(cause: string) {
    if (this.gameState === 'lost') return;
    this.gameState = 'lost';

    if (this.player) {
      this.director?.recordDeath(cause, this.player.x, this.player.y);
    }
    audioService.playHazard();
    this.hazardEmitter?.explode(16, this.player.x, this.player.y);
    this.player.setTint(0xff0000);
    this.player.setVelocity(0, -200);
    this.cameras.main.shake(220, 0.02);
    this.showMessage(`Defeated: ${cause}`);
    this.triggerStateUpdate('lost');

    if (this.recorder.isRecording()) {
      const elapsed = this.time.now - this.runStartTime;
      const replay = this.recorder.finalize(false, this.score, this.coinsCollected, 1, 'died', elapsed);
      this.onReplayRecorded?.(replay);
    }
  }

  update(time: number, delta: number) {
    if (!this.player || this.gameState === 'won' || this.gameState === 'lost') {
      return;
    }

    this.director?.update(time, delta);

    if (this.ghostVisual) {
      this.ghostVisual.update(delta);
    }

    const speed = this.sceneData?.player.speed ?? 240;
    const jumpPower = this.sceneData?.player.jumpPower ?? 440;
    const movementModel = this.sceneData?.movementModel ?? (this.sceneData?.world.gravity === 0 ? 'topdown' : 'platformer');

    const left = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown || this.virtualInput.left;
    const right = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown || this.virtualInput.right;
    const up = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown || this.virtualInput.up;
    const down = this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown || this.virtualInput.down;
    const jumpKey = this.cursors?.space?.isDown || this.wasdKeys?.SPACE?.isDown || this.virtualInput.jump || this.virtualInput.action;

    if (this.recorder.isRecording() && this.player && this.runStartTime > 0) {
      const elapsed = this.time.now - this.runStartTime;
      this.recorder.recordTick(
        elapsed,
        { left, right, up, down, jump: jumpKey, action: false },
        {
          x: this.player.x,
          y: this.player.y,
          vx: this.player.body?.velocity.x || 0,
          vy: this.player.body?.velocity.y || 0,
          facingRight: !this.player.flipX,
        }
      );
    }

    // -------------------------------------------------------------------------
    // 1. TOP-DOWN 4-WAY / 8-WAY MOVEMENT
    // -------------------------------------------------------------------------
    if (movementModel === 'topdown') {
      let vx = 0;
      let vy = 0;
      if (left) vx -= speed;
      if (right) vx += speed;
      if (up) vy -= speed;
      if (down) vy += speed;

      if (vx !== 0 && vy !== 0) {
        vx *= 0.7071;
        vy *= 0.7071;
      }
      this.player.setVelocity(vx, vy);

      if (vx !== 0 || vy !== 0) {
        this.player.setRotation(Math.atan2(vy, vx));
      }
    }
    // -------------------------------------------------------------------------
    // 2. GRAVITY-SWITCH INVERSION
    // -------------------------------------------------------------------------
    else if (movementModel === 'gravity-switch') {
      const isFloorGrounded = this.gravityDirection > 0 && this.player.body.touching.down;
      const isCeilingGrounded = this.gravityDirection < 0 && this.player.body.touching.up;

      if (left) {
        this.player.setVelocityX(-speed);
        this.player.setFlipX(true);
      } else if (right) {
        this.player.setVelocityX(speed);
        this.player.setFlipX(false);
      } else {
        this.player.setVelocityX(0);
      }

      // Action/Jump key flips gravity when grounded on ceiling or floor
      if (jumpKey && (isFloorGrounded || isCeilingGrounded)) {
        this.gravityDirection *= -1;
        const baseGrav = this.sceneData?.world.gravity ?? 750;
        this.player.setGravityY(baseGrav * this.gravityDirection);
        this.player.setFlipY(this.gravityDirection < 0);
        this.player.setVelocityY(-150 * this.gravityDirection); // slight lift off
        audioService.playJump();
        this.bounceEmitter?.explode(8, this.player.x, this.player.y);
      }
    }
    // -------------------------------------------------------------------------
    // 3. MOMENTUM & DRIFTING
    // -------------------------------------------------------------------------
    else if (movementModel === 'drift') {
      if (left) this.driftAngle -= 3.5;
      if (right) this.driftAngle += 3.5;

      if (up) {
        this.driftSpeed = Math.min(this.driftSpeed + 12, speed);
      } else {
        this.driftSpeed = Math.max(0, this.driftSpeed - 4);
      }

      const rad = Phaser.Math.DegToRad(this.driftAngle);
      const targetVx = Math.cos(rad) * this.driftSpeed;
      const targetVy = Math.sin(rad) * this.driftSpeed;

      const curVx = this.player.body.velocity.x;
      const curVy = this.player.body.velocity.y;
      this.player.setVelocity(curVx + (targetVx - curVx) * 0.12, curVy + (targetVy - curVy) * 0.12);
      this.player.setRotation(rad);

      if (this.driftSpeed > 100 && (left || right)) {
        this.dustEmitter?.explode(1, this.player.x, this.player.y);
      }
    }
    // -------------------------------------------------------------------------
    // 4. PRECISION PLATFORMER
    // -------------------------------------------------------------------------
    else if (movementModel === 'precision') {
      // Instant acceleration and zero delay stop
      if (left) {
        this.player.setVelocityX(-speed);
        this.player.setFlipX(true);
      } else if (right) {
        this.player.setVelocityX(speed);
        this.player.setFlipX(false);
      } else {
        this.player.setVelocityX(0);
      }

      const isGrounded = this.player.body.touching.down;
      if ((jumpKey || up) && isGrounded) {
        this.player.setVelocityY(-jumpPower);
        audioService.playJump();
        this.dustEmitter?.explode(3, this.player.x, this.player.y + 16);
      }
    }
    // -------------------------------------------------------------------------
    // 5. STANDARD PHYSICS PLATFORMER
    // -------------------------------------------------------------------------
    else {
      const isGrounded = this.player.body.touching.down;
      const friction = this.sceneData?.world.friction ?? 1.0;
      const isIceFriction = friction < 0.8;

      if (left) {
        if (isIceFriction) {
          const curVx = this.player.body.velocity.x;
          this.player.setVelocityX(curVx + (-speed - curVx) * 0.14);
        } else {
          this.player.setVelocityX(-speed);
        }
        this.player.setFlipX(true);

        if (isGrounded && time - this.lastDustTime > 140) {
          this.dustEmitter?.explode(2, this.player.x + 8, this.player.y + 14);
          this.lastDustTime = time;
        }
      } else if (right) {
        if (isIceFriction) {
          const curVx = this.player.body.velocity.x;
          this.player.setVelocityX(curVx + (speed - curVx) * 0.14);
        } else {
          this.player.setVelocityX(speed);
        }
        this.player.setFlipX(false);

        if (isGrounded && time - this.lastDustTime > 140) {
          this.dustEmitter?.explode(2, this.player.x - 8, this.player.y + 14);
          this.lastDustTime = time;
        }
      } else {
        if (isIceFriction) {
          const curVx = this.player.body.velocity.x;
          this.player.setVelocityX(Math.abs(curVx) < 6 ? 0 : curVx * 0.93);
        } else {
          this.player.setVelocityX(0);
        }
      }

      if ((jumpKey || up) && isGrounded) {
        this.player.setVelocityY(-jumpPower);
        audioService.playJump();
        this.dustEmitter?.explode(3, this.player.x, this.player.y + 16);
      }
    }

    // -------------------------------------------------------------------------
    // ENEMY AI BEHAVIOR UPDATE
    // -------------------------------------------------------------------------
    if (this.enemies) {
      for (const child of this.enemies.getChildren()) {
        const enemy = child as Phaser.Physics.Arcade.Sprite;
        const eType = enemy.getData('type');

        if (eType === 'chaser' && movementModel === 'topdown') {
          // Pursue player directly in arena survival
          this.physics.moveToObject(enemy, this.player, enemy.getData('speed') || 100);
        } else if (eType === 'patrol') {
          const initialX = enemy.getData('initialX') || enemy.x;
          const range = enemy.getData('patrolRange') || 120;
          const speed = enemy.getData('speed') || 100;

          if (enemy.x > initialX + range) {
            enemy.setData('direction', -1);
            enemy.setVelocityX(-speed);
          } else if (enemy.x < initialX - range) {
            enemy.setData('direction', 1);
            enemy.setVelocityX(speed);
          }
        }
      }
    }
  }

  private triggerStateUpdate(newState: GamePlayState) {
    this.gameState = newState;
    if (this.onGameStateChange) {
      this.onGameStateChange(newState, this.score, this.coinsCollected);
    }
  }

  public restartGame(newSceneData?: PlayableGameScene) {
    this.director?.shutdown();
    this.director = undefined;
    this.ambientEmitter?.destroy();
    this.ambientEmitter = undefined;
    this.timerEvent?.destroy();
    this.timerEvent = undefined;
    this.messageTimer?.destroy();
    this.messageTimer = undefined;

    const nextData = newSceneData ?? this.sceneData;
    this.scene.restart({
      sceneData: nextData,
      onGameStateChange: this.onGameStateChange,
    });
  }

  public getDirector(): GameDirector | undefined {
    return this.director;
  }

  public spawnDirectorPlatform(plat: { x: number; y: number; width: number; height: number; tint?: number }) {
    let platTextureKey = 'custom-asset-platform';
    if (!this.textures.exists(platTextureKey)) {
      platTextureKey = 'door-texture';
    }
    const pSprite = this.platforms.create(plat.x, plat.y, platTextureKey) as Phaser.Physics.Arcade.Sprite;
    pSprite.setDisplaySize(plat.width, plat.height);
    if (plat.tint) {
      pSprite.setTint(plat.tint);
    }
    pSprite.refreshBody();
    return pSprite;
  }

  public spawnDirectorCheckpoint(cp: { x: number; y: number; id: string }) {
    const cpSprite = this.physics.add.staticImage(cp.x, cp.y, 'trampoline-texture');
    cpSprite.setDisplaySize(32, 24);
    cpSprite.setTint(0x06b6d4);
    cpSprite.refreshBody();

    this.physics.add.overlap(this.player, cpSprite, () => {
      if (!cpSprite.getData('activated')) {
        cpSprite.setData('activated', true);
        cpSprite.setTint(0x10b981);
        this.director?.recordCheckpoint(cp.id, cp.x, cp.y);
        audioService.playCoin();
        this.sparkleEmitter?.explode(10, cp.x, cp.y);
        this.showMessage('Checkpoint Activated! Progress secured.');
      }
    });

    return cpSprite;
  }

  /**
   * Stage 7: Controlled Hot Update Path for live remix patches.
   * Modifies active runtime objects and physics bodies without reloading the Phaser scene
   * when changes are presentation, physics, or entity additions.
   * If structural changes occurred, performs a graceful state-preserving restage.
   */
  public applyRemixHotPatch(
    patchedScene: PlayableGameScene,
    affectedSystems: string[] = []
  ): { success: boolean; appliedHot: boolean; reason?: string } {
    return applySceneHotPatch(this as any, patchedScene, affectedSystems);
  }

  /**
   * Stage 8: Ghost Playback Controls
   */
  public setGhostSpeed(speed: PlaybackSpeed) {
    this.ghostVisual?.controller.setSpeed(speed);
  }

  public pauseGhost() {
    this.ghostVisual?.controller.pause();
  }

  public resumeGhost() {
    this.ghostVisual?.controller.resume();
  }

  public stopGhost() {
    this.ghostVisual?.destroy();
    this.ghostVisual = null;
  }

  public isGhostActive(): boolean {
    return Boolean(this.ghostVisual?.controller.isActive());
  }

  public getGhostProgress(): { currentMs: number; durationMs: number; speed: number } | null {
    if (!this.ghostVisual) return null;
    return {
      currentMs: this.ghostVisual.controller.getCurrentTimeMs(),
      durationMs: this.ghostVisual.controller.getDurationMs(),
      speed: this.ghostVisual.controller.getSpeed(),
    };
  }
}
