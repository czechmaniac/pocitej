<?php
declare(strict_types=1);
function chessNowMs(): int { return (int)floor(microtime(true)*1000); }
function chessClocksReady(): bool {
    static $ready=null;
    if($ready!==null)return $ready;
    try{query('SELECT game_id FROM pc_chess_clocks LIMIT 1');query('SELECT invite_id FROM pc_chess_invite_options LIMIT 1');return $ready=true;}
    catch(PDOException $e){if($e->getCode()==='42S02')return $ready=false;throw $e;}
}
function chessTimeSeconds(mixed $value): int {
    if(!is_int($value)||!in_array($value,[0,300,600,900],true))chessFail('Vyber čas 5, 10 nebo 15 minut, případně bez limitu.');
    if($value>0&&!chessClocksReady())chessFail('Časované partie zatím nejsou připravené. Zkus režim bez limitu.',503);
    return $value;
}
function chessGameSelect(string $where,array $args=[],bool $lock=false): array|false {
    $fields=chessClocksReady()?'c.time_seconds,c.white_ms,c.black_ms,c.tick_ms':'0 AS time_seconds,NULL AS white_ms,NULL AS black_ms,NULL AS tick_ms';
    $join=chessClocksReady()?' LEFT JOIN pc_chess_clocks c ON c.game_id=g.id':'';
    return query('SELECT g.*,'.$fields.' FROM pc_chess_games g'.$join.' WHERE '.$where.($lock?' FOR UPDATE':''),$args)->fetch();
}
function chessReadGame(string $id,bool $lock=false): array|false { return chessGameSelect('g.id=?',[$id],$lock); }
function chessClockState(array $game,?int $now=null): ?array {
    if(!(int)($game['time_seconds']??0))return null;
    $now??=chessNowMs();$white=(int)$game['white_ms'];$black=(int)$game['black_ms'];$turn=explode(' ',$game['fen'])[1];
    if($game['status']==='active'&&(int)$game['tick_ms']>0){$elapsed=max(0,$now-(int)$game['tick_ms']);if($turn==='w')$white-=$elapsed;else $black-=$elapsed;}
    return ['limitSeconds'=>(int)$game['time_seconds'],'whiteMs'=>max(0,$white),'blackMs'=>max(0,$black),'active'=>$game['status']==='active'?$turn:null,'asOf'=>$now];
}
function chessCanMate(\PChess\Chess\Chess $chess,string $color): bool {
    if($chess->insufficientMaterial())return false;
    foreach(\PChess\Chess\Board::SQUARES as $square=>$index) { $p=$chess->get($square);if($p&&$p->getColor()===$color&&!$p->isKing())return true; }
    return false;
}
// Charges the running side; only valid actions or an actual flag persist this state.
function chessChargeClock(array &$game,?int $now=null): bool {
    $now??=chessNowMs();$clock=chessClockState($game,$now);if(!$clock||$game['status']!=='active')return false;
    $game['white_ms']=$clock['whiteMs'];$game['black_ms']=$clock['blackMs'];$game['tick_ms']=$now;
    if(($clock['active']==='w'?$clock['whiteMs']:$clock['blackMs'])>0)return false;
    $winner=$clock['active']==='w'?'b':'w';$canMate=chessCanMate(new \PChess\Chess\Chess($game['fen']),$winner);
    $game['status']='finished';$game['reason']=$canMate?'timeout':'timeout_draw';$game['winner_id']=$canMate?($winner==='w'?$game['white_id']:$game['black_id']):null;$game['draw_offer']=null;$game['tick_ms']=0;
    return true;
}
function chessWriteClock(array $game): void {
    if((int)($game['time_seconds']??0)>0)query('UPDATE pc_chess_clocks SET white_ms=?,black_ms=?,tick_ms=? WHERE game_id=?',[$game['white_ms'],$game['black_ms'],$game['status']==='active'?$game['tick_ms']:0,$game['id']]);
}
function chessSettleGame(string $id): array|false {
    global $db;
    $game=chessReadGame($id);if(!$game||$game['status']!=='active'||!($clock=chessClockState($game)))return $game;
    if(($clock['active']==='w'?$clock['whiteMs']:$clock['blackMs'])>0)return $game;
    chessLockPlayers((int)$game['white_id'],(int)$game['black_id']);$game=chessReadGame($id,true);
    if(chessChargeClock($game)){
        chessWriteClock($game);query('UPDATE pc_chess_games SET status=?,reason=?,winner_id=?,draw_offer=NULL,revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE id=?',[$game['status'],$game['reason'],$game['winner_id'],$id]);
    }
    $db->commit();return chessReadGame($id);
}
function chessSettleExpired(): void {
    if(!chessClocksReady())return;
    $rows=query("SELECT g.id FROM pc_chess_games g JOIN pc_chess_clocks c ON c.game_id=g.id WHERE g.status='active' AND c.tick_ms>0 AND c.tick_ms+CASE WHEN g.fen LIKE '% w %' THEN c.white_ms ELSE c.black_ms END<=? LIMIT 1000",[chessNowMs()])->fetchAll();
    foreach($rows as $row)chessSettleGame($row['id']);
}
