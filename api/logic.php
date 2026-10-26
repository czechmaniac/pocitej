<?php
declare(strict_types=1);

function settings(array $p): array {
    return [
        'operation' => in_array($p['operation'] ?? '', ['addition','subtraction','multiplication','division'], true) ? $p['operation'] : 'addition',
        'range' => in_array($p['range'] ?? null, [10,20,50,100,1000,0], true) ? $p['range'] : 20,
        'multiplicationLimit' => in_array($p['multiplicationLimit'] ?? 0, [20,50,100], true) ? $p['multiplicationLimit'] : 100,
        'count' => in_array($p['count'] ?? 0, [6,9,12], true) ? $p['count'] : 6,
        'gender' => ($p['gender'] ?? '') === 'girl' ? 'girl' : 'boy',
        'largeText' => ($p['largeText'] ?? false) === true,
    ];
}
function weekStart(?DateTimeImmutable $now = null): string {
    $now = ($now ?? new DateTimeImmutable('now', new DateTimeZone('Europe/Prague')))->setTimezone(new DateTimeZone('Europe/Prague'));
    return $now->modify('-'.((int)$now->format('N')-1).' days')->format('Y-m-d');
}
function needsDecomposition(array $e): bool {
    return $e['operation']==='subtraction' && $e['a']>10 && $e['a']<=20 && $e['a']-$e['b']<10;
}
function requiresDecomposition(array $e, array $s): bool {
    return ($s['mode']??'practice')!=='battle' && needsDecomposition($e);
}
function exerciseResult(array $e): int {
    return $e['operation']==='addition' ? $e['a']+$e['b'] : ($e['operation']==='multiplication' ? $e['a']*$e['b'] : ($e['operation']==='division' ? intdiv($e['a'],$e['b']) : $e['a']-$e['b']));
}
function answerChoices(int $result): array {
    $spread=min(20,max(3,(int)ceil($result/4)));
    $lower=$result>0?range($result-1,max(0,$result-$spread)):[];
    $upper=range($result+1,$result+$spread);shuffle($lower);shuffle($upper);
    $rank=random_int(0,min(2,$result));
    $choices=[$result,...array_slice($lower,0,$rank),...array_slice($upper,0,2-$rank)];shuffle($choices);
    return $choices;
}
function exercisePool(array $s): array {
    $pool=[];$op=$s['operation'];$range=$s['range'];
    $pairs=[];
    if($range>0 && $range<=20) {
        for($a=1;$a<=$range;$a++) for($b=1;$b<=$range;$b++) {
            if($op==='division' && $a%$b!==0) continue;
            $pairs[]=[$a,$b];
        }
    } else {
        $seen=[];
        for($attempt=0;count($pairs)<240 && $attempt<6000;$attempt++) {
            $limit=$range?:10**random_int(1,6);
            if($op==='addition') { $a=random_int(1,$limit-1);$b=random_int(1,$limit-$a); }
            elseif($op==='subtraction') { $a=random_int(1,$limit);$b=random_int(1,$a); }
            else {
                $factor=random_int(1,(int)floor(sqrt($limit)));$other=random_int(1,intdiv($limit,$factor));
                if($op==='division') { $a=$factor*$other;$b=random_int(0,1)?$factor:$other; }
                else { $a=$factor;$b=$other;if(random_int(0,1))[$a,$b]=[$b,$a]; }
            }
            $key=$a.':'.$b;
            if(!isset($seen[$key])) { $seen[$key]=true;$pairs[]=[$a,$b]; }
        }
    }
    foreach($pairs as [$a,$b]) {
        $e=['operation'=>$op,'a'=>$a,'b'=>$b,'checked'=>false,'solved'=>false];$result=exerciseResult($e);
        if($result<0||($range>0 && $result>$range)) continue;
        $e['type']=requiresDecomposition($e,$s)?'decomposition':'direct';
        if($e['type']==='direct') {
            $e['choices']=answerChoices($result);
        }
        $pool[]=$e;
    }
    return $pool;
}
function answerChecks(array $e, array $v, array $s): array {
    $v=array_values(array_map(static fn($n)=>is_int($n)&&$n>=0&&$n<=1000000?$n:null,$v));
    if(!requiresDecomposition($e,$s)) return [($v[0]??null)===exerciseResult($e)];
    $part=$e['a']-10;
    return [($v[0]??null)===$part,($v[1]??null)===$e['b']-$part,($v[2]??null)===exerciseResult($e)];
}
// First checks count once, even when a request is retried or an answer is repaired.
function recordAnswer(array &$e, array &$w, bool $ok): void {
    if(!$e['checked']) {
        $e['checked']=true;$w['solved']++;
        if($ok) { $w['correct']++;$w['streak']++;$w['best_streak']=max($w['streak'],$w['best_streak']); }
        else $w['streak']=0;
    }
    if($ok) $e['solved']=true;
}
function rewardTitle(int $sets, string $gender): string {
    $girl=$gender==='girl';
    $titles=['Začínáme','První krůček','Jiskra počítání','Bystrá liška',$girl?'Lovkyně výsledků':'Lovec výsledků','Hvězda násobilky a rozkladů',$girl?'Průzkumnice čísel':'Průzkumník čísel','Diamantová mysl',$girl?'Čarodějka matematiky':'Čaroděj matematiky',$girl?'Šampionka počítání':'Šampion počítání',$girl?'Kari královna':'Dino král'];
    $level=0; foreach([1,3,6,10,15,21,28,36,45,60] as $threshold) if($sets>=$threshold) $level++;
    return $titles[$level];
}
