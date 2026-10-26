<?php
declare(strict_types=1);
function chessLeaderboard(int $uid): array {
    chessSettleExpired();
    $score="SELECT player_id,COUNT(*) AS played,SUM(won) AS wins,SUM(drawn) AS draws,SUM(lost) AS losses,SUM(won*2+drawn) AS half_points FROM (SELECT white_id AS player_id,CASE WHEN winner_id=white_id THEN 1 ELSE 0 END AS won,(winner_id IS NULL) AS drawn,(winner_id IS NOT NULL AND winner_id<>white_id) AS lost FROM pc_chess_games WHERE status='finished' UNION ALL SELECT black_id AS player_id,CASE WHEN winner_id=black_id THEN 1 ELSE 0 END AS won,(winner_id IS NULL) AS drawn,(winner_id IS NOT NULL AND winner_id<>black_id) AS lost FROM pc_chess_games WHERE status='finished') results GROUP BY player_id";
    $rows=query('SELECT u.id,u.nickname,s.* FROM ('.$score.') s JOIN pc_users u ON u.id=s.player_id ORDER BY s.half_points DESC,s.wins DESC,u.nickname')->fetchAll();
    $entries=[];$last=null;$rank=0;$mine=null;
    foreach($rows as $index=>$row){$tie=[(int)$row['half_points'],(int)$row['wins']];if($tie!==$last)$rank=$index+1;$last=$tie;
        $entry=['rank'=>$rank,'nickname'=>$row['nickname'],'points'=>(int)$row['half_points']/2,'played'=>(int)$row['played'],'wins'=>(int)$row['wins'],'draws'=>(int)$row['draws'],'losses'=>(int)$row['losses'],'mine'=>(int)$row['id']===$uid];
        if($index<100)$entries[]=$entry;if($entry['mine'])$mine=$entry;
    }
    return ['entries'=>$entries,'mine'=>$mine,'total'=>count($rows)];
}
