// levels.js — the vault room: walls, cover, coins, loot, exit, patrol routes.
// Everything is data here; game.js only reads it, never edits the layout.

// One rectangular display case or crate. Cover blocks movement AND sight:
// a guard cannot see through a case, so the thief plans routes behind them.
function vaultCoverRect(x, y, w, h, kind, label) {
  return { x, y, w, h, kind, label: label || '' };
}

// Build the single room the whole game happens in.
function buildVaultRoom() {
  const room = VAULT_ROOM;
  return {
    bounds: { x: room.x, y: room.y, w: room.w, h: room.h },
    // Display cases (tall glass) and crates (low wood) — the stealth cover.
    cover: [
      vaultCoverRect(190, 170, 130, 74, 'case', 'Amber Room'),
      vaultCoverRect(700, 170, 130, 74, 'case', 'Jade Hall'),
      vaultCoverRect(450, 330, 150, 84, 'case', 'Crown Jewels'),
      vaultCoverRect(950, 430, 130, 74, 'case', 'Ivory Wing'),
      vaultCoverRect(180, 500, 130, 74, 'case', 'Silver Vault'),
      vaultCoverRect(330, 300, 62, 62, 'crate', ''),
      vaultCoverRect(880, 300, 62, 62, 'crate', ''),
      vaultCoverRect(560, 540, 62, 62, 'crate', ''),
      vaultCoverRect(1080, 210, 62, 62, 'crate', ''),
    ],
    // Round pillars: cover you can circle around.
    pillars: [
      { x: 640, y: 280, r: 26 },
      { x: 640, y: 540, r: 26 },
      { x: 280, y: 430, r: 22 },
    ],
    // Coins buy tools. Spread so every route passes near at least one.
    coins: [
      { x: 130, y: 150, taken: false },
      { x: 1150, y: 150, taken: false },
      { x: 130, y: 620, taken: false },
      { x: 640, y: 650, taken: false },
      { x: 1000, y: 580, taken: false },
      { x: 420, y: 130, taken: false },
    ],
    // The diamond sits in a lit case at the top centre of the room.
    loot: { x: 640, y: 128, r: 20, taken: false, name: LOOT_NAME },
    // The getaway: a service door at the bottom right, lit green.
    exit: { x: 1140, y: 640, w: 76, h: 52 },
    // The thief slips in through the bottom-left service door.
    playerStart: { x: 120, y: 648 },
    // Two guards walk set routes; each route is a list of waypoints.
    // pauseSeconds: how long a guard surveys (sweeps its cone) at each
    // waypoint before walking on — a readable beat the thief can time.
    guardRoutes: [
      {
        name: 'Rook',
        waypoints: [
          { x: 180, y: 260 },
          { x: 1100, y: 260 },
        ],
        speed: 72,
        pauseSeconds: 1.0,
      },
      {
        name: 'Bishop',
        waypoints: [
          { x: 1100, y: 470 },
          { x: 300, y: 470 },
        ],
        speed: 100,
        pauseSeconds: 1.6,
      },
    ],
    // Vent shafts: a second route through the museum. Crawl in one grate
    // and come out the other — slow, but it slips past Rook's patrol and
    // drops the thief at the top-left, a short dash from the diamond.
    // Vents are the quiet route; the hall is the fast one.
    vents: [
      { x: 72, y: 640, r: 24, to: { x: 132, y: 142 } },
      { x: 132, y: 142, r: 24, to: { x: 72, y: 640 } },
    ],
    // Wall cameras: fixed mounts, cones that sweep back and forth.
    cameraMounts: [
      { x: 640, y: 88, baseAngle: Math.PI / 2, name: 'Cam A' },
      { x: 1236, y: 380, baseAngle: Math.PI, name: 'Cam B' },
    ],
  };
}

// --- collision: a circle (the thief, a guard) against the room ---

// True when the circle at (x, y) with radius r overlaps a rectangle.
function vaultCircleHitsRect(x, y, r, rect) {
  const nearestX = vaultClamp(x, rect.x, rect.x + rect.w);
  const nearestY = vaultClamp(y, rect.y, rect.y + rect.h);
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < r * r;
}

// True when the circle overlaps any cover, pillar or the room's walls.
function vaultCircleBlocked(x, y, r, vault) {
  const b = vault.bounds;
  if (x - r < b.x || x + r > b.x + b.w) return true;
  if (y - r < b.y || y + r > b.y + b.h) return true;
  for (const rect of vault.cover) {
    if (vaultCircleHitsRect(x, y, r, rect)) return true;
  }
  for (const pillar of vault.pillars) {
    if (vaultCirclesTouch(x, y, r, pillar.x, pillar.y, pillar.r)) return true;
  }
  return false;
}

// Move a circle by (dx, dy), sliding along cover: try both axes, then each
// axis alone, so the thief glides around a case instead of sticking to it.
function vaultMoveCircle(body, dx, dy, vault) {
  const r = body.r;
  if (!vaultCircleBlocked(body.x + dx, body.y + dy, r, vault)) {
    body.x += dx;
    body.y += dy;
    return;
  }
  if (!vaultCircleBlocked(body.x + dx, body.y, r, vault)) body.x += dx;
  if (!vaultCircleBlocked(body.x, body.y + dy, r, vault)) body.y += dy;
}

// --- line of sight: does a segment cross any cover or pillar? ---

// A segment and a rectangle intersect (edges included) or the segment's
// start sits inside the rectangle.
function vaultSegmentHitsRect(x1, y1, x2, y2, rect) {
  if (x1 >= rect.x && x1 <= rect.x + rect.w && y1 >= rect.y && y1 <= rect.y + rect.h) return true;
  if (x2 >= rect.x && x2 <= rect.x + rect.w && y2 >= rect.y && y2 <= rect.y + rect.h) return true;
  const edges = [
    [rect.x, rect.y, rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h],
    [rect.x, rect.y + rect.h, rect.x, rect.y],
  ];
  for (const e of edges) {
    if (vaultSegmentsCross(x1, y1, x2, y2, e[0], e[1], e[2], e[3])) return true;
  }
  return false;
}

// Two segments cross (or touch), by the standard orientation test.
function vaultSegmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1 = vaultTurn(x3, y3, x4, y4, x1, y1);
  const d2 = vaultTurn(x3, y3, x4, y4, x2, y2);
  const d3 = vaultTurn(x1, y1, x2, y2, x3, y3);
  const d4 = vaultTurn(x1, y1, x2, y2, x4, y4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function vaultTurn(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

// True when nothing solid stands between (x1, y1) and (x2, y2). Pillars are
// sampled along the segment — cheap and plenty accurate for a cone check.
function vaultLineOfSightClear(x1, y1, x2, y2, vault) {
  for (const rect of vault.cover) {
    if (vaultSegmentHitsRect(x1, y1, x2, y2, rect)) return false;
  }
  for (const pillar of vault.pillars) {
    const steps = 24;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      const dx = px - pillar.x;
      const dy = py - pillar.y;
      if (dx * dx + dy * dy < pillar.r * pillar.r) return false;
    }
  }
  return true;
}
