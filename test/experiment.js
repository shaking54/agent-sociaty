// End-to-end rule experiment against the actual HTTP service and persistent store.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const vm = require('node:vm');
const port=19000+Math.floor(Math.random()*1000), base=`http://127.0.0.1:${port}`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'society-test-'));
let child;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),SOCIETY_DATA_FILE:path.join(dir,'world.json')},stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await sleep(25)}throw Error('server failed to start');}
async function stop(){if(!child)return;const p=new Promise(r=>child.once('exit',r));child.kill();await p;child=null;}
async function get(){const r=await fetch(base+'/api/world');assert.equal(r.status,200);return r.json();}
async function post(revision,action){return fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,action})});}
(async()=>{try{
 await start();let world=await get();const initialTurn=world.snapshot.society.completedTurns, initialRetired=world.snapshot.society.retiredGenerationsCount;
 for(let i=0;i<100;i++){const r=await post(world.revision,{type:'tick'});assert.equal(r.status,200);world=await r.json();}
 const s=world.snapshot.society;
 assert.equal(s.completedTurns,initialTurn+100);assert.ok(s.retiredGenerationsCount>initialRetired);assert.ok(world.history.length>=100);
 assert.ok(s.lineages.every(l=>Number.isFinite(l.wallet)&&l.wallet>=0&&l.stamina>=0&&l.stamina<=100));
 const before=world.revision;const stale=await post(before-1,{type:'tick'});assert.equal(stale.status,409);assert.equal((await get()).revision,before);
 const invalid=await post(before,{type:'build',building:'invalid'});assert.equal(invalid.status,400);assert.equal((await get()).revision,before);
 const forbidden=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://evil.example'},body:JSON.stringify({revision:before,action:{type:'tick'}})});assert.equal(forbidden.status,403);
 const result={turns:100,initialTurn,finalTurn:s.completedTurns,retirements:s.retiredGenerationsCount-initialRetired,treasury:s.treasuryBalance,totalWallet:s.lineages.reduce((n,l)=>n+l.wallet,0),buildings:world.snapshot.buildings.length,harmony:s.harmony,historyEntries:world.history.length,revision:world.revision};
 await stop();await start();const restored=await get();assert.deepEqual(restored,world);
 const player=restored.snapshot.society.lineages.find(l=>l.id===restored.snapshot.playerAgentId);const oldWallet=player.wallet;
 const work=await post(restored.revision,{type:'interact',kind:'harvest'});assert.equal(work.status,200);const worked=await work.json();assert.ok(worked.snapshot.society.lineages.find(l=>l.id===player.id).wallet>oldWallet);
 // Exercise the actual UI controller's keyboard-to-backend round trip with a stub scene/DOM.
 const elements=new Map(), handlers={};
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',style:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},replaceChildren(){},appendChild(){}});return elements.get(id);};
 class Scene {constructor(){this.entities={};this.placedBuildings=[];}setSociety(s){s.lineages.forEach(l=>this.entities[l.id]={x:0,y:0});}setPlayerAgent(id){this.id=id;}getNearestHotspot(){return null;}triggerPlayerActionAnim(){}}
 const win={IsometricSocietyScene:Scene,addEventListener:(name,fn)=>handlers[name]=fn};
 const ctx=vm.createContext({window:win,document:{getElementById:el,createElement:()=>el(Symbol()),querySelectorAll:()=>[]},fetch:(p,o)=>fetch(base+p,o),setInterval:()=>1,clearInterval(){},console});
 vm.runInContext(fs.readFileSync('public/experiment-data.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('public/app.js','utf8'),ctx);
 for(let i=0;i<40&&el('saveStatus').textContent!=='Saved';i++)await sleep(25);
 assert.equal(el('saveStatus').textContent,'Saved');
 handlers.keydown({code:'Space',key:' ',repeat:false,preventDefault(){}});
 for(let i=0;i<40&&(await get()).revision===worked.revision;i++)await sleep(25);
 assert.equal((await get()).revision,worked.revision+1);
 console.log(JSON.stringify({...result,restart:'passed',playerAction:'passed',uiCommand:'passed',staleWrite:'rejected',invalidAction:'rejected',crossOrigin:'rejected'},null,2));
 }catch(e){console.error(e);process.exitCode=1}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})();
