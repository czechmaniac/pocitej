'use strict';
// Independent local challenge. Never writes practice or account statistics.
(() => {
 const DEBUG_BATTLE = false;
 const PLAYER_ASSETS = {
  girl: {
  healthy:'assets/characters/player/girl/player-girl-healthy.png',
  damage1:'assets/characters/player/girl/player-girl-damage-1.png',
  damage2:'assets/characters/player/girl/player-girl-damage-2.png',
  critical:'assets/characters/player/girl/player-girl-critical.png',
  defeated:'assets/characters/player/girl/player-girl-defeated.png'
  },
  boy: {
   healthy:'assets/characters/player/boy/player-boy-healthy.png',
   damage1:'assets/characters/player/boy/player-boy-damage-1.png',
   damage2:'assets/characters/player/boy/player-boy-damage-2.png',
   critical:'assets/characters/player/boy/player-boy-critical.png',
   defeated:'assets/characters/player/boy/player-boy-defeated.png'
  }
 };
 const ASSET_VERSION = 'assets-20260929-2';
 const assetURL = path => path + '?v=' + ASSET_VERSION;
 const MONSTER_DEFINITIONS = {
  'stone-guardian': {
   displayName:'Kamenný strážce', scale:1,
   assets:{
    idle:'assets/monsters/stone-guardian/monster-idle.png',
    damage1:'assets/monsters/stone-guardian/monster-damaged.png',
    damage2:'assets/monsters/stone-guardian/monster-damaged.png',
    critical:'assets/monsters/stone-guardian/monster-critical.png',
    defeated:'assets/monsters/stone-guardian/monster-defeated.png'
   }
  }
 };
 const DEFAULT_MONSTER = 'stone-guardian';
 function getMonsterDefinition(id){
  if(!MONSTER_DEFINITIONS[id]&&DEBUG_BATTLE)console.warn('[Battle] Unknown monster:',id);
  return MONSTER_DEFINITIONS[id]||MONSTER_DEFINITIONS[DEFAULT_MONSTER];
 }
 function getMonsterAsset(id,state){
  const assets=getMonsterDefinition(id).assets;
  const key=state==='damaged'?'damage1':state;
  return assets[key]||assets.damage1||assets.idle;
 }
 function getPlayerVisualState(hp,maxHp){
  if(hp<=0)return 'defeated';const percent=100*hp/maxHp;
  return percent<=25?'critical':percent<=50?'damage2':percent<=75?'damage1':'healthy';
 }
 function getMonsterVisualState(hp,maxHp){
  if(hp<=0)return 'defeated';const percent=100*hp/maxHp;
  return percent<=20?'critical':percent<=50?'damaged':'idle';
 }
 // A successful preload is the only source of truth, including the first frame.
 const artworkCache=new Map();
 function preloadArtwork(path){
  const prior=artworkCache.get(path);
  if(prior&&(!prior.failed||prior.attempts>=2))return prior;
  const entry={loaded:false,failed:false,attempts:(prior?.attempts||0)+1,promise:null};
  const probe=new Image();
  entry.promise=new Promise(resolve=>{
   probe.onload=()=>{
    // onload + naturalWidth is sufficient. decode() rejection is not a network failure.
    entry.loaded=probe.naturalWidth>0;entry.failed=!entry.loaded;
    if(entry.failed&&DEBUG_BATTLE)console.warn('[Battle] Empty artwork:',assetURL(path));
    resolve(entry.loaded);
   };
   probe.onerror=()=>{entry.failed=true;if(DEBUG_BATTLE)console.warn('[Battle] Artwork unavailable:',assetURL(path));resolve(false);};
  });artworkCache.set(path,entry);probe.src=assetURL(path);return entry;
 }
 const artworkViews={
  player:{current:'#battle-player-image',previous:'#battle-player-previous',container:'#b-player',path:null,requested:null,revision:0},
  monster:{current:'#battle-enemy-image',previous:'#battle-enemy-previous',container:'#b-monster',path:null,requested:null,revision:0}
 };
 function switchArtwork(view,path,immediate=false,fallback=path){
  if(view.requested===path&&!immediate)return;
  view.requested=path;const revision=++view.revision;
  const image=q(view.current),previous=q(view.previous);
  if(path===view.path){if(immediate){previous.hidden=true;previous.style.opacity='0';}return;}
  const apply=next=>{
   if(view.revision!==revision)return;
   const lastWorking=view.path;
   previous.style.transition='none';
   if(lastWorking)previous.src=assetURL(lastWorking);
   previous.hidden=!lastWorking;previous.style.opacity=lastWorking?'1':'0';
   const reveal=()=>{
    if(view.revision!==revision||image.naturalWidth===0)return;
    image.hidden=false;view.path=next;
    q(view.container).classList.remove('artwork-unavailable');
    void previous.offsetWidth;previous.style.transition='';
    if(immediate)previous.hidden=true;
    requestAnimationFrame(()=>{if(view.revision===revision&&!image.hidden)previous.style.opacity='0';});
   };
   image.onload=reveal;
   image.onerror=()=>{
    if(view.revision!==revision)return;
    image.hidden=true;view.path=lastWorking;
    if(DEBUG_BATTLE)console.warn('[Battle] Display failed:',assetURL(next));
    if(lastWorking){previous.hidden=false;previous.style.opacity='1';}
    else if(next!==fallback)attempt(fallback,false);
    else q(view.container).classList.add('artwork-unavailable');
   };
   image.src=assetURL(next);
   if(image.complete&&image.naturalWidth>0)reveal();
  };
  const attempt=(candidate,canFallback)=>{
   const entry=preloadArtwork(candidate);
   const done=loaded=>{
    if(view.revision!==revision)return;
    if(loaded)apply(candidate);
    else if(!view.path&&canFallback&&fallback!==candidate)attempt(fallback,false);
    else if(!view.path)q(view.container).classList.add('artwork-unavailable');
   };
   if(entry.loaded)done(true);else entry.promise.then(done);
  };
  attempt(path,true);
 }
 function updateCharacterVisuals(immediate=false){
  if(!game)return;
  const gender=settings().gender==='girl'?'girl':'boy';
  const playerState=getPlayerVisualState(game.player.hp,game.player.maxHp);
  const monsterState=getMonsterVisualState(game.enemy.hp,game.enemy.maxHp);
  const definition=getMonsterDefinition(game.enemy.id);
  q('#b-player').dataset.damageState=playerState;q('#b-player').dataset.gender=gender;
  q('#b-monster').dataset.damageState=monsterState;
  q('#b-monster').style.setProperty('--monster-scale',definition.scale);
  q('#b-enemy-name').textContent=definition.displayName+' · Lv. '+game.enemy.level;
  q('#battle-enemy-image').alt=definition.displayName;
  const players=PLAYER_ASSETS[gender];
  switchArtwork(artworkViews.player,players[playerState]||players.healthy,immediate,players.healthy);
  switchArtwork(artworkViews.monster,getMonsterAsset(game.enemy.id,monsterState),immediate,definition.assets.idle);
 }
 function auditArtwork(){
  return Object.entries(artworkViews).map(([kind,view])=>{
   const image=q(view.current),rect=image.getBoundingClientRect();
   return {kind,id:kind==='monster'?game?.enemy.id:settings().gender,
    displayName:kind==='monster'?getMonsterDefinition(game?.enemy.id).displayName:'Hráč',
    state:q(view.container).dataset.damageState,path:image.src,
    naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,
    renderedWidth:rect.width,renderedHeight:rect.height};
  });
 }
 const KEY = 'pocitame-battle-v1';
 const root = document.querySelector('#battle-view');
 if (!root) return;
 const q = selector => root.querySelector(selector);
 for(const path of [...Object.values(PLAYER_ASSETS).flatMap(set=>Object.values(set)),...Object.values(getMonsterDefinition(DEFAULT_MONSTER).assets)])preloadArtwork(path);
 const log = (...args) => { if (DEBUG_BATTLE) console.debug('[Battle]', ...args); };
 const defaults = () => ({coins:0,totalBattlePoints:0,battlesWon:0,battlesLost:0,bestCombo:0});
 let totals = defaults(), storageFailed = false;
 try { const saved=JSON.parse(localStorage.getItem(KEY)); for(const key of Object.keys(totals)) if(Number.isSafeInteger(saved?.[key]) && saved[key]>=0) totals[key]=saved[key]; } catch { storageFailed=true; }
 const settings = () => window.AppSettings.getPreferences();
 const signature = p => JSON.stringify([p.operation,p.range,p.multiplicationLimit,window.PracticeSession?.identity()]);
 const shuffle = values => { for(let i=values.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values; };
 function choicesFor(e){return ExerciseRules.decorate(e).choices;}
 function generate(p=settings()) { const pool=ExerciseRules.pool({...p,mode:'battle'});return {...pool[Math.floor(Math.random()*pool.length)],hadMistake:false,rejected:[]}; }
 const validate=(e,values)=>ExerciseRules.checks(e,values.map(v=>/^\d+$/.test(String(v))?Number(v):null));
 const speed=ms=>ms<=4000?[25,5]:ms<=7000?[20,3]:ms<=12000?[16,1]:[12,0];
 const multiplier=combo=>1+Math.min(Math.max(combo-1,0),3)/10;
 let game=null, shown=false, lastTick=null, interval=null, unlockAt=0, pendingNext=false, preferenceSignature="";
 root.innerHTML=`
 <div class="battle-hud"><div><strong>PLAYER · Lv. 1</strong><span id="b-player-hp"></span><progress id="b-player-bar" max="100" value="100" aria-label="Zdraví hráče"></progress></div><div class="battle-center"><strong id="b-combo">COMBO ×0</strong><span id="b-time">0:00</span><small id="b-wallet"></small></div><div><strong id="b-enemy-name"></strong><span id="b-enemy-hp"></span><progress id="b-enemy-bar" max="300" value="300" aria-label="Zdraví příšery"></progress></div></div>
 <div class="battle-stage"><div class="battle-background-back"></div><div class="battle-background-mid"></div><div class="battle-background-front"></div>
 <div id="b-player" class="character-stage player player-character" data-state="healthy"><div class="character-image battle-character-image"><img id="battle-player-image" hidden alt="Hráč" draggable="false"><img id="battle-player-previous" alt="" aria-hidden="true" hidden draggable="false"></div><div class="character-effects player-effects" aria-hidden="true"></div></div>
 <div class="battle-versus" aria-hidden="true">⚔</div><div id="b-monster" class="character-stage monster enemy-character" data-state="normal"><div class="character-image enemy-artwork"><img id="battle-enemy-image" hidden alt="Příšera" draggable="false"><img id="battle-enemy-previous" alt="" aria-hidden="true" hidden draggable="false"></div><div class="character-effects enemy-effects" aria-hidden="true"></div></div></div>
 <form id="b-form" class="battle-math" novalidate><div class="battle-question-head"><h2 id="b-question"></h2><button type="button" id="b-keyboard-close">↓ Skrýt klávesnici</button></div><p id="b-hint"></p><div id="b-choices" class="battle-choices" role="group" aria-label="Vyber výsledek"></div><div id="b-decomposition"><div class="battle-split"><span id="b-split-number"></span><svg viewBox="0 0 100 18" aria-hidden="true"><path d="M50 1 L15 17 M50 1 L85 17"/></svg></div><div class="battle-inputs"><span id="b-first-number"></span><span>−</span><label><span>První část</span><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" aria-label="První část rozkladu"></label><span>−</span><label><span>Druhá část</span><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" aria-label="Druhá část rozkladu"></label><span>=</span><label><span>Výsledek</span><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" aria-label="Výsledek příkladu"></label></div></div><p id="b-message" role="status" aria-live="polite"></p></form>
 <div class="battle-actions"><button id="b-attack" type="submit" form="b-form">⚔ ZAÚTOČIT</button><button id="b-potion" type="button"></button><button id="b-shield" type="button"></button><button id="b-special" type="button"></button></div>
 <section id="b-outcome" class="battle-outcome" hidden tabindex="-1" aria-labelledby="b-outcome-title"><h2 id="b-outcome-title"></h2><dl id="b-summary"></dl><button id="b-restart" type="button"></button></section><p class="battle-local" id="b-local">Příklady se započítávají do pokroků a přihlášeným do žebříčku. Mince a herní odměny zůstávají v tomto prohlížeči.</p>`;
 const inputs=Array.from(root.querySelectorAll('input'));
 const text=(id,value)=>{q(id).textContent=value;};
 const time=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
 function save(){try{localStorage.setItem(KEY,JSON.stringify(totals));}catch{storageFailed=true;} if(storageFailed)text('#b-local','Ukládání není dostupné. Výzva funguje, odměny se ale nemusí zachovat.');}
 function message(value){text('#b-message',value);}
 const effectTimers=new Map();
 function clearEffects(){for(const [id,node] of effectTimers){clearTimeout(id);node.remove();}effectTimers.clear();}
 function effect(target,value,heal=false){ const node=document.createElement('span');node.className=heal?'heal-number':'damage-number';node.textContent=value;q(target+' .character-effects').appendChild(node);const timeout=setTimeout(()=>{node.remove();effectTimers.delete(timeout);},900);effectTimers.set(timeout,node);const el=q(target);el.classList.remove('player-hit','monster-hit','attack-flash');void el.offsetWidth;el.classList.add(heal?'attack-flash':target==='#b-player'?'player-hit':'monster-hit'); }
 function render(){if(!game)return;const {player:p,enemy:e,battle:b}=game;
 updateCharacterVisuals();
 text('#b-player-hp',`${p.hp} / 100 HP${p.shieldActive?' · 🛡':''}`);text('#b-enemy-hp',`${e.hp} / 300 HP`);q('#b-player-bar').value=p.hp;q('#b-enemy-bar').value=e.hp;
 text('#b-combo',`COMBO ×${b.combo}`);text('#b-time',time(b.elapsed));text('#b-wallet',`${totals.coins} mincí · ${b.sessionPoints} bodů`);
 
 const disabled=!game.active||b.processingAnswer;
 q('#b-attack').disabled=disabled;
 root.querySelectorAll('.battle-choice').forEach(button=>{button.disabled=disabled||game.currentExercise?.rejected.includes(Number(button.value));});inputs.forEach(i=>i.disabled=disabled);
 text('#b-potion',`🧪 LEKTVAR ×${p.potions}`);q('#b-potion').disabled=disabled||p.hp===100||p.potions===0;
 text('#b-shield',p.shieldActive?'🛡 ŠTÍT AKTIVNÍ':`🛡 ŠTÍT ×${p.shields}`);q('#b-shield').disabled=disabled||p.shieldActive||p.shields===0;
 text('#b-special',`⚡ SPECIÁL ${p.specialCharge} %`);q('#b-special').disabled=disabled||p.specialCharge<100;
 }
 let questionRevision=0;
 async function question(){
  unlockAt=0;
  const prefs=settings();preferenceSignature=signature(prefs);const revision=++questionRevision, currentGame=game;game.battle.processingAnswer=true;pendingNext=false;render();
  try { const session=await window.PracticeSession.next(prefs);if(revision!==questionRevision||game!==currentGame)return;
   game.currentExercise={...(session?session.exercise:generate(prefs)),session,hadMistake:false,rejected:[]};game.battle.processingAnswer=false;
  } catch(error) { if(game!==currentGame||revision!==questionRevision)return;window.UsageAnalytics?.activity('activity_error',{error_kind:'battle_load'});message(error.message+' Použij novou výzvu.');game.active=false;q('#b-outcome').hidden=false;text('#b-outcome-title','Připojení se nezdařilo');text('#b-restart','ZKUSIT ZNOVU');render();return; }
  const e=game.currentExercise,direct=e.type==='direct',op=ExerciseRules.sign(e.operation);
  root.classList.toggle('battle-wide-numbers',Math.max(e.a,e.b,e.result)>99);root.classList.toggle('battle-direct',direct);root.classList.toggle('battle-large-text',Boolean(prefs.largeText));
  q('#b-decomposition').hidden=direct;q('#b-choices').hidden=!direct;q('#b-attack').hidden=direct;q('#b-hint').hidden=direct;
  text('#b-question',`${e.a} ${op} ${e.b} = ?`);text('#b-split-number',e.b);text('#b-first-number',e.a);text('#b-hint','Rozlož druhé číslo. Po prvním odečtení musí zbýt 10.');
  q('#b-choices').innerHTML=direct?e.choices.map(n=>`<button class="battle-choice" type="button" value="${n}" aria-label="Odpověď ${n}">${n}</button>`).join(''):'';
  inputs.forEach(i=>{i.value='';i.classList.remove('invalid');i.removeAttribute('aria-invalid');});
  if(direct&&inputs.includes(document.activeElement))document.activeElement.blur();
  game.battle.questionStartedAt=game.battle.elapsed;message(direct?'Vyber správný výsledek.':'Doplň rozklad a zaútoč.');fitBattleToViewport();render();log('generated exercise',e);
 }
 function start(){window.UsageAnalytics?.activity('battle_start');stopClock();clearEffects();game={active:true,player:{hp:100,maxHp:100,level:1,potions:2,shields:2,shieldActive:false,specialCharge:0},enemy:{id:DEFAULT_MONSTER,name:getMonsterDefinition(DEFAULT_MONSTER).displayName,hp:300,maxHp:300,level:1,damage:10,regeneration:2},battle:{combo:0,bestCombo:0,sessionPoints:0,mistakes:0,solved:0,firstTryCorrect:0,questionStartedAt:0,battleStartedAt:performance.now(),elapsed:0,lastCorrect:0,nextRegen:9000,processingAnswer:false,rewardsCommitted:false},currentExercise:null};unlockAt=0;updateCharacterVisuals(true);q('#b-outcome').hidden=true;q('#b-form').hidden=false;root.querySelector('.battle-actions').hidden=false;question();render();resumeClock();log('state transition','start');}
 function finish(won){if(!game.active||game.battle.rewardsCommitted)return;game.active=false;stopClock();clearEffects();pendingNext=false;const b=game.battle;b.rewardsCommitted=true;window.UsageAnalytics?.activity('battle_complete');const coins=won?Math.floor(b.sessionPoints/10):0;totals.coins+=coins;totals.totalBattlePoints+=b.sessionPoints;totals[won?'battlesWon':'battlesLost']++;totals.bestCombo=Math.max(totals.bestCombo,b.bestCombo);save();document.activeElement?.blur();q('#b-form').hidden=true;root.querySelector('.battle-actions').hidden=true;q('#b-outcome').hidden=false;text('#b-outcome-title',won?getMonsterDefinition(game.enemy.id).displayName.toLocaleUpperCase('cs')+' PORAŽEN!':'Výzva tentokrát nevyšla.');q('#b-summary').innerHTML=[['Čas bitvy',time(b.elapsed)],['Vyřešené příklady',b.solved],['Správně napoprvé',b.firstTryCorrect],['Chyby',b.mistakes],['Nejvyšší combo',b.bestCombo],['Body',b.sessionPoints],['Získané mince',coins]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');text('#b-restart',won?'DALŠÍ VÝZVA':'ZKUSIT ZNOVU');render();keyboard();q('#b-outcome').focus({preventScroll:true});log('state transition',won?'victory':'defeat');}
 function tick(){if(!game?.active||!shown||document.hidden)return;const now=performance.now();if(game.battle.processingAnswer&&unlockAt===0){lastTick=now;return;}if(lastTick!==null)game.battle.elapsed+=Math.max(0,now-lastTick);lastTick=now;const b=game.battle;
 if(b.processingAnswer && unlockAt>0 && b.elapsed>=unlockAt){b.processingAnswer=false;unlockAt=0;if(pendingNext)question();render();}
 if(b.elapsed>=b.nextRegen){const ticks=Math.floor((b.elapsed-b.nextRegen)/1000)+1;b.nextRegen+=ticks*1000;const hp=Math.min(300-game.enemy.hp,ticks*2);if(hp>0){game.enemy.hp+=hp;effect('#b-monster',`+${hp}`,true);message('Příšera se léčí!');log('regen',hp);}}
 render();}
 function stopClock(){if(interval!==null)clearInterval(interval);interval=null;lastTick=null;}
 function resumeClock(){if(!game?.active||!shown||document.hidden)return;lastTick=performance.now();if(interval===null)interval=setInterval(tick,100);}
 async function attack(choice){if(!shown||document.hidden||!game?.active||game.battle.processingAnswer)return;tick();const b=game.battle,e=game.currentExercise,p=game.player;const direct=e.type==='direct';if(direct&&(!e.choices.includes(choice)||e.rejected.includes(choice)))return;b.processingAnswer=true;unlockAt=0;render();let checks;
 try { checks=await window.PracticeSession.check(e.session,e,direct?[choice]:inputs.map(i=>/^\d+$/.test(i.value)?Number(i.value):null)); }
 catch(error){window.UsageAnalytics?.activity('activity_error',{error_kind:'battle_answer'});b.processingAnswer=false;message(error.message+' Zkus odpověď znovu.');render();return;}
 if(game.currentExercise!==e||!game.active)return;
 unlockAt=b.elapsed+500;
 if(!checks.every(Boolean)){e.hadMistake=true;b.combo=0;b.mistakes++;const damage=p.shieldActive?5:10;p.shieldActive=false;p.hp=Math.max(0,p.hp-damage);if(direct){e.rejected.push(choice);root.querySelectorAll('.battle-choice').forEach(button=>{if(Number(button.value)===choice)button.classList.add('wrong');});}else checks.forEach((ok,i)=>{inputs[i].classList.toggle('invalid',!ok);inputs[i].setAttribute('aria-invalid',String(!ok));});effect('#b-player',`−${damage}`);message(direct?'Zkus jinou možnost.':'Oprav označená políčka. První krok musí dát 10.');if(p.hp===0)finish(false);
 }else{if(direct)root.querySelectorAll('.battle-choice').forEach(button=>{if(Number(button.value)===choice)button.classList.add('right');});const elapsed=b.elapsed-b.questionStartedAt;const [base,bonus]=e.hadMistake?[12,0]:speed(elapsed);if(!e.hadMistake){b.combo++;b.firstTryCorrect++;}b.bestCombo=Math.max(b.bestCombo,b.combo);const extra=b.combo>0 && b.combo%5===0?15:0;const damage=Math.round(base*multiplier(b.combo))+extra;b.solved++;b.sessionPoints+=10+bonus+(b.combo>=3?2:0);p.specialCharge=Math.min(100,p.specialCharge+20);game.enemy.hp=Math.max(0,game.enemy.hp-damage);b.lastCorrect=b.elapsed;b.nextRegen=b.elapsed+9000;effect('#b-monster',`−${damage}`);message(extra?'COMBO ATTACK! +15 poškození':'Správně! Pokračuj dalším příkladem.');q('#b-combo').classList.remove('combo-pulse');void q('#b-combo').offsetWidth;q('#b-combo').classList.add('combo-pulse');log('elapsed / base / combo / final damage',elapsed,base,b.combo,damage);if(game.enemy.hp===0)finish(true);else pendingNext=true;}log('HP',p.hp,game.enemy.hp);render();}
 function use(kind){if(!shown||document.hidden||!game?.active||game.battle.processingAnswer)return;tick();const p=game.player;if(kind==='potion'&&p.potions>0&&p.hp<100){const healed=Math.min(30,100-p.hp);p.hp+=healed;p.potions--;window.UsageAnalytics?.activity('battle_tool',{tool:'potion'});effect('#b-player',`+${healed}`,true);message(`Lektvar doplnil ${healed} HP.`);}else if(kind==='shield'&&p.shields>0&&!p.shieldActive){p.shields--;window.UsageAnalytics?.activity('battle_tool',{tool:'shield'});p.shieldActive=true;message('Štít sníží příští zásah na polovinu.');}else if(kind==='special'&&p.specialCharge===100){p.specialCharge=0;window.UsageAnalytics?.activity('battle_tool',{tool:'special'});game.enemy.hp=Math.max(0,game.enemy.hp-40);effect('#b-monster','−40');message('Speciální útok!');if(game.enemy.hp===0)finish(true);}render();}
 let baseline=window.visualViewport?.height||window.innerHeight,width=window.innerWidth;
 function keyboard(){const v=window.visualViewport;if(!v)return;if(width!==window.innerWidth){width=window.innerWidth;baseline=v.height;}if(v.scale===1)baseline=Math.max(baseline,v.height);const open=shown&&game?.active&&inputs.includes(document.activeElement)&&v.scale===1&&baseline-v.height>Math.max(160,baseline*.23);root.classList.toggle('battle-keyboard',open);root.style.setProperty('--battle-top',`${v.offsetTop+4}px`);root.style.setProperty('--battle-height',`${Math.max(180,v.height-8)}px`);}
 function fitBattleToViewport(){
  if(!shown)return;
  // Mobile geometry follows width only, so Safari toolbars cannot resize the arena.
   if(window.matchMedia('(max-width:900px)').matches){
    root.style.removeProperty('--battle-available-height');
    root.classList.add('battle-compact');keyboard();return;
   }
   const viewportHeight=window.visualViewport?.height||window.innerHeight;
  const available=Math.max(220,viewportHeight-root.getBoundingClientRect().top-28);
  root.style.setProperty('--battle-available-height',`${available}px`);
  root.classList.toggle('battle-compact',available<650);keyboard();
 }
 function show(visible){
  if(!visible){if(shown&&game?.active){window.UsageAnalytics?.activity('battle_pause');tick();}shown=false;stopClock();clearEffects();root.hidden=true;root.classList.remove('battle-keyboard');document.body.classList.remove('battle-active');return;}
  shown=true;root.hidden=false;document.body.classList.add('battle-active');
  if(!game)start();else{if(game.active)window.UsageAnalytics?.activity('battle_resume');const prefs=settings();root.classList.toggle('battle-large-text',Boolean(prefs.largeText));if(game.active&&signature(prefs)!==preferenceSignature){question();}updateCharacterVisuals(true);resumeClock();}
  requestAnimationFrame(()=>{window.scrollTo({top:0,behavior:"instant"});fitBattleToViewport();});
 }
 q('#b-choices').addEventListener('click',event=>{const button=event.target.closest('.battle-choice');if(button&&!button.disabled)attack(Number(button.value));});
 q('#b-form').addEventListener('submit',ev=>{ev.preventDefault();attack();});
 inputs.forEach(i=>{i.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.repeat)ev.preventDefault();});i.addEventListener('input',()=>{i.value=i.value.replace(/[^0-9]/g,'').slice(0,2);i.classList.remove('invalid');i.removeAttribute('aria-invalid');});i.addEventListener('focus',keyboard);i.addEventListener('blur',()=>requestAnimationFrame(keyboard));});
 for(const kind of ['potion','shield','special'])q('#b-'+kind).addEventListener('click',()=>use(kind));q('#b-restart').addEventListener('click',start);q('#b-keyboard-close').addEventListener('click',()=>{document.activeElement?.blur();keyboard();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopClock();clearEffects();}else resumeClock();});window.addEventListener('resize',fitBattleToViewport);window.addEventListener('orientationchange',fitBattleToViewport);window.visualViewport?.addEventListener('resize',fitBattleToViewport);window.visualViewport?.addEventListener('scroll',keyboard);
 window.BattleGame={show,fitBattleToViewport};
 if(DEBUG_BATTLE)window.BattleGame.debug={auditArtwork,getMonsterAsset,getMonsterDefinition,validate,speed,multiplier,generate,choicesFor,getPlayerVisualState,getMonsterVisualState,updateCharacterVisuals,getState:()=>game,setHP:(player,monster)=>{game.player.hp=player;game.enemy.hp=monster;render();},restart:start,pause:stopClock,resume:resumeClock};
})();
