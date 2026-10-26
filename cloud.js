'use strict';
// Síťová verze: lokální generátor slouží jen ke kreslení; sady a body vydává server.
let account = null;
let csrfToken = '';
let serverSetId = null;
let queue = Promise.resolve();
let waiting = 0;
let focusAfterRequest = null;
const originalShowView = showView;
const localPractice = {
  start: startNewSet, check: checkAnswers, next: goToNextExercisePage,
  saveStats: saveStatistics, savePrefs: savePreferences
};
let guestMode = false;
const GUEST_MODE_KEY = 'pocitame-guest-mode';
function enterGuestMode() {
  guestMode=true;account=null;serverSetId=null;
  writeStorage(GUEST_MODE_KEY,{enabled:true});
  statistics=loadStatistics();preferences=loadPreferences();
  Object.assign(state,{operation:preferences.operation,range:preferences.range,multiplicationLimit:preferences.multiplicationLimit,count:preferences.count});
  document.body.classList.add('signed-in','guest-mode');
  document.body.classList.toggle('large-text',preferences.largeText);
  $('#account-name').textContent='Host – pouze v tomto prohlížeči';
  $('#logout').textContent='Přihlásit se';
  $('#auth-area').hidden=true;cloudError('');
  $('main').inert=false;$('header').inert=false;
  originalShowView('math');localPractice.start(true);
}
function leaveGuestMode() {
  window.ChessRoom?.show(false);
  window.BattleGame?.show(false);
  guestMode=false;writeStorage(GUEST_MODE_KEY,{enabled:false});
  document.body.classList.remove('signed-in','guest-mode','keyboard-open');
  document.activeElement?.blur();$('#auth-area').hidden=false;
  boot();
}

