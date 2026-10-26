const assert=require('node:assert/strict');
const {chromium}=require('playwright');
module.exports=async({config,A,B})=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 try{
  const ca=await browser.newContext({storageState:await A.client.storageState(),viewport:{width:1400,height:1100}}),cb=await browser.newContext({storageState:await B.client.storageState(),viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pa=await ca.newPage(),pb=await cb.newPage(),errors=[];
  for(const p of [pa,pb]){p.on('pageerror',e=>errors.push(e.message));await p.route('**/googletagmanager.com/**',r=>r.abort());await p.goto(config.origin);await p.locator('[data-view="chess"]').click();await p.waitForSelector('#chess-connection:text("Připojeno")');}
  await pa.locator('#chess-search').fill(B.nickname);await pa.locator('#chess-search-form button').click();
  await pb.locator('[data-invite-op="accept"]').click();
  await pa.waitForSelector('#chess-game-actions:visible');await pb.waitForSelector('#chess-game-actions:visible');
  const aWhite=await pa.locator('#chess-you-detail').textContent(),white=aWhite.includes('bílé')?pa:pb,black=white===pa?pb:pa;
  await white.bringToFront();await white.locator('[data-square="e2"]').click();assert.equal(await white.locator('[data-square="e4"]').getAttribute('class').then(x=>x.includes('legal')),true);
  await white.locator('[data-square="e4"]').click();await white.locator('[data-square="e4"] .ivory').waitFor();await black.bringToFront();await black.waitForSelector('#chess-turn:text("Jsi na tahu")');
  assert.equal(await black.locator('[data-square="e4"] .ivory').count(),1);
  await black.locator('[data-square="e7"]').click();await black.locator('[data-square="e5"]').click();
  await black.locator('[data-square="e5"] .navy').waitFor();await white.bringToFront();await white.locator('[data-square="e5"] .navy').waitFor();
  await white.reload();await white.locator('[data-view="chess"]').click();await white.locator('[data-square="e5"] .navy').waitFor();assert.equal(await white.locator('[data-square]').count(),64);
  await white.locator('#chess-pc-options summary').click();await white.locator('#chess-pc-start').click();await white.locator('#chess-connection').getByText('Hra proti PC',{exact:false}).waitFor();
  await white.locator('#chess-online').click();await white.locator('[data-square="e5"] .navy').waitFor();
  if(process.env.CHESS_SCREENSHOT)await pa.screenshot({path:process.env.CHESS_SCREENSHOT,fullPage:true});
  const overflow=await pb.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'mobile board must fit width');
  await black.bringToFront();await black.locator('#chess-resign').click();await black.locator('#chess-resign-cancel').click();assert.equal(await black.locator('#chess-game-actions').isVisible(),true);
  await black.bringToFront();await black.locator('#chess-resign').click();await black.locator('#chess-resign-confirm').click();await white.bringToFront();await white.waitForSelector('#chess-turn:text("Vyhrál/a jsi")');
  await white.locator('#chess-ranking').click();await white.locator('#chess-ranking-content table').waitFor();assert((await white.locator('#chess-ranking-content').textContent()).includes(A.nickname));await white.locator('#chess-ranking-close').click();
  assert.deepEqual(errors,[]);
  console.log('PASS: two browser accounts invite/accept and synchronize moves, persist on reload, render mobile board and confirm resignation');
 }finally{await browser.close();}
};
