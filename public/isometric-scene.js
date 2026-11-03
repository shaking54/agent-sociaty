// AGENT SOCIETY — TRUE 2.5D ISOMETRIC VOXEL MAINLAND BUILDER & DYNASTY GAME ENGINE
// The Mainland is a multi-tiered 2.5D Isometric Diamond Continent (2:1 isometric projection)
// with 3D extruded cliff walls, isometric checkerboard grass tiles, elevated highland plateaus,
// isometric cobblestone avenues, a recessed isometric river channel, and isometric diamond build pads.

window.IsometricSocietyScene = class IsometricSocietyScene {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.pixelCanvas = document.createElement('canvas');
    this.pixelCtx = this.pixelCanvas.getContext('2d');

    this.camera = {
      x: 0,
      y: 16,
      zoom: 1.0,
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
    this.pixelScale = 1; // Full Native Retina 1x Ultra-Sharp rendering
    this.weatherMode = 'sunny';

    // Real-time agent entities on the 2.5D mainland
    this.entities = {};
    this.particles = [];
    this.floatingPopups = [];
    this.beams = [];

    // Built structures on the 2.5D Mainland (aligned to isometric diamond grid)
    this.placedBuildings = [
      { id: 'b-house-1', type: 'house', name: 'Farmer Homestead', owner: 'farmer-1', x: -160, y: -80, lv: 1, ballPhase: 0 },
      { id: 'b-factory-1', type: 'factory', name: 'Blueprint Foundry', owner: 'engineer-8', x: 160, y: -80, lv: 2, ballPhase: 1 },
      { id: 'b-shop-1', type: 'shop', name: 'Central Ration Shop', owner: 'farmer-4', x: 160, y: 80, lv: 1, ballPhase: 2 },
      { id: 'b-paddle-1', type: 'paddlefield', name: 'Club Paddlefield #1', owner: 'manager-3', x: -160, y: 80, lv: 2, ballPhase: 0 }
    ];

    // Pre-marked 2.5D Isometric Diamond Build Plots on the mainland
    this.buildPlots = [
      { x: -240, y: 0 },
      { x: 240, y: 0 },
      { x: 0, y: -120 },
      { x: 0, y: 120 },
      { x: -120, y: -140 },
      { x: 120, y: -140 },
      { x: -120, y: 140 },
      { x: 120, y: 140 },
      { x: -320, y: -40 },
      { x: 320, y: 40 }
    ];

    // Core 2.5D Mainland Landmarks positioned on the Isometric Diamond Continent
    this.landmarks = {
      'farmstead': {
        id: 'farmstead',
        x: -260,
        y: -130,
        title: 'GOLDEN WHEAT TERRACE',
        color: '#4ade80',
        prompt: 'Swing Scythe to Harvest Wheat (+Wage GCOIN & +Rations)',
        actionType: 'harvest'
      },
      'workshop': {
        id: 'workshop',
        x: 260,
        y: -130,
        title: 'ENGINEER FOUNDRY RIDGE',
        color: '#38bdf8',
        prompt: 'Use Wrench to Craft Blueprint (+Wage GCOIN & +Tech)',
        actionType: 'craft'
      },
      'lineage-hall': {
        id: 'lineage-hall',
        x: -380,
        y: 0,
        title: 'LINEAGE ASCENSION SHRINE',
        color: '#c084fc',
        prompt: 'Handover at the context threshold',
        actionType: 'handover'
      },
      'market-exchange': {
        id: 'market-exchange',
        x: 360,
        y: 0,
        title: 'RIVER MARKET BRIDGE',
        color: '#fbbf24',
        prompt: 'Trade Goods & Eat Ration (+45% Stamina & +Sales Power)',
        actionType: 'trade'
      },
      'charter-court': {
        id: 'charter-court',
        x: 0,
        y: 210,
        title: 'ARCHON CHARTER MONOLITH',
        color: '#f472b6',
        prompt: 'Toggle wage reform (Archon only)',
        actionType: 'law'
      },
      'core': {
        id: 'core',
        x: 0,
        y: 0,
        title: 'TOWN PLAZA & TREASURY',
        color: '#22d3ee',
        prompt: 'Upgrade All Mainland Buildings (15 Treasury GCOIN)',
        actionType: 'upgrade'
      }
    };

    // Decorative 3D Voxel Trees arranged along the isometric diamond coastline
    this.trees = [
      { x: -110, y: -210 }, { x: -40, y: -245 }, { x: 40, y: -245 }, { x: 110, y: -210 },
      { x: -460, y: -55 }, { x: -495, y: 0 }, { x: -450, y: 65 },
      { x: 450, y: -60 }, { x: 495, y: 0 }, { x: 455, y: 60 },
      { x: -290, y: 145 }, { x: -210, y: 185 }, { x: 210, y: 185 }, { x: 290, y: 145 }
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
    const v = '?v=sharp3';
    const manifest = {
      pixelFarmer: './assets/sprites/pixel-farmer.png' + v,
      pixelEngineer: './assets/sprites/pixel-engineer.png' + v,
      pixelManager: './assets/sprites/pixel-manager.png' + v,
      pixelArchon: './assets/sprites/pixel-archon.png' + v,
      pixelCastle: './assets/sprites/pixel-castle.png' + v,
      pixelWorkstation: './assets/sprites/pixel-workstation.png' + v,
      pixelBridge: './assets/sprites/pixel-bridge.png' + v,
      pixelMonolith: './assets/sprites/pixel-monolith.png' + v,
      pixelClubhouse: './assets/sprites/pixel-clubhouse.png' + v,
      pixelTree: './assets/sprites/pixel-tree.png' + v,
      pixelHouse: './assets/sprites/pixel-house.png' + v,
      pixelFactory: './assets/sprites/pixel-factory.png' + v,
      pixelShop: './assets/sprites/pixel-shop.png' + v,
      pixelPaddlefield: './assets/sprites/pixel-paddlefield.png' + v,
      toolScythe: './assets/sprites/pixel-tool-scythe.png' + v,
      toolWrench: './assets/sprites/pixel-tool-wrench.png' + v,
      toolRacket: './assets/sprites/pixel-tool-racket.png' + v,
      toolHammer: './assets/sprites/pixel-tool-hammer.png' + v,
      ancestorSvg: './assets/sprites/char-ancestor.svg' + v
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

  // Clamp any (x, y) point inside the 2.5D Isometric Diamond Continent (|x|/580 + |y|/290 <= 1)
  _clampToIsoContinent(x, y) {
    const maxW = 550;
    const maxD = 275;
    const norm = Math.abs(x) / maxW + Math.abs(y) / maxD;
    if (norm > 1) {
      return { x: (x / norm) * 0.98, y: (y / norm) * 0.98 };
    }
    return { x, y };
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

    for (const lin of this.society.lineages) {
      const ent = this.entities[lin.id];
      if (!ent) continue;
      if (Math.hypot(wx - ent.x, wy - (ent.y - 16)) < 26 && lin.id !== this.playerAgentId) {
        if (this.callbacks.onSelectAgent) {
          this.callbacks.onSelectAgent(lin.id);
        }
        return;
      }
    }

    const playerEnt = this.entities[this.playerAgentId];
    if (playerEnt) {
      const clamped = this._clampToIsoContinent(wx, wy);
      playerEnt.targetX = clamped.x;
      playerEnt.targetY = clamped.y;
      this.camera.followPlayer = true;
      this.spawnBurst(clamped.x, clamped.y, '#fde047', 4);
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
      farmer: { x: -220, y: -105 },
      engineer: { x: 220, y: -105 },
      manager: { x: -130, y: 75 }
    };

    this.society.lineages.forEach((lin, idx) => {
      if (!lin.toolLevel) lin.toolLevel = 1;
      if (!this.entities[lin.id]) {
        const base = roleStarts[lin.role] || { x: 0, y: 20 };
        const angle = (idx / this.society.lineages.length) * Math.PI * 2;
        this.entities[lin.id] = {
          id: lin.id,
          x: base.x + Math.cos(angle) * 38,
          y: base.y + Math.sin(angle) * 20,
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

  buildStructureOnLand(type, ownerId, customX = null, customY = null) {
    const ent = this.entities[ownerId] || this.getPlayerEntity();
    let bx = customX !== null ? customX : (ent ? ent.x : 0);
    let by = customY !== null ? customY : (ent ? ent.y - 10 : 0);

    let snappedPlot = null;
    for (const plot of this.buildPlots) {
      const occupied = this.placedBuildings.some((b) => Math.hypot(b.x - plot.x, b.y - plot.y) < 52);
      if (!occupied && Math.hypot(bx - plot.x, by - plot.y) < 82) {
        snappedPlot = plot;
        break;
      }
    }
    if (snappedPlot) {
      bx = snappedPlot.x;
      by = snappedPlot.y;
    } else {
      for (const b of this.placedBuildings) {
        if (Math.hypot(bx - b.x, by - b.y) < 58) {
          bx += (Math.random() > 0.5 ? 64 : -64);
          by += (Math.random() - 0.5) * 32;
        }
      }
    }

    const clamped = this._clampToIsoContinent(bx, by);
    bx = Math.round(clamped.x);
    by = Math.round(clamped.y);

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
          house: 'Rest at House (restore stamina)',
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
    this.pixelScale = this.pixelScale === 1 ? 2 : this.pixelScale === 2 ? 3 : 1;
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

      const nextPos = this._clampToIsoContinent(
        playerEnt.x + playerEnt.vx * dt,
        playerEnt.y + playerEnt.vy * dt
      );
      playerEnt.x = nextPos.x;
      playerEnt.y = nextPos.y;
      if (Math.abs(playerEnt.vx) > 5) {
        playerEnt.facing = playerEnt.vx > 0 ? 1 : -1;
      }

      if (this.camera.followPlayer) {
        const desiredX = -playerEnt.x * this.camera.zoom * 0.32;
        const desiredY = -playerEnt.y * this.camera.zoom * 0.32 + 14;
        this.camera.x += (desiredX - this.camera.x) * Math.min(1, dt * 5);
        this.camera.y += (desiredY - this.camera.y) * Math.min(1, dt * 5);
      }
    }

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
        const c = this._clampToIsoContinent(
          dest.x + (Math.random() - 0.5) * 60,
          dest.y + (Math.random() - 0.5) * 30 + 8
        );
        ent.targetX = c.x;
        ent.targetY = c.y;
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
      targetCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      targetCtx.imageSmoothingEnabled = true;
      targetCtx.imageSmoothingQuality = 'high';
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
    ctx.translate(Math.round(this.width * 0.5 + this.camera.x), Math.round(this.height * 0.5 + this.camera.y));
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.imageSmoothingEnabled = this.pixelScale === 1;
    if (this.pixelScale === 1) ctx.imageSmoothingQuality = 'high';

    const nearestHotspot = this.getNearestHotspot();

    // 1. TRUE 2.5D ISOMETRIC DIAMOND VOXEL CONTINENT (Stepped 3D Slabs, Isometric Tile Grid, Isometric Roads & River)
    this._drawIsoVoxelContinent(ctx, nearestHotspot);

    // 2. Core Mainland Landmarks on 2.5D Terraces
    this._drawMainlandLandmarks(ctx, nearestHotspot);

    // 3. Y-Sorted Render of Trees, Built Structures (House, Factory, Shop, Paddlefield), Agents & Particles
    this._drawSortedEntitiesAndBuildings(ctx, nearestHotspot);

    // 4. Ascension Beams & Popups
    this._drawBeamsAndPopups(ctx);
    this._drawRain(ctx);

    ctx.restore();
  }

  // Draw a 3D Extruded Isometric Diamond Slab (2:1 isometric projection with Top, Left, and Right 3D faces)
  _drawIsoSlab(ctx, cx, cy, halfW, halfD, thickness, colors) {
    const top = { x: cx, y: cy - halfD };
    const right = { x: cx + halfW, y: cy };
    const bottom = { x: cx, y: cy + halfD };
    const left = { x: cx - halfW, y: cy };

    if (colors.shadow) {
      ctx.fillStyle = colors.shadow;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y + thickness + 14);
      ctx.lineTo(right.x + 18, right.y + thickness + 14);
      ctx.lineTo(bottom.x, bottom.y + thickness + 22);
      ctx.lineTo(left.x - 18, left.y + thickness + 14);
      ctx.closePath();
      ctx.fill();
    }

    // Left 3D extruded cliff face
    if (thickness > 0) {
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.lineTo(bottom.x, bottom.y + thickness);
      ctx.lineTo(left.x, left.y + thickness);
      ctx.closePath();
      ctx.fillStyle = colors.left;
      ctx.fill();
      if (colors.stroke) {
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Right 3D extruded cliff face
      ctx.beginPath();
      ctx.moveTo(bottom.x, bottom.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(right.x, right.y + thickness);
      ctx.lineTo(bottom.x, bottom.y + thickness);
      ctx.closePath();
      ctx.fillStyle = colors.right;
      ctx.fill();
      if (colors.stroke) {
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    // Top Isometric Diamond Surface
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fillStyle = colors.top;
    ctx.fill();
    if (colors.topStroke) {
      ctx.strokeStyle = colors.topStroke;
      ctx.lineWidth = colors.topStrokeWidth || 2;
      ctx.stroke();
    }
  }

  _drawOceanBackdrop(ctx) {
    const w = this.width;
    const h = this.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.weatherMode === 'sunny') {
      grad.addColorStop(0, '#0369a1');
      grad.addColorStop(0.5, '#0284c7');
      grad.addColorStop(1, '#0c4a6e');
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

    // Isometric diamond wave crests on the ocean
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 36; i++) {
      const wx = ((i * 193 + Math.floor(this.time * 16)) % w);
      const wy = ((i * 107) % h);
      ctx.beginPath();
      ctx.moveTo(wx - 10, wy);
      ctx.lineTo(wx, wy - 5);
      ctx.lineTo(wx + 10, wy);
      ctx.stroke();
    }
  }

  // Draws the entire Mainland as a multi-tiered 2.5D Isometric Voxel Diorama Continent
  _drawIsoVoxelContinent(ctx) {
    // TIER 0: Animated Ocean Foam Ring lapping at the isometric continent base
    const foamPulse = Math.sin(this.time * 3) * 6;
    this._drawIsoSlab(ctx, 0, 24, 650 + foamPulse, 325 + foamPulse * 0.5, 0, {
      top: 'rgba(186, 230, 253, 0.38)',
      topStroke: 'rgba(255, 255, 255, 0.55)',
      topStrokeWidth: 2
    });

    // TIER 1: Deep Bedrock & Terracotta Cliff Base Slab (3D extruded cliff face plunging into the sea)
    this._drawIsoSlab(ctx, 0, 14, 636, 318, 28, {
      top: '#92400e',
      left: '#5c2808',
      right: '#3b1804',
      stroke: '#0f172a',
      shadow: 'rgba(2, 6, 23, 0.45)'
    });

    // TIER 2: Golden Sandy Beach Shoreline Terrace (extruded 3D sand & soil rim)
    this._drawIsoSlab(ctx, 0, 4, 616, 308, 14, {
      top: '#fde68a',
      left: '#d97706',
      right: '#b45309',
      stroke: '#451a03',
      topStroke: '#fef08a',
      topStrokeWidth: 1.5
    });

    // TIER 3: Main Emerald Meadow Continent Deck (extruded 3D turf slab)
    this._drawIsoSlab(ctx, 0, -6, 588, 294, 14, {
      top: '#22c55e',
      left: '#15803d',
      right: '#14532d',
      stroke: '#0f172a',
      topStroke: '#86efac',
      topStrokeWidth: 2
    });

    // Isometric Checkerboard Grass Tiles across the Mainland Deck (12x12 isometric grid)
    const gridN = 12;
    const tileHW = 560 / gridN; // ~46.6
    const tileHD = 280 / gridN; // ~23.3
    for (let gx = -gridN / 2 + 0.5; gx < gridN / 2; gx += 1) {
      for (let gy = -gridN / 2 + 0.5; gy < gridN / 2; gy += 1) {
        const ix = (gx - gy) * tileHW;
        const iy = (gx + gy) * tileHD - 6;
        const isEven = ((Math.round(gx + 10) + Math.round(gy + 10)) & 1) === 0;
        this._drawIsoSlab(ctx, ix, iy, tileHW - 1, tileHD - 0.5, 0, {
          top: isEven ? '#22c55e' : '#16a34a',
          topStroke: 'rgba(20, 83, 45, 0.18)',
          topStrokeWidth: 1
        });
      }
    }

    // Isometric River Channel cutting diagonally along the East valley (gx = 2.5, gy from -5.5 to +5.5)
    for (let s = -5.5; s <= 5.5; s += 0.5) {
      const gx = 2.6;
      const gy = s;
      const rx = (gx - gy) * tileHW;
      const ry = (gx + gy) * tileHD - 6;
      const foam = ((Math.floor(this.time * 5) + Math.round(s * 2)) % 4) === 0;
      this._drawIsoSlab(ctx, rx, ry + 3, 28, 14, 4, {
        top: foam ? '#7dd3fc' : '#0284c7',
        left: '#0369a1',
        right: '#075985',
        topStroke: '#bae6fd',
        topStrokeWidth: 1
      });
    }

    // Isometric Cobblestone Roads running along the two true 2:1 isometric axes (gx = 0 and gy = 0)
    for (let r = -5; r <= 5; r += 0.5) {
      // Axis 1 road (SW <-> NE)
      const rx1 = r * tileHW;
      const ry1 = -r * tileHD - 6;
      this._drawIsoSlab(ctx, rx1, ry1, 24, 12, 3, {
        top: '#e7e5e4',
        left: '#a8a29e',
        right: '#78716c',
        topStroke: '#d6d3d1',
        topStrokeWidth: 1
      });

      // Axis 2 road (NW <-> SE)
      const rx2 = r * tileHW;
      const ry2 = r * tileHD - 6;
      this._drawIsoSlab(ctx, rx2, ry2, 24, 12, 3, {
        top: '#e7e5e4',
        left: '#a8a29e',
        right: '#78716c',
        topStroke: '#d6d3d1',
        topStrokeWidth: 1
      });
    }

    // Elevated 2.5D Isometric Highland Terraces for the Core Landmarks:
    // 1. NW Golden Wheat Highland Terrace (-260, -130)
    this._drawIsoSlab(ctx, -260, -130, 108, 54, 14, {
      top: '#4ade80',
      left: '#15803d',
      right: '#166534',
      stroke: '#0f172a',
      topStroke: '#bbf7d0'
    });

    // 2. NE Engineer Foundry Highland Terrace (260, -130)
    this._drawIsoSlab(ctx, 260, -130, 108, 54, 14, {
      top: '#475569',
      left: '#334155',
      right: '#1e293b',
      stroke: '#0f172a',
      topStroke: '#38bdf8'
    });

    // 3. Central Town & Treasury Isometric Diamond Plaza (0, 0)
    this._drawIsoSlab(ctx, 0, 0, 88, 44, 10, {
      top: '#1e1b4b',
      left: '#17153b',
      right: '#0f0e26',
      stroke: '#0f172a',
      topStroke: '#22d3ee',
      topStrokeWidth: 2.2
    });

    // 4. 2.5D Isometric Diamond Build Pads (+ BUILD PLOT)
    this.buildPlots.forEach((plot) => {
      const occupied = this.placedBuildings.some((b) => Math.hypot(b.x - plot.x, b.y - plot.y) < 48);
      if (occupied) return;
      this._drawIsoSlab(ctx, plot.x, plot.y, 44, 22, 5, {
        top: 'rgba(254, 240, 138, 0.22)',
        left: 'rgba(217, 119, 6, 0.45)',
        right: 'rgba(180, 83, 9, 0.45)',
        topStroke: '#fde047',
        topStrokeWidth: 1.5
      });
      ctx.fillStyle = '#fef08a';
      ctx.font = '900 7.5px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+ BUILD PAD', plot.x, plot.y + 3);
    });
  }

  _drawMainlandLandmarks(ctx, nearestHotspot) {
    // 1. NW Golden Wheat Terrace & Granary Keep (-260, -130)
    {
      const lm = this.landmarks['farmstead'];
      const cx = lm.x;
      const cy = lm.y - 10;
      // Isometric tilled soil diamond
      this._drawIsoSlab(ctx, cx, cy + 12, 72, 36, 4, {
        top: '#78350f',
        left: '#451a03',
        right: '#27170b',
        topStroke: '#92400e'
      });
      // Swaying Golden Wheat Stalks arranged in isometric diamond rows
      const sway = Math.round(Math.sin(this.time * 4) * 2);
      for (let u = -2; u <= 2; u++) {
        for (let v = -2; v <= 2; v++) {
          const wx = cx + (u - v) * 12;
          const wy = cy + 10 + (u + v) * 6;
          ctx.fillStyle = '#fde047';
          ctx.fillRect(wx - 2 + sway, wy - 9, 5, 9);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(wx - 2, wy - 2, 5, 3);
        }
      }
      if (this._isReady('pixelCastle')) {
        ctx.drawImage(this.sprites.pixelCastle, cx - 48, cy - 88, 96, 96);
      }
      this._drawZoneSign(ctx, cx, cy + 52, '🌾 WHEAT TERRACE', lm.color, nearestHotspot && nearestHotspot.id === 'farmstead');
    }

    // 2. NE Engineer Foundry Ridge (260, -130)
    {
      const lm = this.landmarks['workshop'];
      const cx = lm.x;
      const cy = lm.y - 10;
      if (this._isReady('pixelWorkstation')) {
        ctx.drawImage(this.sprites.pixelWorkstation, cx - 60, cy - 60, 68, 68);
        ctx.drawImage(this.sprites.pixelWorkstation, cx + 2, cy - 60, 68, 68);
      }
      this._drawZoneSign(ctx, cx, cy + 44, '⚙️ ENGINEER RIDGE', lm.color, nearestHotspot && nearestHotspot.id === 'workshop');
    }

    // 3. West Lineage Ascension Shrine (-380, 0)
    {
      const lm = this.landmarks['lineage-hall'];
      const cx = lm.x;
      const cy = lm.y;
      this._drawIsoSlab(ctx, cx, cy, 66, 33, 12, {
        top: '#581c87',
        left: '#3b0764',
        right: '#2e1065',
        topStroke: '#fde047'
      });
      if (this._isReady('ancestorSvg')) {
        ctx.drawImage(this.sprites.ancestorSvg, cx - 38, cy - 52, 34, 42);
        ctx.drawImage(this.sprites.ancestorSvg, cx + 6, cy - 52, 34, 42);
      }
      this._drawZoneSign(ctx, cx, cy + 38, '🧬 LINEAGE SHRINE', lm.color, nearestHotspot && nearestHotspot.id === 'lineage-hall');
    }

    // 4. East River Market Bridge (360, 0)
    {
      const lm = this.landmarks['market-exchange'];
      const cx = lm.x;
      const cy = lm.y;
      if (this._isReady('pixelBridge')) {
        ctx.drawImage(this.sprites.pixelBridge, cx - 52, cy - 64, 104, 104);
      }
      this._drawZoneSign(ctx, cx, cy + 40, '🛒 MARKET BRIDGE', lm.color, nearestHotspot && nearestHotspot.id === 'market-exchange');
    }

    // 5. South Archon Charter Monolith (0, 210)
    {
      const lm = this.landmarks['charter-court'];
      const cx = lm.x;
      const cy = lm.y;
      this._drawIsoSlab(ctx, cx, cy, 68, 34, 10, {
        top: '#334155',
        left: '#1e293b',
        right: '#0f172a',
        topStroke: '#f472b6'
      });
      if (this._isReady('pixelMonolith')) {
        ctx.drawImage(this.sprites.pixelMonolith, cx - 48, cy - 82, 96, 96);
      }
      this._drawZoneSign(ctx, cx, cy + 38, '👑 CHARTER MONOLITH', lm.color, nearestHotspot && nearestHotspot.id === 'charter-court');
    }

    // 6. Central Town Plaza & Treasury Core (0, 0)
    {
      const lm = this.landmarks['core'];
      const cx = lm.x;
      const cy = lm.y - 8;
      const treasury = this.society ? this.society.treasuryBalance : 115;
      this._drawIsoSlab(ctx, cx, cy, 48, 24, 18, {
        top: '#0ea5e9',
        left: '#0284c7',
        right: '#0369a1',
        topStroke: '#fef08a'
      });
      this._drawZoneSign(ctx, cx, cy + 38, `🏦 TREASURY: ${treasury}G`, lm.color, nearestHotspot && nearestHotspot.id === 'core');
    }
  }

  _drawZoneSign(ctx, x, y, text, borderCol, isNear) {
    const w = Math.max(118, text.length * 6.5 + 14);
    ctx.fillStyle = isNear ? '#fde047' : 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = isNear ? '#0f172a' : borderCol;
    ctx.lineWidth = 2;
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - 10), w, 18);
    ctx.strokeRect(Math.round(x - w / 2), Math.round(y - 10), w, 18);
    ctx.fillStyle = isNear ? '#0f172a' : '#ffffff';
    ctx.font = '900 8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, Math.round(x), Math.round(y + 2));
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

    this.trees.forEach((t) => {
      renderables.push({ kind: 'tree', y: t.y, data: t });
    });

    this.placedBuildings.forEach((b) => {
      renderables.push({ kind: 'building', y: b.y, data: b });
    });

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
          ctx.drawImage(this.sprites.pixelTree, Math.round(item.data.x - 26), Math.round(item.data.y - 46), 52, 52);
        }
      } else if (item.kind === 'building') {
        this._drawPlacedBuilding(ctx, item.data, nearestHotspot);
      } else if (item.kind === 'agent') {
        this._drawAgentWithTool(ctx, item.lin, item.ent, archonId);
      }
    });

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
    const size = b.type === 'paddlefield' ? 132 : 106;

    if (this._isReady(key)) {
      ctx.drawImage(this.sprites[key], Math.round(b.x - size / 2), Math.round(b.y - size * 0.72), size, size);
    }

    if (b.type === 'factory') {
      const puffY = (this.time * 18 + b.ballPhase * 10) % 24;
      ctx.fillStyle = 'rgba(241, 245, 249, 0.78)';
      ctx.fillRect(b.x - 14, b.y - 66 - puffY, 8, 6);
      ctx.fillRect(b.x + 2, b.y - 70 - puffY * 0.8, 9, 6);
    } else if (b.type === 'paddlefield') {
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
      b.y + 26,
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
      ctx.drawImage(this.sprites[spriteKey], -27, -50, 54, 54);

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
        ctx.translate(15, -22);
        ctx.rotate(swingAngle);
        ctx.drawImage(this.sprites[toolKey], -15, -20, 32, 32);
        ctx.restore();
      }
      ctx.restore();
    }

    const tagY = ay - 56;
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
