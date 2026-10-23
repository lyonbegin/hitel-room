const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('src/portal/flowCatalog.ts','utf8');
const js = ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const mod={exports:{}};
new Function('exports','module',js)(mod.exports,mod);
const {order,scenarios,getScenario,supportedUi}=mod.exports;
assert.equal(order.length,4);
assert.equal(scenarios.length,16);
assert.equal(new Set(scenarios.map(s=>s.id)).size,16);
assert.deepEqual(scenarios.map(s=>s.id), Array.from({length:16},(_,i)=>i+1));
for(const [i,from] of order.entries()){
  for(const [j,to] of order.entries()){
    const s=getScenario(from,to);
    assert.equal(s.from,from);
    assert.equal(s.to,to);
    assert.equal(s.id,i*4+j+1);
    for(const key of ['title','callerAction','receiverAction','mediaRoute','prerequisite','ai']){
      assert.ok(s[key].length>4, 'missing '+key+' '+s.id);
    }
  }
}
assert.equal(supportedUi('P'),'HITEL 화면 없음 (일반전화만 사용)');
assert.match(getScenario('P','P').ai,/AI 없음/);
assert.match(getScenario('P_PLUS','P_PLUS').ai,/각각|각자/);
assert.match(getScenario('W','P').mediaRoute,/게이트웨이/);
assert.match(getScenario('N','W').mediaRoute,/WebRTC/);
console.log('PASS: 16/16 unique direction-specific frontend flow specifications');
