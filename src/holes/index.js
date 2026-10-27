// The nine holes, in playing order.
import hole1 from './hole1.js';
import hole2 from './hole2.js';
import hole3 from './hole3.js';
import hole4 from './hole4.js';
import hole5 from './hole5.js';
import hole6 from './hole6.js';
import hole7 from './hole7.js';
import hole8 from './hole8.js';
import hole9 from './hole9.js';

export const HOLES = [
  { build: hole1, name: 'Sunny Meadow', par: 2, accent: '#b6d36a' },
  { build: hole2, name: 'Windmill Way', par: 3, accent: '#e8a0b4' },
  { build: hole3, name: 'Pirate Cove', par: 3, accent: '#6eb8c4' },
  { build: hole4, name: 'Frozen Peak', par: 3, accent: '#d4e4f0' },
  { build: hole5, name: 'Dino Valley', par: 3, accent: '#e8c04a' },
  { build: hole6, name: 'Lava Peak', par: 3, accent: '#e04a2a' },
  { build: hole7, name: 'Clockwork Factory', par: 4, accent: '#c9843a' },
  { build: hole8, name: 'Haunted Hollow', par: 4, accent: '#9a6bb8' },
  { build: hole9, name: 'Cosmic Loop', par: 5, accent: '#e07a3a' },
];
