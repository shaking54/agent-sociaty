'use strict';
// Authoritative rule-based simulation. All state changes happen here on the server.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'public/experiment-data.js'),'utf8'),sandbox);
const DATA = sandbox.window.AGENT_SOCIETY_DATA;
const COSTS = {house:15,factory:25,shop:20,paddlefield:30};
const INITIAL_BUILDINGS = [
  {id:'b-house-1',type:'house',name:'Farmer Homestead',owner:'farmer-1',x:-160,y:-80,lv:1,ballPhase:0},
  {id:'b-factory-1',type:'factory',name:'Blueprint Foundry',owner:'engineer-8',x:160,y:-80,lv:2,ballPhase:1},
  {id:'b-shop-1',type:'shop',name:'Central Ration Shop',owner:'farmer-4',x:160,y:80,lv:1,ballPhase:2},
  {id:'b-paddle-1',type:'paddlefield',name:'Club Paddlefield #1',owner:'manager-3',x:-160,y:80,lv:2,ballPhase:0}
];
function createWorld() {
  const society = JSON.parse(JSON.stringify(DATA.SOCIETIES['active-dynasty-sim']));
  society.lineages.forEach(l=>{l.toolLevel=1;l.buildingsOwned=INITIAL_BUILDINGS.filter(b=>b.owner===l.id).length});
  return {revision:0,snapshot:{society,buildings:structuredClone(INITIAL_BUILDINGS),playerAgentId:'farmer-1'},history:[]};
}
function power(l) { return l.wallet + l.completedSales*2 + (l.currentGen-1)*2 + (l.buildingsOwned||0)*5; }
function applyAction(world, input) {
  const next = structuredClone(world), snap=next.snapshot, s=snap.society, buildings=snap.buildings;
  let a=s.lineages.find(l=>l.id===snap.playerAgentId); const messages=[];
  const log = m => messages.push(m);
  const handover = l => {
    if(l.currentGen>=l.maxGen) {log(`${l.id} has reached maximum generation.`);return;}
    if(l.contextTokens<l.contextThreshold) {log(`${l.id} needs ${l.contextThreshold-l.contextTokens} more context tokens before handover.`);return;}
    const old=l.currentGen++; l.contextTokens-=l.contextThreshold; l.stamina=100; s.retiredGenerationsCount++;
    log(`${l.id} generation ${old} retired; generation ${l.currentGen} inherited ${l.wallet}G and its assets.`);
  };
  const eat = l => {
    const seller=s.lineages.find(x=>x.id!==l.id && x.listedGoods.some(g=>g.type==='food'&&g.remainingQty>0));
    if(seller && l.wallet>=1){const food=seller.listedGoods.find(g=>g.type==='food'&&g.remainingQty>0);food.remainingQty--;l.wallet--;seller.wallet++;seller.completedSales++;l.stamina=Math.min(100,l.stamina+45);log(`${l.id} bought a ration from ${seller.id} for 1G; stamina ${l.stamina}%.`);}
    else if(s.treasuryBalance>=1 && s.activeLaws.includes('law-emergency-granary')) {s.treasuryBalance--;l.stamina=Math.min(100,l.stamina+35);log(`${l.id} received an emergency ration; treasury paid 1G.`);}
    else log(`${l.id} could not obtain a ration.`);
  };
  const work = (l,kind) => {
    const mult=1+(l.toolLevel||1)*.5;
    const wage=Math.round((s.wages[l.role]+(l.currentGen-1))*mult);
    l.wallet+=wage;l.workCount=(l.workCount||0)+1;l.contextTokens+=1100;l.stamina=Math.max(0,l.stamina-5);
    if(kind==='harvest') {let food=l.listedGoods.find(g=>g.type==='food');if(!food){food={id:`food-${l.id}`,name:'Staple Food Rations',type:'food',price:1,remainingQty:0,initialQty:0};l.listedGoods.push(food)};const qty=Math.round(4*mult);food.remainingQty+=qty;log(`${l.id} harvested ${qty} rations and earned ${wage}G.`);}
    else if(kind==='craft'){l.completedSales++;log(`${l.id} crafted a blueprint and earned ${wage}G.`);}
    else {s.harmony=Math.min(100,s.harmony+4);log(`${l.id} coordinated a rally, earned ${wage}G and raised harmony to ${s.harmony}%.`);}
    if(l.contextTokens>=l.contextThreshold && l.currentGen<l.maxGen) handover(l);
  };
  const build = (l,type) => {
    const cost=COSTS[type];if(!cost) throw Error('Unknown building');
    if(l.wallet<cost){log(`${l.id} needs ${cost}G to build ${type}.`);return;}
    if(buildings.length>=14){log('The mainland has reached its building limit.');return;}
    l.wallet-=cost;l.buildingsOwned=(l.buildingsOwned||0)+1;l.contextTokens+=900;
    const plots=[[-240,0],[240,0],[0,-120],[0,120],[-120,-140],[120,-140],[-120,140],[120,140],[-320,-40],[320,40]];
    const p=plots.find(([x,y])=>!buildings.some(b=>Math.hypot(b.x-x,b.y-y)<52)) || [0,0];
    buildings.push({id:`b-${next.revision+1}-${buildings.length}`,type,name:type[0].toUpperCase()+type.slice(1),owner:l.id,x:p[0],y:p[1],lv:1,ballPhase:0});log(`${l.id} built a ${type} for ${cost}G.`);
    if(l.contextTokens>=l.contextThreshold&&l.currentGen<l.maxGen)handover(l);
  };
  if(!input||typeof input.type!=='string') throw Error('Missing action type');
  switch(input.type){
    case 'tick': {
      s.completedTurns++;s.treasuryBalance+=1+Math.floor(buildings.filter(b=>b.type==='factory').length*.5);
      const agents=s.lineages.filter(l=>l.id!==a.id), actor=agents[s.completedTurns%agents.length];
      actor.stamina=Math.max(0,actor.stamina-5);
      if(actor.stamina<55) eat(actor);
      else if(actor.contextTokens>=actor.contextThreshold&&actor.currentGen<actor.maxGen)handover(actor);
      else if(actor.wallet>=32&&buildings.length<14&&s.completedTurns%4===0)build(actor,actor.role==='farmer'?'house':actor.role==='engineer'?'factory':'paddlefield');
      else work(actor,actor.role==='farmer'?'harvest':actor.role==='engineer'?'craft':'rally');
      break;
    }
    case 'switch': {const found=s.lineages.find(l=>l.id===input.agentId);if(!found)throw Error('Unknown agent');snap.playerAgentId=found.id;log(`Now controlling ${found.id}.`);break;}
    case 'build': build(a,input.building);break;
    case 'tool': if((a.toolLevel||1)>=5)log(`${a.id} already has a level 5 tool.`);else if(a.wallet<15)log(`${a.id} needs 15G to upgrade a tool.`);else{a.wallet-=15;a.toolLevel++;log(`${a.id} upgraded their tool to level ${a.toolLevel} for 15G.`);}break;
    case 'interact': {
      const kind=input.kind || (a.role==='farmer'?'harvest':a.role==='engineer'?'craft':'rally');
      if(['harvest','craft','rally'].includes(kind))work(a,kind);
      else if(kind==='trade')eat(a);
      else if(kind==='house'){a.stamina=100;log(`${a.id} rested and restored stamina.`);}
      else if(kind==='handover')handover(a);
      else if(kind==='upgrade'){if(s.treasuryBalance<15)log('Treasury needs 15G for building upgrades.');else{s.treasuryBalance-=15;buildings.forEach(b=>b.lv=Math.min(5,(b.lv||1)+1));log('Treasury spent 15G upgrading buildings.');}}
      else if(kind==='law'){
        const archon=[...s.lineages].sort((x,y)=>power(y)-power(x)||y.completedSales-x.completedSales)[0];
        if(a.id!==archon.id)log(`Only Archon ${archon.id} can change the charter.`);
        else {const law=s.activeLaws.includes('law-sha85-wages');s.wages=law?{farmer:5,engineer:10,manager:15}:{farmer:12,engineer:14,manager:10};s.activeLaws=s.activeLaws.filter(x=>x!=='law-sha85-wages');if(!law)s.activeLaws.push('law-sha85-wages');s.charterChangesCount++;log(`${a.id} ${law?'repealed':'enacted'} the wage reform.`);}
      } else throw Error('Unknown interaction');break;
    }
    default: throw Error('Unknown action');
  }
  next.revision++;
  next.history.push(...messages.map(message=>({turn:s.completedTurns,message,timestamp:new Date().toISOString()})));
  next.history=next.history.slice(-500);
  return next;
}
// Model output is data, never executable code. Only these game operations can
// be requested by an agent, and the ordinary authoritative rules still apply.
function applyAgentTurn(world, decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) throw Error('Invalid decision');
  const actor = world.snapshot.society.lineages.find(l => l.id === decision.actor);
  if (!actor || actor.id === world.snapshot.playerAgentId) throw Error('Invalid actor');
  const actions = {work:{type:'interact',kind:{farmer:'harvest',engineer:'craft',manager:'rally'}[actor.role]}, eat:{type:'interact',kind:'trade'}, rest:{type:'interact',kind:'house'}, tool:{type:'tool'}};
  let action=actions[decision.action];
  if (decision.action === 'build' && ['house','factory','shop','paddlefield'].includes(decision.building)) action={type:'build',building:decision.building};
  if (!action) throw Error('Invalid agent action');
  if (typeof decision.memory !== 'string' || decision.memory.length>600) throw Error('Invalid agent memory');
  let msg=null;
  if (decision.message != null) {
    if (!decision.message || typeof decision.message !== 'object' || typeof decision.message.to !== 'string' || typeof decision.message.text !== 'string' || !decision.message.text.trim() || decision.message.text.length>250 || decision.message.to===actor.id || !world.snapshot.society.lineages.some(l=>l.id===decision.message.to)) throw Error('Invalid message');
    msg={from:actor.id,to:decision.message.to,text:decision.message.text.trim()};
  }
  const temp=structuredClone(world), original=temp.snapshot.playerAgentId;
  temp.snapshot.playerAgentId=actor.id;
  temp.snapshot.society.completedTurns++;
  temp.snapshot.society.treasuryBalance+=1+Math.floor(temp.snapshot.buildings.filter(b=>b.type==='factory').length*.5);
  const next=applyAction(temp,action); next.snapshot.playerAgentId=original;
  next.agentMemories=next.agentMemories||{}; next.agentMemories[actor.id]=decision.memory;
  next.agentMessages=(next.agentMessages||[]).filter(m=>m.to!==actor.id);
  if(msg) { next.agentMessages.push(msg); next.history.push({turn:next.snapshot.society.completedTurns,message:`${msg.from} → ${msg.to}: ${msg.text}`,timestamp:new Date().toISOString()}); }
  next.agentMessages=next.agentMessages.slice(-500); next.history=next.history.slice(-500);
  return next;
}
module.exports={createWorld,applyAction,applyAgentTurn};
