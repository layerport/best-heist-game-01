// getaway.js — the getaway phase: what changes once the diamond is stolen.
// The museum knows it is being robbed. Guards hurry, the alarm drains half
// as fast, and the exit pulses green with an arrow pulling the thief home.
// The steal is only half the heist; the run home is the other half.

// True while the thief holds the diamond and the exit is the goal.
function vaultGetawayActive(vault) {
  return vault.loot.taken;
}

// Guard hurry during the getaway: a quarter faster on their feet.
function vaultGetawayGuardSpeedMult(vault) {
  return vaultGetawayActive(vault) ? 1.25 : 1;
}

// Alarm decay during the getaway: the museum stays on edge.
function vaultGetawayAlarmDecayMult(vault) {
  return vaultGetawayActive(vault) ? 0.5 : 1;
}

// Draw the getaway: a pulsing ring on the exit door and a dashed gold arrow
// from the thief toward it, so the way out reads even in a still frame.
function drawVaultGetaway(ctx, thief, vault, timeNow) {
  if (!vaultGetawayActive(vault)) return;
  const exit = vault.exit;
  const cx = exit.x + exit.w / 2;
  const cy = exit.y + exit.h / 2;
  const pulse = 0.5 + 0.5 * Math.sin(timeNow * 5);
  // Pulsing ring around the exit.
  ctx.beginPath();
  ctx.arc(cx, cy, 44 + pulse * 10, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(57, 217, 138, ' + (0.35 + pulse * 0.4) + ')';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Dashed arrow from the thief toward the exit door.
  const dx = cx - thief.x;
  const dy = cy - thief.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 120) {
    const ux = dx / dist;
    const uy = dy / dist;
    const sx = thief.x + ux * 34;
    const sy = thief.y + uy * 34;
    const ex = cx - ux * 46;
    const ey = cy - uy * 46;
    ctx.beginPath();
    ctx.setLineDash([10, 8]);
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = 'rgba(57, 217, 138, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    const headAngle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(headAngle - 0.45) * 14, ey - Math.sin(headAngle - 0.45) * 14);
    ctx.lineTo(ex - Math.cos(headAngle + 0.45) * 14, ey - Math.sin(headAngle + 0.45) * 14);
    ctx.closePath();
    ctx.fillStyle = 'rgba(57, 217, 138, 0.9)';
    ctx.fill();
  }
  // GETAWAY! banner above the exit.
  ctx.fillStyle = '#39d98a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GETAWAY!', cx, exit.y - 10);
}
