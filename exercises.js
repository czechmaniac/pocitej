'use strict';
// Shared rules for worksheets and battles. PHP mirrors this contract.
const ExerciseRules = (() => {
  const ranges = [10,20,50,100,1000,0];
  const needsDecomposition = e => e.operation === 'subtraction' && e.a > 10 && e.a <= 20 && e.a - e.b < 10;
  const sign = operation => ({addition:'+',subtraction:'−',multiplication:'×',division:'÷'})[operation];
  function shuffle(values) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }
  function decorate(e) {
    const result = e.operation === 'addition' ? e.a + e.b : e.operation === 'multiplication' ? e.a * e.b : e.operation === 'division' ? e.a / e.b : e.a - e.b;
    const item = {...e, result, type: e.type !== 'direct' && needsDecomposition(e) ? 'decomposition' : 'direct'};
    if (item.type === 'decomposition') Object.assign(item, {decomposition1:e.a - 10, decomposition2:e.b - (e.a - 10)});
    else if (!item.choices) {
      const wrong = [];
      for (let d = 1; wrong.length < 2; d++) for (const n of [result - d, result + d]) if (n >= 0 && wrong.length < 2) wrong.push(n);
      item.choices = shuffle([result, ...wrong]);
    }
    return item;
  }
  function pool(p) {
    const items = [], range = ranges.includes(p.range) ? p.range : 20;
    const add = (a,b) => items.push(decorate({operation:p.operation,a,b,...(p.mode==='battle'?{type:'direct'}:{})}));
    if (range > 0 && range <= 20) {
      for (let a=1; a<=range; a++) for (let b=1; b<=range; b++) {
        const e=decorate({operation:p.operation,a,b});
        if (Number.isInteger(e.result) && e.result>=0 && e.result<=range) add(a,b);
      }
      return items;
    }
    // Sample a bounded pool: even the unlimited setting never enumerates all pairs.
    const random = max => 1 + Math.floor(Math.random()*max), seen = new Set();
    for (let attempt=0; items.length<240 && attempt<6000; attempt++) {
      const limit=range || 10**random(6);
      let a,b;
      if (p.operation==='addition') { a=random(limit-1);b=random(limit-a); }
      else if (p.operation==='subtraction') { a=random(limit);b=random(a); }
      else {
        const factor=random(Math.floor(Math.sqrt(limit))), other=random(Math.floor(limit/factor));
        if (p.operation==='division') { a=factor*other;b=Math.random()<0.5?factor:other; }
        else { a=factor;b=other;if(Math.random()<0.5)[a,b]=[b,a]; }
      }
      const key=a+':'+b;
      if (!seen.has(key)) { seen.add(key);add(a,b); }
    }
    return items;
  }
  function checks(e, values) {
    return (decorate(e).type === 'decomposition' ? [e.a-10,e.b-(e.a-10),e.a-e.b] : [decorate(e).result]).map((n,i) => Number.isInteger(values[i]) && values[i] === n);
  }
  return {ranges, sign, needsDecomposition, decorate, pool, shuffle, checks};
})();
if (typeof module !== 'undefined') module.exports = ExerciseRules;
