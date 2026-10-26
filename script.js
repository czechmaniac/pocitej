'use strict';

const STORAGE_KEY = 'pocitame-statistics-v1';
const SETTINGS_KEY = 'pocitame-settings-v1';
const $ = selector => document.querySelector(selector);
const state = { operation: 'addition', range: 20, multiplicationLimit: 100, count: 6, series: 1, exercises: [], completed: false, view: 'math', page: 0, pageSize: 6 };
const defaultStats = () => ({ completedSets: 0, solved: 0, correct: 0, bestStreak: 0, streak: 0, lastUsed: '' });
let statistics = loadStatistics();
let preferences = loadPreferences();
Object.assign(state, { operation: preferences.operation, range: preferences.range, multiplicationLimit: preferences.multiplicationLimit, count: preferences.count });

// Ověření hodnot zachovává kompatibilitu se starším uloženým nastavením.
function loadPreferences() {
  const saved = readStorage(SETTINGS_KEY, {});
  return {
    largeText: saved.largeText === true,
    gender: saved.gender === 'girl' ? 'girl' : 'boy',
    operation: ['addition','subtraction','multiplication'].includes(saved.operation) ? saved.operation : 'addition',
    range: [10,20].includes(saved.range) ? saved.range : 20,
    multiplicationLimit: [20,50,100].includes(saved.multiplicationLimit) ? saved.multiplicationLimit : 100,
    count: [6,9,12].includes(saved.count) ? saved.count : 6
  };
}
function savePreferences() {
  Object.assign(preferences, { operation: state.operation, range: state.range, multiplicationLimit: state.multiplicationLimit, count: state.count });
  writeStorage(SETTINGS_KEY, preferences);
}
function getRewards() {
  const girl = preferences.gender === 'girl';
  return [
    ['🌱','První krůček',1],
    ['✨','Jiskra počítání',3],
    ['🦊','Bystrá liška',6],
    ['🔎',girl ? 'Lovkyně výsledků' : 'Lovec výsledků',10],
    ['⭐','Hvězda násobilky a rozkladů',15],
    ['🧭',girl ? 'Průzkumnice čísel' : 'Průzkumník čísel',21],
    ['💎','Diamantová mysl',28],
    ['🪄',girl ? 'Čarodějka matematiky' : 'Čaroděj matematiky',36],
    ['🏆',girl ? 'Šampionka počítání' : 'Šampion počítání',45],
    [girl ? '👑' : '🦖',girl ? 'Kari královna' : 'Dino král',60]
  ];
}

function readStorage(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === 'object' ? value : fallback; }
  catch { $('#storage-note').hidden = false; return fallback; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { $('#storage-note').hidden = false; }
}
function loadStatistics() {
  const saved = readStorage(STORAGE_KEY, defaultStats());
  const result = defaultStats();
  for (const key of ['completedSets', 'solved', 'correct', 'bestStreak', 'streak']) {
    result[key] = Number.isSafeInteger(saved[key]) && saved[key] >= 0 ? saved[key] : 0;
  }
  result.lastUsed = typeof saved.lastUsed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.lastUsed) ? saved.lastUsed : '';
  return result;
}
function saveStatistics() {
  const today = new Date();
  statistics.lastUsed = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  writeStorage(STORAGE_KEY, statistics);
}

