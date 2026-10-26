'use strict';
(() => {
 const root=document.querySelector('#chess-view');
 const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 const names={k:'král',q:'dáma',r:'věž',b:'střelec',n:'jezdec',p:'pěšec'};
 const pieceOrder={k:0,q:1,r:2,b:3,n:4,p:5};
 function piece(code){const white=code===code.toUpperCase();return `<span class="chess-piece chess-3d ${white?'ivory':'navy'}" style="background-position:${pieceOrder[code.toLowerCase()]*20}% ${white?0:100}%" aria-hidden="true"></span>`;}
 const $=s=>root.querySelector(s);
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let mounted=false,shown=false,epoch=0,timer=null,queue=Promise.resolve(),polling=false,busy=false,game=null,gameId=null,owner=null,selected=null,flipped=false,roving='e2',signature='',searchTimer=null,promotion=null;
 let pcGame=null,pcThinking=false,pcTask=0,fitFrame=0,clockReceivedAt=0,clockInterval=null,lastFlagRefresh=0,finishedDismissed=false;
 function mount() {
  if(mounted)return;mounted=true;
  root.innerHTML=`<div class="chess-heading"><div><p class="chess-eyebrow">MALÁ ŠACHOVÁ DOBRODRUŽSTVÍ</p><h2>Šachy <span>♞</span></h2><p>Najdi spoluhráče a zahrajte si spolu.</p></div><div class="chess-heading-tools"><span class="chess-live" id="chess-connection">Herna</span><button type="button" id="chess-ranking">♜ Šachový žebříček</button><button type="button" id="chess-fullscreen">⛶ Celá obrazovka</button></div></div>
   <div id="chess-notice" role="status" aria-live="polite"></div>
   <div class="chess-layout"><section class="chess-board-card panel" aria-label="Šachová partie"><div class="chess-player"><span class="chess-avatar">♟</span><div><strong id="chess-opponent">Černé figurky</strong><small id="chess-opponent-detail">Připravené ke hře</small></div><span id="chess-clock-top" class="chess-clock" role="timer" aria-live="off">10:00</span><button type="button" id="chess-flip" aria-label="Otočit šachovnici">↻ Otočit</button></div>
   <div id="chess-board" role="grid" aria-label="Šachovnice"></div><div class="chess-turn" id="chess-turn" role="status">Bílý začíná. Vyber si spoluhráče.</div><div class="chess-player"><span class="chess-avatar ivory">♙</span><div><strong id="chess-you">Bílé figurky</strong><small id="chess-you-detail">Každý tah je nový nápad.</small></div><span id="chess-clock-bottom" class="chess-clock" role="timer" aria-live="off">10:00</span></div>
   <div id="chess-game-actions" class="chess-actions" hidden><button type="button" id="chess-draw">Nabídnout remízu</button><button type="button" id="chess-claim" hidden>Nárokovat remízu</button><button type="button" id="chess-resign">Vzdát partii</button></div><div id="chess-draw-answer" class="chess-invite" hidden><p>Soupeř nabízí remízu.</p><button type="button" data-game-action="draw_accept">Přijmout remízu</button><button type="button" data-game-action="draw_decline">Pokračovat ve hře</button></div><button type="button" id="chess-lobby" hidden>Zpět do herny</button></section>
   <aside class="chess-sidebar"><section class="panel chess-card chess-pc-card"><h3>Nová partie</h3><label class="chess-time-label">Čas pro každého hráče<select id="chess-time"><option value="300">5 minut</option><option value="600" selected>10 minut</option><option value="900">15 minut</option><option value="0">Bez limitu</option></select></label><p class="chess-muted">Čas platí pro novou pozvánku i novou partii s PC.</p><details id="chess-pc-options"><summary>Hrát s počítačem</summary><form id="chess-pc-form"><label>Obtížnost<select id="chess-pc-level"><option value="1">Lehká</option><option value="2" selected>Střední</option><option value="3">Těžší</option></select></label><label>Tvoje figurky<select id="chess-pc-side"><option value="w">Bílé – začínáš</option><option value="b">Černé – začíná PC</option></select></label><button type="submit" id="chess-pc-start">Nová partie s PC</button><button type="button" id="chess-pc-resume" hidden>Pokračovat s PC</button><button type="button" id="chess-online" hidden>Online herna</button></form></details></section><section class="panel chess-card" data-chess-online><h3>Hráči online <span id="chess-online-count">0</span></h3><p class="chess-muted">Hráči, kteří mají právě otevřenou hernu.</p><div id="chess-login" hidden><p>Přihlas se stejným účtem jako do Počítáme. Pak můžeš pozvat kamaráda nebo vybrat hráče online.</p><button type="button" class="primary" id="chess-login-button">Přihlásit se</button></div><form id="chess-search-form"><label for="chess-search">Přezdívka hráče</label><div class="chess-search"><input id="chess-search" type="search" maxlength="24" placeholder="Napiš přezdívku…" autocomplete="off"><button type="submit">Pozvat</button></div></form><div id="chess-players" class="chess-player-list"></div></section>
   <section class="panel chess-card" data-chess-online><h3>Pozvánky</h3><p class="chess-muted">Pozvánka platí 5 minut. Barvy figurek se losují.</p><div id="chess-invites"></div></section></aside></div>
   <details class="panel chess-rules"><summary>Jak se hrají šachy? <span>Figurky a pravidla</span></summary><div class="chess-piece-guide">${[['K','Král','O jedno pole kterýmkoli směrem. Nesmí vstoupit do šachu.'],['Q','Dáma','Po řadách, sloupcích i úhlopříčkách.'],['R','Věž','Po řadách a sloupcích.'],['B','Střelec','Po úhlopříčkách.'],['N','Jezdec','Do tvaru L: dvě pole a jedno stranou. Může přeskakovat figurky.'],['P','Pěšec','Vpřed o jedno pole, z výchozího místa může o dvě. Bere šikmo vpřed.']].map(([p,n,t])=>`<div>${piece(p)}<h4>${n}</h4><p>${t}</p></div>`).join('')}</div><div class="chess-rule-text"><p><strong>Cíl hry:</strong> dát soupeřovu králi mat. Bílý začíná, potom se v tazích střídáte. V šachu musíš svého krále zachránit. Není-li žádný únik, je to mat. Král se nebere.</p><p><strong>Rošáda:</strong> společný tah krále a věže, pokud se ještě nehýbali, mezi nimi nic nestojí a král není v šachu ani neprochází napadeným polem. Vyber krále a jeho cílové pole.</p><p><strong>Braní mimochodem:</strong> pěšec může bezprostředně po soupeřově dvojkroku sebrat jeho pěšce, jako by postoupil jen o jedno pole. <strong>Proměna:</strong> na poslední řadě si pěšce vyměníš za dámu, věž, střelce nebo jezdce.</p><p><strong>Remíza:</strong> dohodou, patem nebo při nedostatku materiálu k matu. Na svém tahu můžeš nárokovat remízu, když se současná pozice objevila alespoň třikrát nebo uběhlo 50 tahů obou stran bez tahu pěšce a braní. Po pěti opakováních nebo 75 takových tazích skončí partie automaticky remízou; mat má přednost.</p><p><strong>Hodiny:</strong> 5, 10 nebo 15 minut pro každého hráče, případně bez limitu. Od začátku partie běží čas bílému a po každém platném tahu se přepne. Bez přídavku za tah. Časovaná partie běží i při výpadku nebo zavření stránky; po vypršení času prohraješ, pokud soupeř může dát mat. Režim bez limitu umožňuje pokračovat kdykoliv. Šachy mají vlastní partie a nemění body za počítání.</p></div></details>
   <dialog id="chess-ranking-dialog" aria-labelledby="chess-ranking-title"><h3 id="chess-ranking-title">Šachový žebříček</h3><p>Výhra 1 bod · remíza ½ bodu · prohra 0 bodů. Celkové výsledky dokončených online partií; hry proti PC se nezapočítávají.</p><div id="chess-ranking-content" role="status"></div><button type="button" id="chess-ranking-refresh">Obnovit</button><button type="button" id="chess-ranking-close">Zavřít</button></dialog>
   <dialog id="chess-promotion" aria-labelledby="chess-promotion-title"><h3 id="chess-promotion-title">Na co proměníš pěšce?</h3><div class="chess-promotion-options"></div><button type="button" id="chess-promotion-cancel">Zrušit tah</button></dialog><dialog id="chess-resign-dialog" aria-labelledby="chess-resign-title"><h3 id="chess-resign-title">Opravdu chceš vzdát partii?</h3><p>Soupeř tím vyhraje. U časované partie hodiny běží i po zavření stránky.</p><button type="button" id="chess-resign-cancel">Pokračovat</button><button type="button" id="chess-resign-confirm">Vzdát partii</button></dialog>`;
  $('#chess-search-form').addEventListener('submit',e=>{e.preventDefault();act('invite',{nickname:$('#chess-search').value.trim()});});
  $('#chess-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>refresh(),250);});
  $('#chess-ranking').onclick=showRanking;$('#chess-ranking-refresh').onclick=loadRanking;$('#chess-ranking-close').onclick=()=>$('#chess-ranking-dialog').close();
  $('#chess-time').addEventListener('change',tickClocks);
  $('#chess-pc-form').addEventListener('submit',event=>{event.preventDefault();useComputer(true);});
  $('#chess-pc-resume').onclick=()=>useComputer(false);$('#chess-online').onclick=onlineMode;
  $('#chess-fullscreen').onclick=fullscreen;
  $('#chess-flip').onclick=()=>{flipped=!flipped;drawGame();};
  $('#chess-login-button').onclick=()=>window.ChessSession.login();
  $('#chess-draw').onclick=()=>act('draw_offer');$('#chess-claim').onclick=()=>act('claim_draw');
  $('#chess-resign').onclick=()=>$('#chess-resign-dialog').showModal();
  $('#chess-resign-cancel').onclick=()=>$('#chess-resign-dialog').close();
  $('#chess-resign-confirm').onclick=()=>{$('#chess-resign-dialog').close();act('resign');};
  $('#chess-lobby').onclick=()=>{if(pcGame){onlineMode();return;}gameId=null;game=null;finishedDismissed=true;selected=null;signature='';drawGame();refresh();};
  $('#chess-promotion-cancel').onclick=()=>{$('#chess-promotion').close();promotion=null;};
  root.addEventListener('click',event=>{
   const invite=event.target.closest('[data-invite-op]');if(invite)act(invite.dataset.inviteOp,{inviteId:invite.dataset.inviteId});
   const player=event.target.closest('[data-chess-player]');if(player)act('invite',{nickname:player.dataset.chessPlayer});
   const action=event.target.closest('[data-game-action]');if(action)act(action.dataset.gameAction);
  });
  $('#chess-board').addEventListener('click',e=>{const button=e.target.closest('[data-square]');if(button)choose(button.dataset.square);});
  $('#chess-board').addEventListener('keydown',e=>{
   const button=e.target.closest('[data-square]'),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[e.key];if(!button||!offset)return;e.preventDefault();
   const buttons=[...$('#chess-board').querySelectorAll('button')],index=buttons.indexOf(button),next=index+offset;
   if(next<0||next>=64||Math.abs(offset)===1&&Math.floor(index/8)!==Math.floor(next/8))return;
   button.tabIndex=-1;buttons[next].tabIndex=0;roving=buttons[next].dataset.square;buttons[next].focus({preventScroll:true});
  });
 }
 function boardMap() {
  const map={};let rank=8,file=0;
  for(const c of (game?.fen||START).split(' ')[0]){if(c==='/'){rank--;file=0;}else if(/[1-8]/.test(c))file+=Number(c);else map['abcdefgh'[file++]+rank]=c;}
  return map;
 }
 function drawBoard() {
  const map=boardMap(),black=(game?.you==='b')!==flipped,files=[...'abcdefgh'],ranks=[8,7,6,5,4,3,2,1];if(black){files.reverse();ranks.reverse();}
  const targets=game?.legal.filter(m=>m.from===selected).map(m=>m.to)||[],last=game?.moves.at(-1);
  const focused=$('#chess-board').contains(document.activeElement)?document.activeElement.dataset.square:null;
  $('#chess-board').innerHTML=ranks.map((rank,row)=>files.map((file,col)=>{
   const square=file+rank,p=map[square],color=p===p?.toUpperCase()?'bílý':'černý',label=p?`${color} ${names[p.toLowerCase()]}`:'prázdné pole';
   return `<button type="button" class="chess-square ${(file.charCodeAt(0)-97+rank)%2?'dark':'light'} ${square===selected?'selected':''} ${targets.includes(square)?'legal':''} ${last&&(last.from===square||last.to===square)?'last-move':''} ${p?.toLowerCase()==='k'&&game?.check&&(p===p.toUpperCase()?'w':'b')===game.turn?'king-check':''}" data-square="${square}" aria-label="${square}, ${label}" aria-pressed="${square===selected}" tabindex="${square===roving?0:-1}">${p?piece(p):''}${col===0?`<span class="chess-coordinate rank">${rank}</span>`:''}${row===7?`<span class="chess-coordinate file">${file}</span>`:''}${targets.includes(square)?'<span class="chess-target" aria-hidden="true"></span>':''}</button>`;
  }).join('')).join('');
  if(focused)$('#chess-board').querySelector(`[data-square="${focused}"]`)?.focus({preventScroll:true});
 }
 function drawGame() {
  drawBoard();updateMode();const active=game?.status==='active',black=(game?.you==='b')!==flipped;
  const avatars=root.querySelectorAll('.chess-player .chess-avatar');avatars[0].classList.toggle('ivory',black);avatars[1].classList.toggle('ivory',!black);avatars[0].textContent=black?'♙':'♟';avatars[1].textContent=black?'♟':'♙';
  $('#chess-opponent').textContent=game?(black?game.white:game.black):'Černé figurky';
  $('#chess-you').textContent=game?(black?game.black:game.white):'Bílé figurky';
  $('#chess-opponent-detail').textContent=game?(black?'Bílé figurky':'Černé figurky'):'Připravené ke hře';
  $('#chess-you-detail').textContent=game?`Hraješ za ${game.you==='w'?'bílé':'černé'} • ${game.clock?game.clock.limitSeconds/60+' minut':'bez limitu'}`:'Každý tah je nový nápad.';
  let status=game?(game.turn===game.you?'Jsi na tahu. Vyber figurku.':'Na tahu je soupeř.'):'Bílý začíná. Vyber si spoluhráče.';
  if(pcGame&&active&&game.turn!==game.you)status=pcThinking?'Počítač přemýšlí…':'Na tahu je počítač. Stiskni Pokračovat s PC.';
  if(game?.check&&active)status=game.turn===game.you?'Šach! Zachraň svého krále.':'Soupeř je v šachu.';
  if(game&&!active){const reasons={checkmate:'Mat',stalemate:'Pat',material:'Nedostatek materiálu',resigned:'Vzdání partie',agreement:'Dohodnutá remíza',fifty:'Pravidlo 50 tahů',threefold:'Třikrát stejná pozice',fivefold:'Pětkrát stejná pozice',seventyfive:'Pravidlo 75 tahů',timeout:'Vypršel čas',timeout_draw:'Vypršel čas, soupeř nemůže dát mat'};status=(game.winner===null?'Remíza.':game.winner===game.you?'Vyhrál/a jsi!':'Vyhrál soupeř.')+' '+(reasons[game.reason]||'Partie skončila')+'.';}
  $('#chess-turn').textContent=status;$('#chess-game-actions').hidden=!active;$('#chess-lobby').hidden=!game||active;
  $('#chess-draw').hidden=!!pcGame;
  $('#chess-draw').disabled=busy||game?.drawOffer!=null;$('#chess-draw').textContent=game?.drawOffer==='you'?'Remíza nabídnuta':'Nabídnout remízu';
  $('#chess-claim').hidden=!game?.canClaimDraw;$('#chess-draw-answer').hidden=!active||game.drawOffer!=='opponent';
  tickClocks();scheduleFit();
 }
 function choose(square) {
  if(busy||!game||game.status!=='active'||game.turn!==game.you)return;
  const moves=game.legal.filter(m=>m.from===selected&&m.to===square);
  if(moves.length){
   if(moves.some(m=>m.promotion)){
    promotion={from:selected,to:square};const white=game.you==='w';
    $('.chess-promotion-options').innerHTML=moves.map(m=>`<button type="button" data-promotion="${m.promotion}" aria-label="${names[m.promotion]}">${piece(white?m.promotion.toUpperCase():m.promotion)}<span>${names[m.promotion]}</span></button>`).join('');
    $('.chess-promotion-options').querySelectorAll('button').forEach(button=>button.onclick=()=>{const move={...promotion,promotion:button.dataset.promotion};$('#chess-promotion').close();promotion=null;act('move',move);});$('#chess-promotion').showModal();
   }else act('move',{from:selected,to:square,promotion:null});return;
  }
  selected=game.legal.some(m=>m.from===square)&&selected!==square?square:null;roving=square;drawBoard();
 }
 function notice(text,error=false){$('#chess-notice').textContent=text;$('#chess-notice').classList.toggle('error',error);}
 function receive(data) {
  clockReceivedAt=performance.now();const next=data.game;if(next?.status==='active')finishedDismissed=false;const nextSignature=next?next.id+':'+next.revision:'preview';
  if(signature!==nextSignature){selected=null;promotion=null;if($('#chess-promotion').open)$('#chess-promotion').close();game=next;gameId=next?.id||null;signature=nextSignature;drawGame();}
  else game=next;
  tickClocks();
  $('#chess-online-count').textContent=data.players.filter(p=>p.online).length;
  $('#chess-players').innerHTML=data.players.length?data.players.map(p=>`<div class="chess-person"><span class="chess-user-avatar">${esc(p.nickname[0].toUpperCase())}</span><span class="chess-dot ${p.online?'online':''}"></span><div><strong>${esc(p.nickname)}</strong><small>${p.playing?'Rozehraná partie':p.online?'Online':'Právě není v herně'}</small></div><button type="button" data-chess-player="${esc(p.nickname)}" ${busy||game?.status==='active'||p.playing?'disabled':''}>Pozvat</button></div>`).join(''):'<p class="chess-muted">'+($('#chess-search').value.trim()?'Žádný hráč s touto přezdívkou.':'Právě tu není další hráč. Pozvi kamaráda podle přezdívky.')+'</p>';
  $('#chess-invites').innerHTML=data.invites.length?data.invites.map(i=>`<div class="chess-invite"><p><strong>${esc(i.nickname)}</strong> ${i.incoming?'tě zve ke hře.':'čeká na pozvánku.'}<small>${i.timeSeconds?i.timeSeconds/60+' minut na hráče':'Bez limitu'}</small></p>${i.incoming?`<button type="button" data-invite-op="accept" data-invite-id="${i.id}">Přijmout</button><button type="button" data-invite-op="decline" data-invite-id="${i.id}">Odmítnout</button>`:`<button type="button" data-invite-op="cancel" data-invite-id="${i.id}">Zrušit pozvánku</button>`}</div>`).join(''):'<p class="chess-muted">Zatím žádné pozvánky.</p>';
 }
 function request(payload) {const result=queue.catch(()=>{}).then(()=>window.ChessSession.request(payload));queue=result;return result;}
 function payload(op,extra={}) {return {op,resumeLatest:!finishedDismissed,...(op==='invite'?{timeSeconds:Number($('#chess-time').value)}:{}),search:$('#chess-search').value.trim(),...(gameId?{gameId}:{}),...extra};}
 function current(token,user){return !pcGame&&shown&&token===epoch&&window.ChessSession.user()?.id===user;}
 async function refresh() {
  clearTimeout(timer);if(pcGame||!shown||document.hidden||busy||polling||!window.ChessSession.user())return;
  const token=epoch,user=window.ChessSession.user().id;polling=true;
  try{const data=await request(payload('state'));if(current(token,user)){receive(data);$('#chess-connection').textContent='● Připojeno';if($('#chess-notice').classList.contains('error'))notice('');}}
  catch(error){if(current(token,user)){$('#chess-connection').textContent='Znovu připojuji…';notice(error.message+' Zkus to za chvíli znovu.',true);}}
  finally{polling=false;if(shown&&window.ChessSession.user())timer=setTimeout(refresh,current(token,user)?2500:0);}
 }
 async function act(op,extra={}) {
  if(pcGame){computerAction(op,extra);return;}
  if(busy||!window.ChessSession.user())return;
  const token=epoch,user=window.ChessSession.user().id,submittedGame=game?.id;
  const body=payload(op,{...(game?{revision:game.revision}:{}),...extra,...(op==='move'?{requestId:crypto.randomUUID().replaceAll('-','')}: {})});
  busy=true;root.setAttribute('aria-busy','true');notice('');
  try{const data=await request(body);if(current(token,user)){receive(data);notice(op==='invite'?'Pozvánka odeslaná. Platí 5 minut.':'');}}
  catch(error){if(current(token,user)){notice(error.message,true);if(submittedGame)gameId=submittedGame;}}
  finally{busy=false;root.removeAttribute('aria-busy');if(shown&&window.ChessSession.user()){if(current(token,user))drawGame();clearTimeout(timer);timer=setTimeout(refresh,100);}}
 }
 function clockText(ms){const seconds=Math.ceil(Math.max(0,ms)/1000);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
 function tickClocks(){
  if(!mounted||!shown)return;
  if(pcGame&&pcGame.checkTimeout()){stopComputer();pcGame.save(storageKey());game=pcGame.snapshot;drawGame();return;}
  const clock=pcGame?pcGame.clockSnapshot():game?.clock;
  const black=(game?.you==='b')!==flipped,colors=black?['w','b']:['b','w'];
  let zero=false;
  for(let i=0;i<2;i++){
   const element=$(i?'#chess-clock-bottom':'#chess-clock-top'),color=colors[i];let ms=clock?(color==='w'?clock.whiteMs:clock.blackMs):0;
   if(clock&&!pcGame&&clock.active===color&&game?.status==='active')ms=Math.max(0,ms-(performance.now()-clockReceivedAt));
   const text=clock?clockText(ms):game?'∞':Number($('#chess-time').value)?clockText(Number($('#chess-time').value)*1000):'∞';
   if(element.textContent!==text)element.textContent=text;
   element.classList.toggle('running',!!clock&&clock.active===color&&game?.status==='active');element.classList.toggle('low',!!clock&&ms<30000);element.setAttribute('aria-label',(color==='w'?'Čas bílých: ':'Čas černých: ')+text);
   if(clock&&clock.active===color&&ms<=0)zero=true;
  }
  if(zero&&!pcGame&&game?.status==='active'&&performance.now()-lastFlagRefresh>1000){lastFlagRefresh=performance.now();refresh();}
 }
 async function showRanking(){ $('#chess-ranking-dialog').showModal();await loadRanking(); }
 async function loadRanking(){
  const target=$('#chess-ranking-content');
  if(!window.ChessSession.user()){target.textContent='Pro zobrazení online žebříčku se přihlas.';return;}
  target.textContent='Načítám žebříček…';const token=epoch;
  try{const data=await request({op:'leaderboard'});if(token!==epoch||!shown)return;const ranking=data.leaderboard;
   if(!ranking.entries.length){target.textContent='Zatím není dokončená žádná online partie. První body můžete získat vy.';return;}
   target.innerHTML='<div class="chess-ranking-scroll"><table><thead><tr><th>Pořadí</th><th>Hráč</th><th>Body</th><th>Výhry</th><th>Remízy</th><th>Prohry</th></tr></thead><tbody>'+ranking.entries.map(r=>`<tr class="${r.mine?'mine':''}"><td>${r.rank}.</td><td>${esc(r.nickname)}</td><td><strong>${String(r.points).replace('.',',')}</strong></td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td></tr>`).join('')+'</tbody></table></div>'+(ranking.total>100?'<p>Nejlepších 100 hráčů z '+ranking.total+'.</p>':'')+(ranking.mine?`<p>Tvoje pořadí: <strong>${ranking.mine.rank}.</strong> · Body: ${String(ranking.mine.points).replace('.',',')} · Partie: ${ranking.mine.played}.</p>`:'<p>Zatím nemáš dokončenou online partii.</p>');
  }catch(error){target.textContent=error.message;}
 }
 function storageKey(){return 'pocitame-chess-computer-'+(window.ChessSession.user()?.id||'guest');}
 function savedMode(){try{return localStorage.getItem(storageKey()+':mode');}catch{return null;}}
 function rememberMode(mode){try{localStorage.setItem(storageKey()+':mode',mode);}catch{}}
 function updateMode(){
  for(const card of root.querySelectorAll('[data-chess-online]'))card.hidden=!!pcGame;
  $('#chess-online').hidden=!pcGame;
  try{$('#chess-pc-resume').hidden=!localStorage.getItem(storageKey());}catch{$('#chess-pc-resume').hidden=true;}
 }
 function stopComputer(){pcTask++;pcGame?.stop();pcThinking=false;}
 async function useComputer(newGame){
  stopComputer();clearTimeout(timer);const token=++epoch;notice('Připravuji počítačového soupeře…');$('#chess-pc-start').disabled=true;
  try{
   const {ComputerGame}=await import('./assets/chess/computer-game.js?v=clock-3');
   if(!shown||token!==epoch)return;
   pcGame=!newGame?ComputerGame.restore(storageKey()):null;
   if(!pcGame)pcGame=new ComputerGame({side:$('#chess-pc-side').value,level:Number($('#chess-pc-level').value),timeSeconds:Number($('#chess-time').value)});
   $('#chess-pc-side').value=pcGame.side;$('#chess-pc-level').value=pcGame.level;
   $('#chess-pc-options').open=true;game=pcGame.snapshot;gameId=null;signature='';selected=null;flipped=false;rememberMode('pc');pcGame.save(storageKey());notice('');$('#chess-connection').textContent='● Hra proti PC';drawGame();runComputer();
  }catch(error){if(shown&&token===epoch){rememberMode('online');notice('Počítačového soupeře se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.',true);}}
  finally{$('#chess-pc-start').disabled=false;}
 }
 function onlineMode(){$('#chess-pc-options').open=false;finishedDismissed=false;stopComputer();pcGame=null;game=null;gameId=null;selected=null;signature='';rememberMode('online');show(true);}
 function computerAction(op,extra){
  if(op==='move'&&pcThinking)return;
  stopComputer();
  try{pcGame.action(op,extra);game=pcGame.snapshot;selected=null;if(!pcGame.save(storageKey()))notice('Prohlížeč nepovolil uložit tuto partii.',true);else notice('');drawGame();runComputer();}
  catch(error){game=pcGame.snapshot;pcGame.save(storageKey());notice(error.message,true);drawGame();}
 }
 async function runComputer(){
  if(!pcGame||!shown||(document.hidden&&!pcGame.timeSeconds)||pcThinking||pcGame.snapshot.status!=='active'||pcGame.engine.turn()===pcGame.side)return;
  const session=pcGame,task=++pcTask,saveKey=storageKey();pcThinking=true;drawGame();
  try{await session.think();if(pcGame===session&&task===pcTask){game=session.snapshot;session.save(saveKey);}}
  catch(error){if(pcGame===session&&task===pcTask)notice(error.message,true);}
  finally{if(pcGame===session&&task===pcTask){pcThinking=false;game=session.snapshot;if(shown)drawGame();}}
 }
 async function fullscreen(){
  if(document.fullscreenElement===root){await document.exitFullscreen();return;}
  if(root.classList.contains('chess-focus')){root.classList.remove('chess-focus');$('#chess-fullscreen').textContent='⛶ Celá obrazovka';scheduleFit();return;}
  try{if(root.requestFullscreen){await root.requestFullscreen();return;}}catch{}
  root.classList.add('chess-focus');$('#chess-fullscreen').textContent='⛶ Zpět';scheduleFit();
 }
 function scheduleFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitBoard);}
 function fitBoard(){
  if(!shown)return;
  const layout=$('.chess-layout'),card=$('.chess-board-card'),board=$('#chess-board'),sidebar=$('.chess-sidebar');
  sidebar.style.removeProperty('grid-template-columns');
  if(innerWidth<=900||layout.clientWidth<760){root.style.removeProperty('--chess-card-width');root.style.removeProperty('--chess-room-height');return;}
  const style=getComputedStyle(card),padding=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+2;
  const availableWidth=Math.max(280,layout.clientWidth-sidebar.getBoundingClientRect().width-16-padding);
  // Measure at the available width, never at the previous (possibly wrapped) size.
  root.style.setProperty('--chess-card-width',(availableWidth+padding)+'px');
  const chrome=card.getBoundingClientRect().height-board.getBoundingClientRect().height;
  const scrollOffset=document.fullscreenElement===root||root.classList.contains('chess-focus')?root.scrollTop:window.scrollY;
  const room=Math.max(300,(window.visualViewport?.height||innerHeight)-layout.getBoundingClientRect().top-scrollOffset-12);
  const size=Math.floor(Math.min(availableWidth,Math.max(280,room-chrome)));
  root.style.setProperty('--chess-card-width',(size+padding)+'px');root.style.setProperty('--chess-room-height',room+'px');
 }
 function show(visible) {
  mount();clearInterval(clockInterval);clockInterval=visible?setInterval(tickClocks,100):null;shown=visible;root.hidden=!visible;document.body.classList.toggle('chess-active',visible);clearTimeout(timer);clearTimeout(searchTimer);epoch++;
  for(const dialog of root.querySelectorAll('dialog[open]'))dialog.close();
  if(!visible){if(!pcGame?.timeSeconds)stopComputer();root.classList.remove('chess-focus');if(document.fullscreenElement===root)document.exitFullscreen().catch(()=>{});return;}
  const user=window.ChessSession.user();if(owner!==user?.id){stopComputer();pcGame=null;game=null;gameId=null;owner=user?.id;signature='';selected=null;flipped=false;}
  if(pcGame){pcGame.checkTimeout();pcGame.save(storageKey());game=pcGame.snapshot;drawGame();$('#chess-connection').textContent='● Hra proti PC';runComputer();return;}
  if(savedMode()==='pc'){useComputer(false);return;}
  $('#chess-login').hidden=!!user;$('#chess-search-form').hidden=!user;
  if(!user){game=null;gameId=null;signature='preview';drawGame();$('#chess-connection').textContent='Náhled herny';$('#chess-players').innerHTML='';$('#chess-invites').innerHTML='<p class="chess-muted">Po přihlášení tu uvidíš pozvánky.</p>';notice('Pro online partii se přihlas.');return;}
  drawGame();notice('');$('#chess-connection').textContent='Připojuji…';refresh();
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);if(!pcGame?.timeSeconds)stopComputer();}else if(shown){if(pcGame)runComputer();else refresh();}});
 window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);document.addEventListener('fullscreenchange',()=>{if(mounted)$('#chess-fullscreen').textContent=document.fullscreenElement===root?'⛶ Zpět':'⛶ Celá obrazovka';scheduleFit();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.classList.contains('chess-focus')){root.classList.remove('chess-focus');$('#chess-fullscreen').textContent='⛶ Celá obrazovka';scheduleFit();}});
 window.ChessRoom={show};
})();
