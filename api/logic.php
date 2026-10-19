<?php
declare(strict_types=1);

function settings(array $p): array {
    return [
        'operation' => in_array($p['operation'] ?? '', ['addition','subtraction','multiplication'], true) ? $p['operation'] : 'addition',
        'range' => in_array($p['range'] ?? 0, [10,20], true) ? $p['range'] : 20,
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
    return $e['operation']==='subtraction' && $e['a']>10 && $e['a']-$e['b']<10;
}
function exerciseResult(array $e): int {
    return $e['operation']==='addition' ? $e['a']+$e['b'] : ($e['operation']==='multiplication' ? $e['a']*$e['b'] : $e['a']-$e['b']);
}
function exercisePool(array $s): array {
    $pool=[];$op=$s['operation'];$multi=$op==='multiplication';
    for($a=1;$a<=($multi?10:$s['range']);$a++) for($b=1;$b<=($multi?10:$s['range']);$b++) {
        $e=['operation'=>$op,'a'=>$a,'b'=>$b,'checked'=>false,'solved'=>false];$result=exerciseResult($e);
        if($result<0||$result>($multi?$s['multiplicationLimit']:$s['range'])) continue;
        $e['type']=needsDecomposition($e)?'decomposition':'direct';
        if($e['type']==='direct') {
            $wrong=[];
            for($d=1;count($wrong)<2;$d++) foreach([$result-$d,$result+$d] as $n) if($n>=0&&count($wrong)<2) $wrong[]=$n;
            $e['choices']=[$result,...$wrong];shuffle($e['choices']);
        }
        $pool[]=$e;
    }
    return $pool;
}
function answerChecks(array $e, array $v, array $s): array {
    $v=array_values(array_map(static fn($n)=>is_int($n)&&$n>=0&&$n<=999?$n:null,$v));
    if(!needsDecomposition($e)) return [($v[0]??null)===exerciseResult($e)];
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
