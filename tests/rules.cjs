const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const rules=require('../exercises.js');
const fixtures=JSON.parse(execFileSync(process.env.PHP_BINARY||'php',['-n',__dirname+'/rules.php'],{maxBuffer:8*1024*1024}));
let count=0;
for(const {settings,pool} of fixtures){
 const local=rules.pool(settings);
 if(settings.range>0 && settings.range<=20)assert.deepEqual(local.map(e=>[e.operation,e.a,e.b,e.type]),pool.map(e=>[e.operation,e.a,e.b,e.type]));
 assert(local.length>=12 && local.length<=400);
 assert.equal(new Set(local.map(e=>e.a+':'+e.b)).size,local.length);
 for(const e of [...local,...pool.map(e=>rules.decorate(e))]){
  assert(Number.isSafeInteger(e.result));
  assert(e.a>0 && e.b>0 && e.result>=0);
  if(settings.range>0)assert(Math.max(e.a,e.b,e.result)<=settings.range);
  if(e.operation==='division')assert.equal(e.a%e.b,0);
  if(e.operation!=='subtraction')assert.equal(e.type,'direct');
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

assert.equal(rules.decorate({operation:'subtraction',a:1000,b:995}).type,'direct');
assert.equal(rules.decorate({operation:'division',a:1000,b:2}).result,500);
assert.equal(rules.sign('division'),'÷');

for(const result of [0,1,2,12,1000]){const ranks=new Set(),positions=new Set();for(let i=0;i<150;i++){const choices=rules.answerChoices(result);assert.equal(choices.length,3);assert.equal(new Set(choices).size,3);assert(choices.every(n=>n>=0&&Number.isInteger(n)));ranks.add([...choices].sort((a,b)=>a-b).indexOf(result));positions.add(choices.indexOf(result));}assert.equal(ranks.size,Math.min(3,result+1));assert.equal(positions.size,3);}
