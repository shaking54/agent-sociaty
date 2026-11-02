// Pixel-Art 3D & 2.5D Isometric Floating-Island Society Simulator Engine
// Visual style inspired by:
// - https://www.tripo3d.ai/3d-prompts/pixel-art-tennis-club-3d-game (Pixel-Art 3D Floating-Island Diorama, Dynamic Weather, Nearest-Neighbor Pixel Shader)
// - https://www.gamoji.ai/images/blog/foundation-models-6-roles.jpg (6-Role Isometric Command Observatory)

window.IsometricSocietyScene = class IsometricSocietyScene {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    // Offscreen low-res pixel buffer for authentic Pixel-Art 3D rendering
    this.pixelCanvas = document.createElement('canvas');
    this.pixelCtx = this.pixelCanvas.getContext('2d');

    this.camera = {
      x: 0,
      y: 18,
      zoom: 1.0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      hasMoved: false
    };

    this.time = 0;
    this.society = null;
    this.selectedAgentId = null;
    this.selectedIslandId = null;
    this.hoveredHit = null;
    this.showNeedBars = true;
    this.showConduitPackets = true;

    // Pixel-Art 3D visual controls:
    // pixelScale: 2 = Crisp 16-bit Pixel-Art 3D, 3 = Chunky Retro 8-bit 3D, 1 = HD Voxel
    this.pixelScale = 2;
    // weatherMode: 'sunny' | 'sunset' | 'rain' | 'night'
    this.weatherMode = 'sunny';
    // useWorldMapBoard: false = Floating Sky Islands (Tripo3D Pixel-Art 3D style), true = Generated Diorama Map Board
    this.useWorldMapBoard = false;

    this.hitRegions = [];
    this.activePackets = [];
    this.floatingPopups = [];
    this.agentWalkers = {}; // lineageId -> { fromIsland, toIsland, startedAt, duration }

    // Pre-generate drifting pixel clouds & rain particles
    this.clouds = [
      { x: -580, y: -310, w: 86, h: 26, speed: 12 },
      { x: -180, y: -350, w: 110, h: 32, speed: 9 },
      { x: 240, y: -320, w: 94, h: 28, speed: 14 },
      { x: 520, y: -260, w: 76, h: 22, speed: 11 },
      { x: -490, y: 260, w: 88, h: 24, speed: 10 },
      { x: 430, y: 285, w: 98, h: 28, speed: 13 }
    ];

    this.rainDrops = Array.from({ length: 75 }, (_, i) => ({
      x: ((i * 97) % 1400) - 700,
      y: ((i * 61) % 860) - 430,
      len: 10 + (i % 7),
      speed: 260 + (i % 5) * 35
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
      // Crisp 64x64 / 96x96 palette-quantized Pixel-Art 3D sprites
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
      // High-res voxel sprites & SVG props
      hdFarmer: './assets/sprites/farmer.png',
      hdEngineer: './assets/sprites/engineer.png',
      hdManager: './assets/sprites/manager.png',
      hdArchon: './assets/sprites/archon.png',
      hdCastle: './assets/sprites/castle.png',
      hdWorkstation: './assets/sprites/workstation.png',
      hdBridge: './assets/sprites/bridge.png',
      hdMonolith: './assets/sprites/monolith.png',
      ancestorSvg: './assets/sprites/char-ancestor.svg',
      botSvg: './assets/sprites/char-bot.svg',
      worldMap: './assets/iso-world-map.jpg'
    };

    Object.entries(manifest).forEach(([key, src]) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      this.sprites[key] = img;
    });
  }

  _isReady(key) {
    const img = this.sprites[key];
    return Boolean(img && img.complete && img.naturalWidth > 0);
  }

  _startLoop() {
    const tick = (ts) => {
      this.time = ts * 0.001;
      this.render();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.camera.isDragging = true;
      this.camera.hasMoved = false;
      this.camera.dragStartX = e.clientX - this.camera.x;
      this.camera.dragStartY = e.clientY - this.camera.y;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.camera.isDragging) {
        const nx = e.clientX - this.camera.dragStartX;
        const ny = e.clientY - this.camera.dragStartY;
        if (Math.hypot(nx - this.camera.x, ny - this.camera.y) > 4) {
          this.camera.hasMoved = true;
        }
        this.camera.x = nx;
        this.camera.y = ny;
        return;
      }

      if (mx >= 0 && my >= 0 && mx <= rect.width && my <= rect.height) {
        this._updateHover(mx, my);
      } else {
        this.hoveredHit = null;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.camera.isDragging && !this.camera.hasMoved) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        this._handleClick(mx, my);
      }
      this.camera.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._userZoomed = true;
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      this.camera.zoom = Math.max(0.58, Math.min(1.95, this.camera.zoom * factor));
    }, { passive: false });
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 1200;
    this.height = rect.height || 720;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.dpr = dpr;
    const scaleFit = Math.min(this.width / 1340, this.height / 800);
    if (!this._userZoomed) {
      this.camera.zoom = Math.max(0.7, Math.min(1.16, scaleFit));
    }
  }

  resetCamera() {
    this._userZoomed = false;
    const scaleFit = Math.min(this.width / 1340, this.height / 800);
    this.camera.x = 0;
    this.camera.y = 18;
    this.camera.zoom = Math.max(0.7, Math.min(1.16, scaleFit));
  }

  zoomBy(factor) {
    this._userZoomed = true;
    this.camera.zoom = Math.max(0.58, Math.min(1.95, this.camera.zoom * factor));
  }

  cyclePixelMode() {
    if (this.pixelScale === 2) {
      this.pixelScale = 3;
    } else if (this.pixelScale === 3) {
      this.pixelScale = 1;
    } else {
      this.pixelScale = 2;
    }
    return this.pixelScale;
  }

  cycleWeatherMode() {
    const order = ['sunny', 'sunset', 'rain', 'night'];
    const next = order[(order.indexOf(this.weatherMode) + 1) % order.length];
    this.weatherMode = next;
    return this.weatherMode;
  }

  toggleWorldBoard() {
    this.useWorldMapBoard = !this.useWorldMapBoard;
    return this.useWorldMapBoard;
  }

  setSociety(society) {
    this.society = society;
  }

  setSelectedAgent(agentId) {
    this.selectedAgentId = agentId;
  }

  setSelectedIsland(islandId) {
    this.selectedIslandId = islandId;
  }

  spawnFloatingPopup(islandOrLineageId, text, color = '#fbbf24') {
    const islandId = this._resolveIslandId(islandOrLineageId);
    this.floatingPopups.push({
      islandId,
      text,
      color,
      jitterX: (Math.random() - 0.5) * 44,
      createdAt: this.time,
      duration: 2.6
    });
  }

  sendAgentExcursion(lineageId, targetIslandId, duration = 2.0) {
    const homeIsland = this._resolveIslandId(lineageId);
    if (homeIsland === targetIslandId) return;
    this.agentWalkers[lineageId] = {
      fromIsland: homeIsland,
      toIsland: targetIslandId,
      startedAt: this.time,
      duration
    };
  }

  triggerMessagePulse(msg) {
    if (!msg) return;
    const fromIsland = this._resolveIslandId(msg.from);
    const toIsland = msg.category === 'handover'
      ? 'lineage-hall'
      : msg.category === 'trade' || msg.category === 'trade+work'
        ? 'market-exchange'
        : this._resolveIslandId(msg.to);

    this.activePackets.push({
      fromIsland,
      toIsland,
      color: msg.category === 'handover'
        ? '#c084fc'
        : msg.category === 'trade' || msg.category === 'trade+work'
          ? '#fbbf24'
          : '#22d3ee',
      label: `${msg.from} → ${msg.to}`,
      createdAt: this.time,
      duration: 1.9
    });

    this.sendAgentExcursion(msg.from, toIsland, 1.9);
    if (msg.ledgerAction) {
      this.spawnFloatingPopup(
        msg.from,
        msg.ledgerAction.slice(0, 38),
        msg.category === 'handover' ? '#c084fc' : '#34d399'
      );
    }
  }

  _resolveIslandId(id) {
    if (!id) return 'town-hall';
    const knownIslands = ['farmstead', 'workshop', 'lineage-hall', 'market-exchange', 'charter-court', 'town-hall'];
    if (knownIslands.includes(id)) return id;
    if (id.startsWith('farmer')) return 'farmstead';
    if (id.startsWith('engineer')) return 'workshop';
    return 'town-hall';
  }

  _screenToWorld(sx, sy) {
    const cx = this.width * 0.5 + this.camera.x;
    const cy = this.height * 0.52 + this.camera.y;
    return {
      x: (sx - cx) / this.camera.zoom,
      y: (sy - cy) / this.camera.zoom
    };
  }

  _updateHover(sx, sy) {
    const pt = this._screenToWorld(sx, sy);
    let found = null;
    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const r = this.hitRegions[i];
      if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
        found = r;
        break;
      }
    }
    this.hoveredHit = found;
    this.canvas.style.cursor = found ? 'pointer' : (this.camera.isDragging ? 'grabbing' : 'grab');
  }

  _handleClick(sx, sy) {
    this._updateHover(sx, sy);
    if (!this.hoveredHit) return;
    if (this.hoveredHit.type === 'agent' && this.callbacks.onSelectAgent) {
      this.callbacks.onSelectAgent(this.hoveredHit.id);
    } else if (this.hoveredHit.type === 'island' && this.callbacks.onSelectIsland) {
      this.callbacks.onSelectIsland(this.hoveredHit.id);
    } else if (this.hoveredHit.type === 'core' && this.callbacks.onSelectCore) {
      this.callbacks.onSelectCore();
    }
  }

  render() {
    // Determine whether we render through the low-res Pixel-Art 3D frame buffer or native HD
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

    this._renderSceneWorld(targetCtx);
    targetCtx.restore();

    if (usePixelShader) {
      // Blit the low-res pixel-art buffer onto the main display canvas using nearest-neighbor upscaling
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

      // Subtle retro pixel scanlines when in 3x Retro 8-Bit mode
      if (pScale >= 3) {
        mainCtx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        for (let y = 0; y < this.canvas.height; y += 4) {
          mainCtx.fillRect(0, y, this.canvas.width, 1.5);
        }
      }
      mainCtx.restore();
    }

    // Draw crisp UI hover tooltip on top
    if (this.hoveredHit) {
      this.ctx.save();
      this.ctx.scale(this.dpr, this.dpr);
      this._drawHoverTooltip(this.ctx);
      this.ctx.restore();
    }
  }

  _renderSceneWorld(ctx) {
    this._drawSkyAndWeatherBackdrop(ctx);

    ctx.save();
    ctx.translate(this.width * 0.5 + this.camera.x, this.height * 0.52 + this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.imageSmoothingEnabled = false;

    this.hitRegions = [];

    // Drifting 3D pixel clouds behind islands
    this._drawDriftingPixelClouds(ctx, 'back');

    // Optional generated 2.5D Isometric World Map board (or floating sky island sanctuary)
    if (this.useWorldMapBoard && this._isReady('worldMap')) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.drawImage(this.sprites.worldMap, -688, -384, 1376, 768);
      ctx.restore();
    } else {
      this._drawFloatingSkySanctuaryFrame(ctx);
    }

    const islandCoords = this.useWorldMapBoard
      ? {
          'farmstead': { x: -235, y: -145 },
          'workshop': { x: 265, y: -145 },
          'town-hall': { x: -375, y: 25 },
          'lineage-hall': { x: 360, y: 25 },
          'charter-court': { x: -205, y: 195 },
          'market-exchange': { x: 210, y: 195 }
        }
      : {
          'farmstead': { x: -255, y: -155 },
          'workshop': { x: 255, y: -155 },
          'lineage-hall': { x: -375, y: 15 },
          'market-exchange': { x: 375, y: 15 },
          'charter-court': { x: -230, y: 185 },
          'town-hall': { x: 230, y: 185 }
        };
    this._islandCoords = islandCoords;

    this._drawDataConduits(ctx, islandCoords);
    if (!this.useWorldMapBoard) {
      this._drawOperatorWorkstations(ctx);
    }

    // Back row floating islands
    this._drawIslandPod(ctx, 'farmstead', islandCoords['farmstead'].x, islandCoords['farmstead'].y);
    this._drawIslandPod(ctx, 'workshop', islandCoords['workshop'].x, islandCoords['workshop'].y);

    // Mid row floating islands
    if (this.useWorldMapBoard) {
      this._drawIslandPod(ctx, 'town-hall', islandCoords['town-hall'].x, islandCoords['town-hall'].y);
      this._drawIslandPod(ctx, 'lineage-hall', islandCoords['lineage-hall'].x, islandCoords['lineage-hall'].y);
    } else {
      this._drawIslandPod(ctx, 'lineage-hall', islandCoords['lineage-hall'].x, islandCoords['lineage-hall'].y);
      this._drawIslandPod(ctx, 'market-exchange', islandCoords['market-exchange'].x, islandCoords['market-exchange'].y);
    }

    // Central Foundation & Treasury Core
    this._drawCentralFoundationCore(ctx, 0, 5);

    // Front row floating islands
    this._drawIslandPod(ctx, 'charter-court', islandCoords['charter-court'].x, islandCoords['charter-court'].y);
    if (this.useWorldMapBoard) {
      this._drawIslandPod(ctx, 'market-exchange', islandCoords['market-exchange'].x, islandCoords['market-exchange'].y);
    } else {
      this._drawIslandPod(ctx, 'town-hall', islandCoords['town-hall'].x, islandCoords['town-hall'].y);
    }

    // Agents walking across bridges
    this._drawWalkingAgentsOnBridges(ctx, islandCoords);

    // Animated packets & 3D floating combat/reward popups
    this._drawAnimatedPacketsAndPopups(ctx, islandCoords);

    // Foreground pixel clouds & weather particles (rain / sunbeams)
    this._drawDriftingPixelClouds(ctx, 'front');
    this._drawWeatherParticles(ctx);

    ctx.restore();
  }

  _drawSkyAndWeatherBackdrop(ctx) {
    const w = this.width;
    const h = this.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h);

    if (this.weatherMode === 'sunny') {
      // Tripo3D "Pixel-Art Tennis Club 3D Game" bright daytime sky blue gradient
      grad.addColorStop(0, '#1d4ed8');
      grad.addColorStop(0.38, '#38bdf8');
      grad.addColorStop(0.78, '#7dd3fc');
      grad.addColorStop(1, '#bae6fd');
    } else if (this.weatherMode === 'sunset') {
      // Golden hour pixel sunset
      grad.addColorStop(0, '#311042');
      grad.addColorStop(0.35, '#9d174d');
      grad.addColorStop(0.7, '#f97316');
      grad.addColorStop(1, '#fde047');
    } else if (this.weatherMode === 'rain') {
      // Moody pixel rainstorm sky
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.45, '#1e293b');
      grad.addColorStop(0.85, '#334155');
      grad.addColorStop(1, '#475569');
    } else {
      // Cyber Observatory Night
      grad.addColorStop(0, '#060b19');
      grad.addColorStop(0.4, '#111836');
      grad.addColorStop(0.8, '#191d3a');
      grad.addColorStop(1, '#0d1021');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Pixel-art sun or moon & stars
    ctx.save();
    if (this.weatherMode === 'sunny' || this.weatherMode === 'sunset') {
      const sunX = Math.round(w * 0.82);
      const sunY = Math.round(h * 0.16);
      const sunCol = this.weatherMode === 'sunny' ? '#fef08a' : '#fb923c';
      const glowCol = this.weatherMode === 'sunny' ? 'rgba(253, 224, 71, 0.32)' : 'rgba(249, 115, 22, 0.38)';
      ctx.fillStyle = glowCol;
      ctx.fillRect(sunX - 38, sunY - 38, 76, 76);
      ctx.fillRect(sunX - 28, sunY - 28, 56, 56);
      ctx.fillStyle = sunCol;
      ctx.fillRect(sunX - 18, sunY - 18, 36, 36);
    } else {
      // Pixel stars in night/rain sky
      for (let i = 0; i < 48; i++) {
        const sx = ((i * 173) % w);
        const sy = ((i * 97) % Math.floor(h * 0.65));
        const twinkle = Math.sin(this.time * 2.5 + i) > 0.2 ? 4 : 2;
        ctx.fillStyle = i % 3 === 0 ? '#67e8f9' : '#f8fafc';
        ctx.fillRect(sx, sy, twinkle, twinkle);
      }
    }
    ctx.restore();
  }

  _drawDriftingPixelClouds(ctx, layer) {
    if (this.weatherMode === 'night') return;
    const cloudColor = this.weatherMode === 'sunset'
      ? { top: '#fed7aa', mid: '#fdba74', bot: '#f97316' }
      : this.weatherMode === 'rain'
        ? { top: '#94a3b8', mid: '#64748b', bot: '#475569' }
        : { top: '#ffffff', mid: '#e0f2fe', bot: '#bae6fd' };

    this.clouds.forEach((c, idx) => {
      if ((layer === 'back' && idx >= 4) || (layer === 'front' && idx < 4)) return;
      const cx = ((c.x + this.time * c.speed + 780) % 1560) - 780;
      const cy = c.y + Math.sin(this.time * 0.9 + idx) * 4;
      const w = c.w;
      const h = c.h;

      ctx.save();
      // Stepped 16-bit pixel cloud blocks
      ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
      ctx.fillRect(cx - w * 0.45, cy + 10, w * 0.9, h * 0.55);

      ctx.fillStyle = cloudColor.bot;
      ctx.fillRect(cx - w * 0.5, cy, w, h * 0.5);

      ctx.fillStyle = cloudColor.mid;
      ctx.fillRect(cx - w * 0.42, cy - h * 0.35, w * 0.84, h * 0.55);

      ctx.fillStyle = cloudColor.top;
      ctx.fillRect(cx - w * 0.26, cy - h * 0.65, w * 0.52, h * 0.5);
      ctx.restore();
    });
  }

  _drawWeatherParticles(ctx) {
    if (this.weatherMode !== 'rain') return;
    ctx.save();
    ctx.fillStyle = '#7dd3fc';
    this.rainDrops.forEach((d) => {
      const rx = ((d.x - this.time * 80 + 700) % 1400) - 700;
      const ry = ((d.y + this.time * d.speed + 430) % 860) - 430;
      // Stepped pixel raindrop diagonal
      ctx.fillRect(rx, ry, 2, 4);
      ctx.fillRect(rx - 2, ry + 4, 2, 4);
      ctx.fillRect(rx - 4, ry + 8, 2, 4);
    });
    ctx.restore();
  }

  _drawFloatingSkySanctuaryFrame(ctx) {
    ctx.save();
    // Subtle isometric sky-grid beneath the floating islands
    const isSunny = this.weatherMode === 'sunny' || this.weatherMode === 'sunset';
    ctx.fillStyle = isSunny ? 'rgba(15, 23, 42, 0.22)' : 'rgba(15, 23, 42, 0.68)';
    ctx.strokeStyle = isSunny ? 'rgba(255, 255, 255, 0.42)' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -390);
    ctx.lineTo(690, -35);
    ctx.lineTo(0, 355);
    ctx.lineTo(-690, -35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = isSunny ? 'rgba(255, 255, 255, 0.14)' : 'rgba(56, 189, 248, 0.09)';
    ctx.lineWidth = 1;
    for (let i = -520; i <= 520; i += 65) {
      ctx.beginPath();
      ctx.moveTo(i - 260, -210 + i * 0.5);
      ctx.lineTo(i + 260, 50 + i * 0.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i - 260, 50 - i * 0.5);
      ctx.lineTo(i + 260, -210 - i * 0.5);
      ctx.stroke();
    }

    this._drawWallNeonSign(ctx, -475, -180, 'left', 'PIXEL CLUB • DYNASTY', '#c084fc', '#a855f7');
    this._drawWallNeonSign(ctx, 475, -180, 'right', 'BLUEPRINT & TECH LAB', '#fbbf24', '#f59e0b');
    this._drawWallNeonSign(ctx, -505, 55, 'left', 'SKY ISLAND BRIDGE', '#22d3ee', '#06b6d4');
    this._drawWallNeonSign(ctx, 505, 55, 'right', 'AUTONOMOUS SOCIETY', '#34d399', '#10b981');

    const s = this.society;
    const harmony = s ? s.harmony : 90;
    const prosperity = s ? socProsperity(s) : 500;
    this._drawHoloWallScreen(ctx, -185, -265, 'left', `PROSPERITY: ${prosperity} PTS`, `ERA ${s ? s.era || 1 : 1} • 10K TOK HANDOVER`);
    this._drawHoloWallScreen(ctx, 185, -265, 'right', `HARMONY: ${harmony}%`, `LAWS ENACTED: ${s && s.activeLaws ? s.activeLaws.length : 3}`);

    ctx.restore();
  }

  _drawIsoPlatform(ctx, cx, cy, halfW, halfD, height, colors) {
    const topPts = [
      { x: cx, y: cy - halfD },
      { x: cx + halfW, y: cy },
      { x: cx, y: cy + halfD },
      { x: cx - halfW, y: cy }
    ];

    if (colors.shadow) {
      ctx.save();
      ctx.fillStyle = colors.shadow;
      ctx.beginPath();
      ctx.moveTo(cx, cy - halfD + height + 12);
      ctx.lineTo(cx + halfW + 14, cy + height + 12);
      ctx.lineTo(cx, cy + halfD + height + 18);
      ctx.lineTo(cx - halfW - 14, cy + height + 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Left vertical face
    ctx.beginPath();
    ctx.moveTo(topPts[3].x, topPts[3].y);
    ctx.lineTo(topPts[2].x, topPts[2].y);
    ctx.lineTo(topPts[2].x, topPts[2].y + height);
    ctx.lineTo(topPts[3].x, topPts[3].y + height);
    ctx.closePath();
    ctx.fillStyle = colors.left;
    ctx.fill();
    if (colors.stroke) {
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Right vertical face
    ctx.beginPath();
    ctx.moveTo(topPts[2].x, topPts[2].y);
    ctx.lineTo(topPts[1].x, topPts[1].y);
    ctx.lineTo(topPts[1].x, topPts[1].y + height);
    ctx.lineTo(topPts[2].x, topPts[2].y + height);
    ctx.closePath();
    ctx.fillStyle = colors.right;
    ctx.fill();
    if (colors.stroke) {
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Top face
    ctx.beginPath();
    ctx.moveTo(topPts[0].x, topPts[0].y);
    ctx.lineTo(topPts[1].x, topPts[1].y);
    ctx.lineTo(topPts[2].x, topPts[2].y);
    ctx.lineTo(topPts[3].x, topPts[3].y);
    ctx.closePath();
    ctx.fillStyle = colors.top;
    ctx.fill();
    if (colors.topStroke) {
      ctx.strokeStyle = colors.topStroke;
      ctx.lineWidth = colors.topStrokeWidth || 1.5;
      ctx.stroke();
    }

    if (colors.glowTrim) {
      ctx.save();
      ctx.strokeStyle = colors.glowTrim;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(topPts[3].x, topPts[3].y + height - 2);
      ctx.lineTo(topPts[2].x, topPts[2].y + height - 2);
      ctx.lineTo(topPts[1].x, topPts[1].y + height - 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw a Tripo3D-style Stepped Floating Earth/Rock Cliff Island Base + Pixel Vines
  _drawFloatingCliffUnderside(ctx, cx, cy, halfW, halfD, islandColor) {
    // Tier 1: Terracotta / warm earth layer
    this._drawIsoPlatform(ctx, cx, cy + 32, halfW * 0.82, halfD * 0.82, 16, {
      top: '#92400e',
      left: '#78350f',
      right: '#451a03',
      stroke: '#1e1b4b',
      shadow: 'rgba(15, 23, 42, 0.35)'
    });
    // Tier 2: Deep slate rock root
    this._drawIsoPlatform(ctx, cx, cy + 46, halfW * 0.56, halfD * 0.56, 15, {
      top: '#475569',
      left: '#334155',
      right: '#1e293b',
      stroke: '#0f172a'
    });
    // Tier 3: Bottom crystal/stone tip
    this._drawIsoPlatform(ctx, cx, cy + 58, halfW * 0.3, halfD * 0.3, 12, {
      top: '#334155',
      left: '#1e293b',
      right: '#0f172a',
      stroke: '#0f172a',
      glowTrim: islandColor
    });

    // Hanging green pixel vines along the cliff rim
    ctx.save();
    const vineOffsets = [-0.65, -0.35, -0.1, 0.25, 0.55];
    vineOffsets.forEach((vo, i) => {
      const vx = cx + vo * halfW;
      const vy = cy + (1 - Math.abs(vo)) * halfD + 4;
      const vLen = 10 + (i % 3) * 5;
      ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#15803d';
      for (let step = 0; step < vLen; step += 3) {
        ctx.fillRect(vx + ((step / 3) & 1) * 2, vy + step, 3, 3);
      }
    });
    ctx.restore();
  }

  _drawVoxel(ctx, x, y, s, h, topCol, leftCol, rightCol, outline = 'rgba(15,23,42,0.75)') {
    this._drawIsoPlatform(ctx, x, y, s, s * 0.5, h, {
      top: topCol,
      left: leftCol,
      right: rightCol,
      stroke: outline,
      topStroke: outline,
      topStrokeWidth: 1
    });
  }

  _drawIsoWallText(ctx, x, y, side, title, subtitle1, subtitle2, accentColor) {
    ctx.save();
    ctx.translate(x, y);
    if (side === 'left') {
      ctx.transform(1, 0.5, 0, 1, 0, 0);
    } else {
      ctx.transform(1, -0.5, 0, 1, 0, 0);
    }

    ctx.textAlign = 'center';
    ctx.font = '900 11px "Courier New", "JetBrains Mono", monospace';
    ctx.fillStyle = accentColor || '#38bdf8';
    ctx.fillText(title, 0, 0);

    ctx.font = '700 8px "Courier New", "JetBrains Mono", monospace';
    ctx.fillStyle = '#f8fafc';
    if (subtitle1) ctx.fillText(subtitle1, 0, 11);
    if (subtitle2) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(subtitle2, 0, 20);
    }
    ctx.restore();
  }

  _drawWallNeonSign(ctx, x, y, side, text, color, glow) {
    ctx.save();
    ctx.translate(x, y);
    if (side === 'left') {
      ctx.transform(1, -0.5, 0, 1, 0, 0);
    } else {
      ctx.transform(1, 0.5, 0, 1, 0, 0);
    }

    const w = 162;
    const h = 30;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  _drawHoloWallScreen(ctx, x, y, side, line1, line2) {
    ctx.save();
    ctx.translate(x, y);
    if (side === 'left') {
      ctx.transform(1, -0.46, 0, 1, 0, 0);
    } else {
      ctx.transform(1, 0.46, 0, 1, 0, 0);
    }

    const w = 148;
    const h = 58;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.fillStyle = '#fef08a';
    ctx.font = '900 8.5px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(line1, 0, -8);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 8px "Courier New", monospace';
    ctx.fillText(line2, 0, 8);

    for (let i = -45; i <= 45; i += 10) {
      const bh = 5 + Math.abs(Math.sin(this.time * 2 + i)) * 9;
      ctx.fillStyle = '#34d399';
      ctx.fillRect(i, 22 - bh, 6, bh);
    }
    ctx.restore();
  }

  _drawDataConduits(ctx, islandCoords) {
    const conduits = [
      { to: 'farmstead', colors: ['#22d3ee', '#a855f7', '#34d399'], elbow: { x: -135, y: -75 } },
      { to: 'workshop', colors: ['#38bdf8', '#c084fc', '#22d3ee'], elbow: { x: 135, y: -75 } },
      { to: 'lineage-hall', colors: ['#c084fc', '#22d3ee', '#f472b6'], elbow: { x: this.useWorldMapBoard ? 195 : -195, y: 10 } },
      { to: 'market-exchange', colors: ['#fbbf24', '#22d3ee', '#a855f7'], elbow: { x: this.useWorldMapBoard ? 120 : 195, y: this.useWorldMapBoard ? 105 : 10 } },
      { to: 'charter-court', colors: ['#f472b6', '#22d3ee', '#fbbf24'], elbow: { x: -120, y: 105 } },
      { to: 'town-hall', colors: ['#818cf8', '#22d3ee', '#34d399'], elbow: { x: this.useWorldMapBoard ? -195 : 120, y: this.useWorldMapBoard ? 10 : 105 } }
    ];

    conduits.forEach((c, idx) => {
      const target = islandCoords[c.to];
      if (!target) return;

      [-6, 0, 6].forEach((offset, laneIdx) => {
        const col = c.colors[laneIdx % c.colors.length];
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(offset, 28 + offset * 0.5);
        ctx.lineTo(c.elbow.x + offset, c.elbow.y + 24 + offset * 0.5);
        ctx.lineTo(target.x + offset, target.y + 32 + offset * 0.5);
        ctx.stroke();
        ctx.restore();

        if (this.showConduitPackets) {
          const t = ((this.time * 0.48 + idx * 0.17 + laneIdx * 0.31) % 1);
          const p = this._pointOnPolyline(
            { x: offset, y: 28 + offset * 0.5 },
            { x: c.elbow.x + offset, y: c.elbow.y + 24 + offset * 0.5 },
            { x: target.x + offset, y: target.y + 32 + offset * 0.5 },
            t
          );
          ctx.save();
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
          ctx.restore();
        }
      });
    });
  }

  _pointOnPolyline(p0, p1, p2, t) {
    if (t < 0.5) {
      const u = t * 2;
      return { x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u };
    }
    const u = (t - 0.5) * 2;
    return { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u };
  }

  _drawOperatorWorkstations(ctx) {
    const desks = [
      { x: -460, y: -90, label: 'FARMSTEAD AI DIRECTOR', roleColor: '#34d399' },
      { x: 460, y: -90, label: 'BLUEPRINT COMPILER', roleColor: '#38bdf8' },
      { x: -440, y: 175, label: 'CHARTER ARBITER', roleColor: '#f472b6' },
      { x: 440, y: 175, label: 'MARKET MATCHMAKER', roleColor: '#fbbf24' }
    ];

    const deskSprite = this.pixelScale > 1 ? 'pixelWorkstation' : 'hdWorkstation';

    desks.forEach((d) => {
      if (this._isReady(deskSprite)) {
        ctx.drawImage(this.sprites[deskSprite], d.x - 30, d.y - 26, 60, 60);
      } else {
        this._drawIsoPlatform(ctx, d.x, d.y, 46, 23, 16, {
          top: '#b47b48',
          left: '#85552b',
          right: '#69411f',
          stroke: '#27170b'
        });
      }
      ctx.save();
      ctx.font = '800 8px "Courier New", monospace';
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(d.x - 58, d.y + 30, 116, 13);
      ctx.fillStyle = d.roleColor;
      ctx.textAlign = 'center';
      ctx.fillText(d.label, d.x, d.y + 39);
      ctx.restore();
    });
  }

  _drawCentralFoundationCore(ctx, cx, cy) {
    const s = this.society;
    const treasury = s ? s.treasuryBalance : 115;
    const turns = s ? s.completedTurns : 124;
    const harmony = s ? s.harmony : 90;
    const floatBob = Math.sin(this.time * 2.0) * 2.5;
    cy += floatBob;

    if (!this.useWorldMapBoard) {
      this._drawFloatingCliffUnderside(ctx, cx, cy + 4, 118, 59, '#22d3ee');
    }

    this._drawIsoPlatform(ctx, cx, cy + 16, 122, 62, 24, {
      top: '#1e1b4b',
      left: '#17153b',
      right: '#0f0e26',
      stroke: '#0f172a',
      topStroke: '#22d3ee',
      topStrokeWidth: 2.2,
      glowTrim: '#a855f7',
      shadow: 'rgba(0,0,0,0.45)'
    });

    this._drawIsoPlatform(ctx, cx, cy + 6, 98, 49, 14, {
      top: '#0f172a',
      left: '#1e293b',
      right: '#090d16',
      stroke: '#22d3ee',
      topStroke: '#38bdf8',
      topStrokeWidth: 2,
      glowTrim: '#22d3ee'
    });

    this._drawIsoWallText(ctx, cx - 48, cy + 28, 'left', `HARMONY ${harmony}%`, '', '', '#22d3ee');
    this._drawIsoWallText(ctx, cx + 48, cy + 28, 'right', `TREASURY ${treasury}G`, '', '', '#fbbf24');

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 88, cy + 2);
    ctx.lineTo(cx, cy - 42);
    ctx.lineTo(cx, cy - 115);
    ctx.lineTo(cx - 88, cy - 71);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(30, 27, 75, 0.84)';
    ctx.strokeStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 42);
    ctx.lineTo(cx + 88, cy + 2);
    ctx.lineTo(cx + 88, cy - 71);
    ctx.lineTo(cx, cy - 115);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    this._drawIsoWallText(ctx, cx - 44, cy - 68, 'right', 'PIXEL CORE', 'DYNASTY ENGINE', '', '#67e8f9');
    this._drawIsoWallText(ctx, cx + 44, cy - 68, 'left', 'GCOIN VAULT', 'TURN #' + turns, '', '#fde047');

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AI', cx, cy - 48);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 11px "Courier New", monospace';
    ctx.fillText('SOCIETY CORE', cx, cy - 31);

    ctx.fillStyle = '#fde047';
    ctx.font = '900 9.5px "Courier New", monospace';
    ctx.fillText(`💰 ${treasury}G • ⚡ T${turns}`, cx, cy - 16);
    ctx.restore();

    this.hitRegions.push({
      type: 'core',
      id: 'core',
      x: cx - 95,
      y: cy - 110,
      w: 190,
      h: 155,
      title: 'AI SOCIETY CORE — Shared Treasury & Charter Laws',
      subtitle: `Treasury: ${treasury} GCOIN • Harmony: ${harmony}% • Click to enact Charter Laws or God-Mode Grants`
    });
  }

  _getDistrictLevel(islandId) {
    if (!this.society || !this.society.districtLevels) return 2;
    return this.society.districtLevels[islandId] || 2;
  }

  _drawIslandPod(ctx, islandId, cx, cy) {
    const districts = window.AGENT_SOCIETY_DATA.ISLAND_DISTRICTS;
    const island = districts.find((d) => d.id === islandId);
    if (!island) return;

    const lv = this._getDistrictLevel(islandId);
    const stars = '★'.repeat(lv) + '☆'.repeat(Math.max(0, 5 - lv));
    const isSelected = this.selectedIslandId === islandId;
    const isHovered = this.hoveredHit && this.hoveredHit.type === 'island' && this.hoveredHit.id === islandId;

    // Gentle floating island bobbing in the sky
    const phase = islandId.charCodeAt(0) * 0.4;
    const floatBob = this.useWorldMapBoard ? 0 : Math.sin(this.time * 1.8 + phase) * 2.8;
    cy += floatBob;

    const halfW = 114;
    const halfD = 57;
    const pedHeight = 36;

    if (!this.useWorldMapBoard) {
      // Draw stepped floating island rock/earth cliff underside
      this._drawFloatingCliffUnderside(ctx, cx, cy, halfW, halfD, island.color);

      this._drawIsoPlatform(ctx, cx, cy, halfW, halfD, pedHeight, {
        top: '#1e293b',
        left: '#1e293b',
        right: '#0f172a',
        stroke: isSelected || isHovered ? '#ffffff' : '#0f172a',
        topStroke: isSelected || isHovered ? '#fde047' : island.color,
        topStrokeWidth: isSelected ? 3 : 2,
        glowTrim: isSelected || lv >= 3 ? island.color : null
      });

      const turfColors = {
        'farmstead': { top: '#4ade80', left: '#22c55e', right: '#15803d' },
        'workshop': { top: '#334155', left: '#1e293b', right: '#0f172a' },
        'lineage-hall': { top: '#d97706', left: '#b45309', right: '#78350f' },
        'market-exchange': { top: '#34d399', left: '#10b981', right: '#047857' },
        'charter-court': { top: '#4ade80', left: '#22c55e', right: '#15803d' },
        'town-hall': { top: '#22c55e', left: '#16a34a', right: '#15803d' }
      }[islandId];

      this._drawIsoPlatform(ctx, cx, cy - 8, halfW - 5, halfD - 3, 8, {
        top: turfColors.top,
        left: turfColors.left,
        right: turfColors.right,
        stroke: '#0f172a'
      });

      // White Pixel-Art Court Boundary Lines on Town Hall & Market islands (Tripo3D Tennis Club signature touch)
      if (islandId === 'town-hall' || islandId === 'market-exchange') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy - halfD + 8);
        ctx.lineTo(cx + halfW - 22, cy - 8);
        ctx.lineTo(cx, cy + halfD - 22);
        ctx.lineTo(cx - halfW + 22, cy - 8);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      const parts = island.subtitle.split(',');
      const sub1 = (parts[0] || '').trim();
      const sub2 = parts.slice(1).join(',').trim();
      this._drawIsoWallText(ctx, cx - 54, cy + 14, 'left', island.title, sub1, sub2, island.color);
      this._drawIsoWallText(ctx, cx + 54, cy + 14, 'right', `LV.${lv} ${stars}`, island.badge, sub2, '#fde047');
    }

    this.hitRegions.push({
      type: 'island',
      id: islandId,
      x: cx - halfW,
      y: cy - halfD - 52,
      w: halfW * 2,
      h: halfD * 2 + pedHeight + 52,
      title: `${island.title} — Level ${lv}/5 (${stars})`,
      subtitle: `${island.bonusText} • Click to inspect or upgrade district`
    });

    if (islandId === 'farmstead') {
      this._drawFarmsteadDiorama(ctx, cx, cy - 8, lv);
    } else if (islandId === 'workshop') {
      this._drawWorkshopDiorama(ctx, cx, cy - 8, lv);
    } else if (islandId === 'lineage-hall') {
      this._drawLineageHallDiorama(ctx, cx, cy - 8, lv);
    } else if (islandId === 'market-exchange') {
      this._drawMarketExchangeDiorama(ctx, cx, cy - 8, lv);
    } else if (islandId === 'charter-court') {
      this._drawCharterCourtDiorama(ctx, cx, cy - 8, lv);
    } else if (islandId === 'town-hall') {
      this._drawTownHallDiorama(ctx, cx, cy - 8, lv);
    }

    this._drawDistrictAgents(ctx, islandId, cx, cy - 8);
  }

  // Animated pixel waterfall cascading off an island edge
  _drawPixelWaterfall(ctx, x, y, height = 44) {
    ctx.save();
    for (let wy = 0; wy < height; wy += 4) {
      const foam = ((Math.floor(this.time * 8) + wy) % 8) < 4;
      ctx.fillStyle = foam ? '#e0f2fe' : '#38bdf8';
      ctx.fillRect(x - 6, y + wy, 12, 4);
    }
    // Splash mist at bottom of waterfall
    const mistW = 18 + Math.sin(this.time * 6) * 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - mistW / 2, y + height - 2, mistW, 5);
    ctx.restore();
  }

  _drawFarmsteadDiorama(ctx, cx, cy, lv) {
    // Irrigation river + cascading pixel waterfall
    for (let i = -2; i <= 2; i++) {
      this._drawVoxel(ctx, cx + i * 14, cy + i * 7 + 4, 11, 4, '#38bdf8', '#0284c7', '#0369a1');
    }
    if (!this.useWorldMapBoard) {
      this._drawPixelWaterfall(ctx, cx + 32, cy + 20, 46);
    }

    // Render generated Pixel-Art Castle Granary sprite!
    const castleKey = this.pixelScale > 1 ? 'pixelCastle' : 'hdCastle';
    const size = 76 + lv * 4;
    if (this._isReady(castleKey)) {
      ctx.drawImage(this.sprites[castleKey], cx - size * 0.5 - 6, cy - size * 0.85, size, size);
    }

    // Golden grain crop crates
    this._drawVoxel(ctx, cx - 48, cy - 4, 12, 10 + lv * 2, '#fbbf24', '#d97706', '#92400e');
    this._drawVoxelTree(ctx, cx + 52, cy - 14);
    this._drawVoxelTree(ctx, cx - 62, cy + 6);
  }

  _drawWorkshopDiorama(ctx, cx, cy, lv) {
    const deskKey = this.pixelScale > 1 ? 'pixelWorkstation' : 'hdWorkstation';
    if (this._isReady(deskKey)) {
      ctx.drawImage(this.sprites[deskKey], cx - 64, cy - 64, 68, 68);
      ctx.drawImage(this.sprites[deskKey], cx + 2, cy - 64, 68, 68);
    }
    this._drawVoxel(ctx, cx - 22, cy + 4, 13, 6, '#fbbf24', '#d97706', '#b45309');
    this._drawVoxel(ctx, cx - 4, cy + 12, 13, 6, '#38bdf8', '#0284c7', '#0369a1');
    this._drawVoxel(ctx, cx + 16, cy + 4, 13, 6, '#f472b6', '#db2777', '#be185d');
  }

  _drawLineageHallDiorama(ctx, cx, cy, lv) {
    ctx.save();
    ctx.translate(cx - 42, cy - 28);
    ctx.transform(1, -0.5, 0, 1, 0, 0);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.fillRect(-48, -28, 96, 52);
    ctx.strokeRect(-48, -28, 96, 52);

    ctx.fillStyle = '#f472b6';
    ctx.fillRect(-40, -18, 22, 26);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-12, -16, 42, 5);
    ctx.fillStyle = '#34d399';
    ctx.fillRect(-12, -6, 34, 5);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-12, 4, 48, 5);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 7.5px "Courier New", monospace';
    ctx.fillText(`DYNASTY LV.${lv} (+${lv * 10}% XP)`, 2, 18);
    ctx.restore();

    const statueOffsets = [
      { dx: -18, dy: -8, col: '#c084fc' },
      { dx: 12, dy: -14, col: '#38bdf8' },
      { dx: 38, dy: -6, col: '#34d399' },
      { dx: 4, dy: 12, col: '#fbbf24' }
    ];
    statueOffsets.forEach((st, idx) => {
      if (this._isReady('ancestorSvg')) {
        ctx.drawImage(this.sprites.ancestorSvg, cx + st.dx - 16, cy + st.dy - 34, 32, 40);
      } else {
        this._drawVoxelCharacter(ctx, cx + st.dx, cy + st.dy, {
          role: 'ancestor',
          shirt: st.col,
          hair: '#334155',
          label: `Heir G${idx * 2 + 2}`
        });
      }
    });
  }

  _drawMarketExchangeDiorama(ctx, cx, cy, lv) {
    const bridgeKey = this.pixelScale > 1 ? 'pixelBridge' : 'hdBridge';
    if (this._isReady(bridgeKey)) {
      ctx.drawImage(this.sprites[bridgeKey], cx - 48, cy - 58, 96, 96);
    }
    if (!this.useWorldMapBoard) {
      this._drawPixelWaterfall(ctx, cx - 36, cy + 18, 42);
    }

    const totalListings = this.society
      ? this.society.lineages.reduce((acc, l) => acc + l.listedGoods.reduce((s, g) => s + g.remainingQty, 0), 0)
      : 24;
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 58, cy - 66, 116, 20);
    ctx.strokeRect(cx - 58, cy - 66, 116, 20);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 8.5px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`🛒 MARKET: ${totalListings} ITEMS`, cx, cy - 53);
    ctx.restore();
  }

  _drawCharterCourtDiorama(ctx, cx, cy, lv) {
    const monoKey = this.pixelScale > 1 ? 'pixelMonolith' : 'hdMonolith';
    const mSize = 78 + lv * 3;
    if (this._isReady(monoKey)) {
      ctx.drawImage(this.sprites[monoKey], cx - mSize * 0.5, cy - mSize * 0.85, mSize, mSize);
    }
    this._drawVoxelTree(ctx, cx + 48, cy - 8);
    this._drawVoxelTree(ctx, cx - 50, cy - 4);

    if (this.society && this.society.lineages.length) {
      const sorted = [...this.society.lineages].sort(
        (a, b) => socAgentPower(b) - socAgentPower(a) || b.completedSales - a.completedSales
      );
      const leader = sorted[0];
      const pwr = socAgentPower(leader);
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.fillRect(cx - 64, cy - 72, 128, 20);
      ctx.strokeRect(cx - 64, cy - 72, 128, 20);
      ctx.fillStyle = '#fbcfe8';
      ctx.font = '900 8.5px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`👑 ARCHON: ${leader.id} (${pwr})`, cx, cy - 59);
      ctx.restore();
    }
  }

  _drawTownHallDiorama(ctx, cx, cy, lv) {
    // Render our cozy Red-Roofed Pixel-Art 3D Clubhouse & Court Pavilion (inspired by Tripo3D Pixel-Art Tennis Club)
    if (this._isReady('pixelClubhouse')) {
      ctx.drawImage(this.sprites.pixelClubhouse, cx - 48, cy - 66, 92, 92);
    }
    this._drawVoxelTree(ctx, cx - 58, cy - 10);
    this._drawVoxelTree(ctx, cx + 52, cy - 18);

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.8;
    ctx.fillRect(cx + 22, cy - 52, 68, 17);
    ctx.strokeRect(cx + 22, cy - 52, 68, 17);
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '900 8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`CLUB LV.${lv}`, cx + 56, cy - 40);
    ctx.restore();
  }

  _drawVoxelTree(ctx, x, y) {
    if (this._isReady('pixelTree')) {
      ctx.drawImage(this.sprites.pixelTree, x - 22, y - 38, 44, 44);
      return;
    }
    this._drawVoxel(ctx, x, y, 5, 12, '#92400e', '#78350f', '#451a03');
    this._drawVoxel(ctx, x, y - 14, 14, 12, '#4ade80', '#22c55e', '#15803d');
    this._drawVoxel(ctx, x, y - 24, 10, 9, '#86efac', '#4ade80', '#16a34a');
  }

  _getArchonId() {
    if (!this.society || !this.society.lineages.length) return null;
    const sorted = [...this.society.lineages].sort(
      (a, b) => socAgentPower(b) - socAgentPower(a) || b.completedSales - a.completedSales
    );
    return sorted[0].id;
  }

  _drawDistrictAgents(ctx, islandId, cx, cy) {
    if (!this.society) return;
    const roleMap = {
      'farmstead': 'farmer',
      'workshop': 'engineer',
      'town-hall': 'manager'
    };
    const targetRole = roleMap[islandId];
    if (!targetRole) return;

    const archonId = this._getArchonId();
    const agents = this.society.lineages.filter((l) => l.role === targetRole);
    const slots = [
      { dx: -46, dy: 14 },
      { dx: -10, dy: 22 },
      { dx: 26, dy: 16 },
      { dx: 54, dy: 4 },
      { dx: -30, dy: -4 },
      { dx: 14, dy: -4 },
      { dx: 42, dy: -10 }
    ];

    const rolePalette = {
      farmer: { shirt: '#10b981', hair: '#92400e' },
      engineer: { shirt: '#0ea5e9', hair: '#1e293b' },
      manager: { shirt: '#8b5cf6', hair: '#b45309' }
    }[targetRole];

    agents.forEach((agent, idx) => {
      const walker = this.agentWalkers[agent.id];
      if (walker && this.time - walker.startedAt < walker.duration) {
        return;
      }

      const slot = slots[idx % slots.length];
      // Step-quantized pixel bobbing animation
      const bob = Math.round(Math.sin(this.time * 3.5 + idx * 1.3) * 2);
      const ax = cx + slot.dx;
      const ay = cy + slot.dy + bob;

      const isSelected = this.selectedAgentId === agent.id;
      const isActiveTurn = this.society.activeTurnAgentId === agent.id;
      const isArchon = archonId === agent.id;

      if (isActiveTurn || isSelected) {
        ctx.save();
        ctx.strokeStyle = isSelected ? '#fde047' : '#22d3ee';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(ax, ay + 2, 15, 7.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      this._drawVoxelCharacter(ctx, ax, ay, {
        role: agent.role,
        isArchon,
        shirt: rolePalette.shirt,
        hair: rolePalette.hair,
        label: `${isArchon ? '👑 ' : ''}${agent.id}•G${agent.currentGen}`,
        sublabel: `${agent.wallet}G•P:${socAgentPower(agent)}`,
        stamina: agent.stamina ?? 85,
        contextPct: Math.min(100, Math.round((agent.contextTokens / agent.contextThreshold) * 100)),
        isSelected,
        isActiveTurn,
        showBars: this.showNeedBars
      });

      this.hitRegions.push({
        type: 'agent',
        id: agent.id,
        x: ax - 24,
        y: ay - 48,
        w: 48,
        h: 56,
        title: `${isArchon ? '👑 ARCHON ' : ''}${agent.name} (Gen ${agent.currentGen})`,
        subtitle: `Stamina: ${agent.stamina ?? 85}% • Wallet: ${agent.wallet}G • Power: ${socAgentPower(agent)} • Click to command`
      });
    });
  }

  _drawWalkingAgentsOnBridges(ctx, islandCoords) {
    if (!this.society) return;
    const archonId = this._getArchonId();
    Object.keys(this.agentWalkers).forEach((lineageId) => {
      const w = this.agentWalkers[lineageId];
      const elapsed = this.time - w.startedAt;
      if (elapsed >= w.duration) {
        delete this.agentWalkers[lineageId];
        return;
      }
      const agent = this.society.lineages.find((l) => l.id === lineageId);
      if (!agent) return;

      const raw = elapsed / w.duration;
      const legProgress = raw < 0.5 ? raw * 2 : (1 - raw) * 2;
      const start = islandCoords[w.fromIsland] || { x: 0, y: 0 };
      const end = islandCoords[w.toIsland] || { x: 0, y: 0 };
      const pt = this._pointOnPolyline(start, { x: 0, y: 12 }, end, legProgress);
      const hop = Math.round(Math.abs(Math.sin(this.time * 14)) * 6);

      const rolePalette = {
        farmer: { shirt: '#10b981', hair: '#92400e' },
        engineer: { shirt: '#0ea5e9', hair: '#1e293b' },
        manager: { shirt: '#8b5cf6', hair: '#b45309' }
      }[agent.role] || { shirt: '#38bdf8', hair: '#1e293b' };

      this._drawVoxelCharacter(ctx, pt.x, pt.y - hop, {
        role: agent.role,
        isArchon: archonId === agent.id,
        shirt: rolePalette.shirt,
        hair: rolePalette.hair,
        label: `⚡ ${agent.id}`,
        sublabel: `→ ${w.toIsland.toUpperCase()}`,
        stamina: agent.stamina ?? 85,
        contextPct: Math.min(100, Math.round((agent.contextTokens / agent.contextThreshold) * 100)),
        isSelected: this.selectedAgentId === agent.id,
        isActiveTurn: true,
        showBars: this.showNeedBars
      });
    });
  }

  _drawVoxelCharacter(ctx, x, y, opts) {
    // Choose our custom generated Pixel-Art 3D character sprite!
    const usePix = this.pixelScale > 1;
    let spriteKey = null;
    if (opts.isArchon) {
      spriteKey = usePix ? 'pixelArchon' : 'hdArchon';
    } else if (opts.role === 'farmer') {
      spriteKey = usePix ? 'pixelFarmer' : 'hdFarmer';
    } else if (opts.role === 'engineer') {
      spriteKey = usePix ? 'pixelEngineer' : 'hdEngineer';
    } else if (opts.role === 'manager') {
      spriteKey = usePix ? 'pixelManager' : 'hdManager';
    }

    if (spriteKey && this._isReady(spriteKey)) {
      // Pixel shadow oval under feet
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fillRect(x - 10, y - 2, 20, 5);
      // Draw crisp 42x42 pixel-art character sprite
      const sprSize = 42;
      ctx.drawImage(this.sprites[spriteKey], Math.round(x - sprSize / 2), Math.round(y - sprSize + 4), sprSize, sprSize);
    } else {
      this._drawVoxel(ctx, x - 3, y - 4, 3.5, 6, '#334155', '#1e293b', '#0f172a');
      this._drawVoxel(ctx, x + 3, y - 4, 3.5, 6, '#334155', '#1e293b', '#0f172a');
      this._drawVoxel(ctx, x, y - 13, 6.5, 9, opts.shirt, opts.shirt, '#0f172a');
      this._drawVoxel(ctx, x, y - 22, 6, 7, '#fed7aa', '#fdba74', '#fb923c');
      this._drawVoxel(ctx, x, y - 25, 6.4, 3, opts.hair, opts.hair, '#0f172a');
    }

    if (opts.hideLabel || !opts.label) return;

    ctx.save();
    const hasBars = opts.showBars && typeof opts.stamina === 'number';
    const tagW = 76;
    const tagH = hasBars ? 29 : (opts.sublabel ? 21 : 13);
    const tagY = Math.round(y - (hasBars ? 66 : 56));
    const tagX = Math.round(x - tagW / 2);

    ctx.fillStyle = opts.isSelected
      ? '#fde047'
      : opts.isActiveTurn
        ? '#0284c7'
        : '#0f172a';
    ctx.strokeStyle = opts.isSelected ? '#0f172a' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.strokeRect(tagX, tagY, tagW, tagH);

    ctx.textAlign = 'center';
    ctx.font = '900 7.5px "Courier New", monospace';
    ctx.fillStyle = opts.isSelected ? '#0f172a' : '#ffffff';
    ctx.fillText(opts.label, x, tagY + 8.5);

    if (opts.sublabel) {
      ctx.font = '700 7px "Courier New", monospace';
      ctx.fillStyle = opts.isSelected ? '#1e293b' : '#7dd3fc';
      ctx.fillText(opts.sublabel, x, tagY + 16.5);
    }

    if (hasBars) {
      const barW = tagW - 10;
      const bx = Math.round(x - barW / 2);
      // Stamina bar
      ctx.fillStyle = '#020617';
      ctx.fillRect(bx, tagY + 19.5, barW, 3.5);
      const stamCol = opts.stamina > 55 ? '#4ade80' : opts.stamina > 30 ? '#fbbf24' : '#f87171';
      ctx.fillStyle = stamCol;
      ctx.fillRect(bx, tagY + 19.5, Math.round((barW * Math.max(5, opts.stamina)) / 100), 3.5);

      // Context progress bar
      ctx.fillStyle = '#020617';
      ctx.fillRect(bx, tagY + 24, barW, 3);
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(bx, tagY + 24, Math.round((barW * (opts.contextPct || 10)) / 100), 3);
    }
    ctx.restore();
  }

  _drawAnimatedPacketsAndPopups(ctx, islandCoords) {
    this.activePackets = this.activePackets.filter((p) => this.time - p.createdAt < p.duration);
    this.floatingPopups = this.floatingPopups.filter((b) => this.time - b.createdAt < b.duration);

    this.activePackets.forEach((pkt) => {
      const progress = (this.time - pkt.createdAt) / pkt.duration;
      const start = islandCoords[pkt.fromIsland] || { x: 0, y: 0 };
      const end = islandCoords[pkt.toIsland] || { x: 0, y: 0 };
      const pt = this._pointOnPolyline(start, { x: 0, y: 10 }, end, progress);

      ctx.save();
      ctx.fillStyle = pkt.color;
      ctx.fillRect(pt.x - 5, pt.y - 5, 10, 10);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(pt.x - 5, pt.y - 5, 10, 10);
      ctx.restore();
    });

    this.floatingPopups.forEach((b) => {
      const pos = islandCoords[b.islandId] || { x: 0, y: 0 };
      const age = this.time - b.createdAt;
      const alpha = Math.max(0, 1 - (age / b.duration) ** 1.6);
      const floatY = Math.round(pos.y - 68 - age * 20);
      const floatX = Math.round(pos.x + (b.jitterX || 0));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      const w = Math.max(126, b.text.length * 6.2 + 18);
      ctx.fillRect(floatX - w / 2, floatY, w, 22);
      ctx.strokeRect(floatX - w / 2, floatY, w, 22);

      ctx.fillStyle = b.color;
      ctx.font = '900 8.5px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.text, floatX, floatY + 14);
      ctx.restore();
    });
  }

  _drawHoverTooltip(ctx) {
    const h = this.hoveredHit;
    if (!h) return;
    const pad = 12;
    const boxW = 380;
    const boxH = 54;
    const x = 18;
    const y = this.height - boxH - 18;

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeRect(x, y, boxW, boxH);

    ctx.fillStyle = '#fde047';
    ctx.font = '900 11.5px "Courier New", monospace';
    ctx.fillText(h.title, x + pad, y + 20);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 10px "Courier New", monospace';
    const sub = h.subtitle.length > 62 ? h.subtitle.slice(0, 62) + '…' : h.subtitle;
    ctx.fillText(sub, x + pad, y + 38);
    ctx.restore();
  }
};

function socAgentPower(lin) {
  if (!lin) return 0;
  return lin.wallet + lin.completedSales * 2 + (lin.currentGen - 1) * 2;
}

function socProsperity(soc) {
  if (!soc) return 0;
  const totalWallet = soc.lineages.reduce((s, l) => s + l.wallet, 0);
  const totalSales = soc.lineages.reduce((s, l) => s + l.completedSales * 5, 0);
  const districtPts = Object.values(soc.districtLevels || {}).reduce((s, lv) => s + lv * 15, 0);
  return totalWallet + totalSales + soc.treasuryBalance + soc.retiredGenerationsCount * 3 + districtPts;
}
