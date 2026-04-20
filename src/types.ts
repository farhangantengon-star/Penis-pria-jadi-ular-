export interface Point {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  segments: Point[];
  angle: number;
  speed: number;
  score: number;
  coins: number;
  isDead: boolean;
  color: string;
  type: 'player' | 'ai';
  cooldown: number; // For shooting
  skinId?: string;
  accessoryId?: string;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
  isCoin?: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'skin' | 'accessory';
  color?: string; // For skins
  pattern?: 'none' | 'striped' | 'dotted' | 'veined'; // For skins
  icon?: string; // For accessories (we'll use lucide keys or emoji-like icons)
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  life: number;
}

export interface GameState {
  players: Player[];
  food: Food[];
  projectiles: Projectile[];
  status: 'menu' | 'playing' | 'gameover' | 'shop';
}
