// AGENT SOCIETY — REAL-TIME PLAYABLE PIXEL-ART 3D FLOATING-ISLAND GAME ENGINE
// Inspired by Tripo3D "Love All: Pixel-Art 3D Tennis Club Game" & Gamoji 6-Role Diorama
// Features:
// - Direct WASD / Arrow / Click-to-Move player control
// - 9 autonomous AI agents walking, harvesting, crafting, trading & rallying on the pixel court in real time
// - Physical bouncing pixel coins, wheat, gears, lightning beams & speech bubbles
// - Live Pixel Tennis / Civic Rally mini-game on the Town Hall Clubhouse Court

window.IsometricSocietyScene = class IsometricSocietyScene {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.pixelCanvas = document.createElement('canvas');
    this.pixelCtx = this.pixelCanvas.getContext('2d');

    this.camera = {
      x: 0,
      y: 10,
      zoom: 1.08,
      followPlayer: true,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      hasMoved: false
    };

    this.time = 0;
    this.lastTs = performance.now();
    this.society = null;
    this.playerAgentId = 'farmer-1';
    this.pixelScale = 2; // 2x crisp 16-bit pixel shader
    this.weatherMode = 'sunny';

    // Real-time agent physics entities: id -> { x, y, vx, vy, targetX, targetY, facing, aiTimer, speech, speechTimer, actionAnim }
    this.entities = {};
    // Physical bouncing collectible particles (coins, wheat, gears, sparks)
    this.particles = [];
    // Floating combat/reward text popups
    this.floatingPopups = [];
    // Lightning / ascension beams
    this.beams = [];

    // Live Pixel Tennis / Civic Rally ball on the Town Hall Court island (x: 230, y: 185)
    this.courtBall = {
      x: 230,
      y: 175,
      z: 12,
      vx: 55,
      vy: 22,
      vz: 45,
      rallyCount: 0
    };

    // Island definitions & interactive hotspot zones
    this.islands = {
      'farmstead': {
        id: 'farmstead',
        x: -255,
        y: -155,
        title: 'FARMSTEAD FIELDS',
        color: '#4ade80',
        prompt: 'Harvest Golden Wheat (+Wage GCOIN & +5 Rations)',
        actionType: 'harvest'
      },
      'workshop': {
        id: 'workshop',
        x: 255,
        y: -155,
        title: 'ENGINEER WORKSHOP',
        color: '#38bdf8',
        prompt: 'Craft Storage & Irrigation Blueprint (+Wage GCOIN & +Tech)',
        actionType: 'craft'
      },
      'lineage-hall': {
        id: 'lineage-hall',
        x: -375,
        y: 15,
        title: 'LINEAGE SHRINE',
        color: '#c084fc',
        prompt: 'Ascend to Gen +1 Heir (+10% Permanent Wage Mastery)',
        actionType: 'handover'
      },
      'market-exchange': {
        id: 'market-exchange',
        x: 375,
        y: 15,
        title: 'GCOIN MARKET BRIDGE',
        color: '#fbbf24',
        prompt: 'Trade Goods & Eat Ration (+45% Stamina & +Sales Power)',
        actionType: 'trade'
      },
      'charter-court': {
        id: 'charter-court',
        x: -230,
        y: 185,
        title: 'ARCHON CHARTER COURT',
        color: '#f472b6',
        prompt: 'Enact / Cycle Colony Charter Law (Archon Decree)',
        actionType: 'law'
      },
      'town-hall': {
        id: 'town-hall',
        x: 230,
        y: 185,
        title: 'PIXEL CLUBHOUSE & COURT',
        color: '#34d399',
        prompt: 'Play Civic Rally on the Court (+Harmony & +Wage GCOIN)',
        actionType: 'rally'
      },
      'core': {
        id: 'core',
        x: 0,
        y: 5,
        title: 'GCOIN TREASURY CORE',
        color: '#22d3ee',
        prompt: 'Upgrade Floating Island Level (15 Treasury GCOIN)',
        actionType: 'upgrade'
      }
    };

    this.clouds = [
      { x: -580, y: -310, w: 92, h: 28, speed: 14 },
      { x: -180, y: -350, w: 116, h: 34, speed: 10 },
      { x: 240, y: -320, w: 98, h: 28, speed: 15 },
      { x: 520, y: -260, w: 80, h: 24, speed: 12 },
      { x: -490, y: 260, w: 92, h: 26, speed: 11 },
      { x: 430, y: 285, w: 102, h: 30, speed: 13 }
    ];

    this.rainDrops = Array.from({ length: 80 }, (_, i) => ({
      x: ((i * 97) % 1400) - 700,
      y: ((i * 61) % 860) - 430,
      speed: 280 + (i % 5) * 35
    }));

    this._loadSprites();
    this._bindEvents();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._startLoop();
  }

  _loadSprites() {
    this.sprites = {};
    const manifest = {
      pixelFarmer: './assets/sprites/pixel-farmer.png',
      pixelEngineer: './assets/sprites/pixel-engineer.png',
      pixelManager: './assets/sprites/pixel-manager.png',
      pixelArchon: './assets/sprites/pixel-archon.png',
      pixelCastle: './assets/sprites/pixel-castle.png',
      pixelWorkstation: './assets/sprites/pixel-workstation.png',
      pixelBridge: './assets/sprites/pixel-bridge.png',
      pixelMonolith: './assets/sprites/pixel-monolith.png',
      pixelClubhouse: './assets/sprites/pixel-clubhouse.png',
      pixelTree: './assets/sprites/pixel-tree.png',
      ancestorSvg: './assets/sprites/char-ancestor.svg'
    };
    Object.entries(manifest).forEach(([k, src]) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      this.sprites[k] = img;
    });
  }

  _isReady(key) {
    const img = this.sprites[key];
    return Boolean(img && img.complete && img.naturalWidth > 0);
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth || 1280;
    this.height = window.innerHeight || 760;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.dpr = dpr;
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.camera.isDragging = true;
      this.camera.hasMoved = false;
      this.camera.dragStartX = e.clientX - this.camera.x;
      this.camera.dragStartY = e.clientY - this.camera.y;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.camera.isDragging) return;
      const nx = e.clientX - this.camera.dragStartX;
      const ny = e.clientY - this.camera.dragStartY;
      if (Math.hypot(nx - this.camera.x, ny - this.camera.y) > 6) {
        this.camera.hasMoved = true;
        this.camera.followPlayer = false;
      }
      if (this.camera.hasMoved) {
        this.camera.x = nx;
        this.camera.y = ny;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.camera.isDragging && !this.camera.hasMoved) {
        const pt = this._screenToWorld(e.clientX, e.clientY);
        this._handleWorldClick(pt.x, pt.y);
      }
      this.camera.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.09 : 0.92;
      this.camera.zoom = Math.max(0.65, Math.min(2.1, this.camera.zoom * factor));
    }, { passive: false });
  }

  _screenToWorld(sx, sy) {
    const cx = this.width * 0.5 + this.camera.x;
    const cy = this.height * 0.5 + this.camera.y;
    return {
      x: (sx - cx) / this.camera.zoom,
      y: (sy - cy) / this.camera.zoom
    };
  }

  _handleWorldClick(wx, wy) {
    if (!this.society) return;

    // 1. Check if user clicked directly on another agent to switch control to them
    for (const lin of this.society.lineages) {
      const ent = this.entities[lin.id];
      if (!ent) continue;
      if (Math.hypot(wx - ent.x, wy - (ent.y - 16)) < 24 && lin.id !== this.playerAgentId) {
        if (this.callbacks.onSelectAgent) {
          this.callbacks.onSelectAgent(lin.id);
        }
        return;
      }
    }

    // 2. Otherwise walk the player character to the clicked world coordinate!
    const playerEnt = this.entities[this.playerAgentId];
    if (playerEnt) {
      playerEnt.targetX = Math.max(-520, Math.min(520, wx));
      playerEnt.targetY = Math.max(-270, Math.min(270, wy));
      this.camera.followPlayer = true;
      // Spawn click ripple particle
      this.spawnBurst(wx, wy, '#fde047', 4);
    }
  }

  setSociety(society) {
    this.society = society;
    this._syncEntities();
  }

  setPlayerAgent(agentId) {
    this.playerAgentId = agentId;
    this.camera.followPlayer = true;
  }

  _syncEntities() {
    if (!this.society) return;
    const roleIslands = {
      farmer: 'farmstead',
      engineer: 'workshop',
      manager: 'town-hall'
    };

    this.society.lineages.forEach((lin, idx) => {
      if (!this.entities[lin.id]) {
        const homeId = roleIslands[lin.role] || 'town-hall';
        const isl = this.islands[homeId];
        const angle = (idx / this.society.lineages.length) * Math.PI * 2;
        const ox = Math.cos(angle) * 38;
        const oy = Math.sin(angle) * 20 + 8;
        this.entities[lin.id] = {
          id: lin.id,
          x: isl.x + ox,
          y: isl.y + oy,
          vx: 0,
          vy: 0,
          targetX: null,
          targetY: null,
          facing: 1,
          aiTimer: 1.5 + (idx % 4) * 0.8,
          speech: '',
          speechTimer: 0,
          actionAnim: 0
        };
      }
    });
  }

  getPlayerEntity() {
    return this.entities[this.playerAgentId];
  }

  // Find the nearest interactive island hotspot within interaction distance of the player
  getNearestHotspot() {
    const ent = this.getPlayerEntity();
    if (!ent) return null;
    let best = null;
    let bestDist = 92; // activation radius
    Object.values(this.islands).forEach((isl) => {
      const d = Math.hypot(ent.x - isl.x, ent.y - isl.y);
      if (d < bestDist) {
        bestDist = d;
        best = isl;
      }
    });
    return best;
  }

  spawnFloatingPopup(x, y, text, color = '#fde047') {
    this.floatingPopups.push({
      x: x + (Math.random() - 0.5) * 24,
      y,
      text,
      color,
      createdAt: this.time,
      duration: 2.0
    });
  }

  spawnSpeech(agentId, text, duration = 3.2) {
    const ent = this.entities[agentId];
    if (!ent) return;
    ent.speech = text;
    ent.speechTimer = duration;
  }

  spawnBurst(x, y, color = '#fde047', count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 65;
      this.particles.push({
        x,
        y,
        z: 6 + Math.random() * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.6,
        vz: 60 + Math.random() * 80,
        color,
        size: 4 + (i % 3),
        life: 0.75 + Math.random() * 0.45,
        age: 0
      });
    }
  }

  spawnAscensionBeam(x, y, color = '#c084fc') {
    this.beams.push({
      x,
      y,
      color,
      createdAt: this.time,
      duration: 1.2
    });
    this.spawnBurst(x, y, color, 18);
  }

  triggerPlayerActionAnim() {
    const ent = this.getPlayerEntity();
    if (ent) ent.actionAnim = 0.45;
  }

  cyclePixelMode() {
    this.pixelScale = this.pixelScale === 2 ? 3 : this.pixelScale === 3 ? 1 : 2;
    return this.pixelScale;
  }

  cycleWeatherMode() {
    const order = ['sunny', 'sunset', 'rain', 'night'];
    this.weatherMode = order[(order.indexOf(this.weatherMode) + 1) % order.length];
    return this.weatherMode;
  }

  _startLoop() {
    const tick = (ts) => {
      const dt = Math.min(0.05, (ts - this.lastTs) * 0.001);
      this.lastTs = ts;
      this.time = ts * 0.001;
      this._updatePhysics(dt);
      this.render();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _updatePhysics(dt) {
    if (!this.society) return;

    // 1. Update Player WASD / Click-to-Move movement
    const keys = this.callbacks.getKeys ? this.callbacks.getKeys() : {};
    const playerEnt = this.getPlayerEntity();
    if (playerEnt) {
      let dx = 0;
      let dy = 0;
      if (keys.KeyW || keys.ArrowUp) dy -= 1;
      if (keys.KeyS || keys.ArrowDown) dy += 1;
      if (keys.KeyA || keys.ArrowLeft) dx -= 1;
      if (keys.KeyD || keys.ArrowRight) dx += 1;

      const moveSpeed = 135;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        playerEnt.vx = (dx / len) * moveSpeed;
        playerEnt.vy = (dy / len) * moveSpeed;
        playerEnt.targetX = null;
        playerEnt.targetY = null;
        this.camera.followPlayer = true;
      } else if (playerEnt.targetX !== null && playerEnt.targetY !== null) {
        const tdx = playerEnt.targetX - playerEnt.x;
        const tdy = playerEnt.targetY - playerEnt.y;
        const dist = Math.hypot(tdx, tdy);
        if (dist > 5) {
          playerEnt.vx = (tdx / dist) * moveSpeed;
          playerEnt.vy = (tdy / dist) * moveSpeed;
        } else {
          playerEnt.targetX = null;
          playerEnt.targetY = null;
          playerEnt.vx = 0;
          playerEnt.vy = 0;
        }
      } else {
        playerEnt.vx *= 0.75;
        playerEnt.vy *= 0.75;
      }

      playerEnt.x = Math.max(-520, Math.min(520, playerEnt.x + playerEnt.vx * dt));
      playerEnt.y = Math.max(-270, Math.min(270, playerEnt.y + playerEnt.vy * dt));
      if (Math.abs(playerEnt.vx) > 5) {
        playerEnt.facing = playerEnt.vx > 0 ? 1 : -1;
      }

      // Smoothly pan camera toward player when followPlayer is true
      if (this.camera.followPlayer) {
        const desiredX = -playerEnt.x * this.camera.zoom * 0.38;
        const desiredY = -playerEnt.y * this.camera.zoom * 0.38 + 10;
        this.camera.x += (desiredX - this.camera.x) * Math.min(1, dt * 5);
        this.camera.y += (desiredY - this.camera.y) * Math.min(1, dt * 5);
      }
    }

    // 2. Update Autonomous AI Agents (walk between islands, work, trade, chat)
    const islandList = Object.values(this.islands);
    this.society.lineages.forEach((lin) => {
      const ent = this.entities[lin.id];
      if (!ent) return;
      if (ent.speechTimer > 0) ent.speechTimer = Math.max(0, ent.speechTimer - dt);
      if (ent.actionAnim > 0) ent.actionAnim = Math.max(0, ent.actionAnim - dt);

      if (lin.id === this.playerAgentId) return;

      ent.aiTimer -= dt;
      if (ent.aiTimer <= 0) {
        ent.aiTimer = 3.2 + Math.random() * 4.0;
        // Decide where this AI agent wants to walk:
        // Hungry -> Market Bridge; High tokens -> Lineage Shrine; Otherwise -> Home Island or Core
        let destIsl = this.islands[lin.homeDistrictId] || this.islands['town-hall'];
        if ((lin.stamina ?? 85) < 55) {
          destIsl = this.islands['market-exchange'];
        } else if (lin.contextTokens > 8200) {
          destIsl = this.islands['lineage-hall'];
        } else if (Math.random() < 0.28) {
          destIsl = islandList[Math.floor(Math.random() * islandList.length)];
        }
        ent.targetX = destIsl.x + (Math.random() - 0.5) * 76;
        ent.targetY = destIsl.y + (Math.random() - 0.5) * 38 + 6;
      }

      if (ent.targetX !== null && ent.targetY !== null) {
        const dx = ent.targetX - ent.x;
        const dy = ent.targetY - ent.y;
        const dist = Math.hypot(dx, dy);
        const aiSpeed = 68;
        if (dist > 4) {
          ent.vx = (dx / dist) * aiSpeed;
          ent.vy = (dy / dist) * aiSpeed;
          ent.x += ent.vx * dt;
          ent.y += ent.vy * dt;
          if (Math.abs(ent.vx) > 2) ent.facing = ent.vx > 0 ? 1 : -1;
        } else {
          ent.targetX = null;
          ent.targetY = null;
          ent.vx = 0;
          ent.vy = 0;
        }
      }
    });

    // 3. Update Live Pixel Tennis / Civic Rally Ball on the Town Hall Court (x: 230, y: 185)
    const b = this.courtBall;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.vz -= 190 * dt; // gravity
    if (b.z <= 0) {
      b.z = 0;
      b.vz = 72; // bounce on turf
    }
    // Bounce back and forth between left & right sides of the pixel court
    if (b.x > 268) {
      b.x = 268;
      b.vx = -Math.abs(b.vx);
      b.vy = (Math.random() - 0.5) * 28;
      b.vz = 82;
    } else if (b.x < 192) {
      b.x = 192;
      b.vx = Math.abs(b.vx);
      b.vy = (Math.random() - 0.5) * 28;
      b.vz = 82;
    }

    // 4. Update 3D Bouncing Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 240 * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz = Math.abs(p.vz) * 0.55;
        p.vx *= 0.7;
        p.vy *= 0.7;
      }
    }
  }

  render() {
    const pScale = this.pixelScale || 1;
    const usePixelShader = pScale > 1;

    let targetCtx = this.ctx;
    if (usePixelShader) {
      const pw = Math.max(320, Math.floor(this.width / pScale));
      const ph = Math.max(200, Math.floor(this.height / pScale));
      if (this.pixelCanvas.width !== pw || this.pixelCanvas.height !== ph) {
        this.pixelCanvas.width = pw;
        this.pixelCanvas.height = ph;
      }
      targetCtx = this.pixelCtx;
      targetCtx.save();
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.scale(1 / pScale, 1 / pScale);
    } else {
      targetCtx.save();
      targetCtx.scale(this.dpr, this.dpr);
      targetCtx.imageSmoothingEnabled = false;
    }

    this._renderWorld(targetCtx);
    targetCtx.restore();

    if (usePixelShader) {
      const mainCtx = this.ctx;
      mainCtx.save();
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      mainCtx.drawImage(
        this.pixelCanvas,
        0,
        0,
        this.pixelCanvas.width,
        this.pixelCanvas.height,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      if (pScale >= 3) {
        mainCtx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        for (let y = 0; y < this.canvas.height; y += 4) {
          mainCtx.fillRect(0, y, this.canvas.width, 1.5);
        }
      }
      mainCtx.restore();
    }
  }

  _renderWorld(ctx) {
    this._drawSkyAndWeather(ctx);

    ctx.save();
    ctx.translate(this.width * 0.5 + this.camera.x, this.height * 0.5 + this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.imageSmoothingEnabled = false;

    this._drawClouds(ctx, 'back');
    this._drawBridgesAndConduits(ctx);

    const nearestHotspot = this.getNearestHotspot();

    // Back Islands
    this._drawFloatingIsland(ctx, 'farmstead', nearestHotspot);
    this._drawFloatingIsland(ctx, 'workshop', nearestHotspot);

    // Mid Islands + Central Core
    this._drawFloatingIsland(ctx, 'lineage-hall', nearestHotspot);
    this._drawFloatingIsland(ctx, 'market-exchange', nearestHotspot);
    this._drawCentralCoreIsland(ctx, nearestHotspot);

    // Front Islands
    this._drawFloatingIsland(ctx, 'charter-court', nearestHotspot);
    this._drawFloatingIsland(ctx, 'town-hall', nearestHotspot);

    // Y-sorted render of all 10 Agents + Court Tennis Ball + Particles
    this._drawAgentsAndParticles(ctx);

    // Ascension beams & floating popups
    this._drawBeamsAndPopups(ctx);

    this._drawClouds(ctx, 'front');
    this._drawRain(ctx);

    ctx.restore();
  }

  _drawSkyAndWeather(ctx) {
    const w = this.width;
    const h = this.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.weatherMode === 'sunny') {
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.45, '#38bdf8');
      grad.addColorStop(0.82, '#7dd3fc');
      grad.addColorStop(1, '#bae6fd');
    } else if (this.weatherMode === 'sunset') {
      grad.addColorStop(0, '#311042');
      grad.addColorStop(0.38, '#9d174d');
      grad.addColorStop(0.72, '#f97316');
      grad.addColorStop(1, '#fde047');
    } else if (this.weatherMode === 'rain') {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#475569');
    } else {
      grad.addColorStop(0, '#050814');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (this.weatherMode === 'sunny' || this.weatherMode === 'sunset') {
      const sx = Math.round(w * 0.84);
      const sy = Math.round(h * 0.14);
      ctx.fillStyle = this.weatherMode === 'sunny' ? 'rgba(253, 224, 71, 0.3)' : 'rgba(251, 146, 60, 0.35)';
      ctx.fillRect(sx - 36, sy - 36, 72, 72);
      ctx.fillStyle = this.weatherMode === 'sunny' ? '#fef08a' : '#fb923c';
      ctx.fillRect(sx - 20, sy - 20, 40, 40);
    } else {
      for (let i = 0; i < 45; i++) {
        const sx = (i * 179) % w;
        const sy = (i * 97) % Math.floor(h * 0.7);
        const s = Math.sin(this.time * 2.5 + i) > 0 ? 4 : 2;
        ctx.fillStyle = i % 3 === 0 ? '#67e8f9' : '#ffffff';
        ctx.fillRect(sx, sy, s, s);
      }
    }
  }

  _drawClouds(ctx, layer) {
    if (this.weatherMode === 'night') return;
    const col = this.weatherMode === 'sunset'
      ? { top: '#fed7aa', mid: '#fdba74', bot: '#f97316' }
      : this.weatherMode === 'rain'
        ? { top: '#94a3b8', mid: '#64748b', bot: '#475569' }
        : { top: '#ffffff', mid: '#e0f2fe', bot: '#bae6fd' };

    this.clouds.forEach((c, idx) => {
      if ((layer === 'back' && idx >= 4) || (layer === 'front' && idx < 4)) return;
      const cx = ((c.x + this.time * c.speed + 780) % 1560) - 780;
      const cy = c.y + Math.sin(this.time + idx) * 4;
      ctx.fillStyle = col.bot;
      ctx.fillRect(cx - c.w * 0.5, cy, c.w, c.h * 0.5);
      ctx.fillStyle = col.mid;
      ctx.fillRect(cx - c.w * 0.4, cy - c.h * 0.35, c.w * 0.8, c.h * 0.55);
      ctx.fillStyle = col.top;
      ctx.fillRect(cx - c.w * 0.25, cy - c.h * 0.65, c.w * 0.5, c.h * 0.5);
    });
  }

  _drawRain(ctx) {
    if (this.weatherMode !== 'rain') return;
    ctx.fillStyle = '#7dd3fc';
    this.rainDrops.forEach((d) => {
      const rx = ((d.x - this.time * 85 + 700) % 1400) - 700;
      const ry = ((d.y + this.time * d.speed + 430) % 860) - 430;
      ctx.fillRect(rx, ry, 2, 4);
      ctx.fillRect(rx - 2, ry + 4, 2, 4);
    });
  }

  // Walkable wooden/neon pixel bridges connecting the floating islands to the Central Core
  _drawBridgesAndConduits(ctx) {
    const core = this.islands['core'];
    ['farmstead', 'workshop', 'lineage-hall', 'market-exchange', 'charter-court', 'town-hall'].forEach((id, idx) => {
      const isl = this.islands[id];
      const steps = 16;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const bx = core.x + (isl.x - core.x) * t;
        const by = (core.y + 8) + (isl.y - core.y) * t;
        // Stepped pixel plank + glowing rail
        ctx.fillStyle = '#78350f';
        ctx.fillRect(bx - 12, by - 4, 24, 8);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(bx - 10, by - 3, 20, 5);
        const pulse = ((Math.floor(this.time * 6) + s + idx) % 6) === 0;
        ctx.fillStyle = pulse ? '#fde047' : isl.color;
        ctx.fillRect(bx - 12, by - 4, 3, 3);
        ctx.fillRect(bx + 9, by + 1, 3, 3);
      }
    });
  }

  _drawIsoPlatform(ctx, cx, cy, halfW, halfD, height, colors) {
    const topPts = [
      { x: cx, y: cy - halfD },
      { x: cx + halfW, y: cy },
      { x: cx, y: cy + halfD },
      { x: cx - halfW, y: cy }
    ];

    if (colors.shadow) {
      ctx.fillStyle = colors.shadow;
      ctx.beginPath();
      ctx.moveTo(cx, cy - halfD + height + 14);
      ctx.lineTo(cx + halfW + 14, cy + height + 14);
      ctx.lineTo(cx, cy + halfD + height + 20);
      ctx.lineTo(cx - halfW - 14, cy + height + 14);
      ctx.closePath();
      ctx.fill();
    }

    // Left face
    ctx.beginPath();
    ctx.moveTo(topPts[3].x, topPts[3].y);
    ctx.lineTo(topPts[2].x, topPts[2].y);
    ctx.lineTo(topPts[2].x, topPts[2].y + height);
    ctx.lineTo(topPts[3].x, topPts[3].y + height);
    ctx.closePath();
    ctx.fillStyle = colors.left;
    ctx.fill();
    ctx.strokeStyle = colors.stroke || '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Right face
    ctx.beginPath();
    ctx.moveTo(topPts[2].x, topPts[2].y);
    ctx.lineTo(topPts[1].x, topPts[1].y);
    ctx.lineTo(topPts[1].x, topPts[1].y + height);
    ctx.lineTo(topPts[2].x, topPts[2].y + height);
    ctx.closePath();
    ctx.fillStyle = colors.right;
    ctx.fill();
    ctx.stroke();

    // Top face
    ctx.beginPath();
    ctx.moveTo(topPts[0].x, topPts[0].y);
    ctx.lineTo(topPts[1].x, topPts[1].y);
    ctx.lineTo(topPts[2].x, topPts[2].y);
    ctx.lineTo(topPts[3].x, topPts[3].y);
    ctx.closePath();
    ctx.fillStyle = colors.top;
    ctx.fill();
    ctx.strokeStyle = colors.topStroke || '#0f172a';
    ctx.lineWidth = colors.topStrokeWidth || 1.8;
    ctx.stroke();
  }

  _drawCliffRoot(ctx, cx, cy, halfW, halfD) {
    this._drawIsoPlatform(ctx, cx, cy + 28, halfW * 0.82, halfD * 0.82, 16, {
      top: '#92400e',
      left: '#78350f',
      right: '#451a03',
      shadow: 'rgba(15, 23, 42, 0.32)'
    });
    this._drawIsoPlatform(ctx, cx, cy + 42, halfW * 0.55, halfD * 0.55, 15, {
      top: '#475569',
      left: '#334155',
      right: '#1e293b'
    });
    this._drawIsoPlatform(ctx, cx, cy + 54, halfW * 0.28, halfD * 0.28, 12, {
      top: '#334155',
      left: '#1e293b',
      right: '#0f172a'
    });

    // Hanging green pixel vines
    [-0.6, -0.25, 0.15, 0.5].forEach((vo, i) => {
      const vx = cx + vo * halfW;
      const vy = cy + (1 - Math.abs(vo)) * halfD + 4;
      ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#15803d';
      for (let s = 0; s < 14; s += 3) {
        ctx.fillRect(vx + ((s / 3) & 1) * 2, vy + s, 3, 3);
      }
    });
  }

  _drawPixelWaterfall(ctx, x, y, h = 44) {
    for (let wy = 0; wy < h; wy += 4) {
      const foam = ((Math.floor(this.time * 9) + wy) % 8) < 4;
      ctx.fillStyle = foam ? '#e0f2fe' : '#38bdf8';
      ctx.fillRect(x - 6, y + wy, 12, 4);
    }
    const mw = 18 + Math.sin(this.time * 6) * 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - mw / 2, y + h - 2, mw, 5);
  }

  _drawCentralCoreIsland(ctx, nearestHotspot) {
    const isl = this.islands['core'];
    const isNear = nearestHotspot && nearestHotspot.id === 'core';
    const bob = Math.sin(this.time * 2) * 2;
    const cx = isl.x;
    const cy = isl.y + bob;
    const treasury = this.society ? this.society.treasuryBalance : 115;

    this._drawCliffRoot(ctx, cx, cy, 98, 49);
    this._drawIsoPlatform(ctx, cx, cy, 98, 49, 26, {
      top: '#1e1b4b',
      left: '#17153b',
      right: '#0f0e26',
      topStroke: isNear ? '#fde047' : '#22d3ee',
      topStrokeWidth: isNear ? 3.2 : 2
    });

    // Glowing GCOIN Core Obelisk
    this._drawIsoPlatform(ctx, cx, cy - 12, 46, 23, 24, {
      top: '#0ea5e9',
      left: '#0284c7',
      right: '#0369a1',
      topStroke: '#fef08a'
    });

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = isNear ? '#fde047' : '#22d3ee';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 58, cy - 54, 116, 22);
    ctx.strokeRect(cx - 58, cy - 54, 116, 22);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 9.5px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`🏦 TREASURY: ${treasury}G`, cx, cy - 40);
  }

  _drawFloatingIsland(ctx, islandId, nearestHotspot) {
    const isl = this.islands[islandId];
    if (!isl) return;
    const lv = (this.society && this.society.districtLevels && this.society.districtLevels[islandId]) || 2;
    const isNear = nearestHotspot && nearestHotspot.id === islandId;
    const phase = islandId.charCodeAt(0) * 0.4;
    const bob = Math.sin(this.time * 1.8 + phase) * 2.5;
    const cx = isl.x;
    const cy = isl.y + bob;

    const halfW = 114;
    const halfD = 57;

    this._drawCliffRoot(ctx, cx, cy, halfW, halfD);

    const turf = {
      'farmstead': { top: '#4ade80', left: '#22c55e', right: '#15803d' },
      'workshop': { top: '#334155', left: '#1e293b', right: '#0f172a' },
      'lineage-hall': { top: '#d97706', left: '#b45309', right: '#78350f' },
      'market-exchange': { top: '#34d399', left: '#10b981', right: '#047857' },
      'charter-court': { top: '#4ade80', left: '#22c55e', right: '#15803d' },
      'town-hall': { top: '#22c55e', left: '#16a34a', right: '#15803d' }
    }[islandId];

    this._drawIsoPlatform(ctx, cx, cy, halfW, halfD, 28, {
      top: turf.top,
      left: turf.left,
      right: turf.right,
      topStroke: isNear ? '#fde047' : '#0f172a',
      topStrokeWidth: isNear ? 3.5 : 2
    });

    // Island-specific 3D Pixel Buildings, Crops & Props
    if (islandId === 'farmstead') {
      this._drawPixelWaterfall(ctx, cx + 34, cy + 20, 44);
      if (this._isReady('pixelCastle')) {
        ctx.drawImage(this.sprites.pixelCastle, cx - 44, cy - 76, 84, 84);
      }
      // Interactive Golden Wheat Plots swaying in the breeze
      const sway = Math.round(Math.sin(this.time * 4) * 2);
      for (let gx = -56; gx <= -16; gx += 14) {
        for (let gy = -4; gy <= 18; gy += 11) {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(cx + gx - 4, cy + gy, 10, 5);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(cx + gx - 2 + sway, cy + gy - 8, 6, 9);
        }
      }
      if (this._isReady('pixelTree')) {
        ctx.drawImage(this.sprites.pixelTree, cx + 36, cy - 44, 42, 42);
      }
    } else if (islandId === 'workshop') {
      if (this._isReady('pixelWorkstation')) {
        ctx.drawImage(this.sprites.pixelWorkstation, cx - 64, cy - 66, 68, 68);
        ctx.drawImage(this.sprites.pixelWorkstation, cx + 4, cy - 66, 68, 68);
      }
      // Glowing Blueprint Holo-Pad
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(cx - 24, cy + 6, 48, 12);
      ctx.strokeStyle = '#fef08a';
      ctx.strokeRect(cx - 24, cy + 6, 48, 12);
    } else if (islandId === 'lineage-hall') {
      // Glowing 10k-Token Ascension Altar
      this._drawIsoPlatform(ctx, cx, cy - 8, 42, 21, 10, {
        top: '#a855f7',
        left: '#7e22ce',
        right: '#581c87',
        topStroke: '#fde047'
      });
      if (this._isReady('ancestorSvg')) {
        ctx.drawImage(this.sprites.ancestorSvg, cx - 44, cy - 52, 34, 42);
        ctx.drawImage(this.sprites.ancestorSvg, cx + 12, cy - 52, 34, 42);
      }
    } else if (islandId === 'market-exchange') {
      this._drawPixelWaterfall(ctx, cx - 36, cy + 20, 42);
      if (this._isReady('pixelBridge')) {
        ctx.drawImage(this.sprites.pixelBridge, cx - 48, cy - 64, 96, 96);
      }
    } else if (islandId === 'charter-court') {
      if (this._isReady('pixelMonolith')) {
        ctx.drawImage(this.sprites.pixelMonolith, cx - 42, cy - 76, 84, 84);
      }
      if (this._isReady('pixelTree')) {
        ctx.drawImage(this.sprites.pixelTree, cx + 36, cy - 42, 42, 42);
      }
    } else if (islandId === 'town-hall') {
      // Tripo3D-style Pixel Tennis / Civic Court with white lines, net & bouncing ball!
      if (this._isReady('pixelClubhouse')) {
        ctx.drawImage(this.sprites.pixelClubhouse, cx - 72, cy - 74, 88, 88);
      }
      // Crisp white pixel court boundary & net on the right half of the island
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 38, cy - 12, 76, 30);
      // Center net
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(cx - 1, cy - 18, 3, 34);
    }

    // Floating Island Signpost Banner
    ctx.fillStyle = isNear ? '#fde047' : '#0f172a';
    ctx.strokeStyle = isNear ? '#0f172a' : isl.color;
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 64, cy + 32, 128, 18);
    ctx.strokeRect(cx - 64, cy + 32, 128, 18);
    ctx.fillStyle = isNear ? '#0f172a' : '#ffffff';
    ctx.font = '900 8.5px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${isl.title} LV.${lv}`, cx, cy + 44);
  }

  _getArchonId() {
    if (!this.society || !this.society.lineages.length) return null;
    const sorted = [...this.society.lineages].sort(
      (a, b) => socAgentPower(b) - socAgentPower(a) || b.completedSales - a.completedSales
    );
    return sorted[0].id;
  }

  _drawAgentsAndParticles(ctx) {
    if (!this.society) return;
    const archonId = this._getArchonId();

    // Sort agents by Y for proper 2.5D depth occlusion
    const list = this.society.lineages
      .map((lin) => ({ lin, ent: this.entities[lin.id] }))
      .filter((x) => x.ent)
      .sort((a, b) => a.ent.y - b.ent.y);

    list.forEach(({ lin, ent }) => {
      const isPlayer = lin.id === this.playerAgentId;
      const isArchon = lin.id === archonId;
      const isMoving = Math.hypot(ent.vx, ent.vy) > 8;
      const walkBounce = isMoving ? Math.abs(Math.sin(this.time * 15)) * 5 : Math.round(Math.sin(this.time * 3 + ent.x) * 1.5);
      const swingTilt = ent.actionAnim > 0 ? Math.sin(ent.actionAnim * 28) * 6 : 0;

      const ax = Math.round(ent.x + swingTilt);
      const ay = Math.round(ent.y - walkBounce);

      // Ground ring under the player-controlled agent
      if (isPlayer) {
        ctx.save();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(ent.x, ent.y + 2, 16, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fillRect(ent.x - 10, ent.y - 2, 20, 5);
      }

      const spriteKey = isArchon
        ? 'pixelArchon'
        : lin.role === 'farmer'
          ? 'pixelFarmer'
          : lin.role === 'engineer'
            ? 'pixelEngineer'
            : 'pixelManager';

      if (this._isReady(spriteKey)) {
        ctx.save();
        ctx.translate(ax, ay);
        if (ent.facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(this.sprites[spriteKey], -22, -40, 44, 44);
        ctx.restore();
      }

      // Compact Pixel Nameplate & Stamina Bar above character
      const tagY = ay - 52;
      ctx.fillStyle = isPlayer ? '#fde047' : 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = isPlayer ? '#0f172a' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(ax - 32, tagY, 64, 15);
      ctx.strokeRect(ax - 32, tagY, 64, 15);

      ctx.fillStyle = isPlayer ? '#0f172a' : '#ffffff';
      ctx.font = '900 7.5px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${isArchon ? '👑' : ''}${lin.id} G${lin.currentGen}`, ax, tagY + 9);

      // Tiny stamina bar inside nameplate
      const stam = lin.stamina ?? 85;
      ctx.fillStyle = '#020617';
      ctx.fillRect(ax - 28, tagY + 11, 56, 2.5);
      ctx.fillStyle = stam > 55 ? '#22c55e' : stam > 30 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(ax - 28, tagY + 11, Math.round((56 * stam) / 100), 2.5);

      // Floating "▼ YOU" arrow on the controlled agent
      if (isPlayer) {
        const arrowBounce = Math.round(Math.sin(this.time * 8) * 3);
        ctx.fillStyle = '#fde047';
        ctx.font = '900 9px "Courier New", monospace';
        ctx.fillText('▼ YOU', ax, tagY - 5 + arrowBounce);
      }

      // Speech bubble if speaking
      if (ent.speech && ent.speechTimer > 0) {
        const sw = Math.max(84, ent.speech.length * 5.8 + 14);
        const sy = tagY - 24;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.fillRect(ax - sw / 2, sy, sw, 18);
        ctx.strokeRect(ax - sw / 2, sy, sw, 18);
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 8px "Courier New", monospace';
        ctx.fillText(ent.speech, ax, sy + 12);
      }
    });

    // Draw the bouncing Pixel Tennis Ball on the Town Hall Court
    const b = this.courtBall;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x - 3, b.y - 1, 6, 3);
    ctx.fillStyle = '#bef264';
    ctx.fillRect(b.x - 4, b.y - b.z - 4, 8, 8);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x - 4, b.y - b.z - 4, 8, 8);

    // Draw physical 3D bouncing collectible particles
    this.particles.forEach((p) => {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(p.x - 2, p.y, p.size, 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size);
    });
  }

  _drawBeamsAndPopups(ctx) {
    this.beams = this.beams.filter((b) => this.time - b.createdAt < b.duration);
    this.floatingPopups = this.floatingPopups.filter((p) => this.time - p.createdAt < p.duration);

    this.beams.forEach((b) => {
      const age = this.time - b.createdAt;
      const alpha = Math.max(0, 1 - age / b.duration);
      const w = 28 * alpha;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - w / 2, b.y - 260, w, 265);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - w * 0.25, b.y - 260, w * 0.5, 265);
      ctx.restore();
    });

    this.floatingPopups.forEach((p) => {
      const age = this.time - p.createdAt;
      const alpha = Math.max(0, 1 - (age / p.duration) ** 1.5);
      const fy = Math.round(p.y - 45 - age * 26);
      const fx = Math.round(p.x);
      const w = Math.max(110, p.text.length * 6.4 + 16);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.fillRect(fx - w / 2, fy, w, 20);
      ctx.strokeRect(fx - w / 2, fy, w, 20);
      ctx.fillStyle = p.color;
      ctx.font = '900 8.5px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, fx, fy + 13);
      ctx.restore();
    });
  }
};

function socAgentPower(lin) {
  if (!lin) return 0;
  return lin.wallet + lin.completedSales * 2 + (lin.currentGen - 1) * 2;
}
