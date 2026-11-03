// Exercise the actual browser game controller against the real local HTTP API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const port = 19000 + Math.floor(Math.random()*1000);
const base = `http://127.0.0.1:${port}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'society-test-'));
const child = spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),SOCIETY_DATA_FILE:path.join(dir,'world.json')},stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function ready() { for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{} await sleep(25)} throw Error('server failed to start'); }
function browser() {
  const elements = new Map(); const timers=[];
  const element = id => { if(!elements.has(id)) elements.set(id,{id,textContent:'',style:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},replaceChildren(){this.children=[]},appendChild(x){(this.children ||= []).push(x)},closest(){return false}}); return elements.get(id); };
  class Scene {
    constructor(){this.entities={};this.placedBuildings=[{type:'house',owner:'farmer-1',x:0,y:0},{type:'factory',owner:'engineer-8',x:1,y:0},{type:'shop',owner:'farmer-4',x:2,y:0},{type:'paddlefield',owner:'manager-3',x:3,y:0}];}
    setSociety(s){this.soc=s;s.lineages.forEach(l=>this.entities[l.id]={x:0,y:0})} setPlayerAgent(id){this.player=id} getPlayerEntity(){return this.entities[this.player]} getNearestHotspot(){return null}
    buildStructureOnLand(type,owner){const b={type,owner,name:type,x:0,y:0,lv:1};this.placedBuildings.push(b);return b}
    spawnSpeech(){} spawnFloatingPopup(){} spawnBurst(){} spawnAscensionBeam(){} triggerPlayerActionAnim(){}
  }
  const window = {IsometricSocietyScene:Scene,addEventListener(){}};
  const context = vm.createContext({window,document:{getElementById:element,createElement:()=>element(Symbol()),querySelectorAll:()=>[]},fetch:(p,o)=>fetch(base+p,o),setTimeout,clearTimeout,setInterval:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearInterval(){},console,Math});
  vm.runInContext(fs.readFileSync('public/experiment-data.js','utf8'),context);
  vm.runInContext(fs.readFileSync('public/app.js','utf8'),context);
  return {window,timers,elements};
}
(async()=>{try{
  await ready();
  const game=browser(); await sleep(100);
  const step=game.timers.find(t=>t.ms===2000); assert.ok(step,'autonomous loop started');
  const society=game.window.AGENT_SOCIETY_DATA.SOCIETIES['active-dynasty-sim'];
  const initialTurn=society.completedTurns, initialGenerations=society.retiredGenerationsCount;
  const oldRandom=Math.random; Math.random=()=>0.75;
  try { for(let i=0;i<100;i++) step.fn(); } finally {Math.random=oldRandom;}
  await sleep(1200);
  const saved=await (await fetch(base+'/api/world')).json();
  assert.equal(saved.snapshot.society.completedTurns,initialTurn+100);
  assert.equal(saved.history.filter(e=>e.message.includes('autonomous turn')).length,100);
  assert.ok(saved.snapshot.society.lineages.every(l=>Number.isFinite(l.wallet)&&l.wallet>=0&&l.stamina>=0&&l.stamina<=100));
  assert.ok(saved.snapshot.society.retiredGenerationsCount>initialGenerations,'handover occurred');
  const conflict=await fetch(base+'/api/world',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:0,snapshot:saved.snapshot,events:[]})}); assert.equal(conflict.status,409);
  const reloaded=browser(); await sleep(100);
  assert.equal(reloaded.window.AGENT_SOCIETY_DATA.SOCIETIES['active-dynasty-sim'].completedTurns,initialTurn+100);
  const total=saved.snapshot.society.lineages.reduce((sum,l)=>sum+l.wallet,0);
  console.log(JSON.stringify({turns:100,initialTurn,finalTurn:saved.snapshot.society.completedTurns,retirements:saved.snapshot.society.retiredGenerationsCount-initialGenerations,treasury:saved.snapshot.society.treasuryBalance,totalWallet:total,buildings:saved.snapshot.buildings.length,harmony:saved.snapshot.society.harmony,historyEntries:saved.history.length,revision:saved.revision,reload:'passed',staleWrite:'rejected'},null,2));
} catch(e){console.error(e);process.exitCode=1} finally {child.kill();fs.rmSync(dir,{recursive:true,force:true});}})();
