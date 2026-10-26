const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
module.exports=async({A,B,C,temp})=>{
 const helper=path.join(temp,'clock-fixture.php');
 fs.writeFileSync(helper,`<?php $c=json_decode(file_get_contents($argv[1]),true);$db=new PDO('mysql:host='.$c['db_host'].';port='.$c['db_port'].';dbname='.$c['db_name'],$c['db_user'],$c['db_password']);$p=json_decode($argv[2],true);$db->exec("UPDATE pc_chess_invites SET created_at=DATE_SUB(created_at,INTERVAL 1 MINUTE)");if(isset($p['age'])){$q=$db->prepare('UPDATE pc_chess_clocks SET tick_ms=tick_ms-? WHERE game_id=?');$q->execute([$p['age'],$p['id']]);}if(isset($p['flag'])){$q=$db->prepare('UPDATE pc_chess_clocks SET white_ms=10,tick_ms=? WHERE game_id=?');$q->execute([(int)floor(microtime(true)*1000)-30,$p['id']]);}if(isset($p['fen'])){$q=$db->prepare('UPDATE pc_chess_games SET fen=? WHERE id=?');$q->execute([$p['fen'],$p['id']]);}`);
 const fixture=data=>execFileSync(process.env.PHP_BINARY||'php',[helper,path.join(temp,'config.json'),JSON.stringify(data)]);
 const ranking=async()=> (await A.chess({op:'leaderboard'})).leaderboard;
 const points=(r,name)=>r.entries.find(e=>e.nickname===name)?.points||0;
 fixture({});const before=await ranking();
 await A.chess({op:'invite',nickname:B.nickname,timeSeconds:123},400);
 let s=await A.chess({op:'invite',nickname:B.nickname,timeSeconds:300});let invite=s.invites.find(i=>!i.incoming);assert.equal(invite.timeSeconds,300);
 s=await B.chess({op:'accept',inviteId:invite.id});const id=s.game.id;
 assert.equal(s.game.clock.limitSeconds,300);assert.equal(s.game.clock.active,'w');assert.equal(s.game.clock.blackMs,300000);
 const a=await A.chess({op:'state'}),white=a.game.you==='w'?A:B,black=white===A?B:A;
 fixture({id,age:1500});s=await white.chess({op:'state'});assert(s.game.clock.whiteMs<=298500);assert.equal(s.game.clock.blackMs,300000);
 s=await white.chess({op:'move',gameId:id,revision:0,from:'e2',to:'e4',promotion:null,requestId:'8'.repeat(32),whiteMs:999999999});assert.equal(s.game.clock.active,'b');assert(s.game.clock.whiteMs<300000);assert(s.game.clock.blackMs>299000&&s.game.clock.blackMs<=300000);
 fixture({id,age:1100});s=await black.chess({op:'move',gameId:id,revision:1,from:'e7',to:'e5',promotion:null,requestId:'9'.repeat(32)});assert.equal(s.game.clock.active,'w');assert(s.game.clock.blackMs<=298900);
 assert.deepEqual((await ranking()).entries,before.entries,'active game gives no ranking points');
 fixture({id,flag:true});s=await white.chess({op:'move',gameId:id,revision:2,from:'d2',to:'d4',promotion:null,requestId:'a'.repeat(32)});
 assert.equal(s.game.reason,'timeout');assert.equal(s.game.winner,'b');assert.equal(s.game.moves.length,2);assert.equal(s.game.clock.whiteMs,0);assert.equal(s.game.clock.active,null);
 const revision=s.game.revision,blackRemaining=s.game.clock.blackMs;
 s=await A.chess({op:'state',gameId:id});assert.equal(s.game.revision,revision);assert.equal(s.game.clock.blackMs,blackRemaining);
 const won=await ranking();assert.equal(points(won,white.nickname),points(before,white.nickname));assert.equal(points(won,black.nickname),points(before,black.nickname)+1);assert.deepEqual((await ranking()).entries,won.entries,'ranking refresh never duplicates points');
 fixture({});s=await A.chess({op:'invite',nickname:B.nickname,timeSeconds:900});invite=s.invites.find(i=>!i.incoming);s=await B.chess({op:'accept',inviteId:invite.id});const drawId=s.game.id;assert.equal(s.game.clock.limitSeconds,900);
 fixture({id:drawId,fen:'7k/8/8/8/8/8/8/3Q3K w - - 0 1',flag:true});
 await C.chess({op:'leaderboard'});s=await A.chess({op:'state',gameId:drawId});assert.equal(s.game.reason,'timeout_draw');assert.equal(s.game.winner,null);
 const drawn=await ranking();assert.equal(points(drawn,A.nickname),points(won,A.nickname)+0.5);assert.equal(points(drawn,B.nickname),points(won,B.nickname)+0.5);
 for(const row of drawn.entries){assert.equal(row.points,row.wins+row.draws/2);assert.equal(row.played,row.wins+row.draws+row.losses);}
 console.log('PASS: negotiated time controls, server charging/switching, tamper resistance, late move rejection, timeout/draw, frozen clocks and idempotent chess standings');
};
