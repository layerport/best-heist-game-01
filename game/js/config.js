// config.js — every tunable number for The Midnight Vault, in one place.
// Canvas is a fixed 1280x720 frame so screenshots always show the whole room.
const VAULT_WIDTH = 1280;
const VAULT_HEIGHT = 720;
const VAULT_HUD_HEIGHT = 64;

// The museum room itself (inside the outer wall).
const VAULT_ROOM = { x: 40, y: 84, w: 1200, h: 616 };

// Movement and sizes.
const THIEF_RADIUS = 14;
const THIEF_SPEED = 215;
const GUARD_RADIUS = 15;
const GUARD_TOUCH_DISTANCE = 30;
const COIN_RADIUS = 9;

// Vision cones.
const GUARD_CONE_LENGTH = 235;
const GUARD_CONE_HALF_ANGLE = 0.49; // ~28 degrees each side
const GUARD_SWEEP_AMPLITUDE = 0.38; // radians the cone sweeps around facing
const GUARD_SWEEP_SPEED = 1.15;
const CAMERA_CONE_LENGTH = 265;
const CAMERA_CONE_HALF_ANGLE = 0.42;
const CAMERA_SWEEP_AMPLITUDE = 0.85;
const CAMERA_SWEEP_SPEED = 0.85;

// Alarm meter: 0..100. Seen by a guard fills fast, a camera a touch slower.
const ALARM_GUARD_RATE = 46;
const ALARM_CAMERA_RATE = 38;
const ALARM_DECAY_RATE = 13;
const ALARM_CAUGHT_AT = 100;
const ALARM_WARN_AT = 65;

// Tools the thief buys with coins. Keys 1/2/3, costs shown on the HUD.
const VAULT_TOOLS = {
  smoke: { key: '1', name: 'Smoke pellet', cost: 2, radius: 95, duration: 3.5 },
  noise: { key: '2', name: 'Noise-maker', cost: 1, lureSeconds: 4.5 },
  jammer: { key: '3', name: 'Camera jammer', cost: 2, duration: 5 },
};

// Coins the run starts with, and the loot's name.
const STARTING_COINS = 3;
const LOOT_NAME = 'Star of Meridia';

// Palette: a museum at night — deep blue floor, warm gold trim, danger in red.
const VAULT_COLORS = {
  page: '#0a0e1a',
  floorA: '#232c42',
  floorB: '#1d2537',
  wall: '#3a4666',
  wallTop: '#4d5c85',
  gold: '#e8b64c',
  goldDim: '#a8842f',
  caseGlass: 'rgba(140, 200, 255, 0.16)',
  caseFrame: '#6b5a2e',
  crate: '#5a4632',
  crateEdge: '#7d6547',
  pillar: '#39415e',
  diamond: '#7fe7ff',
  diamondGlow: 'rgba(127, 231, 255, 0.35)',
  exitGreen: '#39d98a',
  thief: '#1c1c26',
  thiefTrim: '#e8b64c',
  guard: '#2c4a7c',
  guardTrim: '#9fc2ff',
  coneGuard: 'rgba(255, 214, 90, 0.20)',
  coneGuardEdge: 'rgba(255, 214, 90, 0.55)',
  coneCamera: 'rgba(255, 80, 80, 0.20)',
  coneCameraEdge: 'rgba(255, 80, 80, 0.55)',
  coneJammed: 'rgba(150, 150, 150, 0.10)',
  smoke: 'rgba(200, 205, 220, 0.55)',
  text: '#f2ead8',
  textDim: '#9aa3bd',
};

// The three tools in HUD order, so the HUD and the input code agree.
const VAULT_TOOL_ORDER = ['smoke', 'noise', 'jammer'];

// Rating bands for the win screen: time in seconds, and how many times the
// alarm crossed the warning line (a "spotting"). Fast and unseen is best.
function vaultRatingFor(seconds, spottings) {
  if (seconds <= 90 && spottings === 0) return 'S — Ghost';
  if (seconds <= 120 && spottings <= 1) return 'A — Clean';
  if (seconds <= 180 && spottings <= 2) return 'B — Professional';
  return 'C — Loud, but rich';
}

// Clamp a number into a range; used everywhere movement meets a wall.
function vaultClamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

// True when two circles overlap; guards, coins and the loot all use it.
function vaultCirclesTouch(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy < reach * reach;
}
