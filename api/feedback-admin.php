<?php
declare(strict_types=1);
require __DIR__.'/feedback-common.php';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
// Keep Origin on same-site form POSTs so the strict CSRF origin check can pass.
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
header('X-Robots-Tag: noindex, nofollow');
function feedbackEscape(mixed $value): string { return htmlspecialchars((string)$value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
$error='';$ready=false;$authenticated=false;$rows=[];$page=1;$pages=1;$filter='new';
try {
    $config=feedbackConfig();feedbackSession($config);$password=feedbackAdminPassword();
    $ready=$password!=='';
    if (!$ready) $error='Nejdřív vytvoř na FTP soubor api/feedback-admin.config.php podle vzoru a nastav vlastní heslo o alespoň 16 znacích.';
    $authenticated=$ready&&hash_equals(hash('sha256',$password),(string)($_SESSION['feedback_admin_signature']??''))&&time()<(int)($_SESSION['feedback_admin_until']??0);
    if (($_SERVER['REQUEST_METHOD']??'GET')==='POST') {
        if (($_SERVER['HTTP_ORIGIN']??'')!==$config['origin']||!hash_equals($_SESSION['feedback_csrf'],(string)($_POST['csrf']??''))) { http_response_code(403);throw new RuntimeException('Obnov stránku a zkus to znovu.'); }
        $action=$_POST['action']??'';
        if ($action==='login'&&$ready) {
            if (time()<(int)($_SESSION['feedback_login_blocked_until']??0)) throw new RuntimeException('Příliš mnoho pokusů. Zkus přihlášení za 15 minut.');
            $provided=$_POST['password']??'';
            if (!is_string($provided)||!hash_equals($password,$provided)) {
                $_SESSION['feedback_login_attempts']=(int)($_SESSION['feedback_login_attempts']??0)+1;
                if ($_SESSION['feedback_login_attempts']>=5) { $_SESSION['feedback_login_blocked_until']=time()+900;$_SESSION['feedback_login_attempts']=0; }
                throw new RuntimeException('Heslo nesouhlasí.');
            }
            session_regenerate_id(true);$_SESSION['feedback_admin_signature']=hash('sha256',$password);$_SESSION['feedback_admin_until']=time()+1800;$_SESSION['feedback_login_attempts']=0;
            header('Location: feedback-admin.php',true,303);exit;
        }
        if ($action==='logout') { unset($_SESSION['feedback_admin_signature'],$_SESSION['feedback_admin_until']);session_regenerate_id(true);header('Location: feedback-admin.php',true,303);exit; }
        if ($action==='review'&&$authenticated) {
            $id=$_POST['id']??'';
            if (!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)) throw new RuntimeException('Neplatná zpráva.');
            $db=feedbackDatabase($config);$q=$db->prepare('UPDATE pc_feedback SET reviewed=1 WHERE id=?');$q->execute([$id]);
            header('Location: feedback-admin.php',true,303);exit;
        }
    }
    if ($authenticated) {
        $db=feedbackDatabase($config);$db->exec(feedbackSchema());
        $filter=($_GET['filter']??'')==='all'?'all':'new';$where=$filter==='new'?' WHERE reviewed=0':'';
        $count=(int)$db->query('SELECT COUNT(*) FROM pc_feedback'.$where)->fetchColumn();$pages=max(1,(int)ceil($count/50));$page=min($pages,max(1,(int)($_GET['page']??1)));
        $rows=$db->query('SELECT id,message,category,created_at,reviewed FROM pc_feedback'.$where.' ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET '.(($page-1)*50))->fetchAll();
    }
} catch (PDOException $e) { error_log('Pocitej feedback admin: '.$e->getMessage());$error='Úložiště není připravené. Zkontroluj připojení a oprávnění databáze pro vytvoření tabulky.'; }
catch (Throwable $e) { $error=$e instanceof RuntimeException?$e->getMessage():'Přehled se nepodařilo načíst.'; }
?>
<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nápady návštěvníků — Počítáme</title><link rel="stylesheet" href="../feedback.css?v=1"></head><body class="feedback-admin"><main>
<h1>Nápady návštěvníků</h1>
<?php if ($error!==''): ?><p role="alert"><?=feedbackEscape($error)?></p><?php endif; ?>
<?php if (!$authenticated&&$ready): ?>
<p>Soukromý přehled správce webu.</p><form method="post"><input type="hidden" name="csrf" value="<?=feedbackEscape($_SESSION['feedback_csrf'])?>"><input type="hidden" name="action" value="login"><label>Heslo správce <input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><button>Přihlásit se</button></form>
<?php elseif ($authenticated): ?>
<form method="post"><input type="hidden" name="csrf" value="<?=feedbackEscape($_SESSION['feedback_csrf'])?>"><input type="hidden" name="action" value="logout"><button>Odhlásit se</button></form>
<p>Odesílatel nemusí mít profil. Zprávy neobsahují automaticky přezdívku ani kontakt. Časy jsou převedené na český čas.</p>
<nav><a href="?filter=new">Nové návrhy</a> · <a href="?filter=all">Všechny návrhy</a> · <a href="../">Zpět na web</a></nav>
<?php if (!$rows): ?><p>Zatím tu nejsou žádné <?= $filter==='new'?'nové ':'' ?>návrhy.</p><?php endif; ?>
<?php foreach ($rows as $row): $date=(new DateTimeImmutable($row['created_at'],new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Europe/Prague')); ?>
<article><h2><?=feedbackEscape(['idea'=>'Nápad','problem'=>'Něco nefunguje','other'=>'Jiné'][$row['category']]??'Jiné')?></h2><p><?=feedbackEscape($date->format('j. n. Y H:i'))?> · <?=$row['reviewed']?'Přečteno':'Nové'?></p><p class="feedback-message"><?=feedbackEscape($row['message'])?></p>
<?php if (!$row['reviewed']): ?><form method="post"><input type="hidden" name="csrf" value="<?=feedbackEscape($_SESSION['feedback_csrf'])?>"><input type="hidden" name="action" value="review"><input type="hidden" name="id" value="<?=feedbackEscape($row['id'])?>"><button>Označit jako přečtené</button></form><?php endif; ?></article>
<?php endforeach; ?>
<p>Stránka <?=$page?> / <?=$pages?></p><nav><?php if ($page>1): ?><a href="?filter=<?=feedbackEscape($filter)?>&amp;page=<?=$page-1?>">← Předchozí</a><?php endif; ?> <?php if ($page<$pages): ?><a href="?filter=<?=feedbackEscape($filter)?>&amp;page=<?=$page+1?>">Další →</a><?php endif; ?></nav>
<?php endif; ?></main></body></html>
