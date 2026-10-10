import Phaser from 'phaser';
import type { PlayableGameScene, GamePlayState } from '../../types/scene.js';
import { audioService } from '../../services/audioService.js';

export interface MainSceneInitData {
  sceneData?: PlayableGameScene;
  onGameStateChange?: (state: GamePlayState, score: number, coinsCollected: number) => void;
}

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private trampolines!: Phaser.Physics.Arcade.StaticGroup;
  private coins!: Phaser.Physics.Arcade.Group;
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
  private gameState: GamePlayState = 'ready';

  // Movement & physics states for polish
  private wasGrounded = false;
  private lastDustTime = 0;

  // Virtual mobile touch controls
  private virtualInput = { left: false, right: false, jump: false };

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: MainSceneInitData) {
    this.sceneData = data.sceneData;
    this.onGameStateChange = data.onGameStateChange;
    this.score = 0;
    this.coinsCollected = 0;
    this.totalCoins = this.sceneData?.coins.length ?? 0;
    this.gameState = 'ready';
    this.wasGrounded = false;
    this.lastDustTime = 0;
    this.virtualInput = { left: false, right: false, jump: false };
  }

  getTotalCoins(): number {
    return this.totalCoins;
  }

  /**
   * Set virtual touch inputs from mobile controls
   */
  public setVirtualInput(input: { left?: boolean; right?: boolean; jump?: boolean }) {
    if (input.left !== undefined) this.virtualInput.left = input.left;
    if (input.right !== undefined) this.virtualInput.right = input.right;
    if (input.jump !== undefined) this.virtualInput.jump = input.jump;
  }

  preload() {
    // 1. Procedural Player Hero Texture
    if (!this.textures.exists('hero-sprite')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      // Body
      g.fillStyle(0x38bdf8, 1);
      g.fillCircle(18, 18, 16);
      // Highlights & Visor
      g.fillStyle(0xffffff, 1);
      g.fillCircle(14, 14, 4);
      g.fillCircle(22, 14, 4);
      g.fillStyle(0x0f172a, 1);
      g.fillCircle(15, 14, 2);
      g.fillCircle(23, 14, 2);
      // Outer Stroke
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
      // Spring indicator
      g.fillStyle(0xa5f3fc, 1);
      g.fillRect(8, 2, 32, 3);
      g.generateTexture('trampoline-texture', 48, 16);
      g.destroy();
    }

    // 5. Procedural Goal Flag Texture
    if (!this.textures.exists('goal-flag-texture')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      // Flag pole
      g.fillStyle(0x94a3b8, 1);
      g.fillRect(4, 0, 4, 48);
      // Portal Banner
      g.fillStyle(0xa855f7, 1);
      g.fillTriangle(8, 4, 32, 16, 8, 28);
      g.lineStyle(2, 0xd8b4fe, 1);
      g.strokeTriangle(8, 4, 32, 16, 8, 28);
      g.generateTexture('goal-flag-texture', 36, 48);
      g.destroy();
    }

    // 6. Procedural Particle Textures (Dust, Sparkle, Confetti)
    if (!this.textures.exists('particle-dust')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x94a3b8, 1);
      g.fillCircle(3, 3, 3);
      g.generateTexture('particle-dust', 6, 6);
      g.destroy();
    }

    if (!this.textures.exists('particle-sparkle')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xfde047, 1);
      g.fillCircle(4, 4, 3);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 1.5);
      g.generateTexture('particle-sparkle', 8, 8);
      g.destroy();
    }

    if (!this.textures.exists('particle-confetti')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x38bdf8, 1);
      g.fillRect(0, 0, 6, 6);
      g.generateTexture('particle-confetti', 6, 6);
      g.destroy();
    }

    // 7. Ambient Environmental Particle Textures
    if (!this.textures.exists('particle-snow')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xe0f2fe, 1);
      g.fillCircle(3, 3, 3);
      g.generateTexture('particle-snow', 6, 6);
      g.destroy();
    }

    if (!this.textures.exists('particle-ember')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xf97316, 1);
      g.fillCircle(3, 3, 2.5);
      g.fillStyle(0xfef08a, 1);
      g.fillCircle(3, 3, 1);
      g.generateTexture('particle-ember', 6, 6);
      g.destroy();
    }

    if (!this.textures.exists('particle-stardust')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x818cf8, 1);
      g.fillCircle(2.5, 2.5, 2);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(2.5, 2.5, 1);
      g.generateTexture('particle-stardust', 5, 5);
      g.destroy();
    }

    if (!this.textures.exists('particle-leaf')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x4ade80, 1);
      g.fillRect(0, 0, 5, 3);
      g.generateTexture('particle-leaf', 5, 3);
      g.destroy();
    }

    if (!this.textures.exists('particle-spark')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x00f0ff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture('particle-spark', 4, 4);
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

    // Grid lines for game aesthetic
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, palette.grid, theme === 'ice' || theme === 'cyberpunk' ? 0.2 : 0.4);
    for (let x = 0; x <= width; x += 40) {
      gridGraphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 40) {
      gridGraphics.lineBetween(0, y, width, y);
    }

    // -----------------------------------------------------------------------
    // A. SOLID PLATFORMS (From Ground strokes)
    // -----------------------------------------------------------------------
    this.platforms = this.physics.add.staticGroup();

    const platData = this.sceneData?.platforms ?? [
      { id: 'floor', x: 0, y: height - 32, width, height: 32 },
    ];

    for (const plat of platData) {
      // Create individual procedural graphics for each platform styled to current theme
      const platTextureKey = `plat-tex-${plat.id}-${theme}`;
      if (!this.textures.exists(platTextureKey)) {
        const pg = this.make.graphics({ x: 0, y: 0 });

        pg.fillStyle(palette.platFill, 1);
        pg.fillRoundedRect(0, 0, plat.width, plat.height, 4);

        pg.lineStyle(2, palette.platLine, 1);
        pg.strokeRoundedRect(0, 0, plat.width, plat.height, 4);

        // Highlight cap line
        pg.fillStyle(palette.platCap, 1);
        pg.fillRect(2, 1, Math.max(1, plat.width - 4), 3);

        pg.generateTexture(platTextureKey, plat.width, plat.height);
        pg.destroy();
      }

      // Add as static Arcade sprite centered on the platform
      const pSprite = this.platforms.create(
        plat.x + plat.width / 2,
        plat.y + plat.height / 2,
        platTextureKey
      ) as Phaser.Physics.Arcade.Sprite;
      pSprite.refreshBody();
    }

    // -----------------------------------------------------------------------
    // B. LETHAL HAZARDS (From Hazard strokes)
    // -----------------------------------------------------------------------
    this.hazards = this.physics.add.staticGroup();
    const hazardData = this.sceneData?.hazards ?? [];

    for (const haz of hazardData) {
      const hSprite = this.hazards.create(
        haz.x + haz.width / 2,
        haz.y + haz.height / 2,
        'hazard-spike-texture'
      ) as Phaser.Physics.Arcade.Sprite;
      hSprite.setDisplaySize(haz.width, haz.height);
      hSprite.refreshBody();
    }

    // -----------------------------------------------------------------------
    // C. BOUNCY TRAMPOLINES (From Trampoline strokes)
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
    // D. COLLECTIBLE COINS (From Coin strokes)
    // -----------------------------------------------------------------------
    this.coins = this.physics.add.group();
    const coinData = this.sceneData?.coins ?? [];

    for (const c of coinData) {
      const cSprite = this.coins.create(c.x, c.y, 'coin-sprite') as Phaser.Physics.Arcade.Sprite;
      cSprite.setDisplaySize(c.size || 24, c.size || 24);
      cSprite.setData('value', c.value || 10);
      cSprite.setCollideWorldBounds(true);
      cSprite.setBounce(0.3);

      // Subtle float animation
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
    // E. VICTORY GOAL OBJECT (From Goal stroke)
    // -----------------------------------------------------------------------
    const goalData = this.sceneData?.goal ?? {
      id: 'default-goal',
      x: width - 64,
      y: height - 96,
      width: 36,
      height: 48,
    };

    this.goalObject = this.physics.add.staticImage(
      goalData.x + goalData.width / 2,
      goalData.y + goalData.height / 2,
      'goal-flag-texture'
    );
    this.goalObject.setDisplaySize(goalData.width, goalData.height);
    this.goalObject.refreshBody();

    // Goal visual beacon pulse
    this.tweens.add({
      targets: this.goalObject,
      alpha: 0.8,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // -----------------------------------------------------------------------
    // F. PARTICLE EMITTERS SETUP
    // -----------------------------------------------------------------------
    this.dustEmitter = this.add.particles(0, 0, 'particle-dust', {
      speed: { min: 20, max: 60 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 250,
      emitting: false,
    });

    this.sparkleEmitter = this.add.particles(0, 0, 'particle-sparkle', {
      speed: { min: 40, max: 130 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 450,
      emitting: false,
    });

    this.bounceEmitter = this.add.particles(0, 0, 'particle-sparkle', {
      speed: { min: 60, max: 160 },
      angle: { min: 220, max: 320 },
      scale: { start: 1.5, end: 0.2 },
      tint: 0x06b6d4,
      lifespan: 350,
      emitting: false,
    });

    this.confettiEmitter = this.add.particles(0, 0, 'particle-confetti', {
      speed: { min: 80, max: 220 },
      angle: { min: 200, max: 340 },
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
    // F2. AMBIENT ENVIRONMENTAL PARTICLES
    // -----------------------------------------------------------------------
    const ambientEffect =
      this.sceneData?.world.ambientEffect && this.sceneData.world.ambientEffect !== 'none'
        ? this.sceneData.world.ambientEffect
        : theme === 'ice'
        ? 'snow'
        : theme === 'lava'
        ? 'embers'
        : theme === 'space'
        ? 'stardust'
        : theme === 'forest'
        ? 'leaves'
        : theme === 'cyberpunk'
        ? 'sparks'
        : 'none';

    if (ambientEffect === 'snow') {
      this.ambientEmitter = this.add.particles(0, 0, 'particle-snow', {
        x: { min: 0, max: width },
        y: 0,
        lifespan: 2800,
        speedY: { min: 45, max: 85 },
        speedX: { min: -25, max: 25 },
        scale: { start: 1, end: 0.4 },
        alpha: { start: 0.8, end: 0.1 },
        frequency: 140,
      });
    } else if (ambientEffect === 'embers') {
      this.ambientEmitter = this.add.particles(0, 0, 'particle-ember', {
        x: { min: 0, max: width },
        y: height,
        lifespan: 2200,
        speedY: { min: -40, max: -80 },
        speedX: { min: -20, max: 20 },
        scale: { start: 1.2, end: 0.2 },
        alpha: { start: 0.9, end: 0 },
        frequency: 160,
      });
    } else if (ambientEffect === 'stardust') {
      this.ambientEmitter = this.add.particles(0, 0, 'particle-stardust', {
        x: { min: 0, max: width },
        y: { min: 0, max: height },
        lifespan: 1800,
        speed: { min: 5, max: 20 },
        scale: { start: 0.2, end: 1 },
        alpha: { start: 0.1, end: 0.8 },
        frequency: 200,
      });
    } else if (ambientEffect === 'leaves') {
      this.ambientEmitter = this.add.particles(0, 0, 'particle-leaf', {
        x: { min: 0, max: width },
        y: 0,
        lifespan: 2500,
        speedY: { min: 35, max: 70 },
        speedX: { min: -30, max: 30 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 0.8, end: 0.2 },
        frequency: 220,
      });
    } else if (ambientEffect === 'sparks') {
      this.ambientEmitter = this.add.particles(0, 0, 'particle-spark', {
        x: { min: 0, max: width },
        y: { min: 0, max: height },
        lifespan: 600,
        speed: { min: 30, max: 90 },
        scale: { start: 1.2, end: 0 },
        frequency: 180,
      });
    }

    // -----------------------------------------------------------------------
    // G. PLAYER SPAWN & HERO CONTROLS
    // -----------------------------------------------------------------------
    const spawnX = this.sceneData?.player.spawnX ?? 80;
    const spawnY = this.sceneData?.player.spawnY ?? height - 100;
    const playerSize = this.sceneData?.player.size ?? 36;

    this.player = this.physics.add.sprite(spawnX, spawnY, 'hero-sprite');
    this.player.setDisplaySize(playerSize, playerSize);
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.05);

    const grav = this.sceneData?.world.gravity ?? 750;
    this.player.setGravityY(grav);

    // -----------------------------------------------------------------------
    // H. PHYSICS INTERACTIONS & COLLISIONS
    // -----------------------------------------------------------------------
    // 1. Player & Platforms
    this.physics.add.collider(this.player, this.platforms);

    // 2. Coins & Platforms
    this.physics.add.collider(this.coins, this.platforms);

    // 3. Player & Trampolines (Bounce from top)
    this.physics.add.collider(
      this.player,
      this.trampolines,
      (_playerObj, trampObj) => {
        const tramp = trampObj as Phaser.Physics.Arcade.Sprite;
        // Bounce only when landing on top
        if (this.player.body.touching.down && tramp.body && tramp.body.touching.up) {
          const strength = tramp.getData('bounceStrength') || 620;
          this.player.setVelocityY(-strength);

          // Audio response
          audioService.playBounce();

          // Particle burst
          this.bounceEmitter?.explode(10, tramp.x, tramp.y);

          // Spring squash & stretch effect
          this.tweens.add({
            targets: tramp,
            scaleY: 0.55,
            scaleX: 1.15,
            duration: 80,
            yoyo: true,
          });
        }
      }
    );

    // 4. Player & Coins (Collection Overlap)
    this.physics.add.overlap(this.player, this.coins, (_playerObj, coinObj) => {
      const coin = coinObj as Phaser.Physics.Arcade.Sprite;
      const coinVal = coin.getData('value') || 10;
      const coinX = coin.x;
      const coinY = coin.y;
      coin.disableBody(true, true);

      this.score += coinVal;
      this.coinsCollected++;

      // Audio & Particle response
      audioService.playCoin();
      this.sparkleEmitter?.explode(12, coinX, coinY);

      this.triggerStateUpdate('playing');

      // Player pulse
      this.tweens.add({
        targets: this.player,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 90,
        yoyo: true,
      });
    });

    // 5. Player & Hazards (Death / Failure Trigger)
    this.physics.add.overlap(this.player, this.hazards, () => {
      if (this.gameState === 'lost') return;
      this.gameState = 'lost';

      // Audio & Particle response
      audioService.playHazard();
      this.hazardEmitter?.explode(16, this.player.x, this.player.y);

      this.player.setTint(0xff0000);
      this.player.setVelocity(0, -220);
      this.cameras.main.shake(220, 0.02);

      this.triggerStateUpdate('lost');
    });

    // 6. Player & Goal (Victory Trigger)
    this.physics.add.overlap(this.player, this.goalObject, () => {
      if (this.gameState === 'won' || this.gameState === 'lost') return;
      this.gameState = 'won';

      // Audio & Confetti response
      audioService.playVictory();
      this.confettiEmitter?.explode(32, this.goalObject.x, this.goalObject.y - 10);

      this.player.setVelocity(0, 0);
      this.player.setTint(0xfacc15);

      this.cameras.main.flash(350, 168, 85, 247);
      this.triggerStateUpdate('won');
    });

    // -----------------------------------------------------------------------
    // I. KEYBOARD INPUT CONTROLS
    // -----------------------------------------------------------------------
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    this.gameState = 'playing';
    this.triggerStateUpdate('playing');
  }

  update(time: number) {
    if (!this.player || this.gameState === 'won' || this.gameState === 'lost') {
      return;
    }

    const speed = this.sceneData?.player.speed ?? 220;
    const jumpPower = this.sceneData?.player.jumpPower ?? 400;

    const left = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown || this.virtualInput.left;
    const right = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown || this.virtualInput.right;
    const jump = this.cursors?.up?.isDown || this.cursors?.space?.isDown || this.wasdKeys?.W?.isDown || this.virtualInput.jump;

    const isGrounded = this.player.body.touching.down;

    // Landing Dust effect
    if (!this.wasGrounded && isGrounded) {
      this.dustEmitter?.explode(4, this.player.x, this.player.y + 16);
    }
    this.wasGrounded = isGrounded;

    // Horizontal Movement with Real Ice Friction / Acceleration
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

      // Running dust puffs
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

      // Running dust puffs
      if (isGrounded && time - this.lastDustTime > 140) {
        this.dustEmitter?.explode(2, this.player.x - 8, this.player.y + 14);
        this.lastDustTime = time;
      }
    } else {
      if (isIceFriction) {
        // Ice deceleration / slide
        const curVx = this.player.body.velocity.x;
        this.player.setVelocityX(Math.abs(curVx) < 6 ? 0 : curVx * 0.93);
      } else {
        this.player.setVelocityX(0);
      }
    }

    // Jump only when on ground (no infinite mid-air jumps)
    if (jump && isGrounded) {
      this.player.setVelocityY(-jumpPower);
      audioService.playJump();
      this.dustEmitter?.explode(3, this.player.x, this.player.y + 16);
    }
  }

  private triggerStateUpdate(newState: GamePlayState) {
    this.gameState = newState;
    if (this.onGameStateChange) {
      this.onGameStateChange(newState, this.score, this.coinsCollected);
    }
  }

  public restartGame(newSceneData?: PlayableGameScene) {
    this.ambientEmitter?.destroy();
    this.ambientEmitter = undefined;
    const nextData = newSceneData ?? this.sceneData;
    this.scene.restart({
      sceneData: nextData,
      onGameStateChange: this.onGameStateChange,
    });
  }
}
