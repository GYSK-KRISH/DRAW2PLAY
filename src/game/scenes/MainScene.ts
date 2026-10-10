import Phaser from 'phaser';
import type { PlayableGameScene, GamePlayState } from '../../types/scene.js';

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

  private sceneData?: PlayableGameScene;
  private onGameStateChange?: (state: GamePlayState, score: number, coinsCollected: number) => void;

  private score = 0;
  private coinsCollected = 0;
  private totalCoins = 0;
  private gameState: GamePlayState = 'ready';

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
  }

  getTotalCoins(): number {
    return this.totalCoins;
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
  }

  create() {
    const width = this.sceneData?.world.width ?? 800;
    const height = this.sceneData?.world.height ?? 480;

    // Background aesthetics
    const bgGradient = this.add.graphics();
    bgGradient.fillGradientStyle(0x070a13, 0x070a13, 0x111827, 0x111827, 1);
    bgGradient.fillRect(0, 0, width, height);

    // Grid lines for game aesthetic
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x1f2937, 0.4);
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

    for (const p of platData) {
      // Dynamic texture key per dimension to prevent distortion
      const texKey = `plat-tex-${p.width}x${p.height}`;
      if (!this.textures.exists(texKey)) {
        const pg = this.make.graphics({ x: 0, y: 0 });
        pg.fillStyle(0x10b981, 1); // Emerald Ground
        pg.fillRoundedRect(0, 0, p.width, p.height, 4);
        pg.lineStyle(2, 0x059669, 1);
        pg.strokeRoundedRect(0, 0, p.width, p.height, 4);
        pg.generateTexture(texKey, p.width, p.height);
        pg.destroy();
      }

      const platSprite = this.platforms.create(
        p.x + p.width / 2,
        p.y + p.height / 2,
        texKey
      ) as Phaser.Physics.Arcade.Sprite;
      platSprite.refreshBody();
    }

    // -----------------------------------------------------------------------
    // B. LETHAL HAZARDS (From Hazard strokes)
    // -----------------------------------------------------------------------
    this.hazards = this.physics.add.staticGroup();
    const hazardData = this.sceneData?.hazards ?? [];

    for (const h of hazardData) {
      // Create hazard sprite centered at bounding box
      const hSprite = this.hazards.create(
        h.x + h.width / 2,
        h.y + h.height / 2,
        'hazard-spike-texture'
      ) as Phaser.Physics.Arcade.Sprite;
      hSprite.setDisplaySize(h.width, h.height);
      hSprite.refreshBody();
    }

    // -----------------------------------------------------------------------
    // C. TRAMPOLINES (From Trampoline strokes)
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
      const coinSprite = this.coins.create(c.x, c.y, 'coin-sprite') as Phaser.Physics.Arcade.Sprite;
      coinSprite.setBounceY(0.2);
      coinSprite.setCollideWorldBounds(true);
      coinSprite.setData('value', c.value || 10);

      // Gentle floating animation
      this.tweens.add({
        targets: coinSprite,
        y: c.y - 6,
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // -----------------------------------------------------------------------
    // E. VICTORY GOAL PORTAL / FLAG (From Goal stroke)
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
    // F. PLAYER SPAWN & HERO CONTROLS
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
    // G. PHYSICS INTERACTIONS & COLLISIONS
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

          // Spring squash & stretch effect
          this.tweens.add({
            targets: tramp,
            scaleY: 0.6,
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
      coin.disableBody(true, true);

      this.score += coinVal;
      this.coinsCollected++;

      this.triggerStateUpdate('playing');

      // Player pulse
      this.tweens.add({
        targets: this.player,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 90,
        yoyo: true,
      });
    });

    // 5. Player & Hazards (Death / Failure Trigger)
    this.physics.add.overlap(this.player, this.hazards, () => {
      if (this.gameState === 'lost') return;
      this.gameState = 'lost';

      this.player.setTint(0xff0000);
      this.player.setVelocity(0, -200);
      this.cameras.main.shake(200, 0.02);

      this.triggerStateUpdate('lost');
    });

    // 6. Player & Goal (Victory Trigger)
    this.physics.add.overlap(this.player, this.goalObject, () => {
      if (this.gameState === 'won' || this.gameState === 'lost') return;
      this.gameState = 'won';

      this.player.setVelocity(0, 0);
      this.player.setTint(0xfacc15);

      this.cameras.main.flash(300, 168, 85, 247);
      this.triggerStateUpdate('won');
    });

    // -----------------------------------------------------------------------
    // H. KEYBOARD INPUT CONTROLS
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

  update() {
    if (!this.player || !this.cursors || this.gameState === 'won' || this.gameState === 'lost') {
      return;
    }

    const speed = this.sceneData?.player.speed ?? 220;
    const jumpPower = this.sceneData?.player.jumpPower ?? 400;

    const left = this.cursors.left.isDown || this.wasdKeys?.A.isDown;
    const right = this.cursors.right.isDown || this.wasdKeys?.D.isDown;
    const jump = this.cursors.up.isDown || this.cursors.space.isDown || this.wasdKeys?.W.isDown;

    if (left) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (right) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // Jump only when on ground (no infinite mid-air jumps)
    if (jump && this.player.body.touching.down) {
      this.player.setVelocityY(-jumpPower);
    }
  }

  private triggerStateUpdate(newState: GamePlayState) {
    this.gameState = newState;
    if (this.onGameStateChange) {
      this.onGameStateChange(newState, this.score, this.coinsCollected);
    }
  }

  public restartGame(newSceneData?: PlayableGameScene) {
    const nextData = newSceneData ?? this.sceneData;
    this.scene.restart({
      sceneData: nextData,
      onGameStateChange: this.onGameStateChange,
    });
  }
}
