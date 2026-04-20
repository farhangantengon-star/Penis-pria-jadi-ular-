export const WORLD_SIZE = 3000;
export const STARTING_LENGTH = 10;
export const SEGMENT_DISTANCE = 15;
export const BASE_SPEED = 3;
export const BOOST_SPEED = 6;
export const TURN_SPEED = 0.12;

export const FOOD_COUNT = 300;
export const AI_COUNT = 15;

export const PROJECTILE_SPEED = 12;
export const PROJECTILE_COOLDOWN = 15; // frames
export const PROJECTILE_LIFE = 60; // frames

export const COLORS = [
  '#FF5F6D', // Coral Red
  '#FFC371', // Sunkissed Orange
  '#11998e', // Emerald
  '#38ef7d', // Lime
  '#4facfe', // Sky Blue
  '#00f2fe', // Aqua
  '#7028e4', // Deep Violet
  '#e91e63', // Pink
  '#f44336', // Red
  '#ffeb3b', // Yellow
  '#00d2ff', // Bright Blue
  '#9d50bb', // Purple
  '#6e48aa', // Deep Purple
];

export const SKINS: any[] = [
  { id: 'skin_pink', name: 'Classic Pink', price: 0, type: 'skin', color: '#ffb7c5', pattern: 'none' },
  { id: 'skin_flesh', name: 'Natural', price: 50, type: 'skin', color: '#e5bd9d', pattern: 'none' },
  { id: 'skin_veiny', name: 'Mega Veiny', price: 150, type: 'skin', color: '#e5bd9d', pattern: 'veined' },
  { id: 'skin_striped', name: 'Zebra', price: 100, type: 'skin', color: '#ffffff', pattern: 'striped' },
  { id: 'skin_gold', name: 'Golden King', price: 500, type: 'skin', color: '#ffd700', pattern: 'none' },
  { id: 'skin_dark', name: 'Night Stalker', price: 100, type: 'skin', color: '#333333', pattern: 'none' },
  { id: 'skin_dotted', name: 'Polka Dot', price: 120, type: 'skin', color: '#ff69b4', pattern: 'dotted' },
  { id: 'skin_rainbow', name: 'Rainbow', price: 1000, type: 'skin', color: 'rainbow', pattern: 'none' },
];

export const ACCESSORIES: any[] = [
  { id: 'acc_none', name: 'None', price: 0, type: 'accessory', icon: 'None' },
  { id: 'acc_hat', name: 'Top Hat', price: 200, type: 'accessory', icon: '🎩' },
  { id: 'acc_crown', name: 'King Crown', price: 400, type: 'accessory', icon: '👑' },
  { id: 'acc_shades', name: 'Cool Shades', price: 150, type: 'accessory', icon: '🕶️' },
  { id: 'acc_devil', name: 'Devil Horns', price: 300, type: 'accessory', icon: '😈' },
  { id: 'acc_halo', name: 'Angel Halo', price: 350, type: 'accessory', icon: '😇' },
  { id: 'acc_mustache', name: 'Gentleman', price: 100, type: 'accessory', icon: '👨' },
];
