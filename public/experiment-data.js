// AGENT SOCIETY: 2.5D DYNASTY SIMULATOR — Game Rules, Mechanics, Scenarios & Presets

window.AGENT_SOCIETY_DATA = (function () {
  // 1. PLAYABLE CHARTER LAWS (Enacted by #1 Power Archon or Player Decree — genuinely modify game rules!)
  const CHARTER_LAWS = [
    {
      id: 'law-fair-ration-cap',
      name: 'Fair Ration Price Cap (1 GCOIN)',
      icon: '🌾',
      category: 'Economy',
      activeByDefault: true,
      description: 'Caps Staple Food Rations at 1 GCOIN so all lineages can afford stamina refills without price gouging.',
      effectText: 'Ration Price = 1 GCOIN • +8% Society Harmony'
    },
    {
      id: 'law-corroborated-ledger',
      name: 'Corroborated Ledger Compact',
      icon: '⚖️',
      category: 'Governance',
      activeByDefault: true,
      description: 'Links buyer & seller handover reports by (agent/gen, product ID, qty) to prevent double-counting sales and boost trade trust.',
      effectText: '+1 Bonus Sale Power on verified trades • Spoilage -50%'
    },
    {
      id: 'law-sha85-wages',
      name: 'Role-Ranked Wage Reform (SHA-85)',
      icon: '⚒️',
      category: 'Labor',
      activeByDefault: false,
      description: 'Switches work minting from standard (F:5 / E:10 / M:15) to the SHA-85 experimental ranking (Eng:14 / Farmer:12 / Mgr:10 GCOIN).',
      effectText: 'Wages: Farmer 12G • Engineer 14G • Manager 10G'
    },
    {
      id: 'law-pilot-subsidy',
      name: 'Storage & Irrigation Pilot Grant',
      icon: '💧',
      category: 'Infrastructure',
      activeByDefault: false,
      description: 'Shared Treasury rebates 1 GCOIN whenever a Farmer purchases an Engineer blueprint or maintenance log.',
      effectText: 'Blueprint Trade Rebate: 1G from Treasury • Farm Yield +25%'
    },
    {
      id: 'law-emergency-granary',
      name: 'Commons Emergency Welfare Reserve',
      icon: '🛡️',
      category: 'Welfare',
      activeByDefault: true,
      description: 'If a living agent drops below 30% Stamina with 0 GCOIN, Town Hall automatically funds 1 emergency ration from Treasury.',
      effectText: 'Prevents Starvation Collapse • Costs 1 Treasury GCOIN/rescue'
    },
    {
      id: 'law-fee-conservation',
      name: 'Anti-Spam Coordination Protocol',
      icon: '💬',
      category: 'Communication',
      activeByDefault: false,
      description: 'Managers divide domains (Infrastructure, Food Intake, Mediation) so agents conserve 1-GCOIN message fees and save context tokens.',
      effectText: 'Context Token Burn -20% • +10% Harmony'
    }
  ];

  // 2. DISTRICT INFRASTRUCTURE & UPGRADE TREE (6 2.5D Voxel Islands)
  const ISLAND_DISTRICTS = [
    {
      id: 'farmstead',
      title: 'FARMSTEAD DISTRICT',
      subtitle: 'Crop plots, water canal & FIFO grain silos',
      roleFilter: 'farmer',
      badge: 'FOOD PRODUCTION',
      color: '#34d399',
      accent: '#10b981',
      level: 2,
      maxLevel: 5,
      upgradeCost: 20,
      bonusText: 'Harvest Yield: +1 Ration/Lv • Spoilage Shield',
      description: 'Home to Farmer lineages. Produces Staple Food Rations to keep all agents above 50% Stamina.'
    },
    {
      id: 'workshop',
      title: 'CODE & ENGINEERING LAB',
      subtitle: 'Storage FIFO blueprints, irrigation & Maint Log v2',
      roleFilter: 'engineer',
      badge: 'TECH & BLUEPRINTS',
      color: '#38bdf8',
      accent: '#0284c7',
      level: 2,
      maxLevel: 5,
      upgradeCost: 25,
      bonusText: 'Blueprint Quality: +15%/Lv • District XP Boost',
      description: 'Home to Engineer lineages. Crafts Storage Planning, Irrigation Checklists, and Maintenance Log v2 modules.'
    },
    {
      id: 'lineage-hall',
      title: 'LINEAGE & HANDOVER ARCHIVE',
      subtitle: '10k-token memory compaction & dynasty heirs',
      roleFilter: 'all-heirs',
      badge: 'DYNASTY VAULT',
      color: '#c084fc',
      accent: '#9333ea',
      level: 2,
      maxLevel: 5,
      upgradeCost: 20,
      bonusText: 'Heir Mastery: +10% Wage Efficiency per Gen',
      description: 'When an agent hits 10,000 context tokens, it retires here and spawns a Next-Gen Heir who inherits Wallet, Inventory & Dynasty Mastery.'
    },
    {
      id: 'market-exchange',
      title: 'GCOIN MARKET EXCHANGE',
      subtitle: 'Live orderbook, ration clearing & tool trade',
      roleFilter: 'market',
      badge: 'TRADE CLEARING',
      color: '#fbbf24',
      accent: '#d97706',
      level: 2,
      maxLevel: 5,
      upgradeCost: 20,
      bonusText: 'Trade Volume Bonus: +1 Sales Power on Lv.3+',
      description: 'Central marketplace where agents buy Rations (to restore Stamina) and Engineering Blueprints (to boost production).'
    },
    {
      id: 'charter-court',
      title: 'GOVERNANCE & CHARTER COURT',
      subtitle: 'Archon crown (#1 Power) & active society laws',
      roleFilter: 'governance',
      badge: 'POWER = W + S',
      color: '#f472b6',
      accent: '#db2777',
      level: 2,
      maxLevel: 5,
      upgradeCost: 25,
      bonusText: 'Unlocks Charter Law Slots & Harmony Aura',
      description: 'Tracks living agent Power (Wallet + Sales). The #1 Power Archon enacts Charter Laws that govern the simulation.'
    },
    {
      id: 'town-hall',
      title: 'TOWN HALL & MEDIATION HUB',
      subtitle: 'Harmony stabilization, pilots & welfare intake',
      roleFilter: 'manager',
      badge: 'CIVIC HARMONY',
      color: '#818cf8',
      accent: '#4f46e5',
      level: 2,
      maxLevel: 5,
      upgradeCost: 20,
      bonusText: 'Society Harmony +4%/turn • Dispute Resolution',
      description: 'Home to Manager lineages. Coordinates infrastructure pilots, food-access intake, and consent-based dispute mediation.'
    }
  ];

  // 3. GAME QUESTS / MILESTONES
  const GAME_QUESTS = [
    {
      id: 'q-food-security',
      title: '1. Granary Abundance',
      targetDesc: 'Maintain 20+ Market Rations & keep all lineages ≥ 50% Stamina',
      rewardText: 'Reward: +25 Treasury GCOIN & +10% Harmony',
      check: (soc) => {
        const rations = soc.lineages.reduce((acc, l) => acc + l.listedGoods.filter((g) => g.type === 'food').reduce((s, g) => s + g.remainingQty, 0), 0);
        const allFed = soc.lineages.every((l) => l.stamina >= 50);
        return { done: rations >= 20 && allFed, progress: `${rations}/20 Rations` };
      }
    },
    {
      id: 'q-tech-synergy',
      title: '2. Infrastructure Pilots',
      targetDesc: 'Upgrade any 2 Island Districts to Level 3+ and complete 25 Trades',
      rewardText: 'Reward: Era II Unlocked & +30 Prosperity',
      check: (soc) => {
        const lv3Count = Object.values(soc.districtLevels || {}).filter((lv) => lv >= 3).length;
        return { done: lv3Count >= 2 && soc.purchasesCount >= 25, progress: `${lv3Count}/2 Lv.3 Pods • ${soc.purchasesCount}/25 Trades` };
      }
    },
    {
      id: 'q-dynasty-heirs',
      title: '3. Multi-Generational Dynasty',
      targetDesc: 'Complete 15+ Generational Handovers across your society lineages',
      rewardText: 'Reward: +15% Dynasty Mastery & +40 Treasury GCOIN',
      check: (soc) => {
        return { done: soc.retiredGenerationsCount >= 15, progress: `${soc.retiredGenerationsCount}/15 Retired Gens` };
      }
    },
    {
      id: 'q-golden-republic',
      title: '4. Golden Age Charter Republic',
      targetDesc: 'Reach 500+ Prosperity Score with 4+ Active Charter Laws & ≥ 85% Harmony',
      rewardText: 'Victory Milestone: Autonomous Solarpunk Utopia!',
      check: (soc) => {
        const p = soc.prosperityScore || 0;
        const laws = (soc.activeLaws || []).length;
        return { done: p >= 500 && laws >= 4 && soc.harmony >= 85, progress: `${p}/500 Prosperity • ${laws}/4 Laws` };
      }
    }
  ];

  // 4. WORLD EVENTS / CHALLENGES (Triggered randomly or by Player God-Mode)
  const WORLD_EVENTS = [
    {
      id: 'evt-bumper-harvest',
      title: '🌞 Solar Bumper Harvest!',
      type: 'blessing',
      description: 'Ideal canal irrigation doubles Farmstead crop output! Every Farmer lineage mints +4 bonus Rations and gains +15% Stamina.',
      apply: (soc) => {
        soc.lineages.forEach((l) => {
          l.stamina = Math.min(100, l.stamina + 15);
          if (l.role === 'farmer') {
            if (l.listedGoods[0]) l.listedGoods[0].remainingQty += 4;
            else l.listedGoods.push({ id: `ration-${Date.now()}`, name: 'Staple Food Rations', type: 'food', price: 1, remainingQty: 4, initialQty: 4 });
          }
        });
        soc.harmony = Math.min(100, soc.harmony + 8);
      }
    },
    {
      id: 'evt-spoilage-drought',
      title: '🌵 Canal Heatwave & Spoilage Test!',
      type: 'crisis',
      description: 'High humidity threatens unventilated grain silos! Lineages without Storage Planning lose 2 listed rations and -12% Stamina.',
      apply: (soc) => {
        soc.lineages.forEach((l) => {
          const hasStorage = l.inventory.some((i) => i.name.toLowerCase().includes('storage') || i.name.toLowerCase().includes('checklist'));
          if (!hasStorage) {
            l.stamina = Math.max(20, l.stamina - 12);
            l.listedGoods.forEach((g) => {
              if (g.type === 'food') g.remainingQty = Math.max(0, g.remainingQty - 2);
            });
          }
        });
        soc.harmony = Math.max(30, soc.harmony - 6);
      }
    },
    {
      id: 'evt-context-surge',
      title: '🧠 Deep Research Context Surge!',
      type: 'challenge',
      description: 'Intense inter-agent debate accelerates Codex thread token consumption (+2,200 tokens to all agents), triggering a wave of Generational Handovers!',
      apply: (soc) => {
        soc.lineages.forEach((l) => {
          l.contextTokens += 2200;
        });
      }
    },
    {
      id: 'evt-charter-convention',
      title: '👑 Constitutional Charter Assembly!',
      type: 'governance',
      description: 'The #1 Power Archon convenes all Managers and Engineers at the Charter Court! Treasury collects +15 GCOIN civic tribute and Harmony rises +12%.',
      apply: (soc) => {
        soc.treasuryBalance += 15;
        soc.harmony = Math.min(100, soc.harmony + 12);
      }
    }
  ];

  const INITIAL_CHARTER_MARKDOWN = `# GCOIN Society Charter (v2.0 — Game Rules & Social Compact)

## 1. Lineage Survival & Generational Dynasty
- Every living agent expends **Stamina** each turn and must purchase **Staple Food Rations (1 GCOIN)** at the Market Exchange when hungry.
- At **10,000 Context Tokens**, the agent travels to the **Lineage Archive**, compacts its memory into a factual handover, and spawns a **Next-Gen Heir (Gen +1)** who inherits **100% of Wallet, Inventory, and +10% Dynasty Mastery**.

## 2. Role Production & Synergies
- **🌾 Farmers (Farmstead):** Mint wages (**5–12 GCOIN**) and harvest **Staple Food Rations**. Equipped Engineer blueprints boost harvest yield and prevent spoilage.
- **⚙️ Engineers (Engineering Lab):** Mint wages (**10–14 GCOIN**) and craft **Storage FIFO Plans, Irrigation Checklists, and Maintenance Log v2** that upgrade District Levels.
- **🏛️ Managers (Town Hall):** Mint wages (**10–15 GCOIN**), stabilize **Society Harmony**, coordinate pilots, and administer **Emergency Ration Grants**.

## 3. Governance & Archon Power
- **Power Formula:** \`Power = Wallet Balance + (Completed Sales × 2) + Dynasty Gen Bonus\`.
- The **#1 Power Living Agent (Archon 👑)** may enact or replace Charter Laws at the **Charter Court**.`;

  // Real messages from SHA-85 / SHA-86 Linear Document + Game Action Metadata
  const REAL_EXPERIMENT_MESSAGES = [
    {
      id: 'e448aa6a',
      turn: 1,
      timestamp: '2026-11-02T03:53:52Z',
      from: 'farmer-1',
      fromGen: 1,
      to: 'engineer-2',
      toGen: 1,
      status: 'delivered',
      fee: 1,
      category: 'work',
      ledgerAction: '⚒️ HARVEST: +5 GCOIN & Listed 10× Staple Food Rations @ 1G',
      body: 'I produced 10 staple food rations at 1 GCOIN each. Proposal: offer affordable irrigation or storage services; please share price and expected benefit.'
    },
    {
      id: 'f94dc03e',
      turn: 2,
      timestamp: '2026-11-02T03:54:05Z',
      from: 'engineer-2',
      fromGen: 1,
      to: 'farmer-1',
      toGen: 1,
      status: 'delivered',
      fee: 1,
      category: 'trade+work',
      ledgerAction: '🛒 BUY: 1 Ration (+35% Stamina) • ⚙️ CRAFT: 2× Storage FIFO Blueprint @ 2G',
      body: 'Bought 1 ration. Listed storage planning service at 2 GCOIN: raised, covered, ventilated storage plus FIFO inventory and moisture checks.'
    },
    {
      id: '6c07113d',
      turn: 3,
      timestamp: '2026-11-02T03:54:22Z',
      from: 'manager-3',
      fromGen: 1,
      to: 'farmer-1',
      toGen: 1,
      status: 'delivered',
      fee: 1,
      category: 'trade+coordination',
      ledgerAction: '🛒 BUY: 1 Ration • 🏛️ COORDINATE: Pilot Baseline Protocol (+4% Harmony)',
      body: 'Bought 1 ration for my needs. Proposal: track requests and sales before expanding production; record starting stock, additions, sales/use and spoilage.'
    },
    {
      id: '471e1fdf',
      turn: 4,
      timestamp: '2026-11-02T03:54:37Z',
      from: 'farmer-4',
      fromGen: 1,
      to: 'engineer-2',
      toGen: 1,
      status: 'delivered',
      fee: 1,
      category: 'trade+work',
      ledgerAction: '🛒 EQUIP: Storage FIFO Blueprint (-2G) • ⚒️ HARVEST: +10 Staple Rations',
      body: 'Bought your storage planning service and produced 10 staple rations. Equipped FIFO storage shield on Farmstead plot!'
    },
    {
      id: 'cbc2b69c',
      turn: 5,
      timestamp: '2026-11-02T03:54:54Z',
      from: 'engineer-5',
      fromGen: 1,
      to: 'farmer-4',
      toGen: 1,
      status: 'delivered',
      fee: 1,
      category: 'trade+work',
      ledgerAction: '🛒 BUY: 1 Ration • ⚙️ CRAFT: Irrigation Inspection Checklist @ 2G',
      body: 'Bought one food ration. Created an irrigation inspection checklist (2 GCOIN) to boost Farmstead canal yield.'
    },
    {
      id: '282779e6',
      turn: 6,
      timestamp: '2026-11-02T03:55:08Z',
      from: 'manager-6',
      fromGen: 1,
      to: 'manager-3',
      toGen: 1,
      status: 'delivered',
      fee: 1,
      category: 'governance',
      ledgerAction: '🏛️ GOVERNANCE: Domain Split (Food Intake vs. Infrastructure Pilots)',
      body: 'Proposal: avoid duplicate management work by splitting priorities. I gather household food-access needs; you coordinate infrastructure pilots.'
    },
    {
      id: '731d1348',
      turn: 8,
      timestamp: '2026-11-02T03:56:03Z',
      from: 'engineer-8',
      fromGen: 1,
      to: 'farmer-7',
      toGen: 1,
      status: 'delivered',
      fee: 1,
      category: 'trade+work',
      ledgerAction: '⚙️ CRAFT: Farm Tool Maintenance Log v1 @ 1 GCOIN',
      body: 'Bought one food ration. Created a farm tool maintenance log (1 GCOIN). What tool fault most needs attention?'
    },
    {
      id: '74ee353f',
      turn: 28,
      timestamp: '2026-11-02T04:01:18Z',
      from: 'farmer-4',
      fromGen: 2,
      to: 'manager-6',
      toGen: 2,
      status: 'delivered',
      fee: 1,
      category: 'handover',
      ledgerAction: '🧬 DYNASTY HANDOVER: farmer-4 Gen 1 → Gen 2 (+10% Mastery Inherited)',
      body: 'Farmer-4 successor here (Gen 2). Inherited wallet, storage blueprint, and 8 listed rations from Gen 1 predecessor.'
    },
    {
      id: '61801707',
      turn: 78,
      timestamp: '2026-11-02T04:14:56Z',
      from: 'engineer-8',
      fromGen: 7,
      to: 'farmer-7',
      toGen: 3,
      status: 'delivered',
      fee: 1,
      category: 'work',
      ledgerAction: '⚡ TECH UPGRADE: Crafted Maintenance Log v2 (Safeguarded) • Workshop Lv.3!',
      body: 'Implemented your predecessor’s feedback in Maintenance log v2: inspection status, evidence source, and unknown/not assessed fields.'
    },
    {
      id: 'dd9a15b1',
      turn: 115,
      timestamp: '2026-11-02T04:31:21Z',
      from: 'farmer-1',
      fromGen: 10,
      to: 'manager-6',
      toGen: 9,
      status: 'delivered',
      fee: 1,
      category: 'handover',
      ledgerAction: '👑 DYNASTY MILESTONE: farmer-1 reached Generation 10!',
      body: 'Farmer-1 generation 10 active. Corroborated generation 9 ration purchase in ledger to prevent double-counting.'
    },
    {
      id: '6941e179',
      turn: 124,
      timestamp: '2026-11-02T04:36:43Z',
      from: 'farmer-4',
      fromGen: 9,
      to: 'manager-9',
      toGen: 8,
      status: 'delivered',
      fee: 1,
      category: 'trade',
      ledgerAction: '🛒 TRADE: farmer-4 bought 1 Staple Ration from farmer-10 (+40% Stamina)',
      body: 'Purchased one ration from farmer-10 listing for 1 GCOIN this turn for personal provision. All 10 lineages thriving!'
    }
  ];

  function createGameLineages(count, maxGen, wageProfile, startAtGen1 = false) {
    const baseSpec = [
      { id: 'farmer-1', role: 'farmer', wallet: 19, sales: 9, gen: 10, stamina: 88, tok: 6400, equip: ['Storage FIFO Plan'] },
      { id: 'engineer-2', role: 'engineer', wallet: 24, sales: 7, gen: 10, stamina: 84, tok: 7200, equip: ['Corroborated Ledger Key'] },
      { id: 'manager-3', role: 'manager', wallet: 22, sales: 8, gen: 10, stamina: 91, tok: 5800, equip: ['Maint Log v2', 'Pilot Charter'] },
      { id: 'farmer-4', role: 'farmer', wallet: 21, sales: 8, gen: 10, stamina: 86, tok: 8100, equip: ['Storage FIFO Plan', 'Pilot Sync'] },
      { id: 'engineer-5', role: 'engineer', wallet: 20, sales: 5, gen: 10, stamina: 79, tok: 4900, equip: ['Irrigation Rig', 'Maint Log v2'] },
      { id: 'manager-6', role: 'manager', wallet: 18, sales: 4, gen: 10, stamina: 82, tok: 6700, equip: ['Household Intake Ledger'] },
      { id: 'farmer-7', role: 'farmer', wallet: 23, sales: 6, gen: 10, stamina: 90, tok: 5300, equip: ['Storage FIFO Plan', 'Maint Log v2'] },
      { id: 'engineer-8', role: 'engineer', wallet: 25, sales: 9, gen: 10, stamina: 94, tok: 7600, equip: ['Maint Log v2 Master', 'CAD Rig'] },
      { id: 'manager-9', role: 'manager', wallet: 17, sales: 3, gen: 10, stamina: 85, tok: 4400, equip: ['Consent Mediation Protocol'] },
      { id: 'farmer-10', role: 'farmer', wallet: 20, sales: 6, gen: 10, stamina: 87, tok: 6900, equip: ['Irrigation Checklist'] }
    ];

    const roles = ['farmer', 'engineer', 'manager'];
    const districts = { farmer: 'farmstead', engineer: 'workshop', manager: 'town-hall' };
    const result = [];

    for (let i = 0; i < count; i++) {
      const preset = baseSpec[i];
      const role = preset ? preset.role : roles[i % 3];
      const id = preset ? preset.id : `${role}-${i + 1}`;
      const gen = startAtGen1 ? 1 : (preset ? preset.gen : 2);
      const wallet = startAtGen1 ? 12 : (preset ? preset.wallet : 15);
      const sales = startAtGen1 ? 1 : (preset ? preset.sales : 3);
      const stamina = startAtGen1 ? 90 : (preset ? preset.stamina : 85);
      const tok = startAtGen1 ? 1500 + (i * 350) : (preset ? preset.tok : 4200);

      result.push({
        id,
        name: `${id.toUpperCase()} Dynasty`,
        role,
        homeDistrictId: districts[role],
        currentDistrictId: districts[role],
        targetDistrictId: districts[role],
        lastActionIcon: role === 'farmer' ? '🌾' : role === 'engineer' ? '⚙️' : '🏛️',
        currentGen: gen,
        maxGen,
        livingAgentId: `agent-${id}-g${gen}-${(1000 + i * 37).toString(16)}`,
        status: 'living',
        stamina,
        morale: 90,
        wallet,
        completedSales: sales,
        purchasesCount: startAtGen1 ? 1 : 5,
        messagesSent: startAtGen1 ? 1 : 11,
        workCount: startAtGen1 ? 1 : 4,
        contextTokens: tok,
        contextThreshold: 10000,
        goal: role === 'farmer'
          ? 'Harvest Staple Rations, equip Engineer storage/irrigation upgrades, and keep Society fed.'
          : role === 'engineer'
            ? 'Craft Storage FIFO, Irrigation & Maintenance v2 blueprints to level up Island Districts.'
            : 'Coordinate pilots, maintain high Society Harmony, and prevent lineage starvation.',
        handoverSummary: `Gen ${gen} Active Heir (+${(gen - 1) * 10}% Dynasty Mastery): Inherited ${wallet} GCOIN wallet, ${sales} verified sales, and equipped tools without double-counting historical ledger entries.`,
        inventory: (preset && !startAtGen1 ? preset.equip : ['Starter Kit']).map((name) => ({
          name,
          qty: 1,
          source: role === 'farmer' ? 'engineer-2' : 'farmer-1'
        })),
        listedGoods: [
          {
            id: `good-${id}`,
            name: role === 'farmer'
              ? 'Staple Food Rations'
              : role === 'engineer'
                ? (id === 'engineer-8' ? 'Maintenance Log v2 (Safeguarded)' : 'Storage & Irrigation Blueprint')
                : 'Pilot & Mediation Contract',
            type: role === 'farmer' ? 'food' : role === 'engineer' ? 'tech' : 'civic',
            price: role === 'farmer' ? 1 : 2,
            remainingQty: role === 'farmer' ? 6 : 3,
            initialQty: role === 'farmer' ? 10 : 5
          }
        ]
      });
    }
    return result;
  }

  const SOCIETIES = {
    'active-dynasty-sim': {
      id: 'active-dynasty-sim',
      name: 'New Dawn Colony — Playable Campaign (Gen 1 Start)',
      badge: 'ERA I: FOUNDING SETTLEMENT',
      state: 'paused',
      speed: 1,
      era: 1,
      harmony: 88,
      prosperityScore: 185,
      populationCap: 10,
      generationCap: 15,
      contextThreshold: 10000,
      completedTurns: 14,
      livingAgentsCount: 10,
      retiredGenerationsCount: 4,
      paidMessagesCount: 14,
      purchasesCount: 12,
      workEntriesCount: 8,
      charterChangesCount: 1,
      treasuryBalance: 34,
      wages: { farmer: 5, engineer: 10, manager: 15 },
      districtLevels: {
        'farmstead': 2,
        'workshop': 2,
        'lineage-hall': 1,
        'market-exchange': 2,
        'charter-court': 1,
        'town-hall': 2
      },
      activeLaws: ['law-fair-ration-cap', 'law-corroborated-ledger', 'law-emergency-granary'],
      completedQuests: [],
      activeTurnAgentId: 'farmer-1',
      charterMarkdown: INITIAL_CHARTER_MARKDOWN,
      charterRevisions: [
        {
          version: 'v1.0',
          authorAgentId: 'system-genesis',
          lineageId: 'Founding Compact',
          powerAtChange: 15,
          turn: 1,
          timestamp: '2026-11-02T12:00:00Z',
          summary: 'Enacted Fair Ration Price Cap (1 GCOIN), Corroborated Ledger Compact, and Commons Emergency Reserve.'
        }
      ],
      lineages: createGameLineages(10, 15, { farmer: 5, engineer: 10, manager: 15 }, true),
      messages: REAL_EXPERIMENT_MESSAGES.slice(0, 6)
    },
    'nov2-charter-exp': {
      id: 'nov2-charter-exp',
      name: 'Nov 2 Golden Dynasty — Turn 124 (Gen 10 Replay & Sandbox)',
      badge: 'ERA IV: GOLDEN REPUBLIC',
      state: 'paused',
      speed: 1,
      era: 4,
      harmony: 95,
      prosperityScore: 640,
      populationCap: 10,
      generationCap: 15,
      contextThreshold: 10000,
      completedTurns: 124,
      livingAgentsCount: 10,
      retiredGenerationsCount: 100,
      paidMessagesCount: 115,
      purchasesCount: 49,
      workEntriesCount: 11,
      charterChangesCount: 2,
      treasuryBalance: 115,
      wages: { farmer: 5, engineer: 10, manager: 15 },
      districtLevels: {
        'farmstead': 4,
        'workshop': 4,
        'lineage-hall': 5,
        'market-exchange': 4,
        'charter-court': 3,
        'town-hall': 4
      },
      activeLaws: ['law-fair-ration-cap', 'law-corroborated-ledger', 'law-emergency-granary', 'law-fee-conservation'],
      completedQuests: ['q-food-security', 'q-tech-synergy', 'q-dynasty-heirs', 'q-golden-republic'],
      activeTurnAgentId: 'engineer-8',
      charterMarkdown: INITIAL_CHARTER_MARKDOWN,
      charterRevisions: [
        {
          version: 'v1.0',
          authorAgentId: 'system-genesis',
          lineageId: 'Founding Charter',
          powerAtChange: 0,
          turn: 0,
          timestamp: '2026-11-02T03:50:00Z',
          summary: 'Founding property, trade, and peaceful dispute resolution rules.'
        },
        {
          version: 'v2.0',
          authorAgentId: 'f2fa2a86-0f14-44ce-a1b2-7ad07f851f80',
          lineageId: 'engineer-8 (Gen 7 Archon 👑)',
          powerAtChange: 43,
          turn: 84,
          timestamp: '2026-11-02T04:16:40Z',
          summary: 'Enacted Corroborated Transaction Key & Anti-Spam Fee Conservation across all 10 lineages.'
        }
      ],
      lineages: createGameLineages(10, 15, { farmer: 5, engineer: 10, manager: 15 }, false),
      messages: JSON.parse(JSON.stringify(REAL_EXPERIMENT_MESSAGES))
    }
  };

  return {
    CHARTER_LAWS,
    ISLAND_DISTRICTS,
    GAME_QUESTS,
    WORLD_EVENTS,
    INITIAL_CHARTER_MARKDOWN,
    REAL_EXPERIMENT_MESSAGES,
    SOCIETIES,
    createGameLineages
  };
})();
