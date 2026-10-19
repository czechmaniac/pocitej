<?php
require __DIR__.'/../api/logic.php';
function ensure(bool $condition): void { if(!$condition) throw new RuntimeException('Rule assertion failed'); }
$all=[];
foreach(['addition','subtraction','multiplication'] as $operation) foreach([10,20] as $range) foreach([20,50,100] as $limit) {
    $s=settings(['operation'=>$operation,'range'=>$range,'multiplicationLimit'=>$limit]);$pool=exercisePool($s);
    ensure(count($pool)>=12);
    foreach($pool as $e) {
        $result=exerciseResult($e);
        if(needsDecomposition($e)) {
            $values=[$e['a']-10,$e['b']-($e['a']-10),$result];
            ensure($values[0]>0&&$values[1]>0);
            ensure(answerChecks($e,$values,$s)===[true,true,true]);
            ensure(answerChecks($e,[$values[1],$values[0],$result],$s)===($values[0]===$values[1]?[true,true,true]:[false,false,true]));
            ensure(answerChecks($e,[null,null,$result],$s)===[false,false,true]);
        } else {
            ensure(count($e['choices'])===3&&count(array_unique($e['choices']))===3);
            ensure(count(array_filter($e['choices'],fn($n)=>$n===$result))===1);
            ensure(answerChecks($e,[$result],$s)===[true]);
            ensure(answerChecks($e,[(string)$result],$s)===[false]);
            ensure(answerChecks($e,[null],$s)===[false]);
        }
    }
    $all[]=['settings'=>$s,'pool'=>$pool];
}
$w=['solved'=>0,'correct'=>0,'streak'=>0,'best_streak'=>0];
$e=['checked'=>false,'solved'=>false];recordAnswer($e,$w,false);recordAnswer($e,$w,true);recordAnswer($e,$w,true);
ensure($w===['solved'=>1,'correct'=>0,'streak'=>0,'best_streak'=>0]&&$e['solved']);
$e=['checked'=>false,'solved'=>false];recordAnswer($e,$w,true);recordAnswer($e,$w,true);
ensure($w===['solved'=>2,'correct'=>1,'streak'=>1,'best_streak'=>1]);
echo json_encode($all,JSON_THROW_ON_ERROR);
