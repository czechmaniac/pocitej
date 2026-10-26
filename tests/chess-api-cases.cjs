const assert=require('node:assert/strict');
module.exports=async({client,request,config,post,csrf,temp})=>{
 const clients=[];
 async function register(nickname){const c=await request.newContext({baseURL:config.origin});clients.push(c);const me=await (await c.get('/api/index.php?action=me')).json();const call=async(op,body={},status=200)=>{const r=await c.post('/api/index.php?action='+op,{headers:{Origin:config.origin,'X-CSRF-Token':me.csrf},data:body});assert.equal(r.status(),status,await r.text());return r.json();};const result=await call('register',{nickname,pin:'1234',pinAgain:'1234'});return {client:c,call,chess:(body,status)=>call('chess',body,status),id:result.user.id,nickname};}
 const A={client,call:post,chess:(body,status=200)=>post('chess',body,status),nickname:'ApiTest'};
 const B=await register('ChessFriend'),C=await register('ChessThird');
 const guest=await request.newContext({baseURL:config.origin});clients.push(guest);const guestMe=await (await guest.get('/api/index.php?action=me')).json();
 try{
  const badCsrf=await client.post('/api/index.php?action=chess',{headers:{Origin:config.origin},data:{op:'state'}});assert.equal(badCsrf.status(),403);
  assert.equal((await guest.post('/api/index.php?action=chess',{headers:{Origin:config.origin,'X-CSRF-Token':guestMe.csrf},data:{op:'state'}})).status(),401);
  await B.chess({op:'state'});let state=await A.chess({op:'state'});assert(state.players.some(p=>p.nickname===B.nickname&&p.online));
  assert.equal((await A.chess({op:'state',search:'%'})).players.length,0);
  await A.chess({op:'invite',nickname:'MissingPlayer'},404);await A.chess({op:'invite',nickname:A.nickname},400);
  let declined=await C.chess({op:'invite',nickname:A.nickname});const declinedId=declined.invites.find(i=>!i.incoming).id;
  await A.chess({op:'decline',inviteId:declinedId});await A.chess({op:'accept',inviteId:declinedId},409);
  let cancelled=await B.chess({op:'invite',nickname:A.nickname});const cancelledId=cancelled.invites.find(i=>!i.incoming).id;
  await A.chess({op:'cancel',inviteId:cancelledId},403);await B.chess({op:'cancel',inviteId:cancelledId});await A.chess({op:'accept',inviteId:cancelledId},409);
  state=await A.chess({op:'invite',nickname:B.nickname});const invite=state.invites.find(i=>!i.incoming);assert(invite);
  await C.chess({op:'accept',inviteId:invite.id},403);
  state=await A.chess({op:'invite',nickname:B.nickname});assert.equal(state.invites.length,1);
  state=await B.chess({op:'accept',inviteId:invite.id});assert(state.game);const gameId=state.game.id;
  await C.chess({op:'state',gameId},403);await C.chess({op:'move',gameId,revision:0,from:'e2',to:'e4',requestId:'e'.repeat(32)},403);await C.chess({op:'invite',nickname:A.nickname},409);
  const a=await A.chess({op:'state'}),white=a.game.you==='w'?A:B,black=white===A?B:A;
  assert.equal(a.game.revision,0);assert.equal((await black.chess({op:'state'})).game.legal.length,0);
  await black.chess({op:'move',gameId,revision:0,from:'e7',to:'e5',requestId:'a'.repeat(32),promotion:null},409);
  await white.chess({op:'move',gameId,revision:0,from:'e2',to:'e5',requestId:'a'.repeat(32),promotion:null},400);
  const move={op:'move',gameId,revision:0,from:'e2',to:'e4',requestId:'b'.repeat(32),promotion:null};
  state=await white.chess(move);assert.equal(state.game.revision,1);assert.equal(state.game.moves[0].san,'e4');
  state=await white.chess(move);assert.equal(state.game.revision,1);assert.equal(state.game.moves.length,1);
  await black.chess({op:'move',gameId,revision:0,from:'e7',to:'e5',requestId:'c'.repeat(32),promotion:null},409);
  state=await black.chess({op:'move',gameId,revision:1,from:'e7',to:'e5',requestId:'c'.repeat(32),promotion:null});assert.equal(state.game.moves.length,2);
  // A new request context using the same login cookie resumes the stored game.
  const resumed=await request.newContext({baseURL:config.origin,storageState:await client.storageState()});clients.push(resumed);
  const res=await resumed.post('/api/index.php?action=chess',{headers:{Origin:config.origin,'X-CSRF-Token':csrf},data:{op:'state'}});assert.equal(res.status(),200);assert.equal((await res.json()).game.id,gameId);
  state=await white.chess({op:'draw_offer',gameId,revision:2});assert.equal(state.game.drawOffer,'you');
  await white.chess({op:'draw_accept',gameId,revision:3},409);
  state=await black.chess({op:'draw_decline',gameId,revision:3});assert.equal(state.game.drawOffer,null);
  state=await white.chess({op:'draw_offer',gameId,revision:4});
  state=await black.chess({op:'draw_accept',gameId,revision:5});assert.equal(state.game.status,'finished');assert.equal(state.game.reason,'agreement');
  const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
  const helper=path.join(temp,'chess-fixture.php');fs.writeFileSync(helper,`<?php $c=json_decode(file_get_contents($argv[1]),true);$d=new PDO('mysql:host='.$c['db_host'].';port='.$c['db_port'].';dbname='.$c['db_name'],$c['db_user'],$c['db_password']);$d->exec("UPDATE pc_chess_invites SET created_at=DATE_SUB(created_at,INTERVAL 1 MINUTE)");$g=json_decode($argv[2],true);$q=$d->prepare("UPDATE pc_chess_games SET fen=?,history='[]',status='active',reason=NULL,winner_id=NULL,draw_offer=NULL,revision=0 WHERE id=?");$q->execute([$g['fen'],$g['id']]);`);
  const fixture=fen=>execFileSync(process.env.PHP_BINARY||'php',[helper,path.join(temp,'config.json'),JSON.stringify({id:gameId,fen})]);
  fixture('7k/P7/8/8/8/8/8/7K w - - 0 1');
  state=await white.chess({op:'state'});assert(state.game.legal.filter(m=>m.from==='a7'&&m.to==='a8').length===4);
  state=await white.chess({op:'move',gameId,revision:0,from:'a7',to:'a8',promotion:'n',requestId:'d'.repeat(32)});assert(state.game.fen.startsWith('N6k'));assert.equal(state.game.reason,'material');
  fixture('7k/8/8/8/8/8/8/R5K1 w - - 100 51');
  state=await white.chess({op:'state'});assert.equal(state.game.canClaimDraw,true);
  state=await white.chess({op:'claim_draw',gameId,revision:0});assert.equal(state.game.reason,'fifty');
  fixture('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  for(const [who,from,to,revision] of [[white,'f2','f3',0],[black,'e7','e5',1],[white,'g2','g4',2],[black,'d8','h4',3]])state=await who.chess({op:'move',gameId,revision,from,to,promotion:null,requestId:String(revision+1).repeat(32)});
  assert.equal(state.game.reason,'checkmate');assert.equal(state.game.winner,'b');
  // New online game exercised by two real browser contexts against the same PHP/MySQL server.
  await require('./chess-browser-cases.cjs')({config,A,B});
  console.log('PASS: shared chess accounts, online search, invitations, authorization/CSRF, turn enforcement, illegal/stale/retried moves, reconnect, draw, promotion and mate');
 }finally{for(const c of clients)await c.dispose();}
};
