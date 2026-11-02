// AGENT SOCIETY — MAINLAND BUILDER, TOOLS & DYNASTY GAME CONTROLLER
// Play with WASD / Arrows / Click-to-Move, SPACE to work with your equipped Tool,
// and [1-4] to build House / Factory / Shop / Paddlefield or [5] to Upgrade your Tool!

(function () {
  const DATA = window.AGENT_SOCIETY_DATA;
  const soc = DATA.SOCIETIES['active-dynasty-sim'];

  // Initialize toolLevel and buildingsOwned on each lineage
  soc.lineages.forEach((l) => {
    if (!l.toolLevel) l.toolLevel = 1;
    if (!l.buildingsOwned) l.buildingsOwned = 0;
  });
  soc.lineages[0].buildingsOwned = 1; // farmer-1 owns initial House
  soc.lineages[5].buildingsOwned = 1; // engineer-8 owns initial Factory
  soc.lineages[1].buildingsOwned = 1; // farmer-4 owns initial Shop
  soc.lineages[6].buildingsOwned = 1; // manager-3 owns initial Paddlefield

  let playerAgentId = 'farmer-1';
  let gameSpeed = 1;
  let keysPressed = {};

  const TOOL_META = {
    farmer: {
      name: 'GOLDEN SCYTHE',
      short: 'SCYTHE+',
      icon: './assets/sprites/pixel-tool-scythe.png?v=sharp2'
    },
    engineer: {
      name: 'POWER WRENCH',
      short: 'WRENCH+',
      icon: './assets/sprites/pixel-tool-wrench.png?v=sharp2'
    },
    manager: {
      name: 'PRO PADDLE',
      short: 'PADDLE+',
      icon: './assets/sprites/pixel-tool-racket.png?v=sharp2'
    }
  };

  const BUILDING_COSTS = {
    house: 15,
    factory: 25,
    shop: 20,
    paddlefield: 30
  };

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
    return lin.wallet + lin.completedSales * 2 + (lin.currentGen - 1) * 2 + (lin.buildingsOwned || 0) * 5;
  }

  function getToolMultiplier(lin) {
    const lv = lin.toolLevel || 1;
    return 1 + lv * 0.5; // Lv.1 = 1.5x, Lv.2 = 2.0x, Lv.3 = 2.5x, Lv.4 = 3.0x, Lv.5 = 3.5x
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
    const tMeta = TOOL_META[lin.role] || TOOL_META.farmer;
    scene.spawnSpeech(lin.id, `Equipped ${tMeta.name} Lv.${lin.toolLevel}!`, 2.2);
    setDialogue(
      lin,
      'SWITCHED AGENT',
      `Now playing as ${lin.id} (Gen ${lin.currentGen} ${lin.role}) holding ${tMeta.name} Lv.${lin.toolLevel} (${getToolMultiplier(lin).toFixed(1)}× work output).`,
      isArchon
    );
    updateHUD();
  }

  function cycleNextAgent() {
    const idx = soc.lineages.findIndex((l) => l.id === playerAgentId);
    const next = soc.lineages[(idx + 1) % soc.lineages.length];
    switchPlayerAgent(next.id);
  }

  // Construct a House, Factory, Shop, or Paddlefield on the Mainland
  function playerBuildStructure(type) {
    const lin = getPlayerLineage();
    const ent = scene.getPlayerEntity();
    if (!ent) return;

    const cost = BUILDING_COSTS[type] || 20;
    if (lin.wallet < cost) {
      scene.spawnFloatingPopup(ent.x, ent.y, `NEED ${cost}G TO BUILD ${type.toUpperCase()}!`, '#f87171');
      setDialogue(lin, 'NOT ENOUGH GCOIN', `${lin.id} has ${lin.wallet}G but needs ${cost}G to build a ${type.toUpperCase()}. Press [SPACE] to work & earn GCOIN first!`);
      return;
    }

    lin.wallet -= cost;
    lin.buildingsOwned = (lin.buildingsOwned || 0) + 1;
    lin.contextTokens += 900;

    const bldg = scene.buildStructureOnLand(type, lin.id);
    const effects = {
      house: 'Restores Stamina & grants +10% Heir Mastery',
      factory: 'Passively mints GCOIN & crafts Engineer Blueprints',
      shop: 'Stocks Rations & earns +2 Sales Power per trade',
      paddlefield: 'Hosts Padel/Tennis Rallies for +Harmony & +Wage GCOIN'
    };

    scene.spawnSpeech(lin.id, `Built ${bldg.name}!`, 2.4);
    setDialogue(
      lin,
      `BUILT ${type.toUpperCase()}`,
      `🏗️ ${lin.id} constructed a ${bldg.name} on the mainland for ${cost}G! (${effects[type]}). Power increased by +5!`
    );
    updateHUD();
  }

  // Upgrade the player's equipped Role Work Tool (Scythe / Wrench / Paddle)
  function playerUpgradeTool() {
    const lin = getPlayerLineage();
    const ent = scene.getPlayerEntity();
    if (!ent) return;

    const currentLv = lin.toolLevel || 1;
    if (currentLv >= 5) {
      scene.spawnFloatingPopup(ent.x, ent.y, 'MAX TOOL LV.5 REACHED! ★', '#fde047');
      return;
    }

    const cost = 15;
    if (lin.wallet < cost) {
      scene.spawnFloatingPopup(ent.x, ent.y, `NEED ${cost}G TO UPGRADE TOOL!`, '#f87171');
      setDialogue(lin, 'TOOL FORGE', `Need ${cost} GCOIN to upgrade your ${TOOL_META[lin.role].name} to Lv.${currentLv + 1}. Press [SPACE] to work first!`);
      return;
    }

    lin.wallet -= cost;
    lin.toolLevel = currentLv + 1;
    const mult = getToolMultiplier(lin).toFixed(1);
    const tMeta = TOOL_META[lin.role];

    scene.triggerPlayerActionAnim();
    scene.spawnAscensionBeam(ent.x, ent.y, '#38bdf8');
    scene.spawnFloatingPopup(ent.x, ent.y, `🛠️ ${tMeta.name} LV.${lin.toolLevel} (${mult}×)!`, '#38bdf8');
    scene.spawnSpeech(lin.id, `${tMeta.name} Lv.${lin.toolLevel}!`, 2.5);
    setDialogue(
      lin,
      'TOOL ENHANCED',
      `🛠️ Upgraded ${lin.id}'s ${tMeta.name} to Level ${lin.toolLevel}! All work, harvest, factory & Paddlefield output is now ${mult}×!`
    );
    updateHUD();
  }

  // Contextual Action when pressing SPACE
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

    const toolMult = getToolMultiplier(lin);

    if (actionType === 'harvest') {
      const baseWage = soc.wages.farmer + (lin.currentGen - 1);
      const wage = Math.round(baseWage * toolMult);
      const rations = Math.round(4 * toolMult);
      lin.wallet += wage;
      lin.workCount += 1;
      lin.stamina = Math.max(10, (lin.stamina ?? 85) - 5);
      lin.contextTokens += 1150;

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
      scene.spawnFloatingPopup(ent.x, ent.y, `🌾 +${wage}G & +${rations} RATIONS (${toolMult.toFixed(1)}×)!`, '#4ade80');
      scene.spawnSpeech(lin.id, `Scythe Lv.${lin.toolLevel}: +${wage}G!`, 2.0);
      setDialogue(lin, 'FARMLAND HARVEST', `${lin.id} swung Golden Scythe Lv.${lin.toolLevel} (${toolMult.toFixed(1)}×)! Earned +${wage} GCOIN and harvested +${rations} Rations.`);
    } else if (actionType === 'craft') {
      const baseWage = soc.wages.engineer + (lin.currentGen - 1);
      const wage = Math.round(baseWage * toolMult);
      lin.wallet += wage;
      lin.workCount += 1;
      lin.completedSales += 1;
      lin.stamina = Math.max(10, (lin.stamina ?? 85) - 5);
      lin.contextTokens += 1200;
      scene.spawnBurst(ent.x, ent.y, '#38bdf8', 12);
      scene.spawnFloatingPopup(ent.x, ent.y, `⚙️ +${wage}G & BLUEPRINT (${toolMult.toFixed(1)}×)!`, '#38bdf8');
      scene.spawnSpeech(lin.id, `Wrench Lv.${lin.toolLevel}: +${wage}G!`, 2.0);
      setDialogue(lin, 'FACTORY & TECH RIG', `${lin.id} used Power Wrench Lv.${lin.toolLevel} (${toolMult.toFixed(1)}×) to manufacture Tech Blueprints! Earned +${wage} GCOIN and +2 Power.`);
    } else if (actionType === 'rally') {
      const baseWage = soc.wages.manager + (lin.currentGen - 1);
      const wage = Math.round(baseWage * toolMult);
      lin.wallet += wage;
      soc.harmony = Math.min(100, (soc.harmony || 88) + 4);
      lin.stamina = Math.min(100, (lin.stamina ?? 80) + 12);
      lin.contextTokens += 1100;
      scene.spawnBurst(ent.x, ent.y, '#bef264', 14);
      scene.spawnFloatingPopup(ent.x, ent.y, `🎾 PADDLE SMASH! +${wage}G & +HARMONY`, '#bef264');
      scene.spawnSpeech(lin.id, `Paddle Lv.${lin.toolLevel} Smash!`, 2.0);
      setDialogue(lin, 'PADDLEFIELD RALLY', `${lin.id} rallied on the Paddlefield with Pro Paddle Lv.${lin.toolLevel} (${toolMult.toFixed(1)}×)! Earned +${wage} GCOIN and boosted Colony Harmony to ${soc.harmony}%.`);
    } else if (actionType === 'house') {
      lin.stamina = 100;
      lin.wallet += 4;
      scene.spawnBurst(ent.x, ent.y, '#4ade80', 10);
      scene.spawnFloatingPopup(ent.x, ent.y, '🏠 RESTED AT HOUSE (100% STAMINA)', '#4ade80');
      scene.spawnSpeech(lin.id, 'Rested! Stamina 100%!', 2.0);
      setDialogue(lin, 'HOMESTEAD HOUSE', `${lin.id} rested inside the Homestead House! Stamina fully restored to 100%.`);
    } else if (actionType === 'trade') {
      eatOrTradeAtMarket(lin, ent.x, ent.y, true);
    } else if (actionType === 'handover') {
      ascendToNextGen(lin, ent.x, ent.y);
    } else if (actionType === 'law') {
      cycleCharterLaw(lin, ent.x, ent.y);
    } else if (actionType === 'upgrade') {
      upgradeAllBuildings(lin, ent.x, ent.y);
    }

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
        setDialogue(lin, 'MARKET SHOP TRADE', `${lin.id} bought a Ration from ${seller.id} at the Shop for 1G and restored Stamina to ${lin.stamina}%!`);
      }
      return true;
    }
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
      `⚡ ${lin.id} Gen ${prev} retired at 10,000 tokens and passed Wallet (${lin.wallet}G), Tool Lv.${lin.toolLevel} & ${lin.buildingsOwned || 0} Buildings to Gen ${lin.currentGen} Heir!`
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

  function upgradeAllBuildings(lin, x, y) {
    if (soc.treasuryBalance < 15) {
      scene.spawnFloatingPopup(x, y, 'NEED 15 TREASURY GCOIN!', '#f87171');
      return;
    }
    soc.treasuryBalance -= 15;
    scene.placedBuildings.forEach((b) => {
      b.lv = Math.min(5, (b.lv || 1) + 1);
    });
    scene.spawnAscensionBeam(x, y, '#fde047');
    scene.spawnFloatingPopup(x, y, '⬆️ ALL BUILDINGS UPGRADED!', '#fde047');
    setDialogue(lin, 'TREASURY UPGRADE', `Spent 15 Treasury GCOIN to upgrade all Mainland Houses, Factories, Shops, and Paddlefields!`);
  }

  // Autonomous background world simulation: AI agents work, use tools, and build Houses/Factories/Shops/Paddlefields!
  function stepAutonomousWorld() {
    if (gameSpeed === 0) return;
    soc.completedTurns += 1;

    // Passive income from built Factories & Shops on the mainland
    const factoryCount = scene.placedBuildings.filter((b) => b.type === 'factory').length;
    soc.treasuryBalance += 1 + Math.floor(factoryCount * 0.5);

    const aiAgents = soc.lineages.filter((l) => l.id !== playerAgentId);
    const actor = aiAgents[soc.completedTurns % aiAgents.length];
    if (!actor) return;
    const ent = scene.entities[actor.id];
    const ax = ent ? ent.x : 0;
    const ay = ent ? ent.y : 0;

    actor.stamina = Math.max(15, (actor.stamina ?? 85) - 5);
    actor.contextTokens += 1100;

    if (actor.stamina < 55) {
      eatOrTradeAtMarket(actor, ax, ay, false);
    } else if (actor.contextTokens >= actor.contextThreshold && actor.currentGen < actor.maxGen) {
      ascendToNextGen(actor, ax, ay);
    } else if (actor.wallet >= 32 && scene.placedBuildings.length < 14 && soc.completedTurns % 4 === 0) {
      // AI agent autonomously builds their role's signature building on an open land plot!
      const roleBldg = actor.role === 'farmer'
        ? (Math.random() > 0.5 ? 'house' : 'shop')
        : actor.role === 'engineer'
          ? 'factory'
          : 'paddlefield';
      const cost = BUILDING_COSTS[roleBldg] || 20;
      actor.wallet -= cost;
      actor.buildingsOwned = (actor.buildingsOwned || 0) + 1;
      scene.buildStructureOnLand(roleBldg, actor.id, ax, ay);
      scene.spawnSpeech(actor.id, `Built ${roleBldg.toUpperCase()}!`, 2.4);
    } else {
      const mult = getToolMultiplier(actor);
      const wage = Math.round((soc.wages[actor.role] || 10) * mult);
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
      ? './assets/sprites/pixel-archon.png?v=sharp2'
      : `./assets/sprites/pixel-${lin.role}.png?v=sharp2`;
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

    // Equipped Work Tool HUD
    const tMeta = TOOL_META[lin.role] || TOOL_META.farmer;
    const mult = getToolMultiplier(lin).toFixed(1);
    document.getElementById('hudToolImg').src = tMeta.icon;
    document.getElementById('hudToolLv').textContent = `LV.${lin.toolLevel || 1} (${mult}×)`;
    document.getElementById('hotbarToolIcon').src = tMeta.icon;
    document.getElementById('hotbarToolName').textContent = tMeta.short;

    document.getElementById('hudWallet').textContent = `${lin.wallet}G`;
    document.getElementById('hudPower').textContent = `P:${computePower(lin)} (#${myRank})`;
    document.getElementById('hudTreasury').textContent = `${soc.treasuryBalance}G`;

    const totalRations = soc.lineages.reduce(
      (acc, l) => acc + l.listedGoods.filter((g) => g.type === 'food').reduce((s, g) => s + g.remainingQty, 0),
      0
    );
    document.getElementById('hudRations').textContent = `${totalRations}`;
    document.getElementById('hudBuildingsCount').textContent = `${scene.placedBuildings.length} Built`;

    document.getElementById('hudTurnText').textContent = `DAY ${soc.completedTurns}`;
    if (archon) {
      document.getElementById('hudArchonText').textContent = `👑 ARCHON: ${archon.id.toUpperCase()} (P:${computePower(archon)})`;
    }
  }

  // Proximity prompt check
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

  let aiInterval = setInterval(stepAutonomousWorld, 2000);
  function setSpeed(spd) {
    gameSpeed = spd;
    if (aiInterval) clearInterval(aiInterval);
    if (spd > 0) {
      aiInterval = setInterval(stepAutonomousWorld, Math.round(2000 / spd));
    }
    document.getElementById('btnSpeed').textContent = spd === 0 ? '⏸ PAUSE' : `▶ ${spd}×`;
  }

  // Keyboard bindings for walking, working, building (1-4) & upgrading tool (5)
  window.addEventListener('keydown', (e) => {
    keysPressed[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      performContextualAction();
    } else if (e.key === '1') {
      playerBuildStructure('house');
    } else if (e.key === '2') {
      playerBuildStructure('factory');
    } else if (e.key === '3') {
      playerBuildStructure('shop');
    } else if (e.key === '4') {
      playerBuildStructure('paddlefield');
    } else if (e.key === '5') {
      playerUpgradeTool();
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      const lin = getPlayerLineage();
      const ent = scene.getPlayerEntity();
      if (ent) eatOrTradeAtMarket(lin, ent.x, ent.y, true);
      updateHUD();
    } else if (e.code === 'Tab') {
      e.preventDefault();
      cycleNextAgent();
    }
  });

  window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
  });

  // Hotbar slot clicks
  document.querySelectorAll('.hotbar-slot').forEach((slot) => {
    slot.addEventListener('click', () => {
      const kind = slot.dataset.slot;
      if (kind === 'tool') {
        playerUpgradeTool();
      } else {
        playerBuildStructure(kind);
      }
    });
  });

  document.getElementById('equippedToolBox').addEventListener('click', () => playerUpgradeTool());
  document.getElementById('playerCardBtn').addEventListener('click', (e) => {
    if (e.target.closest('#equippedToolBox')) return;
    cycleNextAgent();
  });
  document.getElementById('worldPromptBubble').addEventListener('click', () => performContextualAction());

  document.getElementById('btnWeather').addEventListener('click', (e) => {
    const mode = scene.cycleWeatherMode();
    const icons = { sunny: '☀️', sunset: '🌅', rain: '🌧️', night: '🌙' };
    e.currentTarget.textContent = icons[mode] || '☀️';
  });

  document.getElementById('btnPixelMode').addEventListener('click', (e) => {
    const scale = scene.cyclePixelMode();
    e.currentTarget.textContent = scale === 1 ? '✨ HD 1×' : `🕹️ ${scale}×`;
  });

  document.getElementById('btnSpeed').addEventListener('click', () => {
    const next = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 4 : gameSpeed === 4 ? 0 : 1;
    setSpeed(next);
  });

  updateHUD();
})();