function cloudError(message) {
  $('#cloud-message').textContent = message;
  $('#cloud-message').hidden = !message;
}
async function api(action, payload) {
  const response = await fetch(`api/index.php?action=${action}`, {
    method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: payload === undefined ? {} : { 'Content-Type':'application/json', 'X-CSRF-Token':csrfToken },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('Server nevrátil odpověď aplikace. Zkontrolujte PHP a cestu api/index.php.'); }
  if (!response.ok) {
    if(response.status === 401 && account) {
      account=null;serverSetId=null;window.BattleGame?.show(false);document.body.classList.remove('signed-in');
      $('#auth-area').hidden=false;
    }
    throw new Error(result.error || 'Požadavek se nepodařilo dokončit.');
  }
  return result;
}
function run(task) {
  waiting++;
  $('main').inert=true; $('header').inert=true;
  $('#cloud-busy').hidden=false;
  queue = queue.catch(()=>{}).then(async()=>{
    cloudError('');
    try { return await task(); }
    catch(error) { cloudError(error.message || 'Připojení se nezdařilo. Odpovědi zůstaly vyplněné, zkus kontrolu znovu.'); }
    finally {
      waiting--;
      if(!waiting) {
        $('main').inert=false;$('header').inert=false;$('#cloud-busy').hidden=true;
        if(focusAfterRequest?.isConnected) focusAfterRequest.focus({preventScroll:true});
        focusAfterRequest=null;
      }
    }
  });
  return queue;
}
function acceptProfile(user, restoreSettings=false) {
  guestMode=false;writeStorage(GUEST_MODE_KEY,{enabled:false});
  document.body.classList.remove('guest-mode');$('#logout').textContent='Odhlásit se';
  account=user;
  statistics={...defaultStats(),...user.statistics};
  $('#account-name').textContent=user.nickname;
  if(restoreSettings) {
    preferences={...user.preferences};
    Object.assign(state,{operation:preferences.operation,range:preferences.range,multiplicationLimit:preferences.multiplicationLimit,count:preferences.count});
    document.body.classList.toggle('large-text',preferences.largeText);
    syncControls();
  }
}
saveStatistics = function() { if(guestMode) localPractice.saveStats(); }; // Host zapisuje pouze do prohlížeče.
savePreferences = function() {
  if(guestMode) return localPractice.savePrefs();
  Object.assign(preferences,{operation:state.operation,range:state.range,multiplicationLimit:state.multiplicationLimit,count:state.count});
  if(!account) return;
  const snapshot={...preferences};
  run(async()=>{ await api('settings',snapshot);account.preferences=snapshot; });
};
async function newServerSet(resetSeries) {
  const result=await api('start',{settings:{...preferences,operation:state.operation,range:state.range,multiplicationLimit:state.multiplicationLimit,count:state.count}});
  acceptProfile(result.user);
  serverSetId=result.setId;
  if(resetSeries) state.series=1;
  state.exercises=result.exercises.map(e=>ExerciseRules.decorate(e));
  state.completed=false;state.page=0;
  $('#feedback').textContent='';$('#check').hidden=false;$('#next').hidden=true;
  renderExercises();showProgress();syncControls();scheduleLayout();
  window.UsageAnalytics?.activity('practice_start');
}
startNewSet = function(resetSeries=false) {
  if(guestMode) return localPractice.start(resetSeries);
  if(!account) return;
  serverSetId=null;
  return run(()=>newServerSet(resetSeries));
};
async function checkOnServer(advance, selectedIndex = null) {
  if(!serverSetId) throw new Error('Nejdřív načti sadu tlačítkem Nové příklady.');
  if(state.completed) return;
  const first=selectedIndex !== null ? selectedIndex : advance?state.page*state.pageSize:0;
  const end=selectedIndex !== null ? selectedIndex + 1 : advance?Math.min(first+state.pageSize,state.count):state.count;
  const answers=[];
  for(let index=first;index<end;index++) {
    answers.push({index,values:answerValues(index)});
  }
  const result=await api('check',{setId:serverSetId,answers});
  acceptProfile(result.user);
  let wrong;
  for(const item of result.checks) {
    const inputs=Array.from(document.querySelectorAll(`[data-exercise="${item.index}"]`));
    inputs.forEach((input,i)=>{
      const valid=item.checks[state.exercises[item.index].type==='direct'?0:i];
      input.classList.toggle('correct',valid);input.classList.toggle('incorrect',!valid);
      input.setAttribute('aria-invalid',String(!valid));
      if(!valid&&!wrong) wrong=input;
    });
    const ok=item.checks.every(Boolean);
    const card=inputs[0].closest('.exercise');card.classList.toggle('solved',ok);
    const blank=answerValues(item.index).length===0||answerValues(item.index).includes(null);
    card.querySelector('.exercise-status').textContent=ok?'✓ Výborně!':blank?'Doplň označená políčka.':'Ještě přepočítej označená políčka.';
    const question=card.querySelector('.question');
    if(question) question.textContent=item.checks.at(-1)?state.exercises[item.index].result:'?';
    if(ok) inputs.forEach(input=>{if(input.type==='radio') input.disabled=true; else input.readOnly=true;});
  }
  if(selectedIndex !== null && !result.completed) return;
  if(wrong) {
    $('#feedback').textContent='Ještě oprav označená políčka. Potom můžeš pokračovat.';
    showExercisePage(Math.floor(Number(wrong.dataset.exercise)/state.pageSize));
    focusAfterRequest=wrong;return;
  }
  if(result.completed) {
    window.UsageAnalytics?.activity('practice_complete');
    state.completed=true;
    $('#feedback').textContent=state.series===6?'Hotovo! Celé cvičení je za tebou! 🎉':'Skvělé! Všechno správně! 🎉';
    $('#check').hidden=true;$('#next').hidden=false;
    $('#next').textContent=state.series===6?'Nové cvičení →':'Další série →';
    showProgress();
    document.activeElement?.blur();
  } else if(advance) {
    $('#feedback').textContent='';showExercisePage(state.page+1);
    focusAfterRequest=document.querySelector(`[data-exercise="${state.page*state.pageSize}"]`);
  }
}
const localCheckSelectedAnswer = checkSelectedAnswer;
checkSelectedAnswer = function(index) {
  if (guestMode) return localCheckSelectedAnswer(index);
  if (!account || state.completed) return;
  return run(() => checkOnServer(false, index));
};

goToNextExercisePage = function() {
  if(guestMode) return localPractice.next();
  if(state.completed) { showExercisePage(state.page+1);return; }
  return run(()=>checkOnServer(true));
};
checkAnswers = function() { return guestMode ? localPractice.check() : run(()=>checkOnServer(false)); };
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
async function showLeaderboard(page=1) {
  const result=await api(`leaderboard&page=${page}`);
  const panel=$('#secondary-view');
  panel.innerHTML=`<h2>Týdenní žebříček</h2><p>Týden od ${escapeHtml(result.week.split('-').reverse().join('. '))}. Za správný první pokus získáš 10 bodů. Stejný počet bodů znamená stejné pořadí.</p><div class="ranking">${result.entries.length?`<table><thead><tr><th>Pořadí</th><th>Přezdívka a titul</th><th>Body</th></tr></thead><tbody>${result.entries.map(row=>`<tr class="${row.mine?'my-rank':''}"><td>${row.rank}.</td><td><strong>${escapeHtml(row.nickname)}</strong><small>${escapeHtml(row.title)}</small></td><td>${row.points}</td></tr>`).join('')}</tbody></table>`:'<p>Tento týden zatím nikdo nepočítal. Začni jako první!</p>'}</div><div class="ranking-pages"><button id="rank-back" ${result.page===1?'disabled':''}>←</button><span>${result.page} / ${result.pages}</span><button id="rank-next" ${result.page>=result.pages?'disabled':''}>→</button></div><p>Žebříček je společný pro všechny operace a rozsahy. V pondělí začíná nové kolo, odměny zůstávají.</p><button id="rank-math">← Zpět na počítání</button>`;
  $('#rank-back').onclick=()=>run(()=>showLeaderboard(page-1));
  $('#rank-next').onclick=()=>run(()=>showLeaderboard(page+1));
  $('#rank-math').onclick=()=>showView('math');
}
showView = function(view) {
  if (view === 'chess') {
    state.view=view;window.BattleGame?.show(false);updateKeyboardLayout();
    for(const id of ['math-view','settings-view','secondary-view','battle-view']) $('#'+id).hidden=true;
    document.querySelectorAll('[data-view]').forEach(button=>{
      button.classList.toggle('active',button.dataset.view===view);
      if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    window.ChessRoom?.show(true);return;
  }
  window.ChessRoom?.show(false);$('#chess-view').hidden=true;
  if (view !== "battle") window.BattleGame?.show(false);
  if(guestMode) {
    originalShowView(view);
    if(view==='leaderboard') {
      $('#secondary-view').innerHTML='<h2>Týdenní žebříček</h2><p>Procvičuješ jako host. Tvoje pokroky a odměny zůstávají pouze v tomto prohlížeči a nevstupují do společného žebříčku.</p><p>Pro soutěžení a ukládání mezi zařízeními se přihlas nebo si vytvoř profil. Místní body se na účet nepřevádějí.</p><button id="guest-login">Přihlásit se / vytvořit profil</button><button id="guest-back">← Zpět na počítání</button>';
      $('#guest-login').onclick=leaveGuestMode;$('#guest-back').onclick=()=>showView('math');
    } else if(view==='stats'||view==='rewards') {
      $('#secondary-view').insertAdjacentHTML('afterbegin','<p>Host · pokroky pouze v tomto prohlížeči, bez společného žebříčku.</p>');
    }
    return;
  }
  if(!account) return;
  if(view==='leaderboard') {
    state.view=view;updateKeyboardLayout();
    $('#math-view').hidden=true;$('#settings-view').hidden=true;$('#secondary-view').hidden=false;
    document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===view);button.removeAttribute('aria-current');});
    $('[data-view="leaderboard"]').setAttribute('aria-current','page');
    return run(()=>showLeaderboard());
  }
  if(view==='stats'||view==='rewards') return run(async()=>{
    const result=await api('me');
    if(!result.user) {
      account=null;serverSetId=null;window.BattleGame?.show(false);document.body.classList.remove('signed-in');$('#auth-area').hidden=false;
      throw new Error('Přihlas se znovu.');
    }
    acceptProfile(result.user);
    if(view==='rewards') {
      const weekly=statistics.completedSets;statistics.completedSets=account.lifetimeSets;
      originalShowView(view);statistics.completedSets=weekly;
    } else {
      originalShowView(view);
      $('#secondary-view').insertAdjacentHTML('afterbegin',`<p>Statistiky týdne od ${escapeHtml(account.week.split('-').reverse().join('. '))} · ${statistics.correct*10} bodů</p>`);
    }
  });
  originalShowView(view);
};
$('#auth-mode').addEventListener('change',()=>{
  const register=$('#auth-mode').value==='register';
  $('#pin-again-label').hidden=!register;$('#pin-again').required=register;
  $('#auth-submit').textContent=register?'Vytvořit profil':'Přihlásit se';
});
$('#auth-form').addEventListener('submit',event=>{
  event.preventDefault();
  const mode=$('#auth-mode').value;
  const body={nickname:$('#nickname').value.trim(),pin:$('#pin').value,pinAgain:$('#pin-again').value,preferences:{...preferences}};
  $('#auth-submit').disabled=true;
  run(async()=>{
    try {
      const result=await api(mode,body);acceptProfile(result.user,true);
      $('#pin').value='';$('#pin-again').value='';$('#auth-area').hidden=true;
      document.body.classList.add('signed-in');originalShowView('math');await newServerSet(true);
    } finally { $('#auth-submit').disabled=false; }
  });
});
$('#guest-start').onclick=enterGuestMode;
$('#logout').onclick=()=>guestMode?leaveGuestMode():run(async()=>{
  window.ChessRoom?.show(false);
  await api('logout',{});account=null;serverSetId=null;state.view='math';
  window.BattleGame?.show(false);document.body.classList.remove('signed-in');$('#auth-area').hidden=false;
  $('#pin').value='';$('#pin-again').value='';
});
$('#cloud-retry').onclick=()=>account?startNewSet(true):boot();
function boot() {
  if(readStorage(GUEST_MODE_KEY,{}).enabled) { enterGuestMode();return Promise.resolve(); }
  $('#auth-area').hidden=false;
  return run(async()=>{
    const result=await api('me');csrfToken=result.csrf;
    if(guestMode) return;
    if(result.user) {
      acceptProfile(result.user,true);document.body.classList.add('signed-in');$('#auth-area').hidden=true;
      originalShowView('math');await newServerSet(true);
    } else { $('#auth-area').hidden=false; }
  });
}
// Účet a žebříček se při návratu na kartu obnoví; rozepsané odpovědi se nemažou.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&account&&!waiting) run(async()=>{
    const result=await api('me');
    if(result.user) {
      const changedWeek=account.week!==result.user.week;acceptProfile(result.user);
      if(changedWeek) cloudError('Začal nový týden. Pro započítávání bodů načti Nové příklady.');
    } else { account=null;serverSetId=null;window.BattleGame?.show(false);document.body.classList.remove('signed-in');$('#auth-area').hidden=false; }
  });
});
boot();

