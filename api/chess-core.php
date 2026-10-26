<?php
declare(strict_types=1);
spl_autoload_register(static function(string $class): void {
    $prefix='PChess\\Chess\\';
    if(!str_starts_with($class,$prefix)) return;
    $name=substr($class,strlen($prefix));
    if(preg_match('/^[A-Za-z]+$/D',$name) && is_file(__DIR__.'/vendor/p-chess/'.$name.'.php')) require_once __DIR__.'/vendor/p-chess/'.$name.'.php';
});
function chessPositionKey(\PChess\Chess\Chess $chess): string {
    $parts=explode(' ',$chess->fen());
    if($parts[3]!=='-') {
        $hasEp=false;
        foreach($chess->moves() as $move) if(($move->flags & \PChess\Chess\Move::BITS['EP_CAPTURE'])!==0) $hasEp=true;
        if(!$hasEp) $parts[3]='-';
    }
    return implode(' ',array_slice($parts,0,4));
}
function chessRepetitions(\PChess\Chess\Chess $chess,array $history): int {
    $key=chessPositionKey($chess);
    $count=$key===chessPositionKey(new \PChess\Chess\Chess())?1:0;
    foreach($history as $entry) if(($entry['key']??'')===$key) $count++;
    return $count;
}
function chessEnding(\PChess\Chess\Chess $chess,array $history): ?string {
    if($chess->inCheckmate()) return 'checkmate';
    if($chess->inStalemate()) return 'stalemate';
    if($chess->insufficientMaterial()) return 'material';
    if((int)explode(' ',$chess->fen())[4]>=150) return 'seventyfive';
    if(chessRepetitions($chess,$history)>=5) return 'fivefold';
    return null;
}