function generateExercises() { return ExerciseRules.shuffle(ExerciseRules.pool(state)).slice(0,state.count); }
function answerInputs(index) { return Array.from(document.querySelectorAll('[data-exercise="'+index+'"]')).filter(input=>input.type!=='radio'||input.checked); }
function answerValues(index) { const values=answerInputs(index).map(input=>/^\d+$/.test(input.value)?Number(input.value):null); return values.length?values:[null]; }
function renderExercises() {
  $('#exercise-title').textContent='Spočítej a vyber výsledek. U odčítání přes desítku doplň rozklad.';
  $('#tip-text').textContent='Rozklad vyplňuj jen při odčítání přes desítku. Prvním krokem dojdi na 10.';
  $('#exercise-grid').innerHTML=state.exercises.map((e,index)=>{
    const sign=e.operation==='addition'?'+':e.operation==='multiplication'?'×':'−';
    const answers=e.type==='direct' ? '<div class="answer-choices" role="group" aria-label="Vyber výsledek">'+e.choices.map(n=>'<label class="answer-choice"><input type="radio" name="answer-'+index+'" data-exercise="'+index+'" value="'+n+'" aria-describedby="status-'+index+'"><span>'+n+'</span></label>').join('')+'</div>' : '<svg class="branches" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="M48 0 L34 12 M48 0 L62 12"/></svg><div class="answer-row"><span>'+e.a+'</span><span>−</span>'+inputMarkup(index,0,'První část rozkladu')+'<span>−</span>'+inputMarkup(index,1,'Druhá část rozkladu')+'<span>=</span>'+inputMarkup(index,2,'Výsledek')+'</div>';
    return '<article class="exercise" aria-label="Příklad '+(index+1)+'"><div class="equation"><span>'+e.a+'</span><span>'+sign+'</span><span class="operand">'+e.b+'</span><span>=</span><span class="question">?</span></div>'+answers+'<p class="exercise-status" id="status-'+index+'"></p></article>';
  }).join('');
}
function inputMarkup(index, part, label, maxLength = 2) {
  return `<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="${maxLength}" autocomplete="off" data-exercise="${index}" data-part="${part}" aria-label="Příklad ${index+1}: ${label}" aria-describedby="status-${index}">`;
}
function showProgress() {
  $('#series-badge').textContent = state.series;
  $('#series-progress').innerHTML = `<div class="dots" aria-hidden="true">${Array.from({length:6}, (_,i) => `<span class="dot ${i+1 < state.series || (state.completed && i+1 === state.series) ? 'done' : i+1 === state.series ? 'current' : ''}"></span>`).join('')}</div><p class="progress-label">${state.series} / 6${state.completed && state.series === 6 ? ' · Hotovo!' : ''}</p>`;
}
function syncControls() {
  document.querySelectorAll('[data-gender]').forEach(button => {
    const active = button.dataset.gender === preferences.gender;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('#range-options').hidden = state.operation === 'multiplication';
  $('#multiplication-range').hidden = state.operation !== 'multiplication';
  document.querySelectorAll('[data-multiplication-limit]').forEach(button => {
    const active = Number(button.dataset.multiplicationLimit) === state.multiplicationLimit;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  for (const property of ['operation', 'range', 'count']) {
    document.querySelectorAll(`[data-${property}]`).forEach(button => {
      const active = String(state[property]) === button.dataset[property];
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
}
function startNewSet(resetSeries = false) {
  if (resetSeries) state.series = 1;
  state.exercises = generateExercises();
  state.completed = false;
  state.page = 0;
  $('#feedback').textContent = '';
  $('#check').hidden = false;
  $('#next').hidden = true;
  renderExercises(); showProgress(); syncControls();
  window.UsageAnalytics?.activity('practice_start');
  scheduleLayout();
}
// Měříme skutečný prostor okna, nikoli rozlišení monitoru. Odpovědi zůstávají
// v DOM i na skrytých stránkách, takže otočení tabletu nic nevymaže.
let layoutFrame;
function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(fitExercisesToWindow);
}
function fitExercisesToWindow() {
  if (state.view !== 'math') return;
  const cards = Array.from(document.querySelectorAll('.exercise'));
  if (!cards.length) return;
  const focused = document.activeElement;
  const anchor = focused?.matches('.answer-row input') ? Number(focused.dataset.exercise) : state.page * state.pageSize;
  // Na telefonu zůstává vždy jeden příklad, i když je klávesnice zavřená.
  // Změna dostupné výšky tak nezobrazí další příklad pod klávesnicí.
  if (window.innerWidth <= 650) {
    state.pageSize = 1;
    showExercisePage(Math.min(anchor, state.count - 1));
    return;
  }
  cards.forEach(card => { card.hidden = false; });
  $('#exercise-pages').hidden = false;
  const grid = $('#exercise-grid');
  const gridStyle = getComputedStyle(grid);
  const columns = gridStyle.gridTemplateColumns.split(' ').length;
  const gap = parseFloat(gridStyle.rowGap) || 0;
  const cardHeight = Math.max(...cards.map(card => card.getBoundingClientRect().height));
  const gridRect = grid.getBoundingClientRect();
  const appRect = $('.app').getBoundingClientRect();
  // Rezerva zahrnuje navigaci stránek, feedback, spodní tlačítka i padding.
  const afterGrid = appRect.bottom - gridRect.bottom;
  const room = window.innerHeight - (gridRect.top + window.scrollY) - afterGrid - 8;
  const rows = Math.max(1, Math.floor((room + gap) / (cardHeight + gap)));
  state.pageSize = Math.min(state.count, columns * rows);
  state.page = Math.floor(Math.min(anchor, state.count - 1) / state.pageSize);
  showExercisePage(state.page);
}
function showExercisePage(page, focusFirst = false) {
  const pages = Math.ceil(state.count / state.pageSize);
  state.page = Math.max(0, Math.min(page, pages - 1));
  const first = state.page * state.pageSize;
  document.querySelectorAll('.exercise').forEach((card,index) => { card.hidden = index < first || index >= first + state.pageSize; });
  $('#exercise-pages').hidden = pages === 1;
  $('#page-label').textContent = state.pageSize === 1 ? `Příklad ${first + 1} z ${state.count}` : `Příklady ${first + 1}–${Math.min(first + state.pageSize,state.count)} z ${state.count}`;
  $('#page-back').disabled = state.page === 0;
  $('#page-forward').disabled = state.page === pages - 1;
  $('#check').innerHTML = state.page < pages - 1 ? state.pageSize === 1 ? 'Další příklad →' : 'Další příklady →' : '<span>✓</span> Zkontrolovat';
  if (focusFirst) document.querySelector(`[data-exercise="${first}"]`)?.focus({ preventScroll: true });
}
function validateAnswer(exercise,values) { return ExerciseRules.checks(exercise,values); }
function checkExerciseAnswers(start = 0, end = state.count) {
  let correctCount = 0;
  let firstIncorrect;
  for (let index = start; index < end; index++) {
    const exercise = state.exercises[index];
    const inputs = Array.from(document.querySelectorAll(`[data-exercise="${index}"]`));
    const values = answerValues(index);
    const checks = validateAnswer(exercise, values, state.range);
    inputs.forEach((input, part) => {
      input.classList.toggle('correct', checks[exercise.type === 'direct' ? 0 : part]);
      input.classList.toggle('incorrect', !checks[exercise.type === 'direct' ? 0 : part]);
      input.setAttribute('aria-invalid', String(!checks[exercise.type === 'direct' ? 0 : part]));
      if (!checks[exercise.type === 'direct' ? 0 : part] && !firstIncorrect) firstIncorrect = input;
    });
    const correct = checks.every(Boolean);
    if (correct) correctCount++;
    const card = inputs[0].closest('.exercise');
    card.classList.toggle('solved', correct);
    const question = card.querySelector('.question');
    if (question) question.textContent = checks.at(-1) ? exercise.result : '?';
    $(`#status-${index}`).textContent = correct ? '✓ Výborně!' : exercise.type === 'direct' ? values.includes(null) ? 'Vyber výsledek.' : 'Ještě zkus přepočítat příklad.' : values.includes(null) ? 'Doplň všechna tři políčka.' : !checks[0] || !checks[1] ? 'Zkus prvním krokem dojít na 10.' : 'Rozklad máš! Ještě přepočítej výsledek.';
    // Každý příklad započítáme při jeho první kontrole, i při stránkování.
    if (!exercise.checked) {
      exercise.checked = true;
      statistics.solved++;
      if (correct) { statistics.correct++; statistics.streak++; statistics.bestStreak = Math.max(statistics.bestStreak, statistics.streak); }
      else statistics.streak = 0;
    }
  }
  return { correctCount, firstIncorrect };
}
function checkSelectedAnswer(index) {
  if (state.completed) return;
  checkExerciseAnswers(index, index + 1);
  saveStatistics();
}
$('#exercise-grid').addEventListener('change', event => {
  if (event.target.matches('input[type="radio"][data-exercise]')) {
    checkSelectedAnswer(Number(event.target.dataset.exercise));
  }
});
function goToNextExercisePage() {
  const lastPage = Math.ceil(state.count / state.pageSize) - 1;
  if (state.page >= lastPage) return;
  if (!state.completed) {
    const start = state.page * state.pageSize;
    const end = Math.min(start + state.pageSize, state.count);
    const { firstIncorrect } = checkExerciseAnswers(start, end);
    saveStatistics();
    if (firstIncorrect) {
      $('#feedback').textContent = 'Ještě oprav označená políčka. Potom můžeš pokračovat.';
      firstIncorrect.focus({ preventScroll: true });
      return;
    }
  }
  $('#feedback').textContent = '';
  showExercisePage(state.page + 1, true);
}
function checkAnswers() {
  if (state.completed) return;
  const { correctCount, firstIncorrect } = checkExerciseAnswers();
  if (correctCount === state.count) {
    state.completed = true;
    statistics.completedSets++;
    window.UsageAnalytics?.activity('practice_complete');
    const praise = ['Skvělé! Všechno správně! 🎉', 'Paráda! To se povedlo!', 'Výborně! Jen tak dál!'];
    $('#feedback').textContent = state.series === 6 ? 'Hotovo! Celé cvičení je za tebou! 🎉' : praise[Math.floor(Math.random()*praise.length)];
    $('#check').hidden = true;
    $('#next').hidden = false;
    $('#next').textContent = state.series === 6 ? 'Nové cvičení →' : 'Další série →';
    document.querySelectorAll('[data-exercise]').forEach(input => { if(input.type==='radio') input.disabled=true; else input.readOnly = true; });
    showProgress();
    $('#next').focus();
  } else {
    $('#feedback').textContent = `Správně ${correctCount} z ${state.count}. Skoro! Zkus opravit označená políčka.`;
    if (firstIncorrect) {
      showExercisePage(Math.floor(Number(firstIncorrect.dataset.exercise) / state.pageSize));
      firstIncorrect.focus();
    }
  }
  saveStatistics();
}
function showView(view) {
  window.BattleGame?.show(view === "battle");
  state.view = view;
  updateKeyboardLayout();
  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('#math-view').hidden = view !== 'math';
  $('#settings-view').hidden = view !== 'settings';
  $('#secondary-view').hidden = view === 'math' || view === 'settings' || view === 'battle';
  if (view === 'battle') return;
  if (view === 'math') { scheduleLayout(); return; }
  if (view === 'settings') {
    syncControls();
    $('#large-text').checked = Boolean(preferences.largeText);
    $('#settings-view').focus();
    return;
  }
  const panel = $('#secondary-view');
  if (view === 'stats') {
    const stats = [['Dokončené sady',statistics.completedSets],['Vyřešené příklady',statistics.solved],['Správně napoprvé',statistics.correct],['Úspěšnost',`${statistics.solved ? Math.round(statistics.correct/statistics.solved*100) : 0} %`],['Nejlepší série bez chyby',statistics.bestStreak],['Poslední počítání',statistics.lastUsed ? statistics.lastUsed.split('-').reverse().join('. ') : 'Zatím žádné']];
    panel.innerHTML = `<h2>Moje pokroky</h2><p>Každý příklad je krok dopředu. Jen tak dál!</p><div class="stat-grid">${stats.map(([label,value])=>`<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><p>Vyřešené příklady a úspěšnost počítáme z první kontroly každého příkladu. Dokončená sada se započítá i po opravě. Nejlepší série je počet příkladů správně napoprvé za sebou.</p>`;
  } else if (view === 'rewards') {
    const rewards = getRewards();
    panel.innerHTML = `<h2>Moje odměny</h2><p>Za dokončené sady sbíráš 10 odměn. Počítá se i sada, kterou opravíš! Nejvyšší titul získáš za 60 dokončených sad.</p><div class="reward-grid">${rewards.map(([icon,title,target],index)=>`<div class="reward ${statistics.completedSets>=target?'earned':''} ${index===rewards.length-1?'royal-reward':''}"><div class="medal">${icon}</div><h3>${title}</h3><p>${index===rewards.length-1?'Nejvyšší odměna · ':''}${statistics.completedSets>=target?'✓ Odznak je tvůj!':`${Math.min(statistics.completedSets,target)} / ${target} dokončených sad`}</p></div>`).join('')}</div>`;
  }
  panel.insertAdjacentHTML('beforeend','<button class="back-button">← Zpět na počítání</button>');
  panel.querySelector('.back-button').addEventListener('click',()=>showView('math'));
  panel.focus();
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
$('#settings-back').addEventListener('click',()=>showView('math'));
document.querySelectorAll('[data-gender]').forEach(button => button.addEventListener('click', () => {
  preferences.gender = button.dataset.gender;
  savePreferences();
  syncControls();
}));
document.querySelectorAll('[data-multiplication-limit]').forEach(button => button.addEventListener('click', () => {
  const limit = Number(button.dataset.multiplicationLimit);
  if (state.multiplicationLimit === limit) return;
  state.multiplicationLimit = limit;
  savePreferences();
  startNewSet(true);
}));
$('#large-text').addEventListener('change', event => {
  preferences.largeText = event.target.checked;
  document.body.classList.toggle('large-text', preferences.largeText);
  savePreferences();
});
for (const property of ['operation','range','count']) {
  document.querySelectorAll(`[data-${property}]`).forEach(button=>button.addEventListener('click',()=>{
    const value = property==='operation' ? button.dataset[property] : Number(button.dataset[property]);
    if (state[property]===value) return;
    state[property]=value; savePreferences(); startNewSet(true);
  }));
}
$('#exercise-form').addEventListener('submit',event=>{
  event.preventDefault();
  if (state.page < Math.ceil(state.count / state.pageSize) - 1) goToNextExercisePage();
  else checkAnswers();
});
$('#page-back').addEventListener('click',()=>showExercisePage(state.page - 1));
$('#page-forward').addEventListener('click',goToNextExercisePage);
// Safari mění při otevření klávesnice visualViewport, nikoli vždy innerHeight.
// Celé cvičení i akce držíme společně ve skutečně viditelné části stránky.
// Porovnáváme s viditelnou výškou bez klávesnice, ne s innerHeight:
// Safari do rozdílu innerHeight započítává i vlastní horní a spodní lišty.
let keyboardBaseline = window.visualViewport?.height || window.innerHeight || 0;
let keyboardWidth = window.innerWidth;
let keyboardDismissed = false;
function updateKeyboardLayout() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  if (keyboardWidth !== window.innerWidth) {
    keyboardWidth = window.innerWidth;
    keyboardBaseline = viewport.height;
  }
  if (viewport.scale === 1) keyboardBaseline = Math.max(keyboardBaseline, viewport.height);
  const active = document.activeElement;
  const editing = Boolean(active?.matches('.answer-row input') && !active.readOnly);
  const keyboardOpen = !keyboardDismissed && editing && state.view === 'math' && window.innerWidth <= 650
    && viewport.scale === 1 && keyboardBaseline - viewport.height > Math.max(180, keyboardBaseline * 0.25);
  document.body.classList.toggle('keyboard-open', keyboardOpen);
  if (keyboardOpen) {
    document.body.style.setProperty('--keyboard-view-top', `${viewport.offsetTop + 6}px`);
    document.body.style.setProperty('--keyboard-view-height', `${Math.max(0, viewport.height - 18)}px`);
  } else {
    document.body.style.removeProperty('--keyboard-view-top');
    document.body.style.removeProperty('--keyboard-view-height');
  }
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateKeyboardLayout);
  window.visualViewport.addEventListener('scroll', updateKeyboardLayout);
}
window.addEventListener('resize',()=>{
  updateKeyboardLayout();
  // Mobilní klávesnice nemá za běhu přehazovat právě vyplňovaný příklad.
  if (!document.activeElement?.matches('.answer-row input')) scheduleLayout();
});
$('#exercise-grid').addEventListener('focusin', () => {
  keyboardDismissed = false;
  updateKeyboardLayout();
});
$('#exercise-grid').addEventListener('focusout', () => {
  scheduleLayout();
  requestAnimationFrame(updateKeyboardLayout);
});
window.addEventListener('pageshow', updateKeyboardLayout);
$('#keyboard-exit').addEventListener('click', () => {
  keyboardDismissed = true;
  document.activeElement?.blur();
  updateKeyboardLayout();
  requestAnimationFrame(() => window.scrollTo({top:0,behavior:'instant'}));
});
$('#exercise-grid').addEventListener('input',event=>{
  if (!event.target.matches('input')) return;
  if (event.target.type !== 'radio') event.target.value=event.target.value.replace(/[^0-9]/g,'').slice(0,event.target.maxLength);
  document.querySelectorAll(`[data-exercise="${event.target.dataset.exercise}"]`).forEach(input=>{
    input.classList.remove('correct','incorrect');input.removeAttribute('aria-invalid');
  });
  const card=event.target.closest('.exercise');
  card.classList.remove('solved');
  card.querySelector('.exercise-status').textContent='';
  const question = card.querySelector('.question');
  if (question) question.textContent='?';
  $('#feedback').textContent='';
});
$('#new-set').addEventListener('click',()=>startNewSet(state.completed && state.series===6));
$('#next').addEventListener('click',()=>{state.series=state.series===6?1:state.series+1;startNewSet();document.querySelector('[data-exercise]')?.focus();});
document.body.classList.toggle('large-text',Boolean(preferences.largeText));
saveStatistics();startNewSet();showView('math');


// Read-only bridge: battle always uses the current application preferences.
window.AppSettings = { getPreferences() { return { gender: preferences.gender, operation: preferences.operation, range: preferences.range, multiplicationLimit: preferences.multiplicationLimit, count: preferences.count, largeText: preferences.largeText }; } };
