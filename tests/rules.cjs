const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const rules=require('../exercises.js');
const fixtures=JSON.parse(execFileSync(process.env.PHP_BINARY||'php',['-n',__dirname+'/rules.php'],{maxBuffer:8*1024*1024}));
let count=0;
for(const {settings,pool} of fixtures){
 const local=rules.pool(settings);
 assert.deepEqual(local.map(e=>[e.operation,e.a,e.b,e.type]),pool.map(e=>[e.operation,e.a,e.b,e.type]));
 for(const e of local){
  const expected=e.type==='direct'?[e.result]:[e.decomposition1,e.decomposition2,e.result];
  assert(rules.checks(e,expected).every(Boolean));
  assert(!rules.checks(e,expected.map(String)).every(Boolean));
  assert(!rules.checks(e,[]).every(Boolean));
  if(e.type==='direct') {assert.equal(e.choices.length,3);assert.equal(new Set(e.choices).size,3);assert.equal(e.choices.filter(n=>n===e.result).length,1);}
  count++;
 }
}
const positions=new Set();for(let i=0;i<100;i++)positions.add(rules.decorate({operation:'addition',a:1,b:1}).choices.indexOf(2));assert.equal(positions.size,3);
assert.equal(rules.decorate({operation:'subtraction',a:14,b:4}).type,'direct');
assert.equal(rules.decorate({operation:'subtraction',a:14,b:5}).type,'decomposition');
assert.equal(rules.decorate({operation:'subtraction',a:20,b:11}).type,'decomposition');
console.log(`PASS: ${count} JS/PHP exercise contracts, unique choices, validation and first-attempt statistics`);
