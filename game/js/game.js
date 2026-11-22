// game.js — The Midnight Vault: state, input, rules, rendering, HUD.
// One room, one diamond, two guards, two cameras, three tools, one getaway.
// The thief grabs the diamond and reaches the green exit before the alarm
// fills — or a guard's hands do the talking.

(function startVaultGame() {
  const canvas = document.getElementById('vault-canvas');
  const ctx = canvas.getContext('2d');
  const sound = createSoundEngine();

  // --- the whole run's state, rebuilt by resetVaultRun() ---
  let vault;
  let guards;
  let cameras;
  let thief;
  let state; // 'title' | 'playing' | 'paused' | 'caught' | 'win'
  let alarm;
  let coins;
  let smokes;
  let noisePings;
  let jamTimer;
  let elapsed;
  let spottings;
  let alarmWasBelowWarn;
  let caughtReason;
  let winRating;
  let frozen;
  let timeNow;
  let keysDown;
  let moveTarget;
  let mouseAt;

  function resetVaultRun() {
    vault = buildVaultRoom();
    guards = vault.guardRoutes.map(createGuard);
    cameras = vault.cameraMounts.map(createCamera);
    thief = {
      x: vault.playerStart.x,
      y: vault.playerStart.y,
      r: THIEF_RADIUS,
      facing: -Math.PI / 2,
    };
    state = 'title';
    alarm = 0;
    coins = STARTING_COINS;
    smokes = [];
    noisePings = [];
    jamTimer = 0;
    elapsed = 0;
    spottings = 0;
    alarmWasBelowWarn = true;
    caughtReason = '';
    winRating = '';
    frozen = false;
    timeNow = 0;
    keysDown = {};
    moveTarget = null;
    mouseAt = { x: VAULT_WIDTH / 2, y: VAULT_HEIGHT / 2 };
  }

  resetVaultRun();

  // --- input: keyboard moves, mouse clicks move or lure, keys use tools ---

  function vaultKeyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    sound.ensure();
    const key = vaultKeyName(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (key === 'm') {
      sound.toggleMute();
      return;
    }
    if (state === 'title' && (key === 'Enter' || key === ' ')) {
      state = 'playing';
      return;
    }
    if ((state === 'caught' || state === 'win') && key === 'r') {
      resetVaultRun();
      state = 'playing';
      return;
    }
    if (state === 'playing' && key === 'p') {
      state = 'paused';
      return;
    }
    if (state === 'paused' && key === 'p') {
      state = 'playing';
      return;
    }
    if (state !== 'playing') return;
    keysDown[key] = true;
    if (key === '1') useVaultTool('smoke');
    if (key === '2') useVaultTool('noise');
    if (key === '3') useVaultTool('jammer');
  });

  window.addEventListener('keyup', (event) => {
    keysDown[vaultKeyName(event)] = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseAt = {
      x: ((event.clientX - rect.left) / rect.width) * VAULT_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VAULT_HEIGHT,
    };
  });

  canvas.addEventListener('mousedown', (event) => {
    sound.ensure();
    if (state === 'title') {
      state = 'playing';
      return;
    }
    if (state === 'caught' || state === 'win') return;
    if (state !== 'playing') return;
    moveTarget = { x: mouseAt.x, y: mouseAt.y };
  });

  // --- tools: smoke hides, noise lures, jammer blinds the cameras ---

  function useVaultTool(toolName) {
    const tool = VAULT_TOOLS[toolName];
    if (!tool || coins < tool.cost) {
      sound.tone(160, 120, 0.08, 'square', 0.25);
      return;
    }
    coins -= tool.cost;
    if (toolName === 'smoke') {
      smokes.push({ x: thief.x, y: thief.y, radius: tool.radius, timer: tool.duration });
      sound.smoke();
    } else if (toolName === 'noise') {
      noisePings.push({ x: mouseAt.x, y: mouseAt.y, timer: 0.8 });
      let nearest = null;
      let nearestDist = Infinity;
      for (const guard of guards) {
        const dx = guard.x - mouseAt.x;
        const dy = guard.y - mouseAt.y;
        const d = dx * dx + dy * dy;
        if (d < nearestDist) {
          nearestDist = d;
          nearest = guard;
        }
      }
      if (nearest) lureGuard(nearest, mouseAt.x, mouseAt.y, tool.lureSeconds);
      sound.noise();
    } else if (toolName === 'jammer') {
      jamCameras(cameras, tool.duration);
      jamTimer = tool.duration;
      sound.jam();
    }
  }

  // --- update: one tick of the heist, dt seconds ---

  function vaultThiefSeenNow() {
    for (const guard of guards) {
      if (guardSeesThief(guard, thief, vault, smokes)) return 'guard';
    }
    for (const camera of cameras) {
      if (cameraSeesThief(camera, thief, vault, smokes)) return 'camera';
    }
    return null;
  }

  function updateVault(dt) {
    timeNow += dt;
    elapsed += dt;

    // Move the thief: keys win over click-to-move, and clear the click target.
    let mx = 0;
    let my = 0;
    if (keysDown['w'] || keysDown['ArrowUp']) my -= 1;
    if (keysDown['s'] || keysDown['ArrowDown']) my += 1;
    if (keysDown['a'] || keysDown['ArrowLeft']) mx -= 1;
    if (keysDown['d'] || keysDown['ArrowRight']) mx += 1;
    if (mx !== 0 || my !== 0) {
      moveTarget = null;
      const len = Math.sqrt(mx * mx + my * my);
      const step = THIEF_SPEED * dt;
      vaultMoveCircle(thief, (mx / len) * step, (my / len) * step, vault);
      thief.facing = Math.atan2(my, mx);
      sound.step(timeNow * 1000);
    } else if (moveTarget) {
      const dx = moveTarget.x - thief.x;
      const dy = moveTarget.y - thief.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 6) {
        moveTarget = null;
      } else {
        const step = Math.min(dist, THIEF_SPEED * dt);
        vaultMoveCircle(thief, (dx / dist) * step, (dy / dist) * step, vault);
        thief.facing = Math.atan2(dy, dx);
        sound.step(timeNow * 1000);
      }
    }

    for (const guard of guards) updateGuard(guard, dt, timeNow);
    for (const camera of cameras) updateCamera(camera, dt);
    if (jamTimer > 0) jamTimer -= dt;
    for (const smoke of smokes) smoke.timer -= dt;
    smokes = smokes.filter((s) => s.timer > 0);
    for (const ping of noisePings) ping.timer -= dt;
    noisePings = noisePings.filter((p) => p.timer > 0);

    // The alarm: seen and it climbs, hidden and it drains.
    const seenBy = vaultThiefSeenNow();
    if (seenBy === 'guard') alarm += ALARM_GUARD_RATE * dt;
    else if (seenBy === 'camera') alarm += ALARM_CAMERA_RATE * dt;
    else alarm -= ALARM_DECAY_RATE * dt;
    alarm = vaultClamp(alarm, 0, 100);
    if (alarm >= ALARM_WARN_AT) {
      if (alarmWasBelowWarn) spottings += 1;
      alarmWasBelowWarn = false;
      sound.alarmBeep(timeNow * 1000);
    } else {
      alarmWasBelowWarn = true;
    }

    // A guard's hands: touching one ends the run on the spot.
    for (const guard of guards) {
      if (vaultCirclesTouch(thief.x, thief.y, thief.r, guard.x, guard.y, guard.r + 4)) {
        endVaultRun('caught', 'A guard grabbed you in the dark.');
        return;
      }
    }
    if (alarm >= ALARM_CAUGHT_AT) {
      endVaultRun('caught', 'The alarm hit 100% — the museum locked down.');
      return;
    }

    // Coins: walk over one to pocket it.
    for (const coin of vault.coins) {
      if (!coin.taken && vaultCirclesTouch(thief.x, thief.y, thief.r + 4, coin.x, coin.y, COIN_RADIUS)) {
        coin.taken = true;
        coins += 1;
        sound.pickup();
      }
    }

    // The diamond: touch the case and it is yours.
    if (!vault.loot.taken && vaultCirclesTouch(thief.x, thief.y, thief.r + 6, vault.loot.x, vault.loot.y, vault.loot.r)) {
      vault.loot.taken = true;
      sound.loot();
    }

    // The getaway: diamond in hand, reach the green door and you are gone.
    if (vault.loot.taken) {
      const exit = vault.exit;
      if (thief.x > exit.x - 6 && thief.x < exit.x + exit.w + 6 && thief.y > exit.y - 6 && thief.y < exit.y + exit.h + 6) {
        endVaultRun('win', '');
      }
    }
  }

  function endVaultRun(nextState, reason) {
    state = nextState;
    caughtReason = reason;
    if (nextState === 'win') {
      winRating = vaultRatingFor(elapsed, spottings);
      sound.win();
    } else {
      sound.caught();
    }
  }

  // --- rendering: the whole frame, HUD included ---

  function drawVaultCone(ox, oy, angle, length, halfAngle, fill, edge) {
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, length, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawVaultRoom() {
    const b = vault.bounds;
    // Floor: a quiet checker so the room reads as a hall, not a void.
    const tile = 40;
    for (let ty = b.y; ty < b.y + b.h; ty += tile) {
      for (let tx = b.x; tx < b.x + b.w; tx += tile) {
        const odd = (Math.floor((tx - b.x) / tile) + Math.floor((ty - b.y) / tile)) % 2 === 0;
        ctx.fillStyle = odd ? VAULT_COLORS.floorA : VAULT_COLORS.floorB;
        ctx.fillRect(tx, ty, tile, tile);
      }
    }
    // Gold inlay lines down the middle of the hall.
    ctx.strokeStyle = 'rgba(232, 182, 76, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h / 2);
    ctx.lineTo(b.x + b.w, b.y + b.h / 2);
    ctx.stroke();
    // The wall: a thick frame with a gold top edge.
    ctx.strokeStyle = VAULT_COLORS.wall;
    ctx.lineWidth = 10;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = VAULT_COLORS.goldDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
  }

  function drawVaultCover() {
    for (const rect of vault.cover) {
      if (rect.kind === 'case') {
        ctx.fillStyle = '#10182b';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = VAULT_COLORS.caseGlass;
        ctx.fillRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);
        ctx.strokeStyle = VAULT_COLORS.caseFrame;
        ctx.lineWidth = 3;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        if (rect.label) {
          ctx.fillStyle = VAULT_COLORS.gold;
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(rect.label.toUpperCase(), rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
        }
      } else {
        ctx.fillStyle = VAULT_COLORS.crate;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = VAULT_COLORS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.beginPath();
        ctx.moveTo(rect.x, rect.y);
        ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
        ctx.moveTo(rect.x + rect.w, rect.y);
        ctx.lineTo(rect.x, rect.y + rect.h);
        ctx.stroke();
      }
    }
    for (const pillar of vault.pillars) {
      ctx.beginPath();
      ctx.arc(pillar.x, pillar.y, pillar.r, 0, Math.PI * 2);
      ctx.fillStyle = VAULT_COLORS.pillar;
      ctx.fill();
      ctx.strokeStyle = VAULT_COLORS.wallTop;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pillar.x, pillar.y, pillar.r - 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(232, 182, 76, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawVaultLootAndExit() {
    const loot = vault.loot;
    const exit = vault.exit;
    // The getaway door, bottom right, lit green with a clear EXIT sign.
    ctx.fillStyle = '#0d2b1d';
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeStyle = VAULT_COLORS.exitGreen;
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = VAULT_COLORS.exitGreen;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 - 2);
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('GETAWAY VAN', exit.x + exit.w / 2, exit.y + exit.h / 2 + 14);
    // The diamond's case, top centre — glowing while the loot is still there.
    if (!loot.taken) {
      const pulse = 0.5 + 0.5 * Math.sin(timeNow * 3);
      ctx.beginPath();
      ctx.arc(loot.x, loot.y, loot.r + 14 + pulse * 4, 0, Math.PI * 2);
      ctx.fillStyle = VAULT_COLORS.diamondGlow;
      ctx.fill();
      ctx.save();
      ctx.translate(loot.x, loot.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = VAULT_COLORS.diamond;
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.restore();
    }
    // The loot's name is drawn after the watchers (see drawVaultLootLabel),
    // so a sweeping cone never paints over it.
    // Coins: small gold discs with a star cut.
    for (const coin of vault.coins) {
      if (coin.taken) continue;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, COIN_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = VAULT_COLORS.gold;
      ctx.fill();
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#7a5c14';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('¢', coin.x, coin.y + 4);
    }
  }

  // The diamond's label, drawn last so it stays readable over any cone.
  function drawVaultLootLabel() {
    const loot = vault.loot;
    ctx.textAlign = 'center';
    if (!loot.taken) {
      ctx.fillStyle = VAULT_COLORS.text;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(LOOT_NAME.toUpperCase(), loot.x, loot.y - 34);
    } else {
      ctx.fillStyle = VAULT_COLORS.textDim;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('CASE EMPTY', loot.x, loot.y - 30);
    }
  }

  function drawVaultWatchers() {
    // Cones first (under the people), then the watchers themselves.
    for (const guard of guards) {
      const angle = guardConeAngle(guard);
      drawVaultCone(guard.x, guard.y, angle, GUARD_CONE_LENGTH, GUARD_CONE_HALF_ANGLE,
        VAULT_COLORS.coneGuard, VAULT_COLORS.coneGuardEdge);
    }
    for (const camera of cameras) {
      const jammed = camera.jamTimer > 0;
      const angle = cameraConeAngle(camera);
      drawVaultCone(camera.x, camera.y, angle, CAMERA_CONE_LENGTH, CAMERA_CONE_HALF_ANGLE,
        jammed ? VAULT_COLORS.coneJammed : VAULT_COLORS.coneCamera,
        jammed ? 'rgba(150,150,150,0.4)' : VAULT_COLORS.coneCameraEdge);
    }
    for (const smoke of smokes) {
      ctx.beginPath();
      ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
      ctx.fillStyle = VAULT_COLORS.smoke;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(smoke.x - 30, smoke.y + 12, smoke.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(smoke.x + 32, smoke.y - 10, smoke.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const ping of noisePings) {
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 10 + (0.8 - ping.timer) * 30, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 240, 150, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const camera of cameras) {
      const jammed = camera.jamTimer > 0;
      ctx.fillStyle = jammed ? '#666' : '#a33';
      ctx.fillRect(camera.x - 9, camera.y - 9, 18, 18);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2;
      ctx.strokeRect(camera.x - 9, camera.y - 9, 18, 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      const cameraLabel = camera.name + (jammed ? ' JAMMED' : '');
      if (camera.y < 150) {
        // Top-wall camera: label above the mount, in the gap by the wall.
        ctx.textAlign = 'center';
        ctx.fillText(cameraLabel, camera.x, camera.y - 16);
      } else if (camera.x > VAULT_WIDTH - 140) {
        // Right-wall camera: label to the left so it never clips the edge.
        ctx.textAlign = 'right';
        ctx.fillText(cameraLabel, camera.x - 14, camera.y + 3);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(cameraLabel, camera.x + 14, camera.y + 3);
      }
    }
    for (const guard of guards) {
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, guard.r, 0, Math.PI * 2);
      ctx.fillStyle = guard.state === 'lured' ? '#7c5a1e' : VAULT_COLORS.guard;
      ctx.fill();
      ctx.strokeStyle = VAULT_COLORS.guardTrim;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Facing tick: a short torch beam stub.
      const angle = guardConeAngle(guard);
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(angle) * (guard.r + 8), guard.y + Math.sin(angle) * (guard.r + 8));
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = VAULT_COLORS.text;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(guard.name.toUpperCase(), guard.x, guard.y - guard.r - 8);
    }
    // The thief: a dark hood with a gold trim and a facing tick.
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, thief.r, 0, Math.PI * 2);
    ctx.fillStyle = VAULT_COLORS.thief;
    ctx.fill();
    ctx.strokeStyle = VAULT_COLORS.thiefTrim;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(thief.x, thief.y);
    ctx.lineTo(thief.x + Math.cos(thief.facing) * (thief.r + 7), thief.y + Math.sin(thief.facing) * (thief.r + 7));
    ctx.strokeStyle = VAULT_COLORS.thiefTrim;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = VAULT_COLORS.text;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', thief.x, thief.y - thief.r - 8);
    if (moveTarget) {
      ctx.beginPath();
      ctx.arc(moveTarget.x, moveTarget.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(242, 234, 216, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // --- HUD: alarm meter, loot, coins, tools, timer — always on screen ---

  function drawVaultHud() {
    ctx.fillStyle = '#0d1220';
    ctx.fillRect(0, 0, VAULT_WIDTH, VAULT_HUD_HEIGHT);
    ctx.strokeStyle = VAULT_COLORS.goldDim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, VAULT_HUD_HEIGHT);
    ctx.lineTo(VAULT_WIDTH, VAULT_HUD_HEIGHT);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = VAULT_COLORS.gold;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('THE MIDNIGHT VAULT', 16, 27);
    ctx.fillStyle = VAULT_COLORS.textDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Steal the diamond. Reach the green exit.', 16, 48);

    // Alarm meter: the big bar in the middle of the HUD.
    const meterX = 470;
    const meterY = 18;
    const meterW = 300;
    const meterH = 20;
    ctx.fillStyle = VAULT_COLORS.text;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', meterX, meterY - 5);
    ctx.fillStyle = '#10182b';
    ctx.fillRect(meterX, meterY, meterW, meterH);
    const alarmColor = alarm < 40 ? '#39d98a' : alarm < ALARM_WARN_AT ? '#e8b64c' : '#e5484d';
    ctx.fillStyle = alarmColor;
    ctx.fillRect(meterX, meterY, meterW * (alarm / 100), meterH);
    ctx.strokeStyle = VAULT_COLORS.textDim;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(meterX, meterY, meterW, meterH);
    ctx.fillStyle = VAULT_COLORS.text;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(Math.round(alarm) + '%', meterX + meterW + 10, meterY + 15);
    if (vaultThiefSeenNow() && state === 'playing') {
      ctx.fillStyle = '#e5484d';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('SPOTTED!', meterX, meterY + 38);
    }

    // Loot status, coins, tools and the clock on the right.
    ctx.textAlign = 'left';
    ctx.fillStyle = vault.loot.taken ? VAULT_COLORS.diamond : VAULT_COLORS.textDim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(vault.loot.taken ? '◆ DIAMOND: STOLEN' : '◇ DIAMOND: IN CASE', 820, 24);
    ctx.fillStyle = VAULT_COLORS.gold;
    ctx.fillText('● Coins: ' + coins, 820, 46);
    ctx.fillStyle = VAULT_COLORS.text;
    ctx.font = '12px system-ui, sans-serif';
    // Short tool names: the full names do not fit the HUD's right block.
    const toolShortName = { smoke: 'Smoke', noise: 'Noise', jammer: 'Jammer' };
    let toolText = '';
    for (const name of VAULT_TOOL_ORDER) {
      const tool = VAULT_TOOLS[name];
      toolText += '[' + tool.key + '] ' + toolShortName[name] + ' ' + tool.cost + '¢   ';
    }
    ctx.fillText(toolText, 1000, 24);
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    ctx.fillText('Time ' + minutes + ':' + String(seconds).padStart(2, '0') + '    P pause    M sound', 1000, 46);
  }

  // --- overlays: title, pause, caught, win ---

  function drawVaultOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(5, 8, 16, 0.78)';
    ctx.fillRect(0, VAULT_HUD_HEIGHT, VAULT_WIDTH, VAULT_HEIGHT - VAULT_HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || VAULT_COLORS.gold;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(title, VAULT_WIDTH / 2, 260);
    ctx.fillStyle = VAULT_COLORS.text;
    ctx.font = '18px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VAULT_WIDTH / 2, 310 + i * 30);
    });
  }

  function drawVaultFrame() {
    ctx.fillStyle = VAULT_COLORS.page;
    ctx.fillRect(0, 0, VAULT_WIDTH, VAULT_HEIGHT);
    drawVaultRoom();
    drawVaultLootAndExit();
    drawVaultCover();
    drawVaultWatchers();
    drawVaultLootLabel();
    drawVaultHud();
    if (state === 'title') {
      drawVaultOverlay('THE MIDNIGHT VAULT', [
        'One room. Two guards. Two cameras. One diamond.',
        'WASD / arrows to move — or click where to sneak.  1 smoke  •  2 noise-maker  •  3 jammer',
        'Grab the Star of Meridia, then reach the green EXIT before the alarm fills.',
        'Click or press Enter to start',
      ]);
    } else if (state === 'paused') {
      drawVaultOverlay('PAUSED', ['The guards wait for no one. Well — right now they do.', 'Press P to keep sneaking.'], VAULT_COLORS.text);
    } else if (state === 'caught') {
      drawVaultOverlay('CAUGHT!', [
        caughtReason,
        'The vault keeps its diamond tonight. Press R to try again.',
      ], '#e5484d');
    } else if (state === 'win') {
      const minutes = Math.floor(elapsed / 60);
      const seconds = Math.floor(elapsed % 60);
      drawVaultOverlay('CLEAN GETAWAY!', [
        'The Star of Meridia is yours. Rating: ' + winRating,
        'Time ' + minutes + ':' + String(seconds).padStart(2, '0') + '  •  Spotted ' + spottings + ' time(s)  •  Coins left: ' + coins,
        'Press R to run the vault again.',
      ], VAULT_COLORS.exitGreen);
    }
  }

  // --- main loop ---

  let lastFrameAt = 0;
  function vaultFrame(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastFrameAt) / 1000 || 0);
    lastFrameAt = timestamp;
    if (state === 'playing' && !frozen) updateVault(dt);
    drawVaultFrame();
    requestAnimationFrame(vaultFrame);
  }
  requestAnimationFrame(vaultFrame);

  // --- staging API for screenshots and tests (window.HeistGame) ---
  // stage('title' | 'approach' | 'cone-close' | 'loot-getaway' | 'win'):
  // puts the game in a fixed, frozen pose so a screenshot is deterministic.

  function stageVaultShot(name) {
    resetVaultRun();
    frozen = true;
    if (name === 'title') {
      state = 'title';
      return;
    }
    state = 'playing';
    if (name === 'approach') {
      thief.x = 470;
      thief.y = 560;
      thief.facing = -Math.PI / 2;
      guards[0].x = 560;
      guards[0].y = 260;
      guards[0].facing = Math.PI;
      guards[0].sweepPhase = 0.4;
      guards[1].x = 700;
      guards[1].y = 470;
      guards[1].facing = 0;
      guards[1].sweepPhase = -0.3;
      alarm = 12;
      coins = 4;
    } else if (name === 'cone-close') {
      thief.x = 700;
      thief.y = 300;
      thief.facing = Math.PI;
      guards[0].x = 560;
      guards[0].y = 260;
      guards[0].facing = 0.35;
      guards[0].sweepPhase = 0;
      guards[1].x = 900;
      guards[1].y = 470;
      guards[1].facing = Math.PI;
      guards[1].sweepPhase = 0.2;
      smokes.push({ x: 660, y: 330, radius: 95, timer: 3.5 });
      alarm = 71;
      coins = 2;
    } else if (name === 'loot-getaway') {
      vault.loot.taken = true;
      thief.x = 980;
      thief.y = 560;
      thief.facing = Math.PI / 4;
      guards[0].x = 800;
      guards[0].y = 260;
      guards[0].facing = Math.PI;
      guards[0].sweepPhase = -0.5;
      guards[1].x = 700;
      guards[1].y = 470;
      guards[1].facing = 0;
      guards[1].sweepPhase = 0.5;
      cameras[1].jamTimer = 4;
      alarm = 48;
      coins = 1;
      elapsed = 73;
    } else if (name === 'win') {
      vault.loot.taken = true;
      thief.x = 1160;
      thief.y = 660;
      endVaultRun('win', '');
      elapsed = 83;
      spottings = 0;
      coins = 2;
    }
  }

  window.HeistGame = {
    stage: stageVaultShot,
    snapshot: function vaultSnapshot() {
      return {
        state,
        alarm: Math.round(alarm),
        coins,
        lootTaken: vault.loot.taken,
        thief: { x: Math.round(thief.x), y: Math.round(thief.y) },
        smokes: smokes.length,
        jamTimer: Math.max(0, jamTimer),
        camerasJammed: cameras.every((c) => c.jamTimer > 0),
        elapsed: Math.round(elapsed),
        guards: guards.map((g) => ({ name: g.name, x: Math.round(g.x), y: Math.round(g.y), state: g.state })),
      };
    },
    // Test hooks: drive the game without real keys.
    pressKey: function vaultPressKey(key) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    },
    setMoveTarget: function vaultSetMoveTarget(x, y) {
      moveTarget = { x, y };
    },
    unfreeze: function vaultUnfreeze() {
      frozen = false;
    },
  };
})();
