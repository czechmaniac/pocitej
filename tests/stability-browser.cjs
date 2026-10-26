const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const server=spawn(process.env.PHP_BINARY||'php',['-n','-S','127.0.0.1:8769','-t',require('node:path').resolve(__dirname,'..')],{stdio:'ignore'});
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:950},isMobile:mobile,hasTouch:mobile});
  let prefs={operation:'addition',range:20,count:12,gender:'boy',largeText:false,multiplicationLimit:100};
  let setId=0;
  const user=()=>({id:1,nickname:'Test',preferences:prefs,statistics:{},lifetimeSets:0,week:'2026-10-26'});
  await page.route('**/googletagmanager.com/**',r=>r.abort());
  await page.route('**/api/index.php?*',async route=>{
   const action=new URL(route.request().url()).searchParams.get('action');const body=route.request().postDataJSON();let result;
   if(action==='me')result={csrf:'test',user:user()};
   else if(action==='settings'){prefs=body;result={ok:true};}
   else if(action==='start')result={setId:String(++setId),exercises:Array.from({length:12},(_,i)=>({operation:'addition',a:i+1,b:1,type:'direct',choices:[i+1,i+2,i+3]})),user:user()};
   else if(action==='check')result={checks:body.answers.map(({index,values})=>({index,checks:[values[0]===index+2]})),completed:false,user:user()};
   else throw Error(action);
   if(action!=='me')await new Promise(resolve=>setTimeout(resolve,180));
   await route.fulfill({json:result});
  });
  await page.goto('http://127.0.0.1:8769');await page.waitForFunction(()=>serverSetId!==null&&!waiting);
  async function stable(action,selectors){
   await page.mouse.move(0,0);await page.waitForTimeout(200);
   await page.evaluate(selectors=>{
    window.stabilityDone=false;window.stabilityFrames=[];
    const frame=()=>{window.stabilityFrames.push({scroll:[scrollX,scrollY],pageSize:state.pageSize,boxes:selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height]})});if(!window.stabilityDone)requestAnimationFrame(frame);};frame();
   },selectors);
   await action();await page.waitForFunction(()=>!waiting);await page.waitForTimeout(200);
   const frames=await page.evaluate(()=>{window.stabilityDone=true;return window.stabilityFrames;});
   const first=frames[0];let max=0;
   for(const frame of frames){for(let i=0;i<first.boxes.length;i++)for(let j=0;j<4;j++)max=Math.max(max,Math.abs(first.boxes[i][j]-frame.boxes[i][j]));assert.deepEqual(frame.scroll,first.scroll);assert.equal(frame.pageSize,first.pageSize);}
   assert(max<1,`${mobile?'mobile':'desktop'} layout moved ${max}px during request`);
  }
  await stable(()=>page.locator('[data-exercise="0"][value="2"]').check(),['header','.worksheet','#exercise-grid','.bottom-bar']);
  await stable(()=>page.locator('#new-set').click(),['header','.worksheet','#exercise-grid','.bottom-bar','#new-set']);
  await page.locator('[data-view="settings"]').click();
  await stable(()=>page.locator('[data-range="50"]').click(),['header','#settings-view','#range-options']);
  await page.close();
 }
 console.log('PASS: desktop and touch mobile keep layout, scroll and page size stable during answer checks, new sets and settings requests');
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
