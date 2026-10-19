// npm install --no-save playwright; npx playwright install chromium
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const rules=require('../exercises.js');
const server=spawn(process.env.PHP_BINARY||'php',['-n','-S','127.0.0.1:8765','-t',require('node:path').resolve(__dirname,'..')],{stdio:'ignore'});
(async()=>{
 let browser;
 try {
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1200,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/googletagmanager.com/**',route=>route.abort());
  await page.goto('http://127.0.0.1:8765');
  await page.locator('#guest-start').click();
  async function set(op,range){await page.locator('[data-view="settings"]').click();await page.locator(`[data-operation="${op}"]`).click();if(op!=='multiplication')await page.locator(`[data-range="${range}"]`).click();await page.locator('#settings-back').click();}
  async function solve(){return page.evaluate(()=>{for(let i=0;i<state.exercises.length;i++){const e=state.exercises[i];if(e.type==='direct')document.querySelector(`[data-exercise="${i}"][value="${e.result}"]`).click();else [e.decomposition1,e.decomposition2,e.result].forEach((v,j)=>{document.querySelector(`[data-exercise="${i}"][data-part="${j}"]`).value=v;});}checkAnswers();return {completed:state.completed,stats:statistics};});}
  for(const [op,range] of [['addition',10],['addition',20],['subtraction',10],['subtraction',20],['multiplication',20]]) {
   await set(op,range);
   assert(await page.evaluate(()=>state.exercises.every(e=>e.type==='direct'?e.choices.length===3:new Set([e.decomposition1,e.decomposition2]).size>0)));
   const result=await solve();assert(result.completed);
   await page.locator('#next').click();
  }
  // A correct result alone must never satisfy a crossing subtraction.
  await page.evaluate(()=>{
   state.operation='subtraction';state.range=20;state.completed=false;
   state.exercises=Array.from({length:6},()=>ExerciseRules.decorate({operation:'subtraction',a:14,b:5}));renderExercises();scheduleLayout();
   document.querySelector('[data-exercise="0"][data-part="2"]').value='9';
   checkExerciseAnswers(0,1);
  });
  assert.equal(await page.locator('#status-0').textContent(),'Doplň všechna tři políčka.');
  assert.equal(await page.locator('[data-exercise="0"][data-part="0"]').getAttribute('aria-invalid'),'true');
  assert((await solve()).completed);
  // Nothing selected must fail; a repaired first attempt must stay incorrect in stats.
  await set('addition',10);
  const before=await page.evaluate(()=>({...statistics}));
  await page.evaluate(()=>checkAnswers());
  assert.equal(await page.evaluate(()=>state.completed),false);
  const repaired=await solve();assert(repaired.completed);assert.equal(repaired.stats.correct,before.correct);assert.equal(repaired.stats.solved,before.solved+6);
  await page.locator('[data-view="battle"]').click();
  await page.waitForSelector('.battle-choice');
  const initial=await page.evaluate(()=>({...statistics}));
  const answer=await page.locator('#b-question').textContent();const [a,b]=answer.match(/\d+/g).map(Number);
  await page.locator(`.battle-choice[value="${a+b}"]`).click();
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(()=>statistics.solved),initial.solved+1);
  assert.equal(await page.evaluate(()=>statistics.correct),initial.correct+1);
  // Reload preserves guest statistics.
  await page.reload();await page.waitForSelector('#math-view:visible');
  assert.equal(await page.evaluate(()=>statistics.correct),initial.correct+1);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.exercise')).filter(e=>!e.hidden).length===1);
  assert.equal(await page.locator('.exercise:visible').count(),1);
  // Signed-in fixture checks one-value payloads, cloud radio feedback, battle API and retries.
  let prefs={operation:'addition',range:10,multiplicationLimit:100,count:6,gender:'boy',largeText:false};
  let stats={solved:0,correct:0,completedSets:0,streak:0,bestStreak:0,lastUsed:''},sets=new Map(),id=0,failBattle=false;
  const user=()=>({id:1,nickname:'Test',preferences:prefs,statistics:stats,lifetimeSets:stats.completedSets,week:'2026-10-19'});
  await page.evaluate(()=>localStorage.clear());
  await page.route('**/api/index.php?*',async route=>{
   const req=route.request(),action=new URL(req.url()).searchParams.get('action'),body=req.postDataJSON();let result;
   if(action==='me')result={csrf:'test',user:user()};
   else if(action==='settings'){prefs=body;result={ok:true};}
   else if(action==='start') {const setId=String(++id),items=rules.pool({...body.settings,mode:body.mode}).filter(e=>body.mode!=='battle'||body.settings.operation!=='subtraction'||(e.a>10&&e.a-e.b<10)).slice(0,body.mode==='battle'?1:6);sets.set(setId,{items,mode:body.mode,done:false});result={setId,exercises:items,user:user()};}
   else if(action==='check'){
    const set=sets.get(body.setId);
    if(failBattle&&set.mode==='battle'){failBattle=false;await route.fulfill({status:503,json:{error:'Test výpadku'}});return;}
    const checks=body.answers.map(({index,values})=>{const e=set.items[index];assert.equal(values.length,e.type==='direct'?1:3);const checks=rules.checks(e,values),ok=checks.every(Boolean);if(!e.checked){e.checked=true;stats.solved++;if(ok){stats.correct++;stats.streak++;stats.bestStreak=Math.max(stats.bestStreak,stats.streak);}else stats.streak=0;}if(ok)e.solved=true;return {index,checks};});const completed=set.items.every(e=>e.solved);if(completed&&!set.done){set.done=true;if(set.mode!=='battle')stats.completedSets++;}result={checks,completed,user:user()};
   } else throw Error(action);
   await route.fulfill({json:result});
  });
  await page.reload();await page.waitForSelector('#math-view:visible');
  await page.waitForFunction(()=>serverSetId!==null&&!waiting);
  await page.evaluate(()=>checkAnswers());assert.equal(await page.evaluate(()=>state.completed),false);
  await page.evaluate(()=>{state.exercises.forEach((e,i)=>document.querySelector(`[data-exercise="${i}"][value="${e.result}"]`).click());});
  await page.evaluate(()=>checkAnswers());assert.equal(await page.evaluate(()=>state.completed),true);assert.equal(stats.correct,0);assert.equal(stats.solved,6);
  await page.locator('[data-view="battle"]').click();await page.waitForSelector('.battle-choice');failBattle=true;
  const battleAnswer=await page.locator('#b-question').textContent();const [x,y]=battleAnswer.match(/\d+/g).map(Number);
  await page.locator(`.battle-choice[value="${x+y}"]`).click();await page.waitForSelector('#b-message:text("Test výpadku")');assert.equal(stats.solved,6);
  await page.locator(`.battle-choice[value="${x+y}"]`).click();await page.waitForTimeout(650);assert.equal(stats.solved,7);assert.equal(stats.correct,1);assert.equal(stats.completedSets,1);
  await set('subtraction',20);
  await page.locator('[data-view="battle"]').click();
  await page.waitForFunction(()=>document.querySelector('#b-question').textContent.includes('−')&&!document.querySelector('.battle-choice')?.disabled);
  assert.equal(await page.locator('#b-decomposition').isVisible(),false);
  assert.equal(await page.locator('.battle-choice').count(),3);
  const subtractQuestion=await page.locator('#b-question').innerText();const [minuend,subtrahend]=subtractQuestion.match(/\d+/g).map(Number);
  assert(minuend>10&&minuend-subtrahend<10);
  await page.locator('.battle-choice[value="'+(minuend-subtrahend)+'"]').click();await page.waitForTimeout(650);
  assert.equal(stats.solved,8);assert.equal(stats.correct,2);
  const tracked=await page.evaluate(()=>window.dataLayer.filter(item=>item[0]==='event').map(item=>({name:item[1],params:item[2]})));
  for(const name of ['pocitej_open','practice_start','practice_complete','settings_change','view_section','battle_start'])assert(tracked.some(e=>e.name===name),'Missing event '+name);
  assert.equal(tracked.filter(e=>e.name==='pocitej_open').length,1);
  assert(tracked.some(e=>e.name==='settings_change'&&e.params.setting==='operation'&&e.params.operation==='subtraction'));
  assert(!JSON.stringify(tracked).includes('nickname'));assert(!JSON.stringify(tracked).includes('pin'));
  assert.deepEqual(errors,[]);console.log('PASS: guest and cloud worksheets, mobile paging, saved stats, battle accounting and network retry');
 } finally {if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
