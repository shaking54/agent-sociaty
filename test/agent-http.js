'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'society-agent-test-'));
const port=20000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
const config=path.join(dir,'config.json');fs.writeFileSync(config,JSON.stringify({agents:{defaults:{}}}));
const fake=path.join(dir,'fake-openclaw');fs.writeFileSync(fake,`#!/usr/bin/env node\nconsole.log(JSON.stringify({ok:true,sessionId:'stub-session',toolSummary:{calls:0},final:JSON.stringify({action:'work',memory:'remember',message:{to:'engineer-2',text:'hello'}})}));\n`,{mode:0o700});
let server;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),SOCIETY_DATA_FILE:path.join(dir,'world.json'),SOCIETY_AGENT_MODE:'openclaw'},stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await sleep(25)}throw Error('server failed');}
async function stop(){if(!server)return;const done=new Promise(r=>server.once('exit',r));server.kill();await done;server=null}
(async()=>{try{await start();const before=await (await fetch(base+'/api/world')).json();const tick=await fetch(base+'/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision:before.revision,action:{type:'tick'}})});assert.equal(tick.status,400);
execFileSync(process.execPath,['scripts/openclaw-experiment.js'],{env:{...process.env,SOCIETY_URL:base,SOCIETY_TURNS:'1',OPENCLAW_BIN:fake,OPENCLAW_CONFIG_PATH:config},stdio:'pipe'});
const after=await (await fetch(base+'/api/world')).json();assert.equal(after.revision,before.revision+1);assert.equal(after.agentMessages[0].text,'hello');assert.ok(Object.values(after.agentMemories).includes('remember'));
await stop();await start();assert.deepEqual(await (await fetch(base+'/api/world')).json(),after);console.log('Mocked runner HTTP and restart persistence passed');
}catch(e){console.error(e);process.exitCode=1}finally{await stop();fs.rmSync(dir,{recursive:true,force:true})}})();
