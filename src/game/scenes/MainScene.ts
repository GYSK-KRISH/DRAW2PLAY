import Phaser from 'phaser';
import type { CharacterConfig } from '../../types/game.js';

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
  private coins!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private scoreText!: Phaser.GameObjects.Text;
  private score = 0;
  private characterConfig?: CharacterConfig;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: { characterConfig?: CharacterConfig }) {
    if (data.characterConfig) {
      this.characterConfig = data.characterConfig;
    }
    this.score = 0;
  }

  preload() {
    // Generate default procedural player texture if no custom sketch is loaded
    const defaultGraphics = this.make.graphics({ x: 0, y: 0 });
    defaultGraphics.fillStyle(0x38bdf8, 1);
    defaultGraphics.fillCircle(24, 24, 20);
    defaultGraphics.fillStyle(0xffffff, 1);
    defaultGraphics.fillCircle(18, 18, 6);
    defaultGraphics.fillCircle(30, 18, 6);
    defaultGraphics.fillStyle(0x0f172a, 1);
    defaultGraphics.fillCircle(20, 18, 3);
    defaultGraphics.fillCircle(32, 18, 3);
    defaultGraphics.lineStyle(2, 0x0284c7, 1);
    defaultGraphics.strokeCircle(24, 24, 20);
    defaultGraphics.generateTexture('default-hero', 48, 48);

    // Coin texture
    const coinGraphics = this.make.graphics({ x: 0, y: 0 });
    coinGraphics.fillStyle(0xfacc15, 1);
    coinGraphics.fillCircle(12, 12, 10);
    coinGraphics.lineStyle(2, 0xeab308, 1);
    coinGraphics.strokeCircle(12, 12, 10);
    coinGraphics.generateTexture('coin-texture', 24, 24);

    // Hazard spike texture
    const spikeGraphics = this.make.graphics({ x: 0, y: 0 });
    spikeGraphics.fillStyle(0xef4444, 1);
    spikeGraphics.fillTriangle(0, 24, 12, 0, 24, 24);
    spikeGraphics.generateTexture('hazard-spike', 24, 24);

    // Platform texture
    const platGraphics = this.make.graphics({ x: 0, y: 0 });
    platGraphics.fillStyle(0x334155, 1);
    platGraphics.fillRoundedRect(0, 0, 160, 24, 6);
    platGraphics.lineStyle(2, 0x64748b, 1);
    platGraphics.strokeRoundedRect(0, 0, 160, 24, 6);
    platGraphics.generateTexture('platform-texture', 160, 24);

    // Ground texture
    const groundGraphics = this.make.graphics({ x: 0, y: 0 });
    groundGraphics.fillStyle(0x1e293b, 1);
    groundGraphics.fillRect(0, 0, 800, 40);
    groundGraphics.lineStyle(2, 0x0ea5e9, 0.8);
    groundGraphics.lineBetween(0, 0, 800, 0);
    groundGraphics.generateTexture('ground-texture', 800, 40);

    // Load custom character texture from drawn data URL if available
    if (this.characterConfig?.drawingDataUrl) {
      if (this.textures.exists('drawn-character')) {
        this.textures.remove('drawn-character');
      }
      this.textures.addBase64('drawn-character', this.characterConfig.drawingDataUrl);
    }
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;

    // Background aesthetics
    const bgGradient = this.add.graphics();
    bgGradient.fillGradientStyle(0x0f172a, 0x0f172a, 0x1e1b4b, 0x1e1b4b, 1);
    bgGradient.fillRect(0, 0, width, height);

    // Static platforms
    this.platforms = this.physics.add.staticGroup();
    
    // Bottom Ground
    const ground = this.platforms.create(width / 2, height - 20, 'ground-texture') as Phaser.Physics.Arcade.Sprite;
    ground.refreshBody();

    // Floating ledge platforms
    const p1 = this.platforms.create(180, height - 130, 'platform-texture') as Phaser.Physics.Arcade.Sprite;
    p1.refreshBody();
    const p2 = this.platforms.create(400, height - 230, 'platform-texture') as Phaser.Physics.Arcade.Sprite;
    p2.refreshBody();
    const p3 = this.platforms.create(620, height - 150, 'platform-texture') as Phaser.Physics.Arcade.Sprite;
    p3.refreshBody();

    // Hazardous spikes
    this.hazards = this.physics.add.staticGroup();
    this.hazards.create(300, height - 44, 'hazard-spike');
    this.hazards.create(520, height - 44, 'hazard-spike');

    // Collectible Banana Coins
    this.coins = this.physics.add.group({
      key: 'coin-texture',
      repeat: 5,
      setXY: { x: 120, y: 100, stepX: 110 },
    });

    const coinChildren = this.coins.getChildren();
    for (const c of coinChildren) {
      const coin = c as Phaser.Physics.Arcade.Sprite;
      coin.setBounceY(Phaser.Math.FloatBetween(0.3, 0.5));
      coin.setCollideWorldBounds(true);
    }

    // Determine player texture
    const textureKey = (this.characterConfig?.drawingDataUrl && this.textures.exists('drawn-character'))
      ? 'drawn-character'
      : 'default-hero';

    // Player character setup
    this.player = this.physics.add.sprite(80, height - 100, textureKey);
    this.player.setDisplaySize(48, 48);
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.1);

    // Apply AI-derived physics properties if configured
    const speed = this.characterConfig?.attributes.speed ?? 220;
    const gravity = this.characterConfig?.attributes.gravity ?? 800;
    this.player.setGravityY(gravity);

    // Collisions
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.coins, this.platforms);

    // Overlap: Collect coin
    this.physics.add.overlap(this.player, this.coins, (_player, coin) => {
      (coin as Phaser.Physics.Arcade.Sprite).disableBody(true, true);
      this.score += 10;
      this.scoreText.setText(`🍌 Score: ${this.score}`);

      // Visual pulse
      this.tweens.add({
        targets: this.player,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 80,
        yoyo: true,
      });
    });

    // Overlap: Hazard damage
    this.physics.add.overlap(this.player, this.hazards, () => {
      // Bounce player back to spawn on spike hit
      this.player.setPosition(80, height - 100);
      this.player.setVelocity(0, 0);
      this.cameras.main.shake(150, 0.015);
    });

    // Controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // UI Overlay Text
    this.scoreText = this.add.text(16, 16, `🍌 Score: ${this.score}`, {
      fontSize: '18px',
      color: '#facc15',
      fontStyle: 'bold',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      padding: { x: 8, y: 4 },
    });

    const heroName = this.characterConfig?.attributes.name ?? 'Sketch Hero';
    const archetype = this.characterConfig?.attributes.archetype ?? 'balanced';
    this.add.text(16, 48, `Hero: ${heroName} (${archetype.toUpperCase()}) | SPD: ${speed}`, {
      fontSize: '13px',
      color: '#94a3b8',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      padding: { x: 6, y: 3 },
    });

    // Hint text
    this.add.text(width - 240, 16, 'Controls: [A/D] Move | [W/Space] Jump', {
      fontSize: '12px',
      color: '#64748b',
    });
  }

  update() {
    if (!this.player || !this.cursors) return;

    const speed = this.characterConfig?.attributes.speed ?? 220;
    const jumpPower = this.characterConfig?.attributes.jumpPower ?? 380;

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

    if (jump && this.player.body.touching.down) {
      this.player.setVelocityY(-jumpPower);
    }
  }

  public updateCharacter(config: CharacterConfig) {
    this.characterConfig = config;
    if (this.scene.isActive()) {
      this.scene.restart({ characterConfig: config });
    }
  }
}
