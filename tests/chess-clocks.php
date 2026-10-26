<?php
require __DIR__.'/../api/chess-core.php';
require __DIR__.'/../api/chess-clock.php';
function clockTest(bool $ok,string $name): void { if(!$ok)throw new RuntimeException($name); }
$game=['id'=>str_repeat('a',32),'fen'=>(new PChess\Chess\Chess())->fen(),'status'=>'active','reason'=>null,'winner_id'=>null,'draw_offer'=>null,'white_id'=>1,'black_id'=>2,'time_seconds'=>300,'white_ms'=>2000,'black_ms'=>3000,'tick_ms'=>9000];
$clock=chessClockState($game,10000);clockTest($clock['whiteMs']===1000&&$clock['blackMs']===3000,'only the active side counts');
clockTest(!chessChargeClock($game,10000)&&$game['white_ms']===1000&&$game['tick_ms']===10000,'charge active clock');
$chess=new PChess\Chess\Chess();$chess->move('e4');$game['fen']=$chess->fen();
$clock=chessClockState($game,10500);clockTest($clock['whiteMs']===1000&&$clock['blackMs']===2500,'clock switches on legal move');
clockTest(chessChargeClock($game,14000)&&$game['reason']==='timeout'&&(int)$game['winner_id']===1,'flag awards opponent once');
clockTest(chessClockState($game,900000)['whiteMs']===1000&&chessClockState($game,900000)['blackMs']===0,'finished clocks freeze');
$game['status']='active';$game['reason']=null;$game['winner_id']=null;$game['fen']='7k/8/8/8/8/8/8/3Q3K w - - 0 1';$game['white_ms']=1;$game['black_ms']=1000;$game['tick_ms']=10000;
clockTest(chessChargeClock($game,10002)&&$game['reason']==='timeout_draw'&&$game['winner_id']===null,'bare king cannot win on time');
$game['status']='active';$game['time_seconds']=0;clockTest(chessClockState($game,999999)===null&&!chessChargeClock($game,999999),'legacy untimed games stay untimed');
echo "PASS: server clock charging/switching, flag result, frozen finish, timeout draw and untimed compatibility\n";
