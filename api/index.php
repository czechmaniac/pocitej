<?php
declare(strict_types=1);
require __DIR__.'/logic.php';
date_default_timezone_set('Europe/Prague');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(array $data, int $status=200): never {
    http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); exit;
}
function fail(string $message,int $status=400): never { respond(['error'=>$message],$status); }
function query(string $sql,array $args=[]): PDOStatement {
    global $db; $q=$db->prepare($sql);$q->execute($args);return $q;
}
function cookie(string $name,string $value,int $expires,bool $httpOnly=true): void {
    global $config;
    setcookie($name,$value,['expires'=>$expires,'path'=>$config['cookie_path'],'secure'=>$config['secure_cookies'],'httponly'=>$httpOnly,'samesite'=>'Strict']);
}
function currentUser(): ?array {
    $token=$_COOKIE['pc_login']??'';
    if(!preg_match('/^[a-f0-9]{64}$/D',$token)) return null;
    $row=query('SELECT u.* FROM pc_tokens t JOIN pc_users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at>UTC_TIMESTAMP()',[hash('sha256',$token)])->fetch();
    return $row?:null;
}
function profile(array $u): array {
    $w=query('SELECT * FROM pc_weeks WHERE user_id=? AND week_start=?',[$u['id'],weekStart()])->fetch()?:[];
    $prefs=settings(json_decode($u['preferences'],true)??[]);
    return ['id'=>(int)$u['id'],'nickname'=>$u['nickname'],'preferences'=>$prefs,'lifetimeSets'=>(int)$u['lifetime_sets'],'week'=>weekStart(),
        'statistics'=>['solved'=>(int)($w['solved']??0),'correct'=>(int)($w['correct']??0),'completedSets'=>(int)($w['completed_sets']??0),'streak'=>(int)($w['streak']??0),'bestStreak'=>(int)($w['best_streak']??0),'lastUsed'=>$w['last_used']??'']];
}
function logIn(array $u): void {
    // Bez limitu chybných pokusů a bez blokování, dle zadání.
    $old=$_COOKIE['pc_login']??'';
    if($old!=='') query('DELETE FROM pc_tokens WHERE token_hash=?',[hash('sha256',$old)]);
    $token=bin2hex(random_bytes(32));
    query('INSERT INTO pc_tokens (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY))',[hash('sha256',$token),$u['id']]);
    cookie('pc_login',$token,time()+30*86400);
}
try {
    if(!is_file(__DIR__.'/config.php')) fail('Nejdřív doplňte api/config.php podle návodu.',503);
    $config=require __DIR__.'/config.php';
    $db=new PDO('mysql:host='.$config['db_host'].';port='.$config['db_port'].';dbname='.$config['db_name'].';charset=utf8mb4',$config['db_user'],$config['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    $action=$_GET['action']??'me';
    $csrf=$_COOKIE['pc_csrf']??'';
    if(!preg_match('/^[a-f0-9]{64}$/D',$csrf)) { $csrf=bin2hex(random_bytes(32));cookie('pc_csrf',$csrf,time()+30*86400); }
    $isPost=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
    $readOnly=in_array($action,['me','leaderboard'],true);
    if(!$readOnly&&!$isPost) fail('Použijte POST.',405);
    $input=[];
    if($isPost) {
        if(!hash_equals($csrf,$_SERVER['HTTP_X_CSRF_TOKEN']??'')) fail('Obnovte stránku a zkuste to znovu.',403);
        if(($_SERVER['HTTP_ORIGIN']??'')!==$config['origin']) fail('Nesouhlasí adresa webu v konfiguraci.',403);
        $input=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
        if(!is_array($input)) fail('Neplatný požadavek.');
    }
    $user=currentUser();
    if($action==='me') respond(['csrf'=>$csrf,'user'=>$user?profile($user):null]);
    if($action==='register'||$action==='login') {
        $name=trim((string)($input['nickname']??''));$pin=$input['pin']??null;
        if(!preg_match('/^[\p{L}\p{N}][\p{L}\p{N} _-]{2,23}$/uD',$name)) fail('Přezdívka musí mít 3–24 znaků: písmena, čísla, mezery, pomlčku nebo podtržítko.');
        if(!is_string($pin)||!preg_match('/^[0-9]{4}$/D',$pin)) fail('PIN musí obsahovat přesně čtyři číslice.');
        $u=query('SELECT * FROM pc_users WHERE nickname=?',[$name])->fetch();
        if($action==='register') {
            if(($input['pinAgain']??null)!==$pin) fail('Zadané PINy se liší.');
            if($u) fail('Tato přezdívka je obsazená. Zvol jinou.',409);
            try {
                query('INSERT INTO pc_users (nickname,pin_hash,preferences,created_at) VALUES (?,?,?,UTC_TIMESTAMP())',[$name,password_hash($pin,PASSWORD_DEFAULT),json_encode(settings($input['preferences']??[]))]);
            } catch(PDOException $e) { if($e->getCode()==='23000') fail('Tato přezdívka je obsazená. Zvol jinou.',409); throw $e; }
            $u=query('SELECT * FROM pc_users WHERE id=?',[$db->lastInsertId()])->fetch();
        } elseif(!$u||!password_verify($pin,$u['pin_hash'])) fail('Přezdívka nebo PIN nesouhlasí.',401);
        logIn($u);respond(['user'=>profile($u)]);
    }
    if(!$user) fail('Přihlas se znovu. Tvoje pokroky zůstaly uložené.',401);
    if($action==='chess') { require __DIR__.'/chess-api.php';chessDispatch($input,$user); }
    if($action==='logout') { query('DELETE FROM pc_tokens WHERE token_hash=?',[hash('sha256',$_COOKIE['pc_login']??'')]);cookie('pc_login','',time()-3600);respond(['ok'=>true]); }
    if($action==='settings') {
        $prefs=settings($input);
        query('UPDATE pc_users SET preferences=? WHERE id=?',[json_encode($prefs),$user['id']]);
        respond(['ok'=>true]);
    }
    if($action==='start') {
        $s=settings($input['settings']??[]);$s['answerVersion']=2;$s['mode']=($input['mode']??'')==='battle'?'battle':'practice';$pool=exercisePool($s);
        for($i=count($pool)-1;$i>0;$i--) { $j=random_int(0,$i);[$pool[$i],$pool[$j]]=[$pool[$j],$pool[$i]]; }
        $items=array_slice($pool,0,$s['mode']==='battle'?1:$s['count']);$id=bin2hex(random_bytes(16));
        query('INSERT INTO pc_sets (id,user_id,week_start,settings,exercises,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())',[$id,$user['id'],weekStart(),json_encode($s),json_encode($items)]);
        respond(['setId'=>$id,'exercises'=>array_map(static fn($e)=>array_intersect_key($e,array_flip(['operation','a','b','type','choices'])),$items),'user'=>profile($user)]);
    }
    if($action==='check') {
        $id=$input['setId']??'';$answers=$input['answers']??null;
        if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)||!is_array($answers)||count($answers)<1||count($answers)>12) fail('Neplatná sada příkladů.');
        $db->beginTransaction();
        // Zámek hráče sjednocuje současné požadavky z více zařízení.
        $user=query('SELECT * FROM pc_users WHERE id=? FOR UPDATE',[$user['id']])->fetch();
        $set=query('SELECT * FROM pc_sets WHERE id=? AND user_id=? FOR UPDATE',[$id,$user['id']])->fetch();
        if(!$set) { $db->rollBack();fail('Sada již není dostupná. Použij Nové příklady.',404); }
        if($set['week_start']!==weekStart()) { $db->rollBack();fail('Začal nový týden. Použij Nové příklady a začni nové kolo.',409); }
        $items=json_decode($set['exercises'],true);$s=json_decode($set['settings'],true);
        $indices=[];
        if(($s['answerVersion']??0)!==2) { $db->rollBack();fail('Pravidla příkladů se změnila. Načti Nové příklady.',409); }
        foreach($answers as $answer) {
            $index=$answer['index']??null;$values=$answer['values']??null;
            if(!is_int($index)||!isset($items[$index])||isset($indices[$index])||!is_array($values)||count($values)!==(requiresDecomposition($items[$index],$s)?3:1)) { $db->rollBack();fail('Neplatné odpovědi.'); }
            $indices[$index]=$values;
        }
        ksort($indices);
        query('INSERT IGNORE INTO pc_weeks (user_id,week_start) VALUES (?,?)',[$user['id'],weekStart()]);
        $w=query('SELECT * FROM pc_weeks WHERE user_id=? AND week_start=? FOR UPDATE',[$user['id'],weekStart()])->fetch();
        $checks=[];
        foreach($indices as $index=>$values) {
            $correct=answerChecks($items[$index],$values,$s);$ok=!in_array(false,$correct,true);
            $checks[]=['index'=>$index,'checks'=>$correct];
            recordAnswer($items[$index],$w,$ok);
        }
        $complete=!in_array(false,array_column($items,'solved'),true);
        if($s['mode']!=='battle' && $complete && !(int)$set['completed']) { $w['completed_sets']++;query('UPDATE pc_users SET lifetime_sets=lifetime_sets+1 WHERE id=?',[$user['id']]); }
        query('UPDATE pc_sets SET exercises=?,completed=? WHERE id=?',[json_encode($items),(int)$complete,$id]);
        query('UPDATE pc_weeks SET solved=?,correct=?,completed_sets=?,streak=?,best_streak=?,last_used=? WHERE user_id=? AND week_start=?',[$w['solved'],$w['correct'],$w['completed_sets'],$w['streak'],$w['best_streak'],date('Y-m-d'),$user['id'],weekStart()]);
        $user=query('SELECT * FROM pc_users WHERE id=?',[$user['id']])->fetch();$data=profile($user);$db->commit();
        respond(['checks'=>$checks,'completed'=>$complete,'user'=>$data]);
    }
    if($action==='leaderboard') {
        $page=max(1,(int)($_GET['page']??1));$size=25;$offset=($page-1)*$size;
        $total=(int)query('SELECT COUNT(*) FROM pc_weeks WHERE week_start=? AND solved>0',[weekStart()])->fetchColumn();
        $rows=query('SELECT u.id,u.nickname,u.preferences,u.lifetime_sets,w.correct,w.solved,w.completed_sets FROM pc_weeks w JOIN pc_users u ON u.id=w.user_id WHERE w.week_start=? AND w.solved>0 ORDER BY w.correct DESC,u.nickname ASC,u.id ASC LIMIT '.$size.' OFFSET '.$offset,[weekStart()])->fetchAll();
        $entries=[];foreach($rows as $row) {
            $rank=1+(int)query('SELECT COUNT(*) FROM pc_weeks WHERE week_start=? AND solved>0 AND correct>?',[weekStart(),$row['correct']])->fetchColumn();
            $entries[]=['rank'=>$rank,'nickname'=>$row['nickname'],'points'=>(int)$row['correct']*10,'title'=>rewardTitle((int)$row['lifetime_sets'],settings(json_decode($row['preferences'],true))['gender']),'mine'=>(int)$row['id']===(int)$user['id']];
        }
        respond(['week'=>weekStart(),'page'=>$page,'pages'=>max(1,(int)ceil($total/$size)),'entries'=>$entries]);
    }
    fail('Neznámá akce.',404);
} catch(Throwable $e) {
    if(isset($db)&&$db->inTransaction()) $db->rollBack();
    error_log('Pocitame API: '.$e->getMessage());
    fail('Server není připravený nebo došlo k chybě. Zkontrolujte konfiguraci, import databáze a PHP log.',500);
}
