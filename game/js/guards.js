// guards.js — patrolling guards and wall cameras, and what they can see.
// A watcher has a position, a facing angle and a cone. The cone sweeps while
// the watcher walks, so the thief reads the sweep and times the crossing.

// Smallest absolute difference between two angles, in radians.
function vaultAngleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// True when (tx, ty) sits inside the cone from (ox, oy) facing `angle`.
function vaultInsideCone(ox, oy, angle, length, halfAngle, tx, ty) {
  const dx = tx - ox;
  const dy = ty - oy;
  const distSq = dx * dx + dy * dy;
  if (distSq > length * length) return false;
  if (distSq < 1) return true;
  const targetAngle = Math.atan2(dy, dx);
  return vaultAngleDifference(targetAngle, angle) <= halfAngle;
}

// One patrolling guard. Walks its waypoints, ping-pong; while lured it walks
// to the lure point instead, then goes back to its route.
function createGuard(route) {
  const start = route.waypoints[0];
  const guard = {
    name: route.name,
    x: start.x,
    y: start.y,
    r: GUARD_RADIUS,
    speed: route.speed,
    waypoints: route.waypoints,
    waypointIndex: 1,
    facing: 0,
    sweepPhase: Math.random() * Math.PI * 2,
    luredTo: null,
    lureTimer: 0,
    state: 'patrol',
    pauseTimer: 0,
    pauseSeconds: route.pauseSeconds || 0,
    surveyBase: 0,
    surveyPhase: 0,
  };
  guard.facing = Math.atan2(
    route.waypoints[1].y - start.y,
    route.waypoints[1].x - start.x
  );
  return guard;
}

// Walk toward (tx, ty) at the guard's speed; returns true when arrived.
function vaultGuardWalkTo(guard, tx, ty, dt, speedMult) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 4) return true;
  const step = Math.min(dist, guard.speed * (speedMult || 1) * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.facing = Math.atan2(dy, dx);
  return false;
}

// Advance one guard by dt seconds. Lured guards detour; the rest patrol,
// pausing at each waypoint to survey the room. speedMult lets the getaway
// phase hurry the guards without touching their base speed.
function updateGuard(guard, dt, timeNow, speedMult) {
  guard.sweepPhase += dt * GUARD_SWEEP_SPEED;
  if (guard.lureTimer > 0) {
    guard.lureTimer -= dt;
    if (guard.luredTo) vaultGuardWalkTo(guard, guard.luredTo.x, guard.luredTo.y, dt, speedMult);
    if (guard.lureTimer <= 0) {
      guard.luredTo = null;
      guard.state = 'patrol';
    }
    return;
  }
  if (guard.pauseTimer > 0) {
    // Surveying: stand still, sweep the cone wide, then walk on.
    guard.pauseTimer -= dt;
    guard.surveyPhase += dt * 2.2;
    guard.facing = guard.surveyBase + Math.sin(guard.surveyPhase) * 0.7;
    if (guard.pauseTimer <= 0) guard.state = 'patrol';
    return;
  }
  const target = guard.waypoints[guard.waypointIndex];
  if (vaultGuardWalkTo(guard, target.x, target.y, dt, speedMult)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    if (guard.pauseSeconds > 0) {
      guard.pauseTimer = guard.pauseSeconds;
      guard.surveyBase = guard.facing;
      guard.surveyPhase = 0;
      guard.state = 'survey';
    }
  }
}

// The guard's current cone direction: facing plus the sweep oscillation.
function guardConeAngle(guard) {
  return guard.facing + Math.sin(guard.sweepPhase) * GUARD_SWEEP_AMPLITUDE;
}

// Lure this guard to a point for `seconds` (the noise-maker's job).
function lureGuard(guard, x, y, seconds) {
  guard.luredTo = { x, y };
  guard.lureTimer = seconds;
  guard.state = 'lured';
}

// One wall camera. Fixed to its mount; its cone sweeps around its base
// angle. Jammed cameras freeze grey and see nothing until the jam ends.
function createCamera(mount) {
  return {
    name: mount.name,
    x: mount.x,
    y: mount.y,
    baseAngle: mount.baseAngle,
    sweepPhase: Math.random() * Math.PI * 2,
    jamTimer: 0,
  };
}

// Advance one camera by dt seconds (frozen while jammed).
function updateCamera(camera, dt) {
  if (camera.jamTimer > 0) {
    camera.jamTimer -= dt;
    return;
  }
  camera.sweepPhase += dt * CAMERA_SWEEP_SPEED;
}

// The camera's current cone direction; frozen at the jam moment while jammed.
function cameraConeAngle(camera) {
  return camera.baseAngle + Math.sin(camera.sweepPhase) * CAMERA_SWEEP_AMPLITUDE;
}

// Jam every camera for `seconds`.
function jamCameras(cameras, seconds) {
  for (const camera of cameras) camera.jamTimer = seconds;
}

// True when a watcher at (ox, oy) with this cone can see the thief: inside
// the cone, line of sight clear, and the thief not hidden inside smoke.
function vaultWatcherSeesThief(ox, oy, angle, length, halfAngle, thief, vault, smokes) {
  if (!vaultInsideCone(ox, oy, angle, length, halfAngle, thief.x, thief.y)) return false;
  if (!vaultLineOfSightClear(ox, oy, thief.x, thief.y, vault)) return false;
  for (const smoke of smokes) {
    const dx = thief.x - smoke.x;
    const dy = thief.y - smoke.y;
    if (dx * dx + dy * dy < smoke.radius * smoke.radius) return false;
  }
  return true;
}

// Does this guard see the thief right now?
function guardSeesThief(guard, thief, vault, smokes) {
  return vaultWatcherSeesThief(
    guard.x, guard.y, guardConeAngle(guard),
    GUARD_CONE_LENGTH, GUARD_CONE_HALF_ANGLE,
    thief, vault, smokes
  );
}

// Does this camera see the thief right now? Jammed cameras are blind.
function cameraSeesThief(camera, thief, vault, smokes) {
  if (camera.jamTimer > 0) return false;
  return vaultWatcherSeesThief(
    camera.x, camera.y, cameraConeAngle(camera),
    CAMERA_CONE_LENGTH, CAMERA_CONE_HALF_ANGLE,
    thief, vault, smokes
  );
}
