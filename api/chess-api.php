<?php
declare(strict_types=1);
require_once __DIR__.'/chess-core.php';
require_once __DIR__.'/chess-clock.php';
require_once __DIR__.'/chess-ranking.php';
function chessFail(string $message,int $status=400): never {
    global $db;
    if($db->inTransaction()) $db->rollBack();
    fail($message,$status);
}
function chessId(mixed $id): string {
    if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)) chessFail('Neplatné označení partie nebo pozvánky.');
    return $id;
}
function chessLockPlayers(int $a,int $b): void {
    global $db;
    $db->beginTransaction();$ids=[$a,$b];sort($ids);
    foreach(array_unique($ids) as $id) query('SELECT id FROM pc_users WHERE id=? FOR UPDATE',[$id]);
}
function chessActive(int $userId): array|false {
    global $db;
    $game=chessGameSelect("g.status='active' AND (g.white_id=? OR g.black_id=?) ORDER BY g.updated_at DESC LIMIT 1",[$userId,$userId]);
    if($game&&!$db->inTransaction())$game=chessSettleGame($game['id']);
    return $game&&$game['status']==='active'?$game:false;
}
function chessSnapshot(array $game,int $userId): array {
    if(!in_array($userId,[(int)$game['white_id'],(int)$game['black_id']],true)) chessFail('Tato partie patří jiným hráčům.',403);
    $chess=new \PChess\Chess\Chess($game['fen']);$history=json_decode($game['history'],true,512,JSON_THROW_ON_ERROR);
    $you=(int)$game['white_id']===$userId?'w':'b';$names=[];
    foreach(query('SELECT id,nickname FROM pc_users WHERE id IN (?,?)',[$game['white_id'],$game['black_id']])->fetchAll() as $row) $names[(int)$row['id']]=$row['nickname'];
    $legal=[];
    if($game['status']==='active' && $chess->turn===$you) foreach($chess->moves() as $move) $legal[]=['from'=>$move->from,'to'=>$move->to,'promotion'=>$move->promotion];
    return ['id'=>$game['id'],'fen'=>$game['fen'],'you'=>$you,'turn'=>$chess->turn,'white'=>$names[(int)$game['white_id']],'black'=>$names[(int)$game['black_id']],
        'status'=>$game['status'],'reason'=>$game['reason'],'winner'=>$game['winner_id']===null?null:((int)$game['winner_id']===(int)$game['white_id']?'w':'b'),
        'drawOffer'=>$game['draw_offer']===null?null:((int)$game['draw_offer']===$userId?'you':'opponent'),
        'canClaimDraw'=>$game['status']==='active' && $chess->turn===$you && ($chess->halfMovesExceeded()||chessRepetitions($chess,$history)>=3),
        'clock'=>chessClockState($game),'check'=>$chess->inCheck(),'revision'=>(int)$game['revision'],'legal'=>$legal,'moves'=>array_map(static fn($m)=>['from'=>$m['from'],'to'=>$m['to'],'san'=>$m['san'],'promotion'=>$m['promotion']??null],$history)];
}
function chessState(array $input,int $uid): array {
    query('INSERT INTO pc_chess_presence (user_id,last_seen) VALUES (?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE last_seen=UTC_TIMESTAMP()',[$uid]);
    $game=chessActive($uid);
    if(!$game && isset($input['gameId'])) {
        $game=chessSettleGame(chessId($input['gameId']));
        if(!$game) chessFail('Partie už není dostupná.',404);
    }
    if(!$game&&($input['resumeLatest']??false)===true)$game=chessGameSelect('g.white_id=? OR g.black_id=? ORDER BY g.updated_at DESC LIMIT 1',[$uid,$uid]);
    $search=$input['search']??'';
    if(!is_string($search)||!preg_match('/^.{0,24}$/usD',$search)) chessFail('Přezdívka může mít nejvýše 24 znaků.');
    $sql="SELECT u.id,u.nickname,(p.last_seen>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 60 SECOND)) AS online,EXISTS(SELECT 1 FROM pc_chess_games g WHERE g.status='active' AND (g.white_id=u.id OR g.black_id=u.id)) AS playing FROM pc_users u LEFT JOIN pc_chess_presence p ON p.user_id=u.id WHERE u.id<>?";
    $args=[$uid];
    if(trim($search)==='') $sql.=' AND p.last_seen>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 60 SECOND)';
    else { $sql.=' AND LOCATE(?,u.nickname)>0';$args[]=trim($search); }
    $players=query($sql.' ORDER BY online DESC,u.nickname LIMIT 30',$args)->fetchAll();
    $players=array_map(static fn($p)=>['id'=>(int)$p['id'],'nickname'=>$p['nickname'],'online'=>(bool)$p['online'],'playing'=>(bool)$p['playing']],$players);
    $optionJoin=chessClocksReady()?' LEFT JOIN pc_chess_invite_options o ON o.invite_id=i.id':'';$optionField=chessClocksReady()?'COALESCE(o.time_seconds,0)':'0';
    $invites=query("SELECT i.id,i.from_id,i.to_id,".$optionField." AS time_seconds,a.nickname AS sender,b.nickname AS recipient FROM pc_chess_invites i".$optionJoin." JOIN pc_users a ON a.id=i.from_id JOIN pc_users b ON b.id=i.to_id WHERE i.status='pending' AND i.expires_at>UTC_TIMESTAMP() AND (i.to_id=? OR i.from_id=?) ORDER BY i.created_at DESC LIMIT 20",[$uid,$uid])->fetchAll();
    return ['players'=>$players,'invites'=>array_map(static fn($i)=>['id'=>$i['id'],'timeSeconds'=>(int)$i['time_seconds'],'incoming'=>(int)$i['to_id']===$uid,'nickname'=>(int)$i['to_id']===$uid?$i['sender']:$i['recipient']],$invites),'game'=>$game?chessSnapshot($game,$uid):null];
}
function chessInvite(array $input,int $uid): void {
    global $db;
    $timeSeconds=chessTimeSeconds($input['timeSeconds']??0);
    $name=$input['nickname']??'';
    if(!is_string($name)||!preg_match('/^.{0,24}$/usD',$name)||trim($name)==='') chessFail('Napiš přezdívku hráče.');
    $target=query('SELECT id FROM pc_users WHERE nickname=?',[trim($name)])->fetch();
    if(!$target) chessFail('Hráč s touto přezdívkou neexistuje.',404);
    $tid=(int)$target['id'];if($uid===$tid) chessFail('Pozvi jiného hráče než sebe.');
    chessActive($uid);chessActive($tid);
    chessLockPlayers($uid,$tid);
    if(chessActive($uid)||chessActive($tid)) chessFail('Jeden z hráčů už má rozehranou partii.',409);
    if(query("SELECT id FROM pc_chess_invites WHERE status='pending' AND expires_at>UTC_TIMESTAMP() AND ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) LIMIT 1",[$uid,$tid,$tid,$uid])->fetch()) { $db->commit();return; }
    if((int)query('SELECT COUNT(*) FROM pc_chess_invites WHERE from_id=? AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 10 SECOND)',[$uid])->fetchColumn()>0) chessFail('Další pozvánku můžeš poslat za chvilku.',429);
    $inviteId=bin2hex(random_bytes(16));query("INSERT INTO pc_chess_invites (id,from_id,to_id,created_at,expires_at) VALUES (?,?,?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))",[$inviteId,$uid,$tid]);
    if(chessClocksReady())query('INSERT INTO pc_chess_invite_options (invite_id,time_seconds) VALUES (?,?)',[$inviteId,$timeSeconds]);
    $db->commit();
}
function chessInvitation(array $input,int $uid,string $op): void {
    global $db;
    $id=chessId($input['inviteId']??null);$invite=query('SELECT * FROM pc_chess_invites WHERE id=?',[$id])->fetch();
    if(!$invite||($op==='cancel'?(int)$invite['from_id']!==(int)$uid:(int)$invite['to_id']!==$uid)) chessFail('Tato pozvánka ti nepatří.',403);
    chessActive((int)$invite['from_id']);chessActive((int)$invite['to_id']);
    chessLockPlayers((int)$invite['from_id'],(int)$invite['to_id']);
    $invite=query('SELECT *,expires_at>UTC_TIMESTAMP() AS fresh FROM pc_chess_invites WHERE id=? FOR UPDATE',[$id])->fetch();
    if($invite['status']!=='pending'||!(bool)$invite['fresh']) chessFail('Pozvánka již neplatí. Pošli novou.',409);
    if($op!=='accept') { query('UPDATE pc_chess_invites SET status=? WHERE id=?',[$op==='cancel'?'cancelled':'declined',$id]);$db->commit();return; }
    if(chessActive((int)$invite['from_id'])||chessActive((int)$invite['to_id'])) chessFail('Jeden z hráčů už má rozehranou partii.',409);
    $white=random_int(0,1)?(int)$invite['from_id']:(int)$invite['to_id'];$black=$white===(int)$invite['from_id']?(int)$invite['to_id']:(int)$invite['from_id'];
    $timeSeconds=chessClocksReady()?(int)query('SELECT time_seconds FROM pc_chess_invite_options WHERE invite_id=?',[$id])->fetchColumn():0;
    $gameId=bin2hex(random_bytes(16));
    query("INSERT INTO pc_chess_games (id,white_id,black_id,fen,history,created_at,updated_at) VALUES (?,?,?,?,'[]',UTC_TIMESTAMP(),UTC_TIMESTAMP())",[$gameId,$white,$black,(new \PChess\Chess\Chess())->fen()]);
    if($timeSeconds>0)query('INSERT INTO pc_chess_clocks (game_id,time_seconds,white_ms,black_ms,tick_ms) VALUES (?,?,?,?,?)',[$gameId,$timeSeconds,$timeSeconds*1000,$timeSeconds*1000,chessNowMs()]);
    query("UPDATE pc_chess_invites SET status='accepted',game_id=? WHERE id=?",[$gameId,$id]);
    query("UPDATE pc_chess_invites SET status='cancelled' WHERE status='pending' AND (from_id IN (?,?) OR to_id IN (?,?))",[$white,$black,$white,$black]);
    $db->commit();
}
function chessGameAction(array $input,int $uid,string $op): void {
    global $db;
    $id=chessId($input['gameId']??null);$game=chessReadGame($id);
    if(!$game||!in_array($uid,[(int)$game['white_id'],(int)$game['black_id']],true)) chessFail('Tato partie ti nepatří.',403);
    chessLockPlayers((int)$game['white_id'],(int)$game['black_id']);
    $game=chessReadGame($id,true);
    if($game['status']!=='active') chessFail('Partie už skončila.',409);
    if(chessChargeClock($game)){chessWriteClock($game);query('UPDATE pc_chess_games SET status=?,reason=?,winner_id=?,draw_offer=NULL,revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE id=?',[$game['status'],$game['reason'],$game['winner_id'],$id]);$db->commit();return;}
    $history=json_decode($game['history'],true,512,JSON_THROW_ON_ERROR);$chess=new \PChess\Chess\Chess($game['fen']);$you=(int)$game['white_id']===$uid?'w':'b';
    if($op==='move' && isset($input['requestId']) && count($history)>0) {
        $last=$history[array_key_last($history)];
        if(($last['id']??null)===$input['requestId'] && ($last['actor']??null)===$uid && ($last['from']??null)===($input['from']??null) && ($last['to']??null)===($input['to']??null) && ($last['promotion']??null)===($input['promotion']??null)) { $db->commit();return; }
    }
    if(!is_int($input['revision']??null)||$input['revision']!==(int)$game['revision']) chessFail('Partie se změnila. Načti aktuální pozici a zkus to znovu.',409);
    if($op==='move') {
        if($chess->turn!==$you) chessFail('Teď je na tahu soupeř.',409);
        $from=$input['from']??'';$to=$input['to']??'';$promotion=$input['promotion']??null;
        if(!is_string($from)||!is_string($to)||!preg_match('/^[a-h][1-8]$/D',$from)||!preg_match('/^[a-h][1-8]$/D',$to)||!in_array($promotion,[null,'q','r','b','n'],true)) chessFail('Neplatný tah.');
        $requestId=chessId($input['requestId']??null);
        $move=$chess->move(['from'=>$from,'to'=>$to,'promotion'=>$promotion]);
        if(!$move) chessFail('Tento tah není podle pravidel možný.');
        $history[]=['from'=>$from,'to'=>$to,'promotion'=>$move->promotion,'san'=>$move->san,'id'=>$requestId,'actor'=>$uid,'key'=>chessPositionKey($chess)];
        $game['fen']=$chess->fen();$game['history']=json_encode($history,JSON_THROW_ON_ERROR);$game['draw_offer']=null;
        if($reason=chessEnding($chess,$history)) { $game['status']='finished';$game['reason']=$reason;$game['winner_id']=$reason==='checkmate'?$uid:null; }
    } elseif($op==='resign') { $game['status']='finished';$game['reason']='resigned';$game['winner_id']=$you==='w'?$game['black_id']:$game['white_id']; }
    elseif($op==='draw_offer') { if($game['draw_offer']!==null) chessFail('Nabídka remízy už čeká na odpověď.',409);$game['draw_offer']=$uid; }
    elseif($op==='draw_decline') { if($game['draw_offer']===null||(int)$game['draw_offer']===$uid) chessFail('Nemáš nabídku remízy od soupeře.',409);$game['draw_offer']=null; }
    elseif($op==='draw_accept') { if($game['draw_offer']===null||(int)$game['draw_offer']===$uid) chessFail('Nemáš nabídku remízy od soupeře.',409);$game['status']='finished';$game['reason']='agreement';$game['draw_offer']=null; }
    elseif($op==='claim_draw') { if($chess->turn!==$you||(!$chess->halfMovesExceeded() && chessRepetitions($chess,$history)<3)) chessFail('V této pozici zatím nelze nárokovat remízu.');$game['status']='finished';$game['reason']=$chess->halfMovesExceeded()?'fifty':'threefold';$game['draw_offer']=null; }
    else chessFail('Neznámá šachová akce.');
    chessWriteClock($game);
    query('UPDATE pc_chess_games SET fen=?,history=?,status=?,reason=?,winner_id=?,draw_offer=?,revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE id=?',[$game['fen'],$game['history'],$game['status'],$game['reason'],$game['winner_id'],$game['draw_offer'],$id]);
    $db->commit();
}
function chessDispatch(array $input,array $user): never {
    $uid=(int)$user['id'];$op=$input['op']??'state';
    try { query('SELECT user_id FROM pc_chess_presence LIMIT 1'); }
    catch(PDOException $e) { if($e->getCode()==='42S02') chessFail('Šachová herna zatím není zprovozněná.',503);throw $e; }
    if($op==='leaderboard')respond(['leaderboard'=>chessLeaderboard($uid)]);
    if($op==='invite') chessInvite($input,$uid);
    elseif(in_array($op,['accept','decline','cancel'],true)) chessInvitation($input,$uid,$op);
    elseif(in_array($op,['move','resign','draw_offer','draw_accept','draw_decline','claim_draw'],true)) chessGameAction($input,$uid,$op);
    elseif($op!=='state') chessFail('Neznámá šachová akce.');
    respond(chessState($input,$uid));
}
