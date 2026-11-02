// AGENT SOCIETY: 2.5D DYNASTY SIMULATOR — Game Loop, Rules Engine & UI Controller

(function () {
  const DATA = window.AGENT_SOCIETY_DATA;
  const societies = DATA.SOCIETIES;

  let currentSocietyId = 'active-dynasty-sim';
  let selectedAgentId = 'farmer-1';
  let selectedGenInspect = null;
  let selectedIslandId = null;
  let activeRoleFilter = 'all';
  let rosterSortBy = 'power';
  let currentEventIdx = 0;
  let replayInterval = null;
  let liveRunInterval = null;
  let toastTimeout = null;

  const canvas = document.getElementById('isoCanvas');
  const scene = new window.IsometricSocietyScene(canvas, {
    onSelectAgent: (agentId) => {
      selectAgent(agentId);
      switchRightTab('agent');
    },
    onSelectIsland: (islandId) => {
      selectedIslandId = islandId;
      scene.setSelectedIsland(islandId);
      renderIslandChips();
      if (islandId === 'market-exchange') {
        switchRightTab('market');
      } else if (islandId === 'charter-court') {
        switchRightTab('charter');
      } else if (islandId === 'lineage-hall') {
        switchRightTab('agent');
      } else {
        switchRightTab('market');
      }
    },
    onSelectCore: () => {
      switchRightTab('charter');
    }
  });

  function getSociety() {
    return societies[currentSocietyId];
  }

  function computePower(lin) {
    return lin.wallet + lin.completedSales * 2 + (lin.currentGen - 1) * 2;
  }

  function computeProsperity(soc) {
    const totalWallet = soc.lineages.reduce((s, l) => s + l.wallet, 0);
    const totalSales = soc.lineages.reduce((s, l) => s + l.completedSales * 5, 0);
    const districtPts = Object.values(soc.districtLevels || {}).reduce((s, lv) => s + lv * 15, 0);
    soc.prosperityScore = totalWallet + totalSales + soc.treasuryBalance + soc.retiredGenerationsCount * 3 + districtPts;
    if (soc.prosperityScore >= 500) {
      soc.era = 4;
      soc.badge = 'ERA IV: GOLDEN REPUBLIC';
    } else if (soc.prosperityScore >= 360) {
      soc.era = 3;
      soc.badge = 'ERA III: AUTOMATED COMMONS';
    } else if (soc.prosperityScore >= 240) {
      soc.era = 2;
      soc.badge = 'ERA II: MARKET COMPACT';
    } else {
      soc.era = 1;
      soc.badge = 'ERA I: FOUNDING SETTLEMENT';
    }
    return soc.prosperityScore;
  }

  function hasLaw(soc, lawId) {
    return Array.isArray(soc.activeLaws) && soc.activeLaws.includes(lawId);
  }

  function syncActiveWages(soc) {
    if (hasLaw(soc, 'law-sha85-wages')) {
      soc.wages = { farmer: 12, engineer: 14, manager: 10 };
    } else {
      soc.wages = { farmer: 5, engineer: 10, manager: 15 };
    }
  }

  function showToast(msg) {
    const el = document.getElementById('gameToastBanner');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      el.classList.add('hidden');
    }, 3400);
  }

  function getSortedLineages(soc, mode = 'power') {
    const list = [...soc.lineages];
    if (mode === 'power') {
      list.sort((a, b) => computePower(b) - computePower(a) || b.completedSales - a.completedSales || a.id.localeCompare(b.id));
    } else if (mode === 'stamina') {
      list.sort((a, b) => (a.stamina ?? 85) - (b.stamina ?? 85));
    } else if (mode === 'wallet') {
      list.sort((a, b) => b.wallet - a.wallet || b.completedSales - a.completedSales);
    } else {
      list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    }
    return list;
  }

  function getPowerRankMap(soc) {
    const byPower = getSortedLineages(soc, 'power');
    const rankMap = {};
    byPower.forEach((l, idx) => {
      rankMap[l.id] = idx + 1;
    });
    return rankMap;
  }

  function populateSocietySelect() {
    const sel = document.getElementById('societySelect');
    sel.innerHTML = '';
    Object.values(societies).forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      if (s.id === currentSocietyId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function evaluateQuests(soc) {
    if (!soc.completedQuests) soc.completedQuests = [];
    DATA.GAME_QUESTS.forEach((q) => {
      const res = q.check(soc);
      if (res.done && !soc.completedQuests.includes(q.id)) {
        soc.completedQuests.push(q.id);
        soc.treasuryBalance += 25;
        soc.harmony = Math.min(100, (soc.harmony || 85) + 6);
        showToast(`🏆 QUEST COMPLETED: ${q.title}! (+25 Treasury GCOIN)`);
        scene.spawnFloatingPopup('town-hall', `🏆 ${q.title} (+25G)`, '#fbbf24');
      }
    });
  }

  function renderAll() {
    const soc = getSociety();
    syncActiveWages(soc);
    computeProsperity(soc);
    evaluateQuests(soc);

    scene.setSociety(soc);
    scene.setSelectedAgent(selectedAgentId);

    renderTelemetry(soc);
    renderQuests(soc);
    renderRoster(soc);
    renderIslandChips();
    renderAgentInspector(soc);
    renderCharter(soc);
    renderMarketAndDistricts(soc);
    renderEventsAndJournal(soc);
    updateScrubberUI(soc);
  }

  function renderTelemetry(soc) {
    document.getElementById('eraHeaderBadge').textContent = soc.badge;
    document.getElementById('kpiProsperity').textContent = `${soc.prosperityScore} PTS`;
    const nextTarget = soc.era === 1 ? 240 : soc.era === 2 ? 360 : soc.era === 3 ? 500 : 1000;
    document.getElementById('kpiEraSub').textContent = soc.era < 4 ? `Next Era at ${nextTarget} PTS` : 'Max Era Unlocked! ★';

    document.getElementById('kpiTurns').textContent = `Turn ${soc.completedTurns}`;
    document.getElementById('kpiStateBadge').textContent =
      soc.state === 'running' ? `RUNNING (${soc.speed || 1}× SPEED)` : 'PAUSED • READY';

    document.getElementById('kpiTreasury').textContent = `${soc.treasuryBalance} GCOIN`;

    const totalRations = soc.lineages.reduce(
      (acc, l) => acc + l.listedGoods.filter((g) => g.type === 'food').reduce((s, g) => s + g.remainingQty, 0),
      0
    );
    const hungryCount = soc.lineages.filter((l) => (l.stamina ?? 85) < 50).length;
    document.getElementById('kpiRations').textContent = `${totalRations} Rations`;
    document.getElementById('kpiFedStatus').textContent =
      hungryCount === 0 ? `All ${soc.lineages.length} Lineages Fed` : `${hungryCount} Lineage(s) Hungry!`;

    document.getElementById('kpiHarmony').textContent = `${soc.harmony}%`;
    document.getElementById('kpiRetired').textContent = `${soc.retiredGenerationsCount} Gens`;
    document.getElementById('kpiGenCap').textContent = `Cap: Gen ${soc.generationCap} (+10% Wage/Gen)`;

    const ranked = getSortedLineages(soc, 'power');
    const top = ranked[0];
    document.getElementById('kpiTopPower').textContent = top
      ? `👑 ${top.id} (${computePower(top)})`
      : '—';

    document.getElementById('kpiActiveLaws').textContent = `${soc.activeLaws.length} / ${DATA.CHARTER_LAWS.length} LAWS`;
    document.getElementById('kpiWageSummary').textContent =
      `Wages: F:${soc.wages.farmer}G • E:${soc.wages.engineer}G • M:${soc.wages.manager}G`;

    const activeLin = soc.lineages.find((l) => l.id === soc.activeTurnAgentId) || soc.lineages[0];
    if (activeLin) {
      document.getElementById('hudActiveAgent').textContent = `${activeLin.id} (Gen ${activeLin.currentGen})`;
    }
    document.getElementById('hudWageRule').textContent =
      `Farmer ${soc.wages.farmer}G • Engineer ${soc.wages.engineer}G • Manager ${soc.wages.manager}G`;
  }

  function renderQuests(soc) {
    const container = document.getElementById('questsListContainer');
    let doneCount = 0;
    container.innerHTML = DATA.GAME_QUESTS.map((q) => {
      const res = q.check(soc);
      const isDone = soc.completedQuests.includes(q.id) || res.done;
      if (isDone) doneCount += 1;
      return `
        <div class="quest-item ${isDone ? 'done' : ''}">
          <div class="quest-top">
            <span>${isDone ? '✅' : '⏳'} ${q.title}</span>
            <span style="color:${isDone ? '#34d399' : '#fbbf24'};font-family:monospace">${res.progress}</span>
          </div>
          <div class="quest-sub">${q.targetDesc}</div>
        </div>
      `;
    }).join('');
    document.getElementById('questsDoneBadge').textContent = `${doneCount} / ${DATA.GAME_QUESTS.length}`;
  }

  function renderRoster(soc) {
    const container = document.getElementById('lineageRosterList');
    container.innerHTML = '';

    const rankMap = getPowerRankMap(soc);
    const sorted = getSortedLineages(soc, rosterSortBy).filter(
      (l) => activeRoleFilter === 'all' || l.role === activeRoleFilter
    );

    sorted.forEach((lin) => {
      const pwr = computePower(lin);
      const rank = rankMap[lin.id];
      const stam = lin.stamina ?? 85;
      const stamCol = stam >= 60 ? '#34d399' : stam >= 35 ? '#fbbf24' : '#f87171';
      const avatarSrc = rank === 1
        ? './assets/sprites/pixel-archon.png'
        : `./assets/sprites/pixel-${lin.role}.png`;
      const div = document.createElement('div');
      div.className = `roster-item ${lin.id === selectedAgentId ? 'selected' : ''}`;
      div.innerHTML = `
        <div class="roster-top">
          <div class="roster-name-group">
            <img src="${avatarSrc}" alt="${lin.role}" class="roster-avatar" />
            <span class="rank-pill">${rank === 1 ? '👑 #1' : '#' + rank}</span>
            <span class="roster-name">${lin.id}</span>
          </div>
          <span class="role-badge ${lin.role}">${lin.role}</span>
        </div>
        <div class="roster-metrics">
          <span>G<strong>${lin.currentGen}</strong></span>
          <span style="color:${stamCol}">🌾<strong>${stam}%</strong></span>
          <span>💰<strong>${lin.wallet}G</strong></span>
          <span>⚡<strong>${pwr}</strong></span>
        </div>
      `;
      div.addEventListener('click', () => {
        selectAgent(lin.id);
      });
      container.appendChild(div);
    });
  }

  function renderIslandChips() {
    const soc = getSociety();
    const container = document.getElementById('islandQuickButtons');
    container.innerHTML = '';
    DATA.ISLAND_DISTRICTS.forEach((isl) => {
      const lv = (soc.districtLevels && soc.districtLevels[isl.id]) || 2;
      const btn = document.createElement('button');
      btn.className = `island-chip ${selectedIslandId === isl.id ? 'active' : ''}`;
      btn.textContent = `Lv.${lv} ${isl.title.split(' ')[0]}`;
      btn.title = `${isl.title} (Lv.${lv}/5) — Click to view or upgrade`;
      btn.addEventListener('click', () => {
        selectedIslandId = isl.id;
        scene.setSelectedIsland(selectedIslandId);
        switchRightTab('market');
        renderIslandChips();
      });
      container.appendChild(btn);
    });
  }

  function selectAgent(agentId) {
    selectedAgentId = agentId;
    selectedGenInspect = null;
    scene.setSelectedAgent(agentId);
    renderAll();
  }

  function setRoleFilter(role) {
    activeRoleFilter = role;
    document.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.role === role);
    });
    renderRoster(getSociety());
  }

  function renderAgentInspector(soc) {
    const container = document.getElementById('agentInspectorContent');
    const lin = soc.lineages.find((l) => l.id === selectedAgentId) || soc.lineages[0];
    if (!lin) return;

    const rankMap = getPowerRankMap(soc);
    const pwr = computePower(lin);
    const rank = rankMap[lin.id];
    const stam = lin.stamina ?? 85;
    const tokPct = Math.min(100, Math.round((lin.contextTokens / lin.contextThreshold) * 100));
    const masteryBonus = (lin.currentGen - 1) * 10;
    const inspectGen = selectedGenInspect || lin.currentGen;

    let genChipsHtml = '';
    for (let g = 1; g <= lin.currentGen; g++) {
      genChipsHtml += `<button class="gen-chip ${g === inspectGen ? 'active' : ''}" data-gen="${g}">G${g}</button>`;
    }

    const invHtml = lin.inventory.length
      ? lin.inventory.map((item) => `<div class="market-item"><div><div class="market-item-title">🛡️ ${item.name}</div><div class="market-item-sub">Crafted by: ${item.source}</div></div><span class="mini-badge">×${item.qty}</span></div>`).join('')
      : '<div class="muted-note">No equipped blueprints or rations yet.</div>';

    const avatarSrc = rank === 1
      ? './assets/sprites/pixel-archon.png'
      : `./assets/sprites/pixel-${lin.role}.png`;

    container.innerHTML = `
      <div class="dossier-card">
        <div class="dossier-header">
          <div style="display:flex;align-items:center;gap:10px">
            <img src="${avatarSrc}" alt="${lin.role}" class="dossier-avatar" />
            <div>
              <div class="dossier-title">${rank === 1 ? '👑 ' : ''}${lin.name}</div>
              <span class="role-badge ${lin.role}">${lin.role}</span>
              <span class="rank-pill">Power #${rank} (${pwr})</span>
            </div>
          </div>
          <span class="mini-badge">+${masteryBonus}% Gen Mastery</span>
        </div>
        <p class="muted-note">${lin.goal}</p>

        <div class="stat-grid-3">
          <div class="stat-box">
            <span>WALLET</span>
            <strong>${lin.wallet} G</strong>
          </div>
          <div class="stat-box">
            <span>SALES</span>
            <strong>${lin.completedSales}</strong>
          </div>
          <div class="stat-box">
            <span>GEN HEIR</span>
            <strong style="color:#c084fc">G${lin.currentGen}/${lin.maxGen}</strong>
          </div>
        </div>

        <div class="token-bar-wrap">
          <div class="token-bar-label">
            <span>🌾 Food Stamina (Eats Ration < 60%)</span>
            <strong>${stam}%</strong>
          </div>
          <div class="token-bar-track">
            <div class="token-bar-fill stamina-fill" style="width:${stam}%"></div>
          </div>
        </div>

        <div class="token-bar-wrap">
          <div class="token-bar-label">
            <span>🧠 Context Lifespan (Heir Handover @ 10,000)</span>
            <strong>${lin.contextTokens.toLocaleString()} / 10k (${tokPct}%)</strong>
          </div>
          <div class="token-bar-track">
            <div class="token-bar-fill" style="width:${tokPct}%"></div>
          </div>
        </div>
      </div>

      <div class="section-subheader">
        <span>🎮 DIRECT PLAYER / AGENT COMMANDS</span>
      </div>
      <div class="quick-action-card">
        <div class="quick-action-buttons">
          <button id="btnCmdWork" class="cyber-btn small accent-emerald">⚒️ Work &amp; Produce</button>
          <button id="btnCmdEat" class="cyber-btn small accent-amber">🌾 Buy &amp; Eat Ration (1G)</button>
          <button id="btnCmdHandover" class="cyber-btn small accent-purple">🧬 Spawn Gen ${lin.currentGen + 1} Heir</button>
          <button id="btnCmdGrant" class="cyber-btn small accent-cyan">🎁 Treasury Grant (+10G)</button>
        </div>
      </div>

      <div class="section-subheader">
        <span>🛠️ EQUIPPED BLUEPRINTS &amp; INVENTORY</span>
      </div>
      <div class="market-list">${invHtml}</div>

      <div class="section-subheader">
        <span>🧬 DYNASTY LINEAGE HISTORY (GEN 1 → ${lin.currentGen})</span>
      </div>
      <div class="dossier-card">
        <div class="gen-strip">${genChipsHtml}</div>
        <div class="handover-box" style="margin-top:7px">${lin.handoverSummary}</div>
      </div>
    `;

    container.querySelectorAll('.gen-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        selectedGenInspect = Number(chip.dataset.gen);
        renderAgentInspector(soc);
      });
    });

    document.getElementById('btnCmdWork').addEventListener('click', () => performAgentWork(soc, lin));
    document.getElementById('btnCmdEat').addEventListener('click', () => performAgentBuyRation(soc, lin));
    document.getElementById('btnCmdHandover').addEventListener('click', () => performAgentHandover(soc, lin));
    document.getElementById('btnCmdGrant').addEventListener('click', () => {
      if (soc.treasuryBalance < 10) {
        showToast('⚠️ Need at least 10 GCOIN in Shared Treasury for a Stimulus Grant!');
        return;
      }
      soc.treasuryBalance -= 10;
      lin.wallet += 10;
      lin.stamina = Math.min(100, (lin.stamina ?? 85) + 15);
      scene.spawnFloatingPopup(lin.id, `🎁 +10G TREASURY GRANT!`, '#22d3ee');
      showToast(`🎁 Granted +10 GCOIN from Shared Treasury to ${lin.id}!`);
      renderAll();
    });
  }

  function performAgentWork(soc, lin) {
    const baseWage = soc.wages[lin.role] || 10;
    const districtLv = (soc.districtLevels && soc.districtLevels[lin.homeDistrictId]) || 2;
    const genBonus = Math.floor((lin.currentGen - 1) * 0.8);
    const totalWage = baseWage + genBonus + (districtLv - 1);

    lin.wallet += totalWage;
    lin.workCount += 1;
    soc.workEntriesCount += 1;
    lin.stamina = Math.max(10, (lin.stamina ?? 85) - 6);
    lin.contextTokens += hasLaw(soc, 'law-fee-conservation') ? 950 : 1250;

    let itemCreated = '';
    if (lin.role === 'farmer') {
      const yieldUnits = 4 + districtLv;
      const existing = lin.listedGoods.find((g) => g.type === 'food');
      if (existing) {
        existing.remainingQty += yieldUnits;
        existing.initialQty += yieldUnits;
      } else {
        lin.listedGoods.push({
          id: `ration-${lin.id}-${soc.completedTurns}`,
          name: 'Staple Food Rations',
          type: 'food',
          price: 1,
          remainingQty: yieldUnits,
          initialQty: yieldUnits
        });
      }
      itemCreated = `+${yieldUnits}🌾 Rations`;
    } else if (lin.role === 'engineer') {
      const bpName = lin.id === 'engineer-8' ? 'Maintenance Log v2' : 'Storage & Irrigation Blueprint';
      const existing = lin.listedGoods[0];
      if (existing) {
        existing.remainingQty += 2;
      } else {
        lin.listedGoods.push({
          id: `tech-${lin.id}-${soc.completedTurns}`,
          name: bpName,
          type: 'tech',
          price: 2,
          remainingQty: 3,
          initialQty: 3
        });
      }
      itemCreated = `+2⚙️ Blueprints`;
    } else {
      soc.harmony = Math.min(100, (soc.harmony || 85) + 4);
      itemCreated = `+4% 💖 Harmony`;
    }

    scene.spawnFloatingPopup(lin.id, `⚒️ +${totalWage}G & ${itemCreated}`, '#34d399');
    checkHandoverThreshold(soc, lin);
    renderAll();
  }

  function performAgentBuyRation(soc, buyer) {
    const seller = soc.lineages.find(
      (l) => l.listedGoods.some((g) => g.type === 'food' && g.remainingQty > 0)
    );
    if (!seller) {
      showToast('⚠️ No Staple Food Rations in stock! Command a Farmer to Harvest first.');
      return false;
    }
    const foodGood = seller.listedGoods.find((g) => g.type === 'food' && g.remainingQty > 0);
    const price = hasLaw(soc, 'law-fair-ration-cap') ? 1 : foodGood.price;

    if (buyer.wallet < price) {
      if (hasLaw(soc, 'law-emergency-granary') && soc.treasuryBalance >= price) {
        soc.treasuryBalance -= price;
        seller.wallet += price;
        foodGood.remainingQty -= 1;
        buyer.stamina = Math.min(100, (buyer.stamina ?? 40) + 45);
        scene.sendAgentExcursion(buyer.id, 'market-exchange', 1.8);
        scene.spawnFloatingPopup(buyer.id, `🛡️ WELFARE RATION (+45% 🌾)`, '#22d3ee');
        renderAll();
        return true;
      }
      showToast(`⚠️ ${buyer.id} lacks ${price} GCOIN to buy a Ration!`);
      return false;
    }

    foodGood.remainingQty -= 1;
    buyer.wallet -= price;
    seller.wallet += price;
    seller.completedSales += hasLaw(soc, 'law-corroborated-ledger') ? 2 : 1;
    buyer.purchasesCount += 1;
    soc.purchasesCount += 1;
    buyer.stamina = Math.min(100, (buyer.stamina ?? 60) + 42);

    scene.sendAgentExcursion(buyer.id, 'market-exchange', 1.8);
    scene.spawnFloatingPopup(buyer.id, `🛒 ATE RATION (+42% 🌾)`, '#fbbf24');
    renderAll();
    return true;
  }

  function performAgentHandover(soc, lin) {
    if (lin.currentGen >= lin.maxGen) {
      showToast(`👑 ${lin.id} has reached the maximum Generation Cap (${lin.maxGen})!`);
      return;
    }
    const prevGen = lin.currentGen;
    lin.currentGen += 1;
    lin.contextTokens = 900;
    lin.stamina = 95;
    soc.retiredGenerationsCount += 1;
    lin.livingAgentId = `agent-${lin.id}-g${lin.currentGen}-${Math.floor(1000 + Math.random() * 8999)}`;
    lin.handoverSummary = `Gen ${prevGen} → Gen ${lin.currentGen} Dynasty Handover (Turn ${soc.completedTurns}): Compacted thread memory at 10k tokens. Heir inherited ${lin.wallet} GCOIN wallet, ${lin.completedSales} sales, and +${(lin.currentGen - 1) * 10}% Wage Mastery!`;

    soc.messages.push({
      id: `handover-${lin.id}-g${lin.currentGen}-${Date.now()}`,
      turn: soc.completedTurns,
      timestamp: new Date().toISOString(),
      from: lin.id,
      fromGen: lin.currentGen,
      to: 'manager-3',
      toGen: 1,
      status: 'delivered',
      fee: 1,
      category: 'handover',
      ledgerAction: `🧬 DYNASTY HANDOVER: ${lin.id} Gen ${prevGen} → Gen ${lin.currentGen} (+${(lin.currentGen - 1) * 10}% Mastery)`,
      body: lin.handoverSummary
    });
    currentEventIdx = soc.messages.length - 1;

    scene.sendAgentExcursion(lin.id, 'lineage-hall', 2.1);
    scene.spawnFloatingPopup('lineage-hall', `🧬 ${lin.id} GEN ${lin.currentGen} BORN!`, '#c084fc');
    renderAll();
  }

  function checkHandoverThreshold(soc, lin) {
    if (lin.contextTokens >= lin.contextThreshold && lin.currentGen < lin.maxGen) {
      performAgentHandover(soc, lin);
    }
  }

  function renderCharter(soc) {
    const ranked = getSortedLineages(soc, 'power');
    const leader = ranked[0];
    if (leader) {
      document.getElementById('govLeaderBadge').textContent =
        `${leader.id} (Wallet ${leader.wallet}G + Sales ${leader.completedSales}×2 + Gen = Power ${computePower(leader)})`;
    }

    const lawsGrid = document.getElementById('charterLawsGrid');
    lawsGrid.innerHTML = DATA.CHARTER_LAWS.map((law) => {
      const enacted = hasLaw(soc, law.id);
      return `
        <div class="law-card ${enacted ? 'enacted' : ''}" data-lawid="${law.id}">
          <div class="law-header">
            <span>${law.icon} ${law.name}</span>
            <span class="mini-badge" style="color:${enacted ? '#34d399' : '#94a3b8'}">${enacted ? 'ENACTED ✔' : 'CLICK TO ENACT'}</span>
          </div>
          <div class="journal-body">${law.description}</div>
          <div class="law-effect">⚡ ${law.effectText}</div>
        </div>
      `;
    }).join('');

    lawsGrid.querySelectorAll('.law-card').forEach((card) => {
      card.addEventListener('click', () => {
        const lawId = card.dataset.lawid;
        const lawObj = DATA.CHARTER_LAWS.find((l) => l.id === lawId);
        const idx = soc.activeLaws.indexOf(lawId);
        if (idx >= 0) {
          soc.activeLaws.splice(idx, 1);
          showToast(`📜 Repealed Charter Law: ${lawObj.name}`);
        } else {
          soc.activeLaws.push(lawId);
          soc.charterChangesCount += 1;
          soc.harmony = Math.min(100, (soc.harmony || 85) + 4);
          soc.charterRevisions.push({
            version: `v${soc.charterRevisions.length + 1}.0`,
            authorAgentId: leader ? leader.livingAgentId : 'archon',
            lineageId: leader ? `👑 ${leader.id} (Gen ${leader.currentGen})` : 'Archon Decree',
            powerAtChange: leader ? computePower(leader) : 0,
            turn: soc.completedTurns,
            timestamp: new Date().toISOString(),
            summary: `Enacted ${lawObj.name}: ${lawObj.effectText}`
          });
          if (leader) scene.sendAgentExcursion(leader.id, 'charter-court', 1.9);
          scene.spawnFloatingPopup('charter-court', `👑 LAW ENACTED: ${lawObj.name.slice(0, 22)}`, '#f472b6');
          showToast(`👑 Archon ${leader ? leader.id : ''} enacted: ${lawObj.name}!`);
        }
        renderAll();
      });
    });

    document.getElementById('charterMarkdownView').textContent = soc.charterMarkdown;

    const revContainer = document.getElementById('charterRevisionsList');
    revContainer.innerHTML = soc.charterRevisions.slice().reverse().map((r) => `
      <div class="journal-card">
        <div class="journal-meta">
          <span><strong>${r.version}</strong> • Turn #${r.turn} • ${r.lineageId}</span>
          <span>Power: ${r.powerAtChange}</span>
        </div>
        <div class="journal-body">${r.summary}</div>
      </div>
    `).join('');
  }

  function renderMarketAndDistricts(soc) {
    // 1. District Upgrade Cards
    const distIcons = {
      'farmstead': './assets/sprites/pixel-castle.png',
      'workshop': './assets/sprites/pixel-workstation.png',
      'lineage-hall': './assets/sprites/char-ancestor.svg',
      'market-exchange': './assets/sprites/pixel-bridge.png',
      'charter-court': './assets/sprites/pixel-monolith.png',
      'town-hall': './assets/sprites/pixel-clubhouse.png'
    };
    const distContainer = document.getElementById('districtUpgradesList');
    distContainer.innerHTML = DATA.ISLAND_DISTRICTS.map((isl) => {
      const lv = (soc.districtLevels && soc.districtLevels[isl.id]) || 2;
      const cost = isl.upgradeCost + (lv - 1) * 5;
      const isMax = lv >= isl.maxLevel;
      const iconSrc = distIcons[isl.id] || './assets/sprites/pixel-clubhouse.png';
      return `
        <div class="market-item">
          <div style="display:flex;align-items:center;gap:9px">
            <img src="${iconSrc}" alt="${isl.title}" class="district-icon" />
            <div>
              <div class="market-item-title">${isl.title} <span style="color:#fbbf24">Lv.${lv}/${isl.maxLevel}</span></div>
              <div class="market-item-sub">${isl.bonusText}</div>
            </div>
          </div>
          <button class="price-tag btn-upgrade-dist" data-dist="${isl.id}" data-cost="${cost}" ${isMax ? 'disabled' : ''}>
            ${isMax ? 'MAX LV.5 ★' : `⬆️ Upgrade (${cost}G)`}
          </button>
        </div>
      `;
    }).join('');

    distContainer.querySelectorAll('.btn-upgrade-dist').forEach((btn) => {
      btn.addEventListener('click', () => {
        const distId = btn.dataset.dist;
        const cost = Number(btn.dataset.cost);
        const lv = (soc.districtLevels && soc.districtLevels[distId]) || 2;
        if (lv >= 5) return;
        if (soc.treasuryBalance < cost) {
          showToast(`⚠️ Need ${cost} Treasury GCOIN to upgrade ${distId.toUpperCase()}! (Current Treasury: ${soc.treasuryBalance}G)`);
          return;
        }
        soc.treasuryBalance -= cost;
        soc.districtLevels[distId] = lv + 1;
        soc.harmony = Math.min(100, (soc.harmony || 85) + 3);
        scene.spawnFloatingPopup(distId, `⬆️ UPGRADED TO LV.${lv + 1}! ★`, '#fbbf24');
        showToast(`🏗️ Upgraded ${distId.toUpperCase()} to Level ${lv + 1}!`);
        renderAll();
      });
    });

    // 2. Live Market Listings
    const allListings = [];
    let totalUnits = 0;
    soc.lineages.forEach((lin) => {
      lin.listedGoods.forEach((g) => {
        if (g.remainingQty > 0) {
          totalUnits += g.remainingQty;
          allListings.push({ ...g, sellerId: lin.id });
        }
      });
    });

    document.getElementById('marketTotalUnitsBadge').textContent = `${totalUnits} Units Listed`;

    const mktContainer = document.getElementById('marketListingsContainer');
    mktContainer.innerHTML = allListings.map((item) => `
      <div class="market-item">
        <div>
          <div class="market-item-title">${item.type === 'food' ? '🌾' : item.type === 'tech' ? '⚙️' : '🏛️'} ${item.name}</div>
          <div class="market-item-sub">Seller: <strong>${item.sellerId}</strong> • Stock: ${item.remainingQty}</div>
        </div>
        <button class="price-tag btn-buy-item" data-seller="${item.sellerId}" data-goodid="${item.id}">
          🛒 Buy (${item.price}G)
        </button>
      </div>
    `).join('');

    mktContainer.querySelectorAll('.btn-buy-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const buyer = soc.lineages.find((l) => l.id === selectedAgentId) || soc.lineages[0];
        const seller = soc.lineages.find((l) => l.id === btn.dataset.seller);
        if (!buyer || !seller) return;
        const good = seller.listedGoods.find((g) => g.id === btn.dataset.goodid);
        if (!good || good.remainingQty <= 0) return;

        if (buyer.wallet < good.price) {
          showToast(`⚠️ ${buyer.id} only has ${buyer.wallet} GCOIN (needs ${good.price}G)!`);
          return;
        }
        good.remainingQty -= 1;
        buyer.wallet -= good.price;
        seller.wallet += good.price;
        seller.completedSales += 1;
        buyer.purchasesCount += 1;
        soc.purchasesCount += 1;

        if (good.type === 'food') {
          buyer.stamina = Math.min(100, (buyer.stamina ?? 65) + 42);
        } else {
          buyer.inventory.push({ name: good.name, qty: 1, source: seller.id });
          if (hasLaw(soc, 'law-pilot-subsidy') && soc.treasuryBalance >= 1) {
            soc.treasuryBalance -= 1;
            buyer.wallet += 1;
          }
        }
        scene.sendAgentExcursion(buyer.id, 'market-exchange', 1.8);
        scene.spawnFloatingPopup('market-exchange', `🛒 ${buyer.id} bought ${good.name.slice(0, 18)}`, '#fbbf24');
        renderAll();
      });
    });
  }

  function renderEventsAndJournal(soc) {
    // 1. World Events God-Mode Deck
    const deckEl = document.getElementById('worldEventsDeck');
    deckEl.innerHTML = DATA.WORLD_EVENTS.map((ev) => `
      <div class="law-card" data-evid="${ev.id}">
        <div class="law-header">
          <span>${ev.title}</span>
          <span class="mini-badge">TRIGGER ⚡</span>
        </div>
        <div class="journal-body">${ev.description}</div>
      </div>
    `).join('');

    deckEl.querySelectorAll('.law-card').forEach((card) => {
      card.addEventListener('click', () => {
        const ev = DATA.WORLD_EVENTS.find((e) => e.id === card.dataset.evid);
        if (!ev) return;
        ev.apply(soc);
        soc.lineages.forEach((l) => checkHandoverThreshold(soc, l));
        scene.spawnFloatingPopup('town-hall', ev.title, '#f472b6');
        showToast(`${ev.title} — ${ev.description}`);
        renderAll();
      });
    });

    // 2. Action Chronicle
    const listEl = document.getElementById('journalFeedList');
    const query = (document.getElementById('journalSearchInput').value || '').toLowerCase().trim();
    const cat = document.getElementById('journalCategorySelect').value;

    const filtered = soc.messages.filter((m) => {
      if (cat === 'ledger' && !m.ledgerAction) return false;
      if (cat === 'handover' && m.category !== 'handover') return false;
      if (!query) return true;
      return (
        m.from.toLowerCase().includes(query) ||
        m.to.toLowerCase().includes(query) ||
        m.body.toLowerCase().includes(query) ||
        (m.ledgerAction && m.ledgerAction.toLowerCase().includes(query))
      );
    }).slice().reverse();

    listEl.innerHTML = filtered.map((m) => `
      <div class="journal-card" data-msgid="${m.id}">
        <div class="journal-meta">
          <span>Turn #${m.turn} • <strong>${m.from}</strong> (G${m.fromGen}) → <strong>${m.to}</strong> (G${m.toGen})</span>
          <span>−1G Tax</span>
        </div>
        ${m.ledgerAction
          ? `<div class="ledger-action-pill">${m.ledgerAction}</div>`
          : `<div class="proposal-pill">💬 MCP Coordination</div>`
        }
        <div class="journal-body">${m.body}</div>
      </div>
    `).join('');

    listEl.querySelectorAll('.journal-card').forEach((card) => {
      card.addEventListener('click', () => {
        const msg = soc.messages.find((m) => m.id === card.dataset.msgid);
        if (msg) {
          scene.triggerMessagePulse(msg);
          selectAgent(msg.from);
        }
      });
    });
  }

  function updateScrubberUI(soc) {
    const scrubber = document.getElementById('eventScrubberInput');
    const maxIdx = Math.max(0, soc.messages.length - 1);
    scrubber.max = maxIdx;
    if (currentEventIdx > maxIdx) currentEventIdx = maxIdx;
    scrubber.value = currentEventIdx;

    const msg = soc.messages[currentEventIdx];
    const label = document.getElementById('scrubberEventLabel');
    if (msg) {
      label.textContent = `Turn ${msg.turn} • ${msg.from} → ${msg.to} (${currentEventIdx + 1}/${soc.messages.length})`;
    } else {
      label.textContent = `Turn ${soc.completedTurns}`;
    }
  }

  // CORE GAME SIMULATION TURN STEP
  function executeSingleTurn() {
    const soc = getSociety();
    syncActiveWages(soc);

    const idx = soc.lineages.findIndex((l) => l.id === soc.activeTurnAgentId);
    const currentLin = soc.lineages[idx >= 0 ? idx : 0];
    const nextLin = soc.lineages[(idx + 1) % soc.lineages.length];

    soc.completedTurns += 1;

    // 1. Passive Stamina drain on active agent
    currentLin.stamina = Math.max(15, (currentLin.stamina ?? 85) - 7);

    let actionDesc = '';
    let category = 'work';

    // 2. Priority 1: If Hungry (< 62% Stamina), buy & eat a Staple Food Ration!
    if (currentLin.stamina < 62) {
      const ate = performAgentBuyRation(soc, currentLin);
      if (ate) {
        actionDesc = `🛒 ATE RATION: Restored Stamina to ${currentLin.stamina}%`;
        category = 'trade';
      }
    }

    // 3. Priority 2: Role Work or Blueprint Trade
    if (!actionDesc) {
      if (soc.completedTurns % 3 !== 0) {
        performAgentWork(soc, currentLin);
        actionDesc = `⚒️ WORK (${currentLin.role.toUpperCase()}): Minted Wage & Produced Goods`;
        category = 'work';
      } else {
        // Buy a blueprint or ration from another lineage
        const seller = soc.lineages.find(
          (l) => l.id !== currentLin.id && l.listedGoods.some((g) => g.remainingQty > 0 && g.price <= currentLin.wallet - 1)
        );
        if (seller) {
          const good = seller.listedGoods.find((g) => g.remainingQty > 0 && g.price <= currentLin.wallet - 1);
          good.remainingQty -= 1;
          currentLin.wallet -= good.price;
          seller.wallet += good.price;
          seller.completedSales += 1;
          currentLin.purchasesCount += 1;
          soc.purchasesCount += 1;
          if (good.type === 'food') {
            currentLin.stamina = Math.min(100, currentLin.stamina + 38);
          } else {
            currentLin.inventory.push({ name: good.name, qty: 1, source: seller.id });
          }
          actionDesc = `🛒 TRADE: Bought 1× ${good.name} from ${seller.id} (${good.price}G)`;
          category = 'trade';
        } else {
          performAgentWork(soc, currentLin);
          actionDesc = `⚒️ WORK (${currentLin.role.toUpperCase()}): Minted Wage & Produced Goods`;
        }
      }
    }

    // 4. Send 1 paid MCP message (1 GCOIN tax -> Shared Treasury)
    if (currentLin.wallet >= 1) {
      currentLin.wallet -= 1;
      soc.treasuryBalance += 1;
      soc.paidMessagesCount += 1;
      currentLin.messagesSent += 1;

      const newMsg = {
        id: `msg-t${soc.completedTurns}-${Date.now()}`,
        turn: soc.completedTurns,
        timestamp: new Date().toISOString(),
        from: currentLin.id,
        fromGen: currentLin.currentGen,
        to: nextLin.id,
        toGen: nextLin.currentGen,
        status: 'delivered',
        fee: 1,
        category,
        ledgerAction: actionDesc,
        body: `${currentLin.id} (Gen ${currentLin.currentGen}) completed turn: ${actionDesc}. Stamina ${currentLin.stamina}%, Wallet ${currentLin.wallet}G.`
      };
      soc.messages.push(newMsg);
      currentEventIdx = soc.messages.length - 1;
      scene.triggerMessagePulse(newMsg);
    }

    // 5. Check 10,000-token Generational Handover
    checkHandoverThreshold(soc, currentLin);

    soc.activeTurnAgentId = nextLin.id;
    selectedAgentId = currentLin.id;
    renderAll();
  }

  function setSimulationSpeed(speed) {
    const soc = getSociety();
    if (liveRunInterval) {
      clearInterval(liveRunInterval);
      liveRunInterval = null;
    }
    soc.speed = speed;
    document.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.speed) === speed);
    });

    if (speed === 0) {
      soc.state = 'paused';
      renderAll();
      return;
    }

    soc.state = 'running';
    renderAll();
    executeSingleTurn();
    const intervalMs = speed === 1 ? 2200 : speed === 2 ? 1150 : 600;
    liveRunInterval = setInterval(() => {
      if (getSociety().state !== 'running') {
        clearInterval(liveRunInterval);
        liveRunInterval = null;
        return;
      }
      executeSingleTurn();
    }, intervalMs);
  }

  function switchRightTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });
  }

  // Bind UI Controls
  document.getElementById('societySelect').addEventListener('change', (e) => {
    setSimulationSpeed(0);
    currentSocietyId = e.target.value;
    const soc = getSociety();
    selectedAgentId = soc.lineages[0].id;
    currentEventIdx = Math.max(0, soc.messages.length - 1);
    renderAll();
  });

  document.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSimulationSpeed(Number(btn.dataset.speed));
    });
  });

  document.getElementById('btnStepTurn').addEventListener('click', () => {
    setSimulationSpeed(0);
    executeSingleTurn();
  });

  document.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => setRoleFilter(btn.dataset.role));
  });

  document.getElementById('rosterSortSelect').addEventListener('change', (e) => {
    rosterSortBy = e.target.value;
    renderRoster(getSociety());
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchRightTab(btn.dataset.tab));
  });

  document.getElementById('journalSearchInput').addEventListener('input', () => renderEventsAndJournal(getSociety()));
  document.getElementById('journalCategorySelect').addEventListener('change', () => renderEventsAndJournal(getSociety()));

  // Scrubber & Replay
  document.getElementById('eventScrubberInput').addEventListener('input', (e) => {
    const soc = getSociety();
    currentEventIdx = Number(e.target.value);
    const msg = soc.messages[currentEventIdx];
    if (msg) {
      scene.triggerMessagePulse(msg);
      selectedAgentId = msg.from;
    }
    renderAll();
  });

  document.getElementById('btnPrevEvent').addEventListener('click', () => {
    const soc = getSociety();
    currentEventIdx = Math.max(0, currentEventIdx - 1);
    const msg = soc.messages[currentEventIdx];
    if (msg) scene.triggerMessagePulse(msg);
    renderAll();
  });

  document.getElementById('btnNextEvent').addEventListener('click', () => {
    const soc = getSociety();
    currentEventIdx = Math.min(soc.messages.length - 1, currentEventIdx + 1);
    const msg = soc.messages[currentEventIdx];
    if (msg) scene.triggerMessagePulse(msg);
    renderAll();
  });

  document.getElementById('btnPlayStream').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (replayInterval) {
      clearInterval(replayInterval);
      replayInterval = null;
      btn.textContent = '▶ Replay History';
      return;
    }
    btn.textContent = '⏹ Stop Replay';
    const soc = getSociety();
    if (currentEventIdx >= soc.messages.length - 1) currentEventIdx = 0;
    scene.triggerMessagePulse(soc.messages[currentEventIdx]);
    renderAll();

    replayInterval = setInterval(() => {
      const s = getSociety();
      if (currentEventIdx < s.messages.length - 1) {
        currentEventIdx += 1;
        const msg = s.messages[currentEventIdx];
        if (msg) scene.triggerMessagePulse(msg);
        renderAll();
      } else {
        clearInterval(replayInterval);
        replayInterval = null;
        btn.textContent = '▶ Replay History';
      }
    }, 1400);
  });

  // Camera, Pixel Shader, Weather & Need Bar Controls
  document.getElementById('btnCyclePixel').addEventListener('click', (e) => {
    const scale = scene.cyclePixelMode();
    const label = scale === 2 ? '🕹️ Pixel 2×' : scale === 3 ? '👾 Retro 3×' : '✨ HD 1×';
    e.currentTarget.textContent = label;
    e.currentTarget.classList.toggle('active', scale > 1);
    showToast(`🕹️ Render Mode: ${scale === 2 ? 'Crisp 16-Bit Pixel-Art 3D (2×)' : scale === 3 ? 'Chunky 8-Bit Retro Scanline (3×)' : 'HD Voxel Resolution (1×)'}`);
  });

  document.getElementById('btnCycleWeather').addEventListener('click', (e) => {
    const mode = scene.cycleWeatherMode();
    const labels = {
      sunny: '☀️ Sunny',
      sunset: '🌅 Sunset',
      rain: '🌧️ Rain',
      night: '🌙 Night'
    };
    e.currentTarget.textContent = labels[mode] || '☀️ Sunny';
    showToast(`🌤️ Floating Island Weather: ${labels[mode]}`);
  });

  document.getElementById('btnToggleBoard').addEventListener('click', (e) => {
    const useMap = scene.toggleWorldBoard();
    e.currentTarget.textContent = useMap ? '🗺️ World Map' : '🏝️ Sky Islands';
    e.currentTarget.classList.toggle('active', useMap);
    showToast(useMap ? '🗺️ Switched to Generated 2.5D Isometric World Map Board' : '🏝️ Switched to Pixel-Art 3D Floating Sky Islands');
  });

  document.getElementById('btnZoomIn').addEventListener('click', () => scene.zoomBy(1.14));
  document.getElementById('btnZoomOut').addEventListener('click', () => scene.zoomBy(0.88));
  document.getElementById('btnResetCam').addEventListener('click', () => scene.resetCamera());
  document.getElementById('btnToggleBars').addEventListener('click', (e) => {
    scene.showNeedBars = !scene.showNeedBars;
    e.currentTarget.classList.toggle('active', scene.showNeedBars);
  });

  // Modals
  document.getElementById('btnNewSociety').addEventListener('click', () => {
    document.getElementById('createSocietyModal').classList.remove('hidden');
  });

  document.getElementById('btnBriefModal').addEventListener('click', () => {
    document.getElementById('briefModal').classList.remove('hidden');
  });

  document.getElementById('truthBannerCard').addEventListener('click', () => {
    switchRightTab('charter');
  });

  document.getElementById('btnHumanEditCharter').addEventListener('click', () => {
    const soc = getSociety();
    document.getElementById('charterEditTextarea').value = soc.charterMarkdown;
    document.getElementById('charterEditModal').classList.remove('hidden');
  });

  document.getElementById('charterEditForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const soc = getSociety();
    soc.charterMarkdown = document.getElementById('charterEditTextarea').value;
    document.getElementById('charterEditModal').classList.add('hidden');
    renderAll();
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.close).classList.add('hidden');
    });
  });

  document.getElementById('createSocietyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    setSimulationSpeed(0);
    const name = document.getElementById('newSocName').value.trim() || 'Solaris Voxel Colony';
    const pop = Math.max(10, Math.min(20, Number(document.getElementById('newSocPop').value) || 12));
    const genCap = Math.max(10, Math.min(20, Number(document.getElementById('newSocGenCap').value) || 15));
    const threshold = Number(document.getElementById('newSocThreshold').value) || 10000;
    const wageMode = document.getElementById('newSocWageMode').value;

    const wages = wageMode === 'sha85'
      ? { farmer: 12, engineer: 14, manager: 10 }
      : wageMode === 'flat10'
        ? { farmer: 10, engineer: 10, manager: 10 }
        : { farmer: 5, engineer: 10, manager: 15 };

    const newId = 'colony-' + Date.now().toString().slice(-4);
    const lineages = DATA.createGameLineages(pop, genCap, wages, true);
    lineages.forEach((l) => {
      l.contextThreshold = threshold;
    });

    societies[newId] = {
      id: newId,
      name,
      badge: 'ERA I: FOUNDING SETTLEMENT',
      state: 'paused',
      speed: 0,
      era: 1,
      harmony: 90,
      prosperityScore: 150,
      populationCap: pop,
      generationCap: genCap,
      contextThreshold: threshold,
      completedTurns: 1,
      livingAgentsCount: pop,
      retiredGenerationsCount: 0,
      paidMessagesCount: 1,
      purchasesCount: 0,
      workEntriesCount: pop,
      charterChangesCount: 1,
      treasuryBalance: 30,
      wages,
      districtLevels: {
        'farmstead': 1,
        'workshop': 1,
        'lineage-hall': 1,
        'market-exchange': 1,
        'charter-court': 1,
        'town-hall': 1
      },
      activeLaws: wageMode === 'sha85'
        ? ['law-fair-ration-cap', 'law-sha85-wages', 'law-emergency-granary']
        : ['law-fair-ration-cap', 'law-corroborated-ledger', 'law-emergency-granary'],
      completedQuests: [],
      activeTurnAgentId: lineages[0].id,
      charterMarkdown: DATA.INITIAL_CHARTER_MARKDOWN,
      charterRevisions: [
        {
          version: 'v1.0',
          authorAgentId: 'system-genesis',
          lineageId: 'Founding Compact',
          powerAtChange: 10,
          turn: 1,
          timestamp: new Date().toISOString(),
          summary: 'Colony founded with 10 GCOIN per lineage and opening Charter laws.'
        }
      ],
      lineages,
      messages: [DATA.REAL_EXPERIMENT_MESSAGES[0]]
    };

    currentSocietyId = newId;
    selectedAgentId = lineages[0].id;
    currentEventIdx = 0;
    document.getElementById('createSocietyModal').classList.add('hidden');
    populateSocietySelect();
    renderAll();
    showToast(`🚀 Launched new Colony: ${name} (${pop} Lineages)!`);
  });

  // Initialize
  populateSocietySelect();
  currentEventIdx = Math.max(0, getSociety().messages.length - 1);
  renderAll();
  setTimeout(() => {
    const soc = getSociety();
    if (soc.messages.length) {
      scene.triggerMessagePulse(soc.messages[soc.messages.length - 1]);
    }
  }, 500);
})();
