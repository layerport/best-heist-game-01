// routes.js — the vent route: a second way through the museum.
// The hall is fast and exposed; the vents are slow and unseen. A thief who
// steps on a grate crawls through the shaft for a breath, then pops out the
// other grate — past Rook's patrol, a short dash from the diamond. Crawling
// takes time, so the vent is a choice, not a free win.

// How long the crawl takes, and how long a grate stays shut afterwards.
const VENT_CRAWL_SECONDS = 0.9;
const VENT_COOLDOWN_SECONDS = 1.5;

// The vent grate under (x, y), or null when the thief stands on open floor.
function vaultVentAt(x, y, vault) {
  for (const vent of vault.vents) {
    const dx = x - vent.x;
    const dy = y - vent.y;
    if (dx * dx + dy * dy < (vent.r + 8) * (vent.r + 8)) return vent;
  }
  return null;
}

// One crawl's state, kept by game.js: { timer, vent, cooldown }.
function vaultStartVentCrawl(vent) {
  return { timer: VENT_CRAWL_SECONDS, vent, cooldown: 0 };
}

// Advance a crawl by dt seconds. Returns 'arrived' when the thief comes
// out the other grate, 'crawling' while still in the shaft.
function vaultUpdateVentCrawl(crawl, thief, dt) {
  crawl.timer -= dt;
  if (crawl.timer > 0) return 'crawling';
  thief.x = crawl.vent.to.x;
  thief.y = crawl.vent.to.y;
  crawl.cooldown = VENT_COOLDOWN_SECONDS;
  return 'arrived';
}

// Draw the grates: gold-framed steel slots in the floor, labelled VENT, so
// the second route reads at a glance. The grate the thief is crawling
// through rattles while the crawl runs.
function drawVaultVents(ctx, vault, timeNow, crawl) {
  for (const vent of vault.vents) {
    const rattling = crawl && crawl.vent === vent && crawl.timer > 0;
    const shake = rattling ? Math.sin(timeNow * 40) * 1.5 : 0;
    ctx.save();
    ctx.translate(vent.x + shake, vent.y);
    // Grate plate.
    ctx.beginPath();
    ctx.arc(0, 0, vent.r, 0, Math.PI * 2);
    ctx.fillStyle = '#141a2c';
    ctx.fill();
    ctx.strokeStyle = VAULT_COLORS.gold;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Slots.
    ctx.strokeStyle = '#8d7a45';
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-13, i * 8);
      ctx.lineTo(13, i * 8);
      ctx.stroke();
    }
    ctx.restore();
    // Label above the grate, clear of the plate.
    ctx.fillStyle = VAULT_COLORS.gold;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VENT', vent.x, vent.y - vent.r - 6);
  }
}
