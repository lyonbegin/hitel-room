import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pageMap,capability,materialsFor,recordForSession,saveBooking,initialState,scenarioPages} from '../src/model.js';
const scenarios=JSON.parse(fs.readFileSync(new URL('../src/scenarios.json',import.meta.url)));
test('Every legacy screen has a handled destination and preserves its own ID',()=>{
 assert.equal(pageMap.length,191);assert.equal(new Set(pageMap.map(x=>x.id)).size,191);
 const app=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 const handled=[...app.matchAll(/case '([^']+)'/g)].map(x=>x[1]);
 assert.deepEqual(pageMap.filter(x=>!handled.includes(x.view)),[]);
});
test('All 80 scenarios map to supported shared views and the 16 routes have 5 cases each',()=>{
 assert.equal(scenarios.rows.length,80);assert.equal(new Set(scenarios.rows.map(r=>r.id)).size,80);
 for(let i=1;i<=16;i++){const id='SC-'+String(i).padStart(2,'0');assert.equal(scenarios.rows.filter(r=>r.id.startsWith(id+'-')).length,5);}
 for(const row of scenarios.rows)assert.ok(scenarioPages(row).length>=2);
});
test('P to P never produces a HITEL session record and no phone route advertises video',()=>{
 assert.equal(recordForSession({from:0,to:0},{id:'a'}),null);
 for(let a=0;a<4;a++)for(let b=0;b<4;b++){const c=capability(a,b);if(a<2||b<2)assert.equal(c.canVideo,false);}
 for(const [a,b] of [[0,1],[1,0],[1,1]]){const c=capability(a,b);assert.equal(c.sidecarOnly,true);assert.equal(c.canSharedAudio,false);}
});
test('Private materials are never exposed when the viewing role changes',()=>{
 const data=[{id:'private-a',owner:'個人',visibility:'개인'},{id:'private-b',owner:'담당자',visibility:'개인'},{id:'shared',owner:'담당자',visibility:'참여자'}];
 assert.deepEqual(materialsFor(data,'담당자').map(x=>x.id),['private-b','shared']);
 assert.deepEqual(materialsFor(data,'개인').map(x=>x.id),['shared']);
});
test('Booking creation and changes require time, preserve the old object and await confirmation',()=>{
 assert.throws(()=>saveBooking({date:'2026-11-05'}));
 const before={id:'b1',date:'2026-11-05',time:'10:00',status:'확정'};
 const after=saveBooking({date:'2026-11-06',time:'11:00'},before);
 assert.equal(after.status,'변경 확인 대기');assert.equal(before.date,'2026-11-05');assert.equal(after.id,'b1');
 assert.equal(saveBooking({date:'2026-11-05',time:'10:00'}).status,'확인 대기');
});
test('Persisted workspace is serializable and all activity targets resolve',()=>{
 const s=initialState();assert.equal(s.activities.length,28);assert.doesNotThrow(()=>JSON.stringify(s));
 for(const a of s.activities){assert.ok(s.entities.some(e=>e.id===a.entityId));assert.ok(a.participants?.length);}
});
