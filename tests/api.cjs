// Requires an empty disposable MySQL database configured via TEST_DB_*.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const {request}=require('playwright');
const rules=require('../exercises.js');
const php=process.env.PHP_BINARY||'php';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pocitej-api-'));
const config={db_host:process.env.TEST_DB_HOST||'127.0.0.1',db_port:Number(process.env.TEST_DB_PORT||3306),db_name:process.env.TEST_DB_NAME,db_user:process.env.TEST_DB_USER||'root',db_password:process.env.TEST_DB_PASSWORD||'',origin:'http://127.0.0.1:8766',cookie_path:'/',secure_cookies:false};
assert(config.db_name,'TEST_DB_NAME must name an empty disposable database');
fs.mkdirSync(path.join(temp,'api'));
for(const n of ['index.php','logic.php'])fs.copyFileSync(path.join(__dirname,'../api',n),path.join(temp,'api',n));
fs.writeFileSync(path.join(temp,'api/config.php'),'<?php return json_decode('+JSON.stringify(JSON.stringify(config))+',true);');
const setup=`<?php $c=json_decode(file_get_contents($argv[1]),true);$db=new PDO('mysql:host='.$c['db_host'].';port='.$c['db_port'].';dbname='.$c['db_name'],$c['db_user'],$c['db_password']);if($db->query('SHOW TABLES')->fetch())throw new Exception('Database must be empty');$db->exec(file_get_contents($argv[2]));`;
fs.writeFileSync(path.join(temp,'setup.php'),setup);fs.writeFileSync(path.join(temp,'config.json'),JSON.stringify(config));
execFileSync(php,[path.join(temp,'setup.php'),path.join(temp,'config.json'),path.join(__dirname,'api-schema.sql')]);
const server=spawn(php,['-S','127.0.0.1:8766','-t',temp],{stdio:'ignore'});
(async()=>{let client;try{
 client=await request.newContext({baseURL:config.origin});
 let me;for(let i=0;i<30;i++){try{me=await (await client.get('/api/index.php?action=me')).json();break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert(me.csrf);
 const post=async(action,body,expected=200)=>{const r=await client.post('/api/index.php?action='+action,{headers:{Origin:config.origin,'X-CSRF-Token':me.csrf},data:body});assert.equal(r.status(),expected,await r.text());return r.json();};
 await post('register',{nickname:'ApiTest',pin:'1234',pinAgain:'1234'});
 let solved=0,correct=0,completedSets=0;
 for(const operation of ['addition','subtraction','multiplication'])for(const range of [10,20]){
  const s=await post('start',{settings:{operation,range,count:12}});assert.equal(s.exercises.length,12);
  const answers=s.exercises.map((item,index)=>{const e=rules.decorate(item);return {index,values:e.type==='direct'?[e.result]:[e.decomposition1,e.decomposition2,e.result]};});
  await post('check',{setId:s.setId,answers:[{index:0,values:[]}]},400);
  const first=await post('check',{setId:s.setId,answers});solved+=12;correct+=12;completedSets++;
  assert(first.completed);assert.equal(first.user.statistics.solved,solved);assert.equal(first.user.statistics.correct,correct);assert.equal(first.user.statistics.completedSets,completedSets);
  const retry=await post('check',{setId:s.setId,answers});assert.deepEqual(retry.user.statistics,first.user.statistics);
 }
 const battle=await post('start',{mode:'battle',settings:{operation:'subtraction',range:20}});assert.equal(battle.exercises.length,1);assert.equal(battle.exercises[0].type,'direct');assert.equal(battle.exercises[0].choices.length,3);
 const e=rules.decorate(battle.exercises[0]),values=e.type==='direct'?[e.result]:[e.decomposition1,e.decomposition2,e.result];
 await post('check',{setId:battle.setId,answers:[{index:0,values:values.map(()=>null)}]});
 const repaired=await post('check',{setId:battle.setId,answers:[{index:0,values}]});assert(repaired.completed);assert.equal(repaired.user.statistics.solved,solved+1);assert.equal(repaired.user.statistics.correct,correct);assert.equal(repaired.user.statistics.completedSets,completedSets);
 console.log('PASS: real PHP/MySQL API, all operation/range modes, malformed payload, retry idempotency, repair and battle statistics');
}finally{if(client)await client.dispose();server.kill();fs.rmSync(temp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
