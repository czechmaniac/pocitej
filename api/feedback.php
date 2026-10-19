<?php
declare(strict_types=1);
require __DIR__.'/feedback-common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function feedbackReply(array $data,int $status=200): never {
    http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
}
try {
    if (feedbackAdminPassword()==='') feedbackReply(['enabled'=>false],($_SERVER['REQUEST_METHOD']??'GET')==='GET'?200:503);
    $config=feedbackConfig();$db=feedbackDatabase($config);feedbackSession($config);
    try { $db->query('SELECT id FROM pc_feedback LIMIT 1'); }
    catch (PDOException $e) { if ($e->getCode()==='42S02') feedbackReply(['enabled'=>false],($_SERVER['REQUEST_METHOD']??'GET')==='GET'?200:503);throw $e; }
    if (($_SERVER['REQUEST_METHOD']??'GET')==='GET') feedbackReply(['enabled'=>true,'csrf'=>$_SESSION['feedback_csrf']]);
    if ($_SERVER['REQUEST_METHOD']!=='POST') feedbackReply(['error'=>'Použij odeslání formuláře.'],405);
    if (($_SERVER['HTTP_ORIGIN']??'')!==$config['origin']||!hash_equals($_SESSION['feedback_csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) feedbackReply(['error'=>'Obnov stránku a zkus to znovu.'],403);
    $raw=file_get_contents('php://input',false,null,0,8193);
    if (strlen($raw)>8192) feedbackReply(['error'=>'Návrh je příliš dlouhý.'],413);
    try { $input=json_decode($raw,true,16,JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { feedbackReply(['error'=>'Návrh se nepodařilo přečíst.'],400); }
    if (!is_array($input)) feedbackReply(['error'=>'Neplatný návrh.'],400);
    $message=feedbackMessage($input['message']??null);$category=$input['category']??'';$id=$input['id']??'';
    if ($message===null||!in_array($category,['idea','problem','other'],true)||!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)||($input['website']??'')!=='') feedbackReply(['error'=>'Napiš 3 až 1000 znaků a vyber druh zprávy.'],400);
    $find=$db->prepare('SELECT id FROM pc_feedback WHERE id=?');$find->execute([$id]);
    if ($find->fetch()) feedbackReply(['ok'=>true]); // A lost response may be safely retried.
    if (time()-(int)($_SESSION['feedback_last_sent']??0)<60) feedbackReply(['error'=>'Další návrh můžeš poslat za minutku.'],429);
    $insert=$db->prepare('INSERT INTO pc_feedback (id,message,category,created_at) VALUES (?,?,?,UTC_TIMESTAMP())');
    $insert->execute([$id,$message,$category]);$_SESSION['feedback_last_sent']=time();
    feedbackReply(['ok'=>true]);
} catch (Throwable $e) {
    error_log('Pocitej feedback: '.$e->getMessage());
    feedbackReply(['error'=>'Odeslání se nepodařilo. Text zůstal vyplněný, zkus to později.'],503);
}
