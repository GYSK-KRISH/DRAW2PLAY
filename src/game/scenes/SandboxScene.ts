import Phaser from 'phaser';
import type {
  SandboxTileType,
  SandboxWorldData,
  SandboxInventory,
} from '../../types/sandbox.js';
import {
  TILE_DEFINITIONS,
} from '../../types/sandbox.js';
import {
  generateDefaultSandboxWorld,
  mineBlock,
  placeBlock,
  type Rect,
} from '../sandbox/sandboxWorld.js';
import {
  createDefaultInventory,
  addInventoryItem,
  consumeInventoryItem,
  getSelectedBlockType,
  setSelectedSlot,
} from '../sandbox/sandboxInventory.js';
import { audioService } from '../../services/audioService.js';

export interface SandboxSceneInitData {
  worldData?: SandboxWorldData;
  initialInventory?: SandboxInventory;
  initialPlayerPos?: { x: number; y: number };
  onInventoryChange?: (inventory: SandboxInventory) => void;
  onActionFeedback?: (message: string) => void;
  onPlayerPositionChange?: (coords: { x: number; y: number; col: number; row: number }) => void;
}

export class SandboxScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private numberKeys!: Phaser.Input.Keyboard.Key[];

  private solidTiles!: Phaser.Physics.Arcade.StaticGroup;
  private tileSpriteMap = new Map<string, Phaser.GameObjects.Sprite>();

  public worldData!: SandboxWorldData;
  public inventory!: SandboxInventory;

  private onInventoryChange?: (inventory: SandboxInventory) => void;
  private onActionFeedback?: (message: string) => void;
  private onPlayerPositionChange?: (coords: { x: number; y: number; col: number; row: number }) => void;

  // Jump tracking to prevent continuous jump on key hold
  private jumpKeyWasDown = false;

  // Particle emitter for block break
  private debrisEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  // Tile hover cursor
  private hoverBox?: Phaser.GameObjects.Rectangle;

  // Touch controls / virtual input
  private virtualInput = { left: false, right: false, jump: false };
  private touchInteractionMode: 'mine' | 'place' = 'mine';

  // Last reported player tile position
  private lastReportedCol = -1;
  private lastReportedRow = -1;

  constructor() {
    super({ key: 'SandboxScene' });
  }

  init(data: SandboxSceneInitData) {
    this.worldData = data.worldData || generateDefaultSandboxWorld();
    this.inventory = data.initialInventory || createDefaultInventory();
    this.onInventoryChange = data.onInventoryChange;
    this.onActionFeedback = data.onActionFeedback;
    this.onPlayerPositionChange = data.onPlayerPositionChange;
    this.jumpKeyWasDown = false;
    this.virtualInput = { left: false, right: false, jump: false };
    this.lastReportedCol = -1;
    this.lastReportedRow = -1;
  }

  public setTouchInteractionMode(mode: 'mine' | 'place') {
    this.touchInteractionMode = mode;
  }

  public setVirtualInput(input: { left?: boolean; right?: boolean; jump?: boolean }) {
    if (input.left !== undefined) this.virtualInput.left = input.left;
    if (input.right !== undefined) this.virtualInput.right = input.right;
    if (input.jump !== undefined) this.virtualInput.jump = input.jump;
  }

  public selectHotbarSlot(slot: number) {
    this.inventory = setSelectedSlot(this.inventory, slot);
    this.onInventoryChange?.(this.inventory);
  }

  preload() {
    this.generateProceduralTextures();
  }

  create() {
    const worldPixelWidth = this.worldData.cols * this.worldData.tileSize;
    const worldPixelHeight = this.worldData.rows * this.worldData.tileSize;

    // Set world physics & camera bounds
    this.physics.world.setBounds(0, 0, worldPixelWidth, worldPixelHeight);
    this.cameras.main.setBounds(0, 0, worldPixelWidth, worldPixelHeight);
    this.cameras.main.setBackgroundColor('#0b1329');

    // 1. Create static group for solid collision tiles
    this.solidTiles = this.physics.add.staticGroup();
    this.tileSpriteMap.clear();

    // 2. Render all solid tiles
    const tileSize = this.worldData.tileSize;
    for (let r = 0; r < this.worldData.rows; r++) {
      for (let c = 0; c < this.worldData.cols; c++) {
        const tileType = this.worldData.tiles[r][c];
        if (tileType !== 'air') {
          this.createTileGameObject(c, r, tileType);
        }
      }
    }

    // 3. Create Player Sprite
    const spawnX = this.worldData.spawnPoint.x;
    const spawnY = this.worldData.spawnPoint.y;
    this.player = this.physics.add.sprite(spawnX, spawnY, 'hero-sprite');
    this.player.setCollideWorldBounds(true);
    this.player.setSize(22, 32);
    this.player.setOffset(7, 4);

    // 4. Collision between player and solid tiles
    this.physics.add.collider(this.player, this.solidTiles);

    // 5. Camera follow
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // 6. Keyboard input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = this.input.keyboard.addKeys('W,A,S,D') as {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
      };
      this.numberKeys = [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      ];
    }

    // 7. Tile hover highlight box
    this.hoverBox = this.add.rectangle(0, 0, tileSize, tileSize);
    this.hoverBox.setStrokeStyle(2, 0x38bdf8, 0.8);
    this.hoverBox.setFillStyle(0x38bdf8, 0.15);
    this.hoverBox.setDepth(10);
    this.hoverBox.setOrigin(0, 0);

    // 8. Particle emitter for block break
    this.debrisEmitter = this.add.particles(0, 0, 'block-particle', {
      lifespan: { min: 200, max: 400 },
      speed: { min: 60, max: 140 },
      scale: { start: 1, end: 0 },
      gravityY: 500,
      emitting: false,
    });
    this.debrisEmitter.setDepth(15);

    // 9. Mouse Pointer interaction
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerAction(pointer);
    });

    // Suppress context menu on canvas so right click works for placing
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Initial inventory report
    this.onInventoryChange?.(this.inventory);
  }

  update() {
    if (!this.player || !this.player.body) return;

    // A. Check Grounded State every frame
    const isGrounded = this.player.body.blocked.down || this.player.body.touching.down;

    // B. Horizontal Movement
    const leftKey = (this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown || this.virtualInput.left) ?? false;
    const rightKey = (this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown || this.virtualInput.right) ?? false;

    if (leftKey) {
      this.player.setVelocityX(-220);
      this.player.setFlipX(true);
    } else if (rightKey) {
      this.player.setVelocityX(220);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // C. Vertical Movement & Jump (preventing continuous hold-jump)
    const jumpKeyDown = (
      this.cursors?.up?.isDown ||
      this.cursors?.space?.isDown ||
      this.wasdKeys?.W?.isDown ||
      this.virtualInput.jump
    ) ?? false;

    if (jumpKeyDown && !this.jumpKeyWasDown && isGrounded) {
      this.player.setVelocityY(-460);
      audioService.playJump();
    }
    this.jumpKeyWasDown = jumpKeyDown;

    // D. Number Keys Hotbar Selection (1 to 4)
    if (this.numberKeys) {
      this.numberKeys.forEach((key, idx) => {
        if (Phaser.Input.Keyboard.JustDown(key)) {
          this.selectHotbarSlot(idx);
          audioService.playClick();
        }
      });
    }

    // E. Tile Hover Cursor Position
    const pointer = this.input.activePointer;
    if (pointer && this.hoverBox) {
      const tileSize = this.worldData.tileSize;
      const hoverCol = Math.floor(pointer.worldX / tileSize);
      const hoverRow = Math.floor(pointer.worldY / tileSize);

      if (
        hoverCol >= 0 &&
        hoverCol < this.worldData.cols &&
        hoverRow >= 0 &&
        hoverRow < this.worldData.rows
      ) {
        this.hoverBox.setVisible(true);
        this.hoverBox.setPosition(hoverCol * tileSize, hoverRow * tileSize);
      } else {
        this.hoverBox.setVisible(false);
      }
    }

    // F. Safe Respawn if falling out of playable world
    const worldBottom = this.worldData.rows * this.worldData.tileSize;
    if (this.player.y > worldBottom + 80) {
      this.player.setPosition(this.worldData.spawnPoint.x, this.worldData.spawnPoint.y);
      this.player.setVelocity(0, 0);
      audioService.playHazard();
      this.onActionFeedback?.('Fell out of world! Respawned safely at spawn.');
    }

    // G. Report Player Coordinates periodically on tile change
    const currentCol = Math.floor(this.player.x / this.worldData.tileSize);
    const currentRow = Math.floor(this.player.y / this.worldData.tileSize);
    if (currentCol !== this.lastReportedCol || currentRow !== this.lastReportedRow) {
      this.lastReportedCol = currentCol;
      this.lastReportedRow = currentRow;
      this.onPlayerPositionChange?.({
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        col: currentCol,
        row: currentRow,
      });
    }
  }

  private handlePointerAction(pointer: Phaser.Input.Pointer) {
    const tileSize = this.worldData.tileSize;
    const col = Math.floor(pointer.worldX / tileSize);
    const row = Math.floor(pointer.worldY / tileSize);

    // Reach distance check: limit to ~6 tiles (192px) from player center
    const playerCenterX = this.player.x;
    const playerCenterY = this.player.y;
    const tileCenterX = col * tileSize + tileSize / 2;
    const tileCenterY = row * tileSize + tileSize / 2;
    const dist = Phaser.Math.Distance.Between(playerCenterX, playerCenterY, tileCenterX, tileCenterY);

    if (dist > 220) {
      this.onActionFeedback?.('Too far to reach! Move closer.');
      return;
    }

    const isRightClick = pointer.button === 2;
    const isMining = isRightClick ? false : this.touchInteractionMode === 'mine';

    if (isMining) {
      this.performMine(col, row, tileCenterX, tileCenterY);
    } else {
      this.performPlace(col, row);
    }
  }

  private performMine(col: number, row: number, tileCenterX: number, tileCenterY: number) {
    const mined = mineBlock(this.worldData, col, row);
    if (!mined) return;

    // 1. Destroy visual & physics sprite
    const key = `${col},${row}`;
    const sprite = this.tileSpriteMap.get(key);
    if (sprite) {
      sprite.destroy();
      this.tileSpriteMap.delete(key);
    }

    // 2. Play particle burst
    if (this.debrisEmitter) {
      this.debrisEmitter.explode(8, tileCenterX, tileCenterY);
    }

    // 3. Collect block into inventory
    this.inventory = addInventoryItem(this.inventory, mined.minedTile, 1);
    this.onInventoryChange?.(this.inventory);

    // 4. Audio & feedback
    audioService.playMine();
    const name = TILE_DEFINITIONS[mined.minedTile].displayName;
    this.onActionFeedback?.(`Mined 1x ${name}`);
  }

  private performPlace(col: number, row: number) {
    const selectedBlock = getSelectedBlockType(this.inventory);
    const playerRect: Rect = {
      x: this.player.x - 11,
      y: this.player.y - 16,
      width: 22,
      height: 32,
    };

    // Check inventory
    const count = this.inventory.items[selectedBlock] ?? 0;
    if (count <= 0) {
      this.onActionFeedback?.(`Out of ${TILE_DEFINITIONS[selectedBlock].displayName}!`);
      audioService.playHazard();
      return;
    }

    // Attempt block placement
    const placed = placeBlock(this.worldData, col, row, selectedBlock, playerRect);
    if (!placed.success) {
      this.onActionFeedback?.(placed.reason || 'Cannot place block here.');
      audioService.playHazard();
      return;
    }

    // Deduct from inventory safely
    const consumed = consumeInventoryItem(this.inventory, selectedBlock, 1);
    if (consumed.success) {
      this.inventory = consumed.inventory;
      this.onInventoryChange?.(this.inventory);
    }

    // Create visual & physics sprite
    this.createTileGameObject(col, row, selectedBlock);

    // Audio & feedback
    audioService.playPlace();
    const name = TILE_DEFINITIONS[selectedBlock].displayName;
    this.onActionFeedback?.(`Placed 1x ${name}`);
  }

  private createTileGameObject(col: number, row: number, tileType: SandboxTileType) {
    const tileSize = this.worldData.tileSize;
    const x = col * tileSize + tileSize / 2;
    const y = row * tileSize + tileSize / 2;
    const textureKey = `tile-${tileType}`;

    const sprite = this.solidTiles.create(x, y, textureKey) as Phaser.Physics.Arcade.Sprite;
    sprite.setOrigin(0.5, 0.5);
    sprite.refreshBody();
    this.tileSpriteMap.set(`${col},${row}`, sprite);
  }

  private generateProceduralTextures() {
    const tileSize = this.worldData.tileSize;

    // 1. Grass Tile
    if (!this.textures.exists('tile-grass')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      // Base dirt
      g.fillStyle(0x78350f, 1);
      g.fillRect(0, 0, tileSize, tileSize);
      // Dirt specks
      g.fillStyle(0x572608, 1);
      g.fillRect(4, 16, 4, 4);
      g.fillRect(20, 22, 4, 4);
      g.fillRect(12, 26, 4, 3);
      // Grass cap (top 8px)
      g.fillStyle(0x16a34a, 1);
      g.fillRect(0, 0, tileSize, 8);
      // Grass fringe
      g.fillStyle(0x22c55e, 1);
      g.fillRect(0, 0, tileSize, 4);
      g.fillRect(3, 8, 3, 3);
      g.fillRect(11, 8, 4, 4);
      g.fillRect(19, 8, 3, 3);
      g.fillRect(26, 8, 4, 4);
      g.generateTexture('tile-grass', tileSize, tileSize);
      g.destroy();
    }

    // 2. Dirt Tile
    if (!this.textures.exists('tile-dirt')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x78350f, 1);
      g.fillRect(0, 0, tileSize, tileSize);
      g.fillStyle(0x572608, 1);
      g.fillRect(3, 5, 5, 4);
      g.fillRect(18, 8, 6, 4);
      g.fillRect(8, 18, 5, 5);
      g.fillRect(22, 20, 4, 4);
      g.fillStyle(0x92400e, 1);
      g.fillRect(12, 11, 3, 3);
      g.fillRect(4, 25, 4, 3);
      g.generateTexture('tile-dirt', tileSize, tileSize);
      g.destroy();
    }

    // 3. Stone Tile
    if (!this.textures.exists('tile-stone')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x475569, 1);
      g.fillRect(0, 0, tileSize, tileSize);
      g.fillStyle(0x334155, 1);
      g.fillRect(2, 6, 12, 4);
      g.fillRect(16, 14, 14, 4);
      g.fillRect(4, 22, 10, 4);
      g.fillStyle(0x64748b, 1);
      g.fillRect(4, 2, 8, 3);
      g.fillRect(18, 10, 10, 3);
      g.fillRect(16, 26, 12, 3);
      g.lineStyle(1, 0x1e293b, 0.8);
      g.strokeRect(0, 0, tileSize, tileSize);
      g.generateTexture('tile-stone', tileSize, tileSize);
      g.destroy();
    }

    // 4. Wood Tile
    if (!this.textures.exists('tile-wood')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x92400e, 1);
      g.fillRect(0, 0, tileSize, tileSize);
      g.fillStyle(0x78350f, 1);
      g.fillRect(6, 0, 4, tileSize);
      g.fillRect(18, 0, 4, tileSize);
      g.fillStyle(0xb45309, 1);
      g.fillRect(2, 0, 2, tileSize);
      g.fillRect(12, 0, 3, tileSize);
      g.fillRect(24, 0, 3, tileSize);
      g.lineStyle(1, 0x451a03, 0.8);
      g.strokeRect(0, 0, tileSize, tileSize);
      g.generateTexture('tile-wood', tileSize, tileSize);
      g.destroy();
    }

    // 5. Block Debris Particle
    if (!this.textures.exists('block-particle')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xf59e0b, 1);
      g.fillRect(0, 0, 6, 6);
      g.generateTexture('block-particle', 6, 6);
      g.destroy();
    }

    // 6. Hero Sprite (if not already existing)
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
  }

  /**
   * Updates the scene's internal inventory copy when items are crafted or synced from React
   */
  public setInventory(newInventory: SandboxInventory): void {
    this.inventory = { ...newInventory };
  }
}