// Battles use the same server-issued exercises and first-attempt accounting.
window.PracticeSession = {
  identity() { return guestMode?'guest':account?.id; },
  async next(p) {
    if(guestMode) return null;
    if(!account) throw new Error('Pro uložení pokroků se přihlas.');
    const owner=account.id;
    const result=await api('start',{settings:{...p,count:6},mode:'battle'});
    if(guestMode||account?.id!==owner) throw new Error('Účet se změnil. Začni novou výzvu.');
    return {exercise:ExerciseRules.decorate(result.exercises[0]),setId:result.setId,owner};
  },
  async check(session,e,values) {
    if(!session) {
      const checks=ExerciseRules.checks(e,values);
      if(!e.checked) { e.checked=true;statistics.solved++;if(checks.every(Boolean)){statistics.correct++;statistics.streak++;statistics.bestStreak=Math.max(statistics.bestStreak,statistics.streak);}else statistics.streak=0;saveStatistics(); }
      return checks;
    }
    if(guestMode||!account||account.id!==session.owner) throw new Error('Účet se změnil. Začni novou výzvu.');
    const result=await api('check',{setId:session.setId,answers:[{index:0,values}]});
    if(guestMode||account?.id!==session.owner) throw new Error('Účet se změnil. Začni novou výzvu.');
    acceptProfile(result.user);return result.checks[0].checks;
  }
};

window.ChessSession = { user() { return !account||guestMode?null:{id:account.id,nickname:account.nickname}; }, request(payload) { return api('chess',payload); }, login() { leaveGuestMode(); } };
