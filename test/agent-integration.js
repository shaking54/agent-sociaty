'use strict';
const assert=require('node:assert/strict');
const {createWorld,applyAgentTurn}=require('../engine');
let w=createWorld();
const [a,b]=w.snapshot.society.lineages.filter(x=>x.id!==w.snapshot.playerAgentId);
const a0=a.wallet, b0=b.wallet, player=w.snapshot.playerAgentId;
w=applyAgentTurn(w,{actor:a.id,action:'work',memory:'I met my neighbor.',message:{to:b.id,text:'Hello neighbor'}});
assert.equal(w.snapshot.playerAgentId,player);
assert.equal(w.snapshot.society.lineages.find(x=>x.id===a.id).wallet>a0,true);
assert.equal(w.snapshot.society.lineages.find(x=>x.id===b.id).wallet,b0);
assert.equal(w.snapshot.society.completedTurns,createWorld().snapshot.society.completedTurns+1);
assert.deepEqual(w.agentMessages,[{from:a.id,to:b.id,text:'Hello neighbor'}]);
assert.equal(w.agentMemories[a.id],'I met my neighbor.');
assert.ok(w.history.some(e=>e.message.includes('Hello neighbor')));
const old=w;w=applyAgentTurn(w,{actor:b.id,action:'rest',memory:'I received the greeting.',message:null});
assert.equal(w.agentMessages.length,0);assert.equal(old.agentMessages.length,1);
for(const decision of [
 {actor:a.id,action:'exec',memory:''},
 {actor:player,action:'work',memory:''},
 {actor:a.id,action:'build',building:'castle',memory:''},
 {actor:a.id,action:'work',memory:'',message:{to:'outside',text:'hello'}},
 {actor:a.id,action:'work',memory:'x'.repeat(601)}
]) assert.throws(()=>applyAgentTurn(w,decision));
console.log('Agent action, messaging, isolation, and validation tests passed');
