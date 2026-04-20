import {
  AI_COUNT,
  BASE_SPEED,
  COLORS,
  FOOD_COUNT,
  PROJECTILE_COOLDOWN,
  PROJECTILE_LIFE,
  PROJECTILE_SPEED,
  SEGMENT_DISTANCE,
  STARTING_LENGTH,
  WORLD_SIZE,
  SKINS
} from './constants';
import { Food, GameState, Player, Projectile } from './types';

export class GameEngine {
  state: GameState;
  totalCoins: number;
  ownedItems: string[];
  private lastId = 0;

  constructor(initialCoins: number = 0, initialItems: string[] = ["skin_pink", "acc_none"]) {
    this.totalCoins = initialCoins;
    this.ownedItems = initialItems;
    this.state = {
      players: [],
      food: [],
      projectiles: [],
      status: 'menu',
    };
  }

  // Helper to init from client side if needed
  static fromLocalStorage(): GameEngine {
    const coins = parseInt(localStorage.getItem('worm_coins') || '0');
    const items = JSON.parse(localStorage.getItem('worm_items') || '["skin_pink", "acc_none"]');
    return new GameEngine(coins, items);
  }

  generateId() {
    return (++this.lastId).toString();
  }

  init() {
    this.state.players = [];
    for (let i = 0; i < AI_COUNT; i++) {
      this.state.players.push(this.createPlayer(`Bot ${i + 1}`, 'ai'));
    }
    
    this.state.food = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.state.food.push(this.createFood());
    }
    
