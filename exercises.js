'use strict';
// Shared rules for worksheets and battles. PHP mirrors this contract.
const ExerciseRules = (() => {
  const needsDecomposition = e => e.operation === 'subtraction' && e.a > 10 && e.a - e.b < 10;
  function shuffle(values) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }
  function decorate(e) {
    const result = e.operation === 'addition' ? e.a + e.b : e.operation === 'multiplication' ? e.a * e.b : e.a - e.b;
    const item = {...e, result, type: needsDecomposition(e) ? 'decomposition' : 'direct'};
    if (item.type === 'decomposition') Object.assign(item, {decomposition1:e.a - 10, decomposition2:e.b - (e.a - 10)});
    else if (!item.choices) {
      const wrong = [];
      for (let d = 1; wrong.length < 2; d++) for (const n of [result - d, result + d]) if (n >= 0 && wrong.length < 2) wrong.push(n);
      item.choices = shuffle([result, ...wrong]);
    }
    return item;
  }
  function pool(p) {
    const items = [], multiplication = p.operation === 'multiplication';
    for (let a=1; a <= (multiplication ? 10 : p.range); a++) {
      for (let b=1; b <= (multiplication ? 10 : p.range); b++) {
        const e = decorate({operation:p.operation,a,b});
        if (e.result < 0 || e.result > (multiplication ? p.multiplicationLimit : p.range)) continue;
        items.push(e);
      }
    }
    return items;
  }
  function checks(e, values) {
    return (needsDecomposition(e) ? [e.a-10,e.b-(e.a-10),e.a-e.b] : [decorate(e).result]).map((n,i) => Number.isInteger(values[i]) && values[i] === n);
  }
  return {needsDecomposition, decorate, pool, shuffle, checks};
})();
if (typeof module !== 'undefined') module.exports = ExerciseRules;
