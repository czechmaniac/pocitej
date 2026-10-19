<?php
declare(strict_types=1);

function feedbackConfig(): array {
    if (!is_file(__DIR__.'/config.php')) throw new RuntimeException('Missing configuration');
    return require __DIR__.'/config.php';
}
function feedbackDatabase(array $config): PDO {
    return new PDO('mysql:host='.$config['db_host'].';port='.$config['db_port'].';dbname='.$config['db_name'].';charset=utf8mb4', $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
}
function feedbackSession(array $config): void {
    session_name('pc_feedback');
    session_set_cookie_params(['lifetime'=>0,'path'=>$config['cookie_path'],'secure'=>$config['secure_cookies'],'httponly'=>true,'samesite'=>'Strict']);
    ini_set('session.use_strict_mode','1');
    session_start();
    if (!isset($_SESSION['feedback_csrf'])) $_SESSION['feedback_csrf']=bin2hex(random_bytes(32));
}
function feedbackAdminPassword(): string {
    if (!is_file(__DIR__.'/feedback-admin.config.php')) return '';
    $config=require __DIR__.'/feedback-admin.config.php';
    $password=$config['password']??'';
    return is_string($password)&&strlen($password)>=16&&$password!=='SEM_NAPIS_VLASTNI_DLOUHE_HESLO' ? $password : '';
}
function feedbackSchema(): string {
    return 'CREATE TABLE IF NOT EXISTS pc_feedback (id CHAR(32) PRIMARY KEY, message TEXT NOT NULL, category VARCHAR(16) NOT NULL, created_at DATETIME NOT NULL, reviewed TINYINT NOT NULL DEFAULT 0, INDEX feedback_created (created_at), INDEX feedback_reviewed (reviewed,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
}
function feedbackMessage(mixed $message): ?string {
    if (!is_string($message)||strlen($message)>4000||!preg_match('//u',$message)) return null;
    $message=trim($message);
    $length=preg_match_all('/./us',$message);
    return $length!==false&&$length>=3&&$length<=1000 ? $message : null;
}
