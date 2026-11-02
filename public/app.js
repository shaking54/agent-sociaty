// AGENT SOCIETY — REAL-TIME PIXEL-ART 3D FLOATING-ISLAND GAME CONTROLLER
// Play directly in the world with WASD / Arrows / Click-to-Move + SPACE to Interact!

(function () {
  const DATA = window.AGENT_SOCIETY_DATA;
  const soc = DATA.SOCIETIES['active-dynasty-sim'];

  let playerAgentId = 'farmer-1';
  let gameSpeed = 1; // 1x running by default so the world is alive immediately!
  let keysPressed = {};

  const canvas = document.getElementById('gameCanvas');
  const scene = new window.IsometricSocietyScene(canvas, {
    getKeys: () => keysPressed,
    onSelectAgent: (agentId) => {
      switchPlayerAgent(agentId);
    }
  });

  scene.setSociety(soc);
  scene.setPlayerAgent(playerAgentId);

  function computePower(lin) {
    return lin.wallet + lin.completedSales * 2 + (lin.currentGen - 1) * 2;
  }

  function getSortedByPower() {
    return [...soc.lineages].sort(
      (a, b) => computePower(b) - computePower(a) || b.completedSales - a.completedSales
    );
  }

  function getPlayerLineage() {
    return soc.lineages.find((l) => l.id === playerAgentId) || soc.lineages[0];
  }

  function setDialogue(speakerLin, tagText, message, isArchon = false) {
    const imgEl = document.getElementById('dialogueSpeakerImg');
    const nameEl = document.getElementById('dialogueSpeakerName');
    const tagEl = document.getElementById('dialogueTag');
    const textEl = document.getElementById('dialogueText');

    if (speakerLin) {
      imgEl.src = isArchon
        ? './assets/sprites/pixel-archon.png'
        : `./assets/sprites/pixel-${speakerLin.role}.png`;
      nameEl.textContent = `${isArchon ? '👑 ARCHON ' : ''}${speakerLin.id.toUpperCase()} (GEN ${speakerLin.currentGen})`;
    }
    tagEl.textContent = tagText;
    textEl.textContent = message;
  }

  function switchPlayerAgent(nextId) {
    playerAgentId = nextId;
    scene.setPlayerAgent(playerAgentId);
    const lin = getPlayerLineage();
    const ranked = getSortedByPower();
    const isArchon = ranked[0] && ranked[0].id === lin.id;
    scene.spawnSpeech(lin.id, `Ready! (${lin.role.toUpperCase()})`, 2.2);
    setDialogue(
      lin,
      'SWITCHED AGENT',
      `Now controlling ${lin.id} (Gen ${lin.currentGen} ${lin.role}). Goal: ${lin.goal}`,
      isArchon
    );
    updateHUD();
  }

  function cycleNextAgent() {
    const idx = soc.lineages.findIndex((l) => l.id === playerAgentId);
    const next = soc.lineages[(idx + 1) % soc.lineages.length];
    switchPlayerAgent(next.id);
  }

  // Contextual Action when player presses SPACE or clicks the floating prompt bubble
  function performContextualAction() {
    const lin = getPlayerLineage();
    const ent = scene.getPlayerEntity();
    if (!ent) return;

    scene.triggerPlayerActionAnim();
    const hotspot = scene.getNearestHotspot();
    const actionType = hotspot
      ? hotspot.actionType
      : lin.role === 'farmer'
        ? 'harvest'
        : lin.role === 'engineer'
          ? 'craft'
          : 'rally';

    if (actionType === 'harvest') {
      const wage = soc.wages.farmer + (lin.currentGen - 1);
      const rations = 5;
      lin.wallet += wage;
      lin.workCount += 1;
      lin.stamina = Math.max(10, (lin.stamina ?? 85) - 5);
      lin.contextTokens += 1200;
      const foodGood = lin.listedGoods.find((g) => g.type === 'food');
      if (foodGood) foodGood.remainingQty += rations;
      else {
        lin.listedGoods.push({
          id: 'ration-' + Date.now(),
          name: 'Staple Food Rations',
          type: 'food',
          price: 1,
          remainingQty: rations,
          initialQty: rations
        });
      }
      scene.spawnBurst(ent.x, ent.y, '#fde047', 12);
      scene.spawnFloatingPopup(ent.x, ent.y, `🌾 +${wage}G & +${rations} RATIONS!`, '#4ade80');
      scene.spawnSpeech(lin.id, `Harvested +${rations} Rations!`, 2.2);
      setDialogue(lin, 'FARMSTEAD HARVEST', `${lin.id} harvested golden wheat! Earned +${wage} GCOIN and stocked +${rations} Rations in the Market.`);
    } else if (actionType === 'craft') {
      const wage = soc.wages.engineer + (lin.currentGen - 1);
      lin.wallet += wage;
      lin.workCount += 1;
      lin.completedSales += 1;
      lin.stamina = Math.max(10, (lin.stamina ?? 85) - 5);
      lin.contextTokens += 1300;
      scene.spawnBurst(ent.x, ent.y, '#38bdf8', 12);
      scene.spawnFloatingPopup(ent.x, ent.y, `⚙️ +${wage}G & BLUEPRINT!`, '#38bdf8');
      scene.spawnSpeech(lin.id, 'Compiled Blueprint v2!', 2.2);
      setDialogue(lin, 'WORKSHOP CRAFT', `${lin.id} compiled a Storage & Irrigation Blueprint! Earned +${wage} GCOIN and +2 Power.`);
    } else if (actionType === 'rally') {
      const wage = soc.wages.manager + (lin.currentGen - 1);
      lin.wallet += wage;
      soc.harmony = Math.min(100, (soc.harmony || 88) + 4);
      lin.contextTokens += 1100;
      scene.courtBall.vz = 115;
      scene.courtBall.vx = -scene.courtBall.vx * 1.15;
      scene.spawnBurst(ent.x, ent.y, '#bef264', 14);
      scene.spawnFloatingPopup(ent.x, ent.y, `🎾 SMASH! +${wage}G & +4% HARMONY`, '#bef264');
      scene.spawnSpeech(lin.id, 'Love All! +Harmony!', 2.2);
      setDialogue(lin, 'CLUBHOUSE COURT RALLY', `${lin.id} smashed a winning rally on the Pixel Tennis Court! Colony Harmony rose to ${soc.harmony}% (+${wage}G).`);
    } else if (actionType === 'trade') {
      eatOrTradeAtMarket(lin, ent.x, ent.y, true);
    } else if (actionType === 'handover') {
      ascendToNextGen(lin, ent.x, ent.y);
    } else if (actionType === 'law') {
      cycleCharterLaw(lin, ent.x, ent.y);
    } else if (actionType === 'upgrade') {
      upgradeAllIslands(lin, ent.x, ent.y);
    }

    // Automatic 10k-token generational handover check
    if (lin.contextTokens >= lin.contextThreshold && lin.currentGen < lin.maxGen) {
      ascendToNextGen(lin, ent.x, ent.y);
    }

    updateHUD();
  }

  function eatOrTradeAtMarket(lin, x, y, isPlayer = false) {
    const seller = soc.lineages.find(
      (l) => l.listedGoods.some((g) => g.type === 'food' && g.remainingQty > 0)
    );
    if (seller && lin.wallet >= 1) {
      const food = seller.listedGoods.find((g) => g.type === 'food' && g.remainingQty > 0);
      food.remainingQty -= 1;
      lin.wallet -= 1;
      seller.wallet += 1;
      seller.completedSales += 1;
      lin.stamina = Math.min(100, (lin.stamina ?? 60) + 45);
      scene.spawnBurst(x, y, '#22c55e', 10);
      scene.spawnFloatingPopup(x, y, '🍞 ATE RATION (+45% STAMINA)', '#4ade80');
      scene.spawnSpeech(lin.id, 'Yum! +45% Stamina!', 2.0);
      if (isPlayer) {
        setDialogue(lin, 'GCOIN MARKET', `${lin.id} bought a Staple Food Ration from ${seller.id} for 1 GCOIN and restored Stamina to ${lin.stamina}%!`);
      }
      return true;
    }
    // Fallback free emergency ration from granary
    lin.stamina = Math.min(100, (lin.stamina ?? 60) + 35);
    scene.spawnBurst(x, y, '#fbbf24', 8);
    scene.spawnFloatingPopup(x, y, '🍞 GRANARY RATION (+35% STAMINA)', '#fde047');
    return true;
  }

  function ascendToNextGen(lin, x, y) {
    if (lin.currentGen >= lin.maxGen) {
      scene.spawnFloatingPopup(x, y, `MAX GEN ${lin.maxGen} REACHED!`, '#c084fc');
      return;
    }
    const prev = lin.currentGen;
    lin.currentGen += 1;
    lin.contextTokens = 600;
    lin.stamina = 100;
    soc.retiredGenerationsCount += 1;
    scene.spawnAscensionBeam(x, y, '#c084fc');
    scene.spawnFloatingPopup(x, y, `🧬 ASCENDED TO GEN ${lin.currentGen}! (+10% WAGE)`, '#c084fc');
    scene.spawnSpeech(lin.id, `Gen ${lin.currentGen} Born!`, 3.0);
    setDialogue(
      lin,
      '10K-TOKEN DYNASTY HANDOVER',
      `⚡ ${lin.id} Gen ${prev} retired at 10,000 tokens and passed 100% of Wallet (${lin.wallet}G) & Sales (${lin.completedSales}) to Gen ${lin.currentGen} Heir (+${(lin.currentGen - 1) * 10}% Wage Mastery)!`
    );
  }

  function cycleCharterLaw(lin, x, y) {
    const laws = DATA.CHARTER_LAWS;
    const currentLawId = soc.activeLaws[0] || laws[0].id;
    const nextIdx = (laws.findIndex((l) => l.id === currentLawId) + 1) % laws.length;
    const nextLaw = laws[nextIdx];
    soc.activeLaws = [nextLaw.id];
    if (nextLaw.id === 'law-sha85-wages') {
      soc.wages = { farmer: 12, engineer: 14, manager: 10 };
    } else {
      soc.wages = { farmer: 5, engineer: 10, manager: 15 };
    }
    const ranked = getSortedByPower();
    const archon = ranked[0] || lin;
    scene.spawnAscensionBeam(x, y, '#f472b6');
    scene.spawnFloatingPopup(x, y, `📜 LAW: ${nextLaw.name.toUpperCase()}`, '#f472b6');
    setDialogue(
      archon,
      'ARCHON CHARTER DECREE',
      `👑 Archon ${archon.id} (Power ${computePower(archon)}) enacted "${nextLaw.name}": ${nextLaw.effectText}`,
      true
    );
  }

  function upgradeAllIslands(lin, x, y) {
    if (soc.treasuryBalance < 15) {
      scene.spawnFloatingPopup(x, y, 'NEED 15 TREASURY GCOIN!', '#f87171');
      return;
    }
    soc.treasuryBalance -= 15;
    Object.keys(soc.districtLevels).forEach((k) => {
      soc.districtLevels[k] = Math.min(5, (soc.districtLevels[k] || 2) + 1);
    });
    scene.spawnAscensionBeam(x, y, '#fde047');
    scene.spawnFloatingPopup(x, y, '⬆️ ISLANDS UPGRADED! (+YIELD)', '#fde047');
    setDialogue(lin, 'TREASURY UPGRADE', `Spent 15 Treasury GCOIN to upgrade the Floating Sky Islands! Production & Harmony increased.`);
  }

  // Autonomous background simulation tick for the other 9 AI agents
  function stepAutonomousWorld() {
    if (gameSpeed === 0) return;
    soc.completedTurns += 1;

    const aiAgents = soc.lineages.filter((l) => l.id !== playerAgentId);
    const actor = aiAgents[soc.completedTurns % aiAgents.length];
    if (!actor) return;
    const ent = scene.entities[actor.id];
    const ax = ent ? ent.x : 0;
    const ay = ent ? ent.y : 0;

    actor.stamina = Math.max(15, (actor.stamina ?? 85) - 6);
    actor.contextTokens += 1150;
    soc.treasuryBalance += 1; // 1G MCP message tax

    if (actor.stamina < 55) {
      eatOrTradeAtMarket(actor, ax, ay, false);
    } else if (actor.contextTokens >= actor.contextThreshold && actor.currentGen < actor.maxGen) {
      ascendToNextGen(actor, ax, ay);
    } else {
      const wage = soc.wages[actor.role] || 10;
      actor.wallet += wage;
      if (actor.role === 'farmer') {
        const fg = actor.listedGoods.find((g) => g.type === 'food');
        if (fg) fg.remainingQty += 3;
        scene.spawnSpeech(actor.id, `+${wage}G 🌾`, 1.8);
      } else if (actor.role === 'engineer') {
        actor.completedSales += 1;
        scene.spawnSpeech(actor.id, `+${wage}G ⚙️`, 1.8);
      } else {
        soc.harmony = Math.min(100, (soc.harmony || 88) + 1);
        scene.spawnSpeech(actor.id, `+${wage}G 🎾`, 1.8);
      }
      scene.spawnBurst(ax, ay, '#38bdf8', 5);
    }

    updateHUD();
  }

  function updateHUD() {
    const lin = getPlayerLineage();
    const ranked = getSortedByPower();
    const archon = ranked[0];
    const myRank = ranked.findIndex((l) => l.id === lin.id) + 1;
    const isArchon = myRank === 1;

    document.getElementById('hudAvatar').src = isArchon
      ? './assets/sprites/pixel-archon.png'
      : `./assets/sprites/pixel-${lin.role}.png`;
    document.getElementById('hudCrown').classList.toggle('hidden', !isArchon);
    document.getElementById('hudAgentName').textContent = lin.id.toUpperCase();
    document.getElementById('hudGenBadge').textContent = `GEN ${lin.currentGen}`;

    const roleEl = document.getElementById('hudRoleBadge');
    roleEl.textContent = lin.role.toUpperCase();
    roleEl.className = `pixel-tag ${lin.role === 'farmer' ? 'green' : lin.role === 'engineer' ? 'cyan' : 'purple'}`;

    const stam = lin.stamina ?? 85;
    document.getElementById('hudStaminaFill').style.width = `${stam}%`;
    document.getElementById('hudStaminaText').textContent = `${stam}%`;

    const tokPct = Math.min(100, Math.round((lin.contextTokens / lin.contextThreshold) * 100));
    document.getElementById('hudContextFill').style.width = `${tokPct}%`;
    document.getElementById('hudContextText').textContent = `${(lin.contextTokens / 1000).toFixed(1)}k/10k`;

    document.getElementById('hudWallet').textContent = `${lin.wallet}G`;
    document.getElementById('hudPower').textContent = `P:${computePower(lin)} (#${myRank})`;
    document.getElementById('hudTreasury').textContent = `${soc.treasuryBalance}G`;

    const totalRations = soc.lineages.reduce(
      (acc, l) => acc + l.listedGoods.filter((g) => g.type === 'food').reduce((s, g) => s + g.remainingQty, 0),
      0
    );
    document.getElementById('hudRations').textContent = `${totalRations}`;

    const activeLawObj = DATA.CHARTER_LAWS.find((l) => l.id === soc.activeLaws[0]) || DATA.CHARTER_LAWS[0];
    document.getElementById('hudLawName').textContent = activeLawObj.name.slice(0, 18);

    document.getElementById('hudTurnText').textContent = `DAY ${soc.completedTurns}`;
    if (archon) {
      document.getElementById('hudArchonText').textContent = `👑 ARCHON: ${archon.id.toUpperCase()} (P:${computePower(archon)})`;
    }
  }

  // Continuous check for proximity prompt bubble
  setInterval(() => {
    const hotspot = scene.getNearestHotspot();
    const promptEl = document.getElementById('worldPromptBubble');
    const promptTxt = document.getElementById('worldPromptText');
    if (hotspot) {
      promptEl.classList.remove('hidden');
      promptTxt.textContent = `${hotspot.title}: ${hotspot.prompt}`;
    } else {
      promptEl.classList.add('hidden');
    }
  }, 120);

  // Autonomous AI tick timer
  let aiInterval = setInterval(stepAutonomousWorld, 2000);
  function setSpeed(spd) {
    gameSpeed = spd;
    if (aiInterval) clearInterval(aiInterval);
    if (spd > 0) {
      aiInterval = setInterval(stepAutonomousWorld, Math.round(2000 / spd));
    }
    document.getElementById('btnSpeed').textContent = spd === 0 ? '⏸ PAUSE' : `▶ ${spd}×`;
  }

  // Keyboard bindings for real game feel
  window.addEventListener('keydown', (e) => {
    keysPressed[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      performContextualAction();
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      const lin = getPlayerLineage();
      const ent = scene.getPlayerEntity();
      if (ent) eatOrTradeAtMarket(lin, ent.x, ent.y, true);
      updateHUD();
    } else if (e.code === 'Tab') {
      e.preventDefault();
      cycleNextAgent();
    } else if (e.code === 'KeyW' && e.shiftKey) {
      document.getElementById('btnWeather').click();
    } else if (e.key >= '1' && e.key <= '9') {
      const idx = Number(e.key) - 1;
      if (soc.lineages[idx]) switchPlayerAgent(soc.lineages[idx].id);
    } else if (e.key === '0' && soc.lineages[9]) {
      switchPlayerAgent(soc.lineages[9].id);
    }
  });

  window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
  });

  // Minimal HUD icon clicks
  document.getElementById('playerCardBtn').addEventListener('click', () => cycleNextAgent());
  document.getElementById('worldPromptBubble').addEventListener('click', () => performContextualAction());

  document.getElementById('btnWeather').addEventListener('click', (e) => {
    const mode = scene.cycleWeatherMode();
    const icons = { sunny: '☀️', sunset: '🌅', rain: '🌧️', night: '🌙' };
    e.currentTarget.textContent = icons[mode] || '☀️';
  });

  document.getElementById('btnPixelMode').addEventListener('click', (e) => {
    const scale = scene.cyclePixelMode();
    e.currentTarget.textContent = `🕹️ ${scale}×`;
  });

  document.getElementById('btnSpeed').addEventListener('click', () => {
    const next = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 4 : gameSpeed === 4 ? 0 : 1;
    setSpeed(next);
  });

  updateHUD();
})();
