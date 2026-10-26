<?php
require __DIR__.'/../api/chess-core.php';
use PChess\Chess\Chess;
function chessTest(bool $ok,string $name): void { if(!$ok) throw new RuntimeException($name); }
function perft(Chess $chess,int $depth): int {
    if($depth===0)return 1;$total=0;
    foreach($chess->moves() as $move){$next=new Chess($chess->fen());$next->move(['from'=>$move->from,'to'=>$move->to,'promotion'=>$move->promotion]);$total+=perft($next,$depth-1);}
    return $total;
}
$c=new Chess();chessTest(count($c->moves())===20,'20 opening moves');chessTest(perft($c,2)===400,'opening perft depth 2');
$c=new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
chessTest(count($c->moves())===48,'Kiwipete legal moves');chessTest(perft($c,2)===2039,'Kiwipete perft depth 2');
$c=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
chessTest($c->move(['from'=>'e1','to'=>'g1'])!==null && $c->get('f1')?->getType()==='r' && $c->get('h1')===null,'castling moves rook');
$c=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');chessTest($c->move(['from'=>'e1','to'=>'c1'])!==null && $c->get('d1')?->getType()==='r','queenside castling');
$c=new Chess('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1');chessTest($c->move(['from'=>'e1','to'=>'g1'])===null,'no castling through check');
$c=new Chess();foreach(['e4','a6','e5','d5','exd6'] as $san)chessTest($c->move($san)!==null,'en passant '.$san);
chessTest($c->get('d5')===null && $c->get('d6')?->getType()==='p','en passant capture');
$c=new Chess('k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');chessTest($c->move(['from'=>'e5','to'=>'d6'])===null,'en passant cannot expose king');chessTest(str_ends_with(chessPositionKey($c),' -'),'irrelevant en passant ignored for repetition');
foreach(['q','r','b','n'] as $p){$c=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');chessTest($c->move(['from'=>'a7','to'=>'a8','promotion'=>$p])!==null && $c->get('a8')?->getType()===$p,'promotion '.$p);}
$c=new Chess('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');chessTest($c->move(['from'=>'e2','to'=>'f2'])===null,'pinned piece');
$c=new Chess();foreach(['f3','e5','g4','Qh4#'] as $san)chessTest($c->move($san)!==null,'Fools mate '.$san);chessTest(chessEnding($c,[])==='checkmate','mate');
chessTest(chessEnding(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),[])==='stalemate','stalemate');
chessTest(chessEnding(new Chess('7k/8/8/8/8/8/8/7K w - - 0 1'),[])==='material','dead material');
$c=new Chess();$history=[];
for($cycle=1;$cycle<=4;$cycle++){foreach(['Nf3','Nf6','Ng1','Ng8'] as $san){chessTest($c->move($san)!==null,'repetition move');$history[]=['key'=>chessPositionKey($c)];}if($cycle===2)chessTest(chessRepetitions($c,$history)===3 && chessEnding($c,$history)===null,'threefold is claimable, not automatic');}
chessTest(chessEnding($c,$history)==='fivefold','automatic fivefold');
chessTest(chessEnding(new Chess('7k/8/8/8/8/8/8/R5K1 w - - 150 80'),[])==='seventyfive','automatic 75 moves');
echo "PASS: chess perft, castling, en passant and pinned king, all promotions, mate, stalemate, material, repetition and move counters\n";
