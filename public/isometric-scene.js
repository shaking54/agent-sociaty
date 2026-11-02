// AGENT SOCIETY — PIXEL-ART 3D MAINLAND BUILDER & DYNASTY GAME ENGINE
// Continuous 2.5D Pixel-Art Mainland with:
// - Buildable Houses (pixel-house.png), Factories (pixel-factory.png), Shops (pixel-shop.png), and Paddlefields (pixel-paddlefield.png)
// - Visible Equipped Role Work Tools (Scythe, Power Wrench, Paddle Racket, Builder Hammer) with swing animations
// - Direct WASD / Arrow / Click-to-Move player control + 9 autonomous AI agents

window.IsometricSocietyScene = class IsometricSocietyScene {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.pixelCanvas = document.createElement('canvas');
    this.pixelCtx = this.pixelCanvas.getContext('2d');

    this.camera = {
      x: 0,
      y: 12,
      zoom: 1.05,
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
    this.pixelScale = 2;
    this.weatherMode = 'sunny';

    // Real-time agent entities on the mainland
    this.entities = {};
    this.particles = [];
    this.floatingPopups = [];
    this.beams = [];

    // Built structures on the Mainland (both pre-existing & newly built by Player/AI)
    // Types: 'house' | 'factory' | 'shop' | 'paddlefield'
    this.placedBuildings = [
      { id: 'b-house-1', type: 'house', name: 'Farmer Homestead', owner: 'farmer-1', x: -165, y: -185, lv: 1, ballPhase: 0 },
      { id: 'b-factory-1', type: 'factory', name: 'Blueprint Foundry', owner: 'engineer-8', x: 135, y: -185, lv: 2, ballPhase: 1 },
      { id: 'b-shop-1', type: 'shop', name: 'Central Ration Shop', owner: 'farmer-4', x: 155, y: 15, lv: 1, ballPhase: 2 },
      { id: 'b-paddle-1', type: 'paddlefield', name: 'Club Paddlefield #1', owner: 'manager-3', x: 230, y: 185, lv: 2, ballPhase: 0 }
    ];

    // Pre-marked buildable land plots (players can also build anywhere on the mainland!)
    this.buildPlots = [
      { x: -145, y: -45 },
      { x: 145, y: -55 },
      { x: -120, y: 95 },
      { x: 95, y: 115 },
      { x: -310, y: -50 },
      { x: 310, y: -55 },
      { x: -75, y: -175 },
      { x: 65, y: 205 },
      { x: -340, y: 130 },
      { x: 355, y: 145 }
    ];

    // Core Mainland Landmarks / Work Zones
    this.landmarks = {
      'farmstead': {
        id: 'farmstead',
        x: -320,
        y: -165,
        title: 'GOLDEN WHEAT FARMLAND',
        color: '#4ade80',
        prompt: 'Swing Scythe to Harvest Wheat (+Wage GCOIN & +Rations)',
        actionType: 'harvest'
      },
      'workshop': {
        id: 'workshop',
        x: 285,
        y: -165,
        title: 'ENGINEER TECH RIG',
        color: '#38bdf8',
        prompt: 'Use Wrench to Craft Blueprint (+Wage GCOIN & +Tech)',
        actionType: 'craft'
      },
      'lineage-hall': {
        id: 'lineage-hall',
        x: -385,
        y: 25,
        title: 'LINEAGE ASCENSION SHRINE',
        color: '#c084fc',
        prompt: 'Ascend to Gen +1 Heir (+10% Permanent Wage Mastery)',
        actionType: 'handover'
      },
      'market-exchange': {
        id: 'market-exchange',
        x: 365,
        y: 20,
        title: 'RIVER MARKET BRIDGE',
        color: '#fbbf24',
        prompt: 'Trade Goods & Eat Ration (+45% Stamina & +Sales Power)',
        actionType: 'trade'
      },
      'charter-court': {
        id: 'charter-court',
        x: -245,
        y: 190,
        title: 'ARCHON CHARTER MONOLITH',
        color: '#f472b6',
        prompt: 'Enact / Cycle Colony Charter Law (Archon Decree)',
        actionType: 'law'
      },
      'core': {
        id: 'core',
        x: 0,
        y: 5,
        title: 'TOWN PLAZA & TREASURY',
        color: '#22d3ee',
        prompt: 'Upgrade All Mainland Buildings (15 Treasury GCOIN)',
        actionType: 'upgrade'
      }
    };

    // Decorative forest trees around the mainland perimeter
    this.trees = [
      { x: -495, y: -230 }, { x: -445, y: -255 }, { x: -215, y: -260 },
      { x: -40, y: -265 }, { x: 65, y: -260 }, { x: 215, y: -260 },
      { x: 430, y: -245 }, { x: 495, y: -195 }, { x: -510, y: -90 },
      { x: -515, y: 110 }, { x: -460, y: 245 }, { x: -360, y: 265 },
      { x: -135, y: 265 }, { x: 15, y: 270 }, { x: 385, y: 255 },
      { x: 485, y: 215 }, { x: 515, y: 80 }
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
      // New Role Buildable Buildings & Work Tools
      pixelHouse: './assets/sprites/pixel-house.png',
      pixelFactory: './assets/sprites/pixel-factory.png',
      pixelShop: './assets/sprites/pixel-shop.png',
      pixelPaddlefield: './assets/sprites/pixel-paddlefield.png',
      toolScythe: './assets/sprites/pixel-tool-scythe.png',
      toolWrench: './assets/sprites/pixel-tool-wrench.png',
      toolRacket: './assets/sprites/pixel-tool-racket.png',
      toolHammer: './assets/sprites/pixel-tool-hammer.png',
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
      this.camera.zoom = Math.max(0.62, Math.min(2.1, this.camera.zoom * factor));
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

    // 1. Check if user clicked on another agent to switch control
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

    // 2. Otherwise walk the player character across the mainland to the clicked coordinate
    const playerEnt = this.entities[this.playerAgentId];
    if (playerEnt) {
      playerEnt.targetX = Math.max(-520, Math.min(520, wx));
      playerEnt.targetY = Math.max(-260, Math.min(260, wy));
      this.camera.followPlayer = true;
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
    const roleStarts = {
      farmer: { x: -290, y: -140 },
      engineer: { x: 250, y: -140 },
      manager: { x: 210, y: 170 }
    };

    this.society.lineages.forEach((lin, idx) => {
      if (!lin.toolLevel) lin.toolLevel = 1;
      if (!this.entities[lin.id]) {
        const base = roleStarts[lin.role] || { x: 0, y: 20 };
        const angle = (idx / this.society.lineages.length) * Math.PI * 2;
        this.entities[lin.id] = {
          id: lin.id,
          x: base.x + Math.cos(angle) * 45,
          y: base.y + Math.sin(angle) * 26,
          vx: 0,
          vy: 0,
          targetX: null,
          targetY: null,
          facing: 1,
          aiTimer: 1.4 + (idx % 4) * 0.7,
          speech: '',
          speechTimer: 0,
          actionAnim: 0,
          overrideTool: null
        };
      }
    });
  }

  getPlayerEntity() {
    return this.entities[this.playerAgentId];
  }

  // Construct a new House, Factory, Shop, or Paddlefield on the Mainland!
  buildStructureOnLand(type, ownerId, customX = null, customY = null) {
    const ent = this.entities[ownerId] || this.getPlayerEntity();
    let bx = customX !== null ? customX : (ent ? ent.x : 0);
    let by = customY !== null ? customY : (ent ? ent.y - 12 : 0);

    // Snap to nearest open buildPlot if within 65px, otherwise place beside character
    let snappedPlot = null;
    for (const plot of this.buildPlots) {
      const occupied = this.placedBuildings.some((b) => Math.hypot(b.x - plot.x, b.y - plot.y) < 52);
      if (!occupied && Math.hypot(bx - plot.x, by - plot.y) < 75) {
        snappedPlot = plot;
        break;
      }
    }
    if (snappedPlot) {
      bx = snappedPlot.x;
      by = snappedPlot.y;
    } else {
      // If standing on top of an existing building, nudge slightly so it doesn't overlap
      for (const b of this.placedBuildings) {
        if (Math.hypot(bx - b.x, by - b.y) < 55) {
          bx += (Math.random() > 0.5 ? 64 : -64);
          by += (Math.random() - 0.5) * 36;
        }
      }
    }

    bx = Math.max(-450, Math.min(450, Math.round(bx)));
    by = Math.max(-220, Math.min(220, Math.round(by)));

    const labels = {
      house: 'Homestead House',
      factory: 'Automation Factory',
      shop: 'GCOIN Market Shop',
      paddlefield: 'Paddlefield Court'
    };

    const newBldg = {
      id: `b-${type}-${Date.now()}`,
      type,
      name: `${labels[type] || type}`,
      owner: ownerId,
      x: bx,
      y: by,
      lv: 1,
      ballPhase: Math.random() * 6
    };
    this.placedBuildings.push(newBldg);

    if (ent) {
      ent.actionAnim = 0.6;
      ent.overrideTool = 'toolHammer';
      setTimeout(() => {
        if (ent) ent.overrideTool = null;
      }, 650);
    }

    this.spawnAscensionBeam(bx, by, '#fde047');
    this.spawnBurst(bx, by, '#fde047', 16);
    this.spawnFloatingPopup(bx, by, `🏗️ BUILT ${type.toUpperCase()}!`, '#fde047');
    return newBldg;
  }

  // Find the nearest interactive landmark or player-built structure within 82px
  getNearestHotspot() {
    const ent = this.getPlayerEntity();
    if (!ent) return null;
    let best = null;
    let bestDist = 85;

    Object.values(this.landmarks).forEach((lm) => {
      const d = Math.hypot(ent.x - lm.x, ent.y - lm.y);
      if (d < bestDist) {
        bestDist = d;
        best = lm;
      }
    });

    this.placedBuildings.forEach((b) => {
      const d = Math.hypot(ent.x - b.x, ent.y - b.y);
      if (d < bestDist) {
        bestDist = d;
        const prompts = {
          house: 'Rest at House (+35% Stamina & +Heir XP)',
          factory: 'Operate Factory (+Blueprint & +Wage GCOIN)',
          shop: 'Trade at Market Shop (+Ration & +Sales Power)',
          paddlefield: 'Play Paddlefield Rally (+Harmony & +Wage GCOIN)'
        };
        const actions = {
          house: 'house',
          factory: 'craft',
          shop: 'trade',
          paddlefield: 'rally'
        };
        best = {
          id: b.id,
          x: b.x,
          y: b.y,
          title: `${b.name.toUpperCase()} (${b.owner})`,
          prompt: prompts[b.type],
          actionType: actions[b.type],
          buildingRef: b
        };
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

  spawnSpeech(agentId, text, duration = 2.8) {
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
      duration: 1.1
    });
    this.spawnBurst(x, y, color, 16);
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

    const keys = this.callbacks.getKeys ? this.callbacks.getKeys() : {};
    const playerEnt = this.getPlayerEntity();
    if (playerEnt) {
      let dx = 0;
      let dy = 0;
      if (keys.KeyW || keys.ArrowUp) dy -= 1;
      if (keys.KeyS || keys.ArrowDown) dy += 1;
      if (keys.KeyA || keys.ArrowLeft) dx -= 1;
      if (keys.KeyD || keys.ArrowRight) dx += 1;

      const moveSpeed = 140;
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
      playerEnt.y = Math.max(-250, Math.min(250, playerEnt.y + playerEnt.vy * dt));
      if (Math.abs(playerEnt.vx) > 5) {
        playerEnt.facing = playerEnt.vx > 0 ? 1 : -1;
      }

      if (this.camera.followPlayer) {
        const desiredX = -playerEnt.x * this.camera.zoom * 0.35;
        const desiredY = -playerEnt.y * this.camera.zoom * 0.35 + 10;
        this.camera.x += (desiredX - this.camera.x) * Math.min(1, dt * 5);
        this.camera.y += (desiredY - this.camera.y) * Math.min(1, dt * 5);
      }
    }

    // Update Autonomous AI Agents roaming the mainland
    const allTargets = [...Object.values(this.landmarks), ...this.placedBuildings];
    this.society.lineages.forEach((lin) => {
      const ent = this.entities[lin.id];
      if (!ent) return;
      if (ent.speechTimer > 0) ent.speechTimer = Math.max(0, ent.speechTimer - dt);
      if (ent.actionAnim > 0) ent.actionAnim = Math.max(0, ent.actionAnim - dt);

      if (lin.id === this.playerAgentId) return;

      ent.aiTimer -= dt;
      if (ent.aiTimer <= 0) {
        ent.aiTimer = 3.0 + Math.random() * 3.8;
        let dest = allTargets[Math.floor(Math.random() * allTargets.length)];
        if ((lin.stamina ?? 85) < 55) {
          dest = this.landmarks['market-exchange'];
        } else if (lin.contextTokens > 8200) {
          dest = this.landmarks['lineage-hall'];
        }
        ent.targetX = dest.x + (Math.random() - 0.5) * 70;
        ent.targetY = dest.y + (Math.random() - 0.5) * 36 + 10;
      }

      if (ent.targetX !== null && ent.targetY !== null) {
        const dx = ent.targetX - ent.x;
        const dy = ent.targetY - ent.y;
        const dist = Math.hypot(dx, dy);
        const aiSpeed = 72;
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
          ent.actionAnim = 0.4;
        }
      }
    });

    // Update 3D Bouncing Particles
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
    this._drawOceanBackdrop(ctx);

    ctx.save();
    ctx.translate(this.width * 0.5 + this.camera.x, this.height * 0.5 + this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.imageSmoothingEnabled = false;

    const nearestHotspot = this.getNearestHotspot();

    // 1. Continuous 2.5D Pixel-Art Mainland Continent (Beach, Turf, Roads, River & Build Plots)
    this._drawContinuousMainland(ctx, nearestHotspot);

    // 2. Core Mainland Landmarks
    this._drawMainlandLandmarks(ctx, nearestHotspot);

    // 3. Y-Sorted Render of Trees, Built Structures (House, Factory, Shop, Paddlefield), Agents & Particles
    this._drawSortedEntitiesAndBuildings(ctx, nearestHotspot);

    // 4. Ascension Beams & Popups
    this._drawBeamsAndPopups(ctx);
    this._drawRain(ctx);

    ctx.restore();
  }

  _drawOceanBackdrop(ctx) {
    const w = this.width;
    const h = this.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.weatherMode === 'sunny') {
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.5, '#0ea5e9');
      grad.addColorStop(1, '#0369a1');
    } else if (this.weatherMode === 'sunset') {
      grad.addColorStop(0, '#4c1d95');
      grad.addColorStop(0.5, '#be185d');
      grad.addColorStop(1, '#ea580c');
    } else if (this.weatherMode === 'rain') {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#334155');
    } else {
      grad.addColorStop(0, '#020617');
      grad.addColorStop(1, '#0f172a');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Animated pixel ocean wave sparkles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = 0; i < 42; i++) {
      const wx = ((i * 193 + Math.floor(this.time * 18)) % w);
      const wy = ((i * 107) % h);
      ctx.fillRect(wx, wy, 14, 3);
    }
  }

  _drawContinuousMainland(ctx, nearestHotspot) {
    // Outer sandy beach shore & cliff bevel
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-580, -296, 1160, 616);

    ctx.fillStyle = '#fde68a';
    ctx.fillRect(-574, -290, 1148, 594);

    // Lush green mainland continent turf with subtle pixel grass patches
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-556, -276, 1112, 560);

    // Checkerboard grass texture patches across the mainland
    for (let gy = -260; gy <= 250; gy += 45) {
      for (let gx = -520; gx <= 500; gx += 65) {
        ctx.fillStyle = ((gx + gy) & 1) === 0 ? '#16a34a' : '#4ade80';
        ctx.fillRect(gx, gy, 28, 16);
      }
    }

    // Sparkling River winding N->S on the right side of the mainland (around x = 235..265)
    for (let ry = -276; ry < 284; ry += 12) {
      const bend = Math.round(Math.sin(ry * 0.015) * 28);
      const rx = 250 + bend;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(rx - 26, ry, 52, 14);
      const foam = ((Math.floor(this.time * 6) + ry) % 24) < 8;
      ctx.fillStyle = foam ? '#bae6fd' : '#38bdf8';
      ctx.fillRect(rx - 18, ry + 2, 36, 10);
    }

    // Cobblestone & Dirt Mainland Roads connecting all districts & plots
    ctx.fillStyle = '#d6d3d1';
    // Main East-West Highway
    ctx.fillRect(-450, -6, 900, 26);
    // North-South Central Avenue
    ctx.fillRect(-16, -230, 32, 460);
    // Farmstead & Workshop North Road
    ctx.fillRect(-360, -165, 680, 20);
    // Charter & Paddlefield South Road
    ctx.fillRect(-290, 175, 560, 20);

    // Cobblestone pixel bricks along the roads
    ctx.fillStyle = '#a8a29e';
    for (let rx = -430; rx <= 430; rx += 28) {
      ctx.fillRect(rx, 2, 14, 8);
      ctx.fillRect(rx + 8, -160, 12, 6);
    }

    // Buildable Land Plot Markers (dashed golden pixel squares where roles can construct buildings)
    this.buildPlots.forEach((plot) => {
      const occupied = this.placedBuildings.some((b) => Math.hypot(b.x - plot.x, b.y - plot.y) < 48);
      if (occupied) return;
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(plot.x - 28, plot.y - 16, 56, 32);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(plot.x - 26, plot.y - 14, 52, 28);
      ctx.fillStyle = '#fef08a';
      ctx.font = '900 7px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+ BUILD PLOT', plot.x, plot.y + 3);
    });
  }

  _drawMainlandLandmarks(ctx, nearestHotspot) {
    // 1. Farmstead Golden Wheat Field & Granary Keep (-320, -165)
    {
      const lm = this.landmarks['farmstead'];
      const cx = lm.x;
      const cy = lm.y;
      // Tilled soil patch
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 78, cy - 22, 156, 62);
      const sway = Math.round(Math.sin(this.time * 4) * 2);
      for (let wx = -68; wx <= 64; wx += 16) {
        for (let wy = -14; wy <= 28; wy += 14) {
          ctx.fillStyle = '#fde047';
          ctx.fillRect(cx + wx + sway, cy + wy - 6, 7, 10);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(cx + wx, cy + wy + 2, 7, 4);
        }
      }
      if (this._isReady('pixelCastle')) {
        ctx.drawImage(this.sprites.pixelCastle, cx - 44, cy - 92, 88, 88);
      }
      this._drawZoneSign(ctx, cx, cy + 48, '🌾 WHEAT FARMLAND', lm.color, nearestHotspot && nearestHotspot.id === 'farmstead');
    }

    // 2. Engineer Tech Rig (285, -165)
    {
      const lm = this.landmarks['workshop'];
      const cx = lm.x;
      const cy = lm.y;
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 64, cy - 24, 128, 52);
      if (this._isReady('pixelWorkstation')) {
        ctx.drawImage(this.sprites.pixelWorkstation, cx - 58, cy - 64, 64, 64);
        ctx.drawImage(this.sprites.pixelWorkstation, cx + 2, cy - 64, 64, 64);
      }
      this._drawZoneSign(ctx, cx, cy + 38, '⚙️ ENGINEER RIG', lm.color, nearestHotspot && nearestHotspot.id === 'workshop');
    }

    // 3. Lineage Ascension Shrine (-385, 25)
    {
      const lm = this.landmarks['lineage-hall'];
      const cx = lm.x;
      const cy = lm.y;
      ctx.fillStyle = '#581c87';
      ctx.fillRect(cx - 52, cy - 22, 104, 48);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 52, cy - 22, 104, 48);
      if (this._isReady('ancestorSvg')) {
        ctx.drawImage(this.sprites.ancestorSvg, cx - 40, cy - 52, 34, 42);
        ctx.drawImage(this.sprites.ancestorSvg, cx + 8, cy - 52, 34, 42);
      }
      this._drawZoneSign(ctx, cx, cy + 36, '🧬 LINEAGE SHRINE', lm.color, nearestHotspot && nearestHotspot.id === 'lineage-hall');
    }

    // 4. River Market Bridge (365, 20)
    {
      const lm = this.landmarks['market-exchange'];
      const cx = lm.x;
      const cy = lm.y;
      if (this._isReady('pixelBridge')) {
        ctx.drawImage(this.sprites.pixelBridge, cx - 48, cy - 58, 96, 96);
      }
      this._drawZoneSign(ctx, cx, cy + 40, '🛒 MARKET BRIDGE', lm.color, nearestHotspot && nearestHotspot.id === 'market-exchange');
    }

    // 5. Archon Charter Monolith (-245, 190)
    {
      const lm = this.landmarks['charter-court'];
      const cx = lm.x;
      const cy = lm.y;
      if (this._isReady('pixelMonolith')) {
        ctx.drawImage(this.sprites.pixelMonolith, cx - 44, cy - 72, 88, 88);
      }
      this._drawZoneSign(ctx, cx, cy + 28, '👑 CHARTER MONOLITH', lm.color, nearestHotspot && nearestHotspot.id === 'charter-court');
    }

    // 6. Central Town Plaza & Treasury Core (0, 5)
    {
      const lm = this.landmarks['core'];
      const cx = lm.x;
      const cy = lm.y;
      const treasury = this.society ? this.society.treasuryBalance : 115;
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(cx - 58, cy - 28, 116, 56);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx - 58, cy - 28, 116, 56);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(cx - 26, cy - 16, 52, 32);
      this._drawZoneSign(ctx, cx, cy + 38, `🏦 TREASURY: ${treasury}G`, lm.color, nearestHotspot && nearestHotspot.id === 'core');
    }
  }

  _drawZoneSign(ctx, x, y, text, borderCol, isNear) {
    const w = Math.max(118, text.length * 6.5 + 14);
    ctx.fillStyle = isNear ? '#fde047' : 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = isNear ? '#0f172a' : borderCol;
    ctx.lineWidth = 2;
    ctx.fillRect(x - w / 2, y - 10, w, 18);
    ctx.strokeRect(x - w / 2, y - 10, w, 18);
    ctx.fillStyle = isNear ? '#0f172a' : '#ffffff';
    ctx.font = '900 8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 2);
  }

  _getArchonId() {
    if (!this.society || !this.society.lineages.length) return null;
    const sorted = [...this.society.lineages].sort(
      (a, b) => socAgentPower(b) - socAgentPower(a) || b.completedSales - a.completedSales
    );
    return sorted[0].id;
  }

  _drawSortedEntitiesAndBuildings(ctx, nearestHotspot) {
    if (!this.society) return;
    const archonId = this._getArchonId();

    const renderables = [];

    // 1. Forest Trees
    this.trees.forEach((t) => {
      renderables.push({ kind: 'tree', y: t.y, data: t });
    });

    // 2. Player & AI Built Structures (House, Factory, Shop, Paddlefield)
    this.placedBuildings.forEach((b) => {
      renderables.push({ kind: 'building', y: b.y, data: b });
    });

    // 3. Living Role Agents
    this.society.lineages.forEach((lin) => {
      const ent = this.entities[lin.id];
      if (ent) {
        renderables.push({ kind: 'agent', y: ent.y, lin, ent });
      }
    });

    renderables.sort((a, b) => a.y - b.y);

    renderables.forEach((item) => {
      if (item.kind === 'tree') {
        if (this._isReady('pixelTree')) {
          ctx.drawImage(this.sprites.pixelTree, item.data.x - 24, item.data.y - 42, 48, 48);
        }
      } else if (item.kind === 'building') {
        this._drawPlacedBuilding(ctx, item.data, nearestHotspot);
      } else if (item.kind === 'agent') {
        this._drawAgentWithTool(ctx, item.lin, item.ent, archonId);
      }
    });

    // 4. Physical 3D Bouncing Particles
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

  _drawPlacedBuilding(ctx, b, nearestHotspot) {
    const isNear = nearestHotspot && nearestHotspot.id === b.id;
    const spriteMap = {
      house: 'pixelHouse',
      factory: 'pixelFactory',
      shop: 'pixelShop',
      paddlefield: 'pixelPaddlefield'
    };
    const key = spriteMap[b.type];
    const size = b.type === 'paddlefield' ? 108 : 88;

    if (this._isReady(key)) {
      ctx.drawImage(this.sprites[key], b.x - size / 2, b.y - size * 0.72, size, size);
    }

    // Animated details per building type:
    if (b.type === 'factory') {
      // Rising smoke puffs from factory smokestacks
      const puffY = (this.time * 18 + b.ballPhase * 10) % 24;
      ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
      ctx.fillRect(b.x - 14, b.y - 62 - puffY, 8, 6);
      ctx.fillRect(b.x + 2, b.y - 66 - puffY * 0.8, 9, 6);
    } else if (b.type === 'paddlefield') {
      // Live bouncing pixel tennis/padel ball rallying back and forth on every built Paddlefield!
      const t = this.time * 3.4 + (b.ballPhase || 0);
      const bx = b.x + Math.sin(t) * 28;
      const by = b.y - 6 + Math.cos(t) * 8;
      const bz = Math.abs(Math.cos(t * 2)) * 18;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(bx - 3, by, 6, 3);
      ctx.fillStyle = '#bef264';
      ctx.fillRect(bx - 4, by - bz - 4, 7, 7);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx - 4, by - bz - 4, 7, 7);
    }

    // Building nameplate badge
    const tagColors = {
      house: '#4ade80',
      factory: '#38bdf8',
      shop: '#fbbf24',
      paddlefield: '#34d399'
    };
    const icons = {
      house: '🏠',
      factory: '🏭',
      shop: '🏪',
      paddlefield: '🎾'
    };
    this._drawZoneSign(
      ctx,
      b.x,
      b.y + 24,
      `${icons[b.type]} ${b.type.toUpperCase()} LV.${b.lv}`,
      tagColors[b.type] || '#fde047',
      isNear
    );
  }

  _drawAgentWithTool(ctx, lin, ent, archonId) {
    const isPlayer = lin.id === this.playerAgentId;
    const isArchon = lin.id === archonId;
    const isMoving = Math.hypot(ent.vx, ent.vy) > 8;
    const walkBounce = isMoving
      ? Math.abs(Math.sin(this.time * 15)) * 5
      : Math.round(Math.sin(this.time * 3 + ent.x) * 1.5);

    const ax = Math.round(ent.x);
    const ay = Math.round(ent.y - walkBounce);

    // Highlight ring under controlled character
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

      // Draw Equipped Role Work Tool in character's hand with swing animation!
      const toolKey = ent.overrideTool
        ? ent.overrideTool
        : lin.role === 'farmer'
          ? 'toolScythe'
          : lin.role === 'engineer'
            ? 'toolWrench'
            : 'toolRacket';

      if (this._isReady(toolKey)) {
        const swingAngle = ent.actionAnim > 0
          ? Math.sin(ent.actionAnim * 28) * 1.1
          : Math.sin(this.time * 3.5) * 0.12;
        ctx.save();
        ctx.translate(12, -18);
        ctx.rotate(swingAngle);
        ctx.drawImage(this.sprites[toolKey], -12, -16, 26, 26);
        ctx.restore();
      }
      ctx.restore();
    }

    // Nameplate + Stamina + Tool Level above character
    const tagY = ay - 54;
    const toolLv = lin.toolLevel || 1;
    ctx.fillStyle = isPlayer ? '#fde047' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = isPlayer ? '#0f172a' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(ax - 36, tagY, 72, 15);
    ctx.strokeRect(ax - 36, tagY, 72, 15);

    ctx.fillStyle = isPlayer ? '#0f172a' : '#ffffff';
    ctx.font = '900 7.2px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${isArchon ? '👑' : ''}${lin.id} 🛠️${toolLv}`, ax, tagY + 9);

    const stam = lin.stamina ?? 85;
    ctx.fillStyle = '#020617';
    ctx.fillRect(ax - 32, tagY + 11, 64, 2.5);
    ctx.fillStyle = stam > 55 ? '#22c55e' : stam > 30 ? '#fbbf24' : '#ef4444';
    ctx.fillRect(ax - 32, tagY + 11, Math.round((64 * stam) / 100), 2.5);

    if (isPlayer) {
      const arrowBounce = Math.round(Math.sin(this.time * 8) * 3);
      ctx.fillStyle = '#fde047';
      ctx.font = '900 9px "Courier New", monospace';
      ctx.fillText('▼ YOU', ax, tagY - 5 + arrowBounce);
    }

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
      const w = Math.max(115, p.text.length * 6.4 + 16);

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
};

function socAgentPower(lin) {
  if (!lin) return 0;
  return lin.wallet + lin.completedSales * 2 + (lin.currentGen - 1) * 2 + ((lin.buildingsOwned || 0) * 5);
}