    this.state.projectiles = [];
    this.state.status = 'playing';
  }

  addPlayer(id: string, name: string, skinId?: string, accessoryId?: string): Player {
    this.removePlayer(id); // Clean up existing player if any
    const p = this.createPlayer(name, 'player', skinId, accessoryId);
    p.id = id;
    this.state.players.push(p);
    return p;
  }

  removePlayer(id: string) {
    this.state.players = this.state.players.filter(p => p.id !== id);
  }

  syncState(newState: GameState) {
    this.state = newState;
  }

  createPlayer(name: string, type: 'player' | 'ai', skinId?: string, accessoryId?: string): Player {
    const x = Math.random() * WORLD_SIZE;
    const y = Math.random() * WORLD_SIZE;
    let color = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    if (type === 'player' && skinId) {
       const skin = SKINS.find(s => s.id === skinId);
       if (skin) color = skin.color;
    }

    const segments = [];
    for (let i = 0; i < STARTING_LENGTH; i++) {
      segments.push({ x, y: y + i * SEGMENT_DISTANCE });
    }

    return {
      id: this.generateId(),
      name,
      segments,
      angle: Math.random() * Math.PI * 2,
      speed: BASE_SPEED,
      score: 0,
      coins: 0,
      isDead: false,
      color,
      type,
      cooldown: 0,
      skinId,
      accessoryId,
    };
  }

  createFood(): Food {
    const isCoin = Math.random() < 0.15; // 15% chance for a coin
    return {
      id: this.generateId(),
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      value: 1,
      color: isCoin ? '#ffd700' : COLORS[Math.floor(Math.random() * COLORS.length)],
      isCoin,
    };
  }

  update(playerInputs: Record<string, { angle: number, isShooting: boolean }>) {
    if (this.state.status !== 'playing') return;

    this.state.players.forEach((p) => {
      if (p.isDead) return;

      // Handle Movement
      if (p.type === 'player') {
        const input = playerInputs[p.id] || { angle: p.angle, isShooting: false };
        let diff = input.angle - p.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.angle += diff * 0.15;
        
        const isShooting = input.isShooting;
        if (isShooting && p.cooldown === 0 && p.segments.length > 5) {
          this.shoot(p);
        }
      } else {
        this.updateAI(p);
      }

      // Move Head
      const head = p.segments[0];
      const newHead = {
        x: head.x + Math.cos(p.angle) * p.speed,
        y: head.y + Math.sin(p.angle) * p.speed,
      };

      if (newHead.x < 0 || newHead.x > WORLD_SIZE || newHead.y < 0 || newHead.y > WORLD_SIZE) {
        this.killPlayer(p);
        return;
      }

      const newSegments = [newHead];
      let prev = newHead;
      for (let i = 1; i < p.segments.length; i++) {
        const seg = p.segments[i];
        const dx = prev.x - seg.x;
        const dy = prev.y - seg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > SEGMENT_DISTANCE) {
          const ratio = SEGMENT_DISTANCE / dist;
          newSegments.push({
            x: prev.x - dx * ratio,
            y: prev.y - dy * ratio,
          });
        } else {
          newSegments.push(seg);
        }
        prev = newSegments[i];
      }
      p.segments = newSegments;

      if (p.cooldown > 0) p.cooldown--;
      
      const isAI = p.type === 'ai';
      if (isAI && (p as any).wantsToShoot && p.cooldown === 0 && p.segments.length > 5) {
        this.shoot(p);
      }

      for (let i = this.state.food.length - 1; i >= 0; i--) {
        const f = this.state.food[i];
        const dx = newHead.x - f.x;
        const dy = newHead.y - f.y;
        if (dx * dx + dy * dy < 625) { // 25px radius
          p.score += f.value;
          
          if (f.isCoin) {
            p.coins += 1;
          }

          this.state.food.splice(i, 1);
          this.state.food.push(this.createFood());
          
          if (p.score % 2 === 0) {
             const last = p.segments[p.segments.length - 1];
             p.segments.push({ ...last });
          }
        }
      }

      this.state.players.forEach((other) => {
        if (other.id === p.id || other.isDead) return;
        
        for (let i = 0; i < other.segments.length; i++) {
          const seg = other.segments[i];
          const dx = newHead.x - seg.x;
          const dy = newHead.y - seg.y;
          if (dx * dx + dy * dy < 400) { 
            this.killPlayer(p);
            return;
          }
        }
      });
    });

    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const proj = this.state.projectiles[i];
      proj.x += proj.vx;
      proj.y += proj.vy;
      proj.life--;

      if (proj.life <= 0) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      let hit = false;
      for (const p of this.state.players) {
        if (p.id === proj.ownerId || p.isDead) continue;
        
        for (const seg of p.segments) {
          const dx = proj.x - seg.x;
          const dy = proj.y - seg.y;
          if (dx * dx + dy * dy < 625) { // Standard hit radius
            this.killPlayer(p);
            hit = true;
            break;
          }
        }
        if (hit) break;
      }

      if (hit) {
        this.state.projectiles.splice(i, 1);
      }
    }

    // This is optional since client handles its own coins
    // But for multiplayer server-side doesn't need to save to local storage
  }

  updateAI(p: Player) {
    const ai = p as any;
    if (!ai.targetAngle || Math.random() < 0.005) {
      ai.targetAngle = Math.random() * Math.PI * 2;
    }
    
    const head = p.segments[0];
    if (head.x < 500 || head.x > WORLD_SIZE - 500 || head.y < 500 || head.y > WORLD_SIZE - 500) {
       const dx = WORLD_SIZE / 2 - head.x;
       const dy = WORLD_SIZE / 2 - head.y;
       ai.targetAngle = Math.atan2(dy, dx);
    }

    let diff = ai.targetAngle - p.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    p.angle += diff * 0.1;

    ai.wantsToShoot = false;
    if (Math.random() < 0.01 && p.segments.length > 12) {
       ai.wantsToShoot = true;
    }
  }

  shoot(p: Player) {
    p.cooldown = PROJECTILE_COOLDOWN;
    p.segments.pop(); 
    
    const head = p.segments[0];
    this.state.projectiles.push({
      id: this.generateId(),
      x: head.x,
      y: head.y,
      vx: Math.cos(p.angle) * PROJECTILE_SPEED,
      vy: Math.sin(p.angle) * PROJECTILE_SPEED,
      ownerId: p.id,
      life: PROJECTILE_LIFE,
    });
  }

  killPlayer(p: Player) {
    if (p.isDead) return;
    p.isDead = true;
    
    p.segments.forEach((seg, i) => {
      if (i % 2 === 0) {
        this.state.food.push({
          id: this.generateId(),
          x: seg.x + (Math.random() - 0.5) * 40,
          y: seg.y + (Math.random() - 0.5) * 40,
          value: 3,
          color: p.color,
        });
      }
    });

    if (p.type === 'ai') {
       setTimeout(() => {
          if (this.state.status === 'playing') {
             this.state.players = this.state.players.filter(pl => pl.id !== p.id);
             this.state.players.push(this.createPlayer(`Bot ${Math.floor(Math.random() * 1000)}`, 'ai'));
          }
       }, 5000);
    }
  }
}
