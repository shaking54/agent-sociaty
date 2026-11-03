// Agent Society client: rendering and controls only; the server owns all rules and state.
(function () {
  const DATA = window.AGENT_SOCIETY_DATA;
  let soc = DATA.SOCIETIES['active-dynasty-sim'];
  let playerAgentId = 'farmer-1', revision = 0, gameSpeed = 1, keysPressed = {};
  let ready = false, stopped = false, busy = false, queue = [], aiInterval, agentMode = false;
  const TOOL_META = {
    farmer: {name:'GOLDEN SCYTHE',short:'SCYTHE+',icon:'./assets/sprites/pixel-tool-scythe.png?v=sharp2'},
    engineer: {name:'POWER WRENCH',short:'WRENCH+',icon:'./assets/sprites/pixel-tool-wrench.png?v=sharp2'},
    manager: {name:'PRO PADDLE',short:'PADDLE+',icon:'./assets/sprites/pixel-tool-racket.png?v=sharp2'}
  };
  const status = document.getElementById('saveStatus');
  const scene = new window.IsometricSocietyScene(document.getElementById('gameCanvas'), {
    getKeys: () => keysPressed,
    onSelectAgent: id => send({type:'switch',agentId:id})
  });
  function computePower(l) { return l.wallet + l.completedSales*2 + (l.currentGen-1)*2 + (l.buildingsOwned||0)*5; }
  function getToolMultiplier(l) { return 1+(l.toolLevel||1)*.5; }
  function getSortedByPower() { return [...soc.lineages].sort((a,b)=>computePower(b)-computePower(a)||b.completedSales-a.completedSales); }
  function getPlayerLineage() { return soc.lineages.find(l=>l.id===playerAgentId)||soc.lineages[0]; }
  function renderWorld(world) {
    revision=world.revision; soc=world.snapshot.society; playerAgentId=world.snapshot.playerAgentId;
    scene.placedBuildings=world.snapshot.buildings; scene.setSociety(soc); if(scene.playerAgentId!==playerAgentId) scene.setPlayerAgent(playerAgentId);
    const list=document.getElementById('historyList'); list.replaceChildren();
    world.history.slice(-100).reverse().forEach(event=>{const item=document.createElement('li');item.textContent=`Day ${event.turn} — ${event.message}`;list.appendChild(item);});
    const last=world.history[world.history.length-1];
    if(last){document.getElementById('dialogueText').textContent=last.message;document.getElementById('dialogueTag').textContent='WORLD EVENT';}
    updateHUD();
  }
  async function drain() {
    if(busy||!ready||stopped||!queue.length)return;
    busy=true;const action=queue.shift();status.textContent='Saving…';
    try {
      const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,action})});
      if(response.status===409){stopped=true;queue=[];clearInterval(aiInterval);status.textContent='Conflict — reload';return;}
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      renderWorld(await response.json()); status.textContent='Saved';
    } catch(error) {stopped=true;queue=[];clearInterval(aiInterval);status.textContent='Offline — reload';}
    finally {busy=false;if(!stopped)drain();}
  }
  function send(action){if(!ready||stopped)return;if(action.type==='tick'&&(busy||queue.length))return;queue.push(action);drain();}
  function interact() {const hotspot=scene.getNearestHotspot();scene.triggerPlayerActionAnim();send({type:'interact',kind:hotspot?hotspot.actionType:null});}
  function cycleNextAgent(){const i=soc.lineages.findIndex(l=>l.id===playerAgentId);send({type:'switch',agentId:soc.lineages[(i+1)%soc.lineages.length].id});}
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


  setInterval(()=>{const spot=scene.getNearestHotspot(),bubble=document.getElementById('worldPromptBubble');if(spot){bubble.classList.remove('hidden');document.getElementById('worldPromptText').textContent=`${spot.title}: ${spot.prompt}`;}else bubble.classList.add('hidden');},120);
  function setSpeed(speed){gameSpeed=speed;clearInterval(aiInterval);if(speed>0&&ready&&!stopped)aiInterval=setInterval(()=>send({type:'tick'}),Math.round(2000/speed));document.getElementById('btnSpeed').textContent=speed===0?'⏸ PAUSE':`▶ ${speed}×`;}
  window.addEventListener('keydown',e=>{keysPressed[e.code]=true;if(e.repeat)return;if(e.code==='Space'){e.preventDefault();interact();}else if(['1','2','3','4'].includes(e.key))send({type:'build',building:{'1':'house','2':'factory','3':'shop','4':'paddlefield'}[e.key]});else if(e.key==='5')send({type:'tool'});else if(e.code==='KeyE')send({type:'interact',kind:'trade'});else if(e.code==='Tab'){e.preventDefault();cycleNextAgent();}});
  window.addEventListener('keyup',e=>{keysPressed[e.code]=false;});
  document.querySelectorAll('.hotbar-slot').forEach(slot=>slot.addEventListener('click',()=>{const kind=slot.dataset.slot;send(kind==='tool'?{type:'tool'}:{type:'build',building:kind});}));
  document.getElementById('equippedToolBox').addEventListener('click',e=>{e.stopPropagation();send({type:'tool'});});
  document.getElementById('playerCardBtn').addEventListener('click',()=>cycleNextAgent());
  document.getElementById('worldPromptBubble').addEventListener('click',interact);
  document.getElementById('btnWeather').addEventListener('click',e=>{const mode=scene.cycleWeatherMode();e.currentTarget.textContent={sunny:'☀️',sunset:'🌅',rain:'🌧️',night:'🌙'}[mode]||'☀️';});
  document.getElementById('btnPixelMode').addEventListener('click',e=>{const scale=scene.cyclePixelMode();e.currentTarget.textContent=scale===1?'✨ HD 1×':`🕹️ ${scale}×`;});
  document.getElementById('btnSpeed').addEventListener('click',()=>setSpeed(gameSpeed===1?2:gameSpeed===2?4:gameSpeed===4?0:1));
  Promise.all([fetch('/api/world'),fetch('/api/health')]).then(async ([r,h])=>{if(!r.ok||!h.ok)throw Error('World unavailable');agentMode=(await h.json()).mode==='openclaw';return r.json();}).then(world=>{renderWorld(world);ready=true;status.textContent='Saved';if(agentMode){document.getElementById('btnSpeed').textContent='🤖 AGENTS';document.getElementById('btnSpeed').disabled=true;setInterval(async()=>{if(busy||queue.length||stopped)return;try {const r=await fetch('/api/world');if(r.ok)renderWorld(await r.json());}catch{}},2000);}else setSpeed(1);}).catch(()=>{status.textContent='Offline — reload';});
})();
