'use strict';
(() => {
 const root=document.querySelector('#chess-view');
 const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 const names={k:'král',q:'dáma',r:'věž',b:'střelec',n:'jezdec',p:'pěšec'};
 const paths={
  p:'<circle cx="32" cy="19" r="9"/><path d="M24 31h16l-3 6 6 18H21l6-18z"/>',
  r:'<path d="M16 12h8v8h5v-8h6v8h5v-8h8v18l-8 6 3 20H21l3-20-8-6z"/><path d="M21 29h22M25 38h14"/>',
  b:'<path d="M32 7c-4 6-14 10-14 19 0 8 7 11 14 11s14-3 14-11C46 17 36 13 32 7zM24 41h16l-3 4 7 11H20l7-11z"/><path d="M33 14l-6 13" fill="none"/>',
  n:'<path d="M19 55l3-14 13-9-11 2-8-6 8-14 9-4 7-5 1 9c11 6 13 20 5 31l-2 10z"/><circle cx="32" cy="21" r="1.7" fill="var(--piece-line)" stroke="none"/><path d="M27 14l4 3M22 27l7-2" fill="none"/>',
  q:'<path d="M15 21l9 7 8-12 8 12 9-7-7 23H22zM23 48h18l4 8H19z"/><circle cx="14" cy="17" r="4"/><circle cx="32" cy="11" r="4"/><circle cx="50" cy="17" r="4"/><path d="M24 37h16"/>',
  k:'<path d="M29 5h6v6h6v5h-6v7h-6v-7h-6v-5h6zM20 28q12-12 24 0l-5 17H25zM24 49h16l5 7H19z"/><path d="M23 33h18"/>'
 };
 let pieceId=0;
 function piece(code) {
  const white=code===code.toUpperCase(),id='cp'+(++pieceId);
  return `<svg class="chess-piece ${white?'ivory':'navy'}" viewBox="0 0 64 72" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${white?'#fffdf1':'#537089'}"/><stop offset="1" stop-color="${white?'#e5c99d':'#182c42'}"/></linearGradient></defs><ellipse cx="32" cy="65" rx="23" ry="4" fill="#172c4224"/><g fill="url(#${id})" stroke="var(--piece-line)" stroke-width="1.8" stroke-linejoin="round">${paths[code.toLowerCase()]}<path d="M20 56h24l5 7q-17 6-34 0z"/><path d="M21 59h22" fill="none" opacity=".45"/></g></svg>`;
 }
 const $=s=>root.querySelector(s);
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let mounted=false,shown=false,epoch=0,timer=null,queue=Promise.resolve(),polling=false,busy=false,game=null,gameId=null,owner=null,selected=null,flipped=false,roving='e2',signature='',searchTimer=null,promotion=null;
 let pcGame=null,pcThinking=false,pcTask=0,fitFrame=0;
 function mount() {
  if(mounted)return;mounted=true;
  root.innerHTML=`<div class="chess-heading"><div><p class="chess-eyebrow">MALÁ ŠACHOVÁ DOBRODRUŽSTVÍ</p><h2>Šachy <span>♞</span></h2><p>Najdi spoluhráče a zahrajte si spolu.</p></div><div class="chess-heading-tools"><span class="chess-live" id="chess-connection">Herna</span><button type="button" id="chess-fullscreen">⛶ Celá obrazovka</button></div></div>
   <div id="chess-notice" role="status" aria-live="polite"></div>
   <div class="chess-layout"><section class="chess-board-card panel" aria-label="Šachová partie"><div class="chess-player"><span class="chess-avatar">♟</span><div><strong id="chess-opponent">Černé figurky</strong><small id="chess-opponent-detail">Připravené ke hře</small></div><button type="button" id="chess-flip" aria-label="Otočit šachovnici">↻ Otočit</button></div>
   <div id="chess-board" role="grid" aria-label="Šachovnice"></div><div class="chess-turn" id="chess-turn" role="status">Bílý začíná. Vyber si spoluhráče.</div><div class="chess-player"><span class="chess-avatar ivory">♙</span><div><strong id="chess-you">Bílé figurky</strong><small id="chess-you-detail">Každý tah je nový nápad.</small></div></div>
   <div id="chess-game-actions" class="chess-actions" hidden><button type="button" id="chess-draw">Nabídnout remízu</button><button type="button" id="chess-claim" hidden>Nárokovat remízu</button><button type="button" id="chess-resign">Vzdát partii</button></div><div id="chess-draw-answer" class="chess-invite" hidden><p>Soupeř nabízí remízu.</p><button type="button" data-game-action="draw_accept">Přijmout remízu</button><button type="button" data-game-action="draw_decline">Pokračovat ve hře</button></div><button type="button" id="chess-lobby" hidden>Zpět do herny</button></section>
   <aside class="chess-sidebar"><section class="panel chess-card chess-pc-card"><h3>Hrát s počítačem</h3><p class="chess-muted">Zahraj si kdykoliv, i bez přihlášení.</p><form id="chess-pc-form"><label>Obtížnost<select id="chess-pc-level"><option value="1">Lehká</option><option value="2" selected>Střední</option><option value="3">Těžší</option></select></label><label>Tvoje figurky<select id="chess-pc-side"><option value="w">Bílé – začínáš</option><option value="b">Černé – začíná PC</option></select></label><button type="submit" id="chess-pc-start">Nová partie s PC</button><button type="button" id="chess-pc-resume" hidden>Pokračovat s PC</button><button type="button" id="chess-online" hidden>Online herna</button></form></section><section class="panel chess-card" data-chess-online><h3>Hráči online <span id="chess-online-count">0</span></h3><p class="chess-muted">Hráči, kteří mají právě otevřenou hernu.</p><div id="chess-login" hidden><p>Přihlas se stejným účtem jako do Počítáme. Pak můžeš pozvat kamaráda nebo vybrat hráče online.</p><button type="button" class="primary" id="chess-login-button">Přihlásit se</button></div><form id="chess-search-form"><label for="chess-search">Přezdívka hráče</label><div class="chess-search"><input id="chess-search" type="search" maxlength="24" placeholder="Napiš přezdívku…" autocomplete="off"><button type="submit">Pozvat</button></div></form><div id="chess-players" class="chess-player-list"></div></section>
   <section class="panel chess-card" data-chess-online><h3>Pozvánky</h3><p class="chess-muted">Pozvánka platí 5 minut. Barvy figurek se losují.</p><div id="chess-invites"></div></section><section class="panel chess-card"><h3>Průběh partie</h3><div id="chess-moves"><p class="chess-muted">Tady se budou zapisovat vaše tahy.</p></div></section></aside></div>
   <details class="panel chess-rules"><summary>Jak se hrají šachy? <span>Figurky a pravidla</span></summary><div class="chess-piece-guide">${[['K','Král','O jedno pole kterýmkoli směrem. Nesmí vstoupit do šachu.'],['Q','Dáma','Po řadách, sloupcích i úhlopříčkách.'],['R','Věž','Po řadách a sloupcích.'],['B','Střelec','Po úhlopříčkách.'],['N','Jezdec','Do tvaru L: dvě pole a jedno stranou. Může přeskakovat figurky.'],['P','Pěšec','Vpřed o jedno pole, z výchozího místa může o dvě. Bere šikmo vpřed.']].map(([p,n,t])=>`<div>${piece(p)}<h4>${n}</h4><p>${t}</p></div>`).join('')}</div><div class="chess-rule-text"><p><strong>Cíl hry:</strong> dát soupeřovu králi mat. Bílý začíná, potom se v tazích střídáte. V šachu musíš svého krále zachránit. Není-li žádný únik, je to mat. Král se nebere.</p><p><strong>Rošáda:</strong> společný tah krále a věže, pokud se ještě nehýbali, mezi nimi nic nestojí a král není v šachu ani neprochází napadeným polem. Vyber krále a jeho cílové pole.</p><p><strong>Braní mimochodem:</strong> pěšec může bezprostředně po soupeřově dvojkroku sebrat jeho pěšce, jako by postoupil jen o jedno pole. <strong>Proměna:</strong> na poslední řadě si pěšce vyměníš za dámu, věž, střelce nebo jezdce.</p><p><strong>Remíza:</strong> dohodou, patem nebo při nedostatku materiálu k matu. Na svém tahu můžeš nárokovat remízu, když se současná pozice objevila alespoň třikrát nebo uběhlo 50 tahů obou stran bez tahu pěšce a braní. Po pěti opakováních nebo 75 takových tazích skončí partie automaticky remízou; mat má přednost.</p><p><strong>V této herně se hraje bez hodin.</strong> Při výpadku připojení ani zavření stránky partii neprohraješ. Přihlas se později a pokračuj. Šachy mají vlastní partie a nemění body za počítání.</p></div></details>
   <dialog id="chess-promotion" aria-labelledby="chess-promotion-title"><h3 id="chess-promotion-title">Na co proměníš pěšce?</h3><div class="chess-promotion-options"></div><button type="button" id="chess-promotion-cancel">Zrušit tah</button></dialog><dialog id="chess-resign-dialog" aria-labelledby="chess-resign-title"><h3 id="chess-resign-title">Opravdu chceš vzdát partii?</h3><p>Soupeř tím vyhraje. Pokud jen zavřeš stránku, můžete později pokračovat.</p><button type="button" id="chess-resign-cancel">Pokračovat</button><button type="button" id="chess-resign-confirm">Vzdát partii</button></dialog>`;
  $('#chess-search-form').addEventListener('submit',e=>{e.preventDefault();act('invite',{nickname:$('#chess-search').value.trim()});});
  $('#chess-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>refresh(),250);});
  $('#chess-pc-form').addEventListener('submit',event=>{event.preventDefault();useComputer(true);});
  $('#chess-pc-resume').onclick=()=>useComputer(false);$('#chess-online').onclick=onlineMode;
  $('#chess-fullscreen').onclick=fullscreen;
  $('#chess-flip').onclick=()=>{flipped=!flipped;drawGame();};
  $('#chess-login-button').onclick=()=>window.ChessSession.login();
  $('#chess-draw').onclick=()=>act('draw_offer');$('#chess-claim').onclick=()=>act('claim_draw');
  $('#chess-resign').onclick=()=>$('#chess-resign-dialog').showModal();
  $('#chess-resign-cancel').onclick=()=>$('#chess-resign-dialog').close();
  $('#chess-resign-confirm').onclick=()=>{$('#chess-resign-dialog').close();act('resign');};
  $('#chess-lobby').onclick=()=>{if(pcGame){onlineMode();return;}gameId=null;game=null;selected=null;signature='';drawGame();refresh();};
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
  $('#chess-you-detail').textContent=game?`Hraješ za ${game.you==='w'?'bílé':'černé'} • partie bez hodin`:'Každý tah je nový nápad.';
  let status=game?(game.turn===game.you?'Jsi na tahu. Vyber figurku.':'Na tahu je soupeř.'):'Bílý začíná. Vyber si spoluhráče.';
  if(pcGame&&active&&game.turn!==game.you)status=pcThinking?'Počítač přemýšlí…':'Na tahu je počítač. Stiskni Pokračovat s PC.';
  if(game?.check&&active)status=game.turn===game.you?'Šach! Zachraň svého krále.':'Soupeř je v šachu.';
  if(game&&!active){const reasons={checkmate:'Mat',stalemate:'Pat',material:'Nedostatek materiálu',resigned:'Vzdání partie',agreement:'Dohodnutá remíza',fifty:'Pravidlo 50 tahů',threefold:'Třikrát stejná pozice',fivefold:'Pětkrát stejná pozice',seventyfive:'Pravidlo 75 tahů'};status=(game.winner===null?'Remíza.':game.winner===game.you?'Vyhrál/a jsi!':'Vyhrál soupeř.')+' '+(reasons[game.reason]||'Partie skončila')+'.';}
  $('#chess-turn').textContent=status;$('#chess-game-actions').hidden=!active;$('#chess-lobby').hidden=!game||active;
  $('#chess-draw').hidden=!!pcGame;
  $('#chess-draw').disabled=busy||game?.drawOffer!=null;$('#chess-draw').textContent=game?.drawOffer==='you'?'Remíza nabídnuta':'Nabídnout remízu';
  $('#chess-claim').hidden=!game?.canClaimDraw;$('#chess-draw-answer').hidden=!active||game.drawOffer!=='opponent';
  if(game?.moves.length){const rows=[];for(let i=0;i<game.moves.length;i+=2)rows.push(`<div><span>${i/2+1}.</span><span>${esc(game.moves[i].san)}</span><span>${esc(game.moves[i+1]?.san||'…')}</span></div>`);$('#chess-moves').innerHTML=rows.join('');$('#chess-moves').scrollTop=$('#chess-moves').scrollHeight;}
  else $('#chess-moves').innerHTML='<p class="chess-muted">Tady se budou zapisovat vaše tahy.</p>';
  scheduleFit();
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
  const next=data.game;const nextSignature=next?next.id+':'+next.revision:'preview';
  if(signature!==nextSignature){selected=null;promotion=null;if($('#chess-promotion').open)$('#chess-promotion').close();game=next;gameId=next?.id||null;signature=nextSignature;drawGame();}
  else game=next;
  $('#chess-online-count').textContent=data.players.filter(p=>p.online).length;
  $('#chess-players').innerHTML=data.players.length?data.players.map(p=>`<div class="chess-person"><span class="chess-dot ${p.online?'online':''}"></span><div><strong>${esc(p.nickname)}</strong><small>${p.playing?'Rozehraná partie':p.online?'Online':'Právě není v herně'}</small></div><button type="button" data-chess-player="${esc(p.nickname)}" ${busy||game?.status==='active'||p.playing?'disabled':''}>Pozvat</button></div>`).join(''):'<p class="chess-muted">'+($('#chess-search').value.trim()?'Žádný hráč s touto přezdívkou.':'Právě tu není další hráč. Pozvi kamaráda podle přezdívky.')+'</p>';
  $('#chess-invites').innerHTML=data.invites.length?data.invites.map(i=>`<div class="chess-invite"><p><strong>${esc(i.nickname)}</strong> ${i.incoming?'tě zve ke hře.':'čeká na pozvánku.'}</p>${i.incoming?`<button type="button" data-invite-op="accept" data-invite-id="${i.id}">Přijmout</button><button type="button" data-invite-op="decline" data-invite-id="${i.id}">Odmítnout</button>`:`<button type="button" data-invite-op="cancel" data-invite-id="${i.id}">Zrušit pozvánku</button>`}</div>`).join(''):'<p class="chess-muted">Zatím žádné pozvánky.</p>';
 }
 function request(payload) {const result=queue.catch(()=>{}).then(()=>window.ChessSession.request(payload));queue=result;return result;}
 function payload(op,extra={}) {return {op,search:$('#chess-search').value.trim(),...(gameId?{gameId}:{}),...extra};}
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
   const {ComputerGame}=await import('./assets/chess/computer-game.js?v=pc-2');
   if(!shown||token!==epoch)return;
   pcGame=!newGame?ComputerGame.restore(storageKey()):null;
   if(!pcGame)pcGame=new ComputerGame({side:$('#chess-pc-side').value,level:Number($('#chess-pc-level').value)});
   $('#chess-pc-side').value=pcGame.side;$('#chess-pc-level').value=pcGame.level;
   game=pcGame.snapshot;gameId=null;signature='';selected=null;flipped=false;rememberMode('pc');pcGame.save(storageKey());notice('');$('#chess-connection').textContent='● Hra proti PC';drawGame();runComputer();
  }catch(error){if(shown&&token===epoch){rememberMode('online');notice('Počítačového soupeře se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.',true);}}
  finally{$('#chess-pc-start').disabled=false;}
 }
 function onlineMode(){stopComputer();pcGame=null;game=null;gameId=null;selected=null;signature='';rememberMode('online');show(true);}
 function computerAction(op,extra){
  if(op==='move'&&pcThinking)return;
  stopComputer();
  try{pcGame.action(op,extra);game=pcGame.snapshot;selected=null;if(!pcGame.save(storageKey()))notice('Prohlížeč nepovolil uložit tuto partii.',true);else notice('');drawGame();runComputer();}
  catch(error){notice(error.message,true);}
 }
 async function runComputer(){
  if(!pcGame||!shown||document.hidden||pcThinking||pcGame.snapshot.status!=='active'||pcGame.engine.turn()===pcGame.side)return;
  const session=pcGame,task=++pcTask;pcThinking=true;drawGame();
  try{await session.think();if(pcGame===session&&task===pcTask){game=session.snapshot;session.save(storageKey());}}
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
  const layout=$('.chess-layout'),card=$('.chess-board-card'),board=$('#chess-board');
  if(innerWidth<=900||layout.clientWidth<760){root.style.removeProperty('--chess-card-width');$('.chess-sidebar').style.removeProperty('grid-template-columns');return;}
  const style=getComputedStyle(card),padding=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+2;
  const availableWidth=layout.clientWidth-300-16-padding;
  const chrome=card.getBoundingClientRect().height-board.getBoundingClientRect().height;
  const availableHeight=Math.max(300,(window.visualViewport?.height||innerHeight)-layout.getBoundingClientRect().top-chrome-12);
  const size=Math.floor(Math.min(availableWidth,availableHeight));
  root.style.setProperty('--chess-card-width',(size+padding)+'px');
  $('.chess-sidebar').style.gridTemplateColumns=layout.clientWidth-size-padding-16>=560?'repeat(2,minmax(0,1fr))':'minmax(0,1fr)';
 }
 function show(visible) {
  mount();shown=visible;root.hidden=!visible;document.body.classList.toggle('chess-active',visible);clearTimeout(timer);clearTimeout(searchTimer);epoch++;
  for(const dialog of root.querySelectorAll('dialog[open]'))dialog.close();
  if(!visible){stopComputer();root.classList.remove('chess-focus');if(document.fullscreenElement===root)document.exitFullscreen().catch(()=>{});return;}
  const user=window.ChessSession.user();if(owner!==user?.id){stopComputer();pcGame=null;game=null;gameId=null;owner=user?.id;signature='';selected=null;flipped=false;}
  if(pcGame){game=pcGame.snapshot;drawGame();$('#chess-connection').textContent='● Hra proti PC';runComputer();return;}
  if(savedMode()==='pc'){useComputer(false);return;}
  $('#chess-login').hidden=!!user;$('#chess-search-form').hidden=!user;
  if(!user){game=null;gameId=null;signature='preview';drawGame();$('#chess-connection').textContent='Náhled herny';$('#chess-players').innerHTML='';$('#chess-invites').innerHTML='<p class="chess-muted">Po přihlášení tu uvidíš pozvánky.</p>';notice('Pro online partii se přihlas.');return;}
  drawGame();notice('');$('#chess-connection').textContent='Připojuji…';refresh();
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);stopComputer();}else if(shown){if(pcGame)runComputer();else refresh();}});
 window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);document.addEventListener('fullscreenchange',()=>{if(mounted)$('#chess-fullscreen').textContent=document.fullscreenElement===root?'⛶ Zpět':'⛶ Celá obrazovka';scheduleFit();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.classList.contains('chess-focus')){root.classList.remove('chess-focus');$('#chess-fullscreen').textContent='⛶ Celá obrazovka';scheduleFit();}});
 window.ChessRoom={show};
})();
