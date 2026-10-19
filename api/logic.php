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
function exercisePool(array $s): array {
    $pool = [];
    $op = $s['operation'];
    for ($a=1; $a<=($op==='multiplication'?10:$s['range']); $a++) {
        for ($b=($op==='multiplication'?1:2); $b<=($op==='multiplication'?10:$s['range']); $b++) {
            $result = $op==='multiplication' ? $a*$b : ($op==='addition' ? $a+$b : $a-$b);
            if ($result<0 || $result>($op==='multiplication'?$s['multiplicationLimit']:$s['range'])) continue;
            if ($op!=='multiplication' && $s['range']===20 && !($op==='addition' ? $a>=5&&$a<=9&&$b<=10&&$result>10 : $a>10&&$a<=19&&$b<=10&&$result<10)) continue;
            $pool[]=['operation'=>$op,'a'=>$a,'b'=>$b,'checked'=>false,'solved'=>false];
        }
    }
    return $pool;
}
function answerChecks(array $e, array $v, array $s): array {
    $v=array_map(static fn($n)=>is_int($n)&&$n>=0&&$n<=999?$n:null,$v);
    $a=$e['a']; $b=$e['b']; $op=$e['operation'];
    if ($op==='multiplication') return [($v[0]??null)===$a*$b];
    $first=$v[0]??null; $second=$v[1]??null; $result=$v[2]??null;
    if ($s['range']===10) {
        $split=$first!==null&&$second!==null&&$first>0&&$second>0&&$first+$second===$b;
        return [$split,$split,$result===($op==='addition'?$a+$b:$a-$b)];
    }
    $part=$op==='addition'?10-$a:$a-10;
    return [$first===$part,$second===$b-$part,$result===($op==='addition'?$a+$b:$a-$b)];
}
function rewardTitle(int $sets, string $gender): string {
    $girl=$gender==='girl';
    $titles=['Začínáme','První krůček','Jiskra počítání','Bystrá liška',$girl?'Lovkyně výsledků':'Lovec výsledků','Hvězda násobilky a rozkladů',$girl?'Průzkumnice čísel':'Průzkumník čísel','Diamantová mysl',$girl?'Čarodějka matematiky':'Čaroděj matematiky',$girl?'Šampionka počítání':'Šampion počítání',$girl?'Kari královna':'Dino král'];
    $level=0; foreach([1,3,6,10,15,21,28,36,45,60] as $threshold) if($sets>=$threshold) $level++;
    return $titles[$level];
}
