const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({client,request,config,temp}){
  assert.equal((await (await client.get('/api/feedback.php')).json()).enabled,false);
  const password='feedback-test-password-1234';
  fs.writeFileSync(path.join(temp,'api/feedback-admin.config.php'),'<?php return ["password"=>"'+password+'"];');
  let html=await (await client.get('/api/feedback-admin.php')).text();
  const csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
  let r=await client.post('/api/feedback-admin.php',{headers:{Origin:config.origin},form:{csrf,action:'login',password:'wrong'}});
  assert((await r.text()).includes('Heslo nesouhlasí.'));
  r=await client.post('/api/feedback-admin.php',{headers:{Origin:config.origin},form:{csrf,action:'login',password}});
  assert((await r.text()).includes('Zatím tu nejsou'));
  const guest=await request.newContext({baseURL:config.origin});
  try {
    const info=await (await guest.get('/api/feedback.php')).json();assert(info.enabled&&info.csrf);
    const headers={Origin:config.origin,'X-CSRF-Token':info.csrf};
    const message='Chci novou příšeru <script>alert("test")</script>';
    const data={id:'a'.repeat(32),category:'idea',message,website:''};
    r=await guest.post('/api/feedback.php',{headers:{...headers,'X-CSRF-Token':'wrong'},data});assert.equal(r.status(),403);
    r=await guest.post('/api/feedback.php',{headers:{...headers,Origin:'https://other.test'},data});assert.equal(r.status(),403);
    for(const bad of [{...data,message:''},{...data,message:'x'.repeat(1001)},{...data,category:'<script>'},{...data,id:'invalid'},{...data,website:'spam'}]) {
      r=await guest.post('/api/feedback.php',{headers,data:bad});assert.equal(r.status(),400,await r.text());
    }
    r=await guest.post('/api/feedback.php',{headers,data});assert.equal(r.status(),200,await r.text());assert((await r.json()).ok);
    r=await guest.post('/api/feedback.php',{headers,data});assert.equal(r.status(),200);
    r=await guest.post('/api/feedback.php',{headers,data:{...data,id:'b'.repeat(32)}});assert.equal(r.status(),429);
    html=await (await guest.get('/api/feedback-admin.php')).text();assert(!html.includes('Chci novou příšeru'));
    html=await (await client.get('/api/feedback-admin.php')).text();assert(html.includes('Chci novou příšeru &lt;script&gt;'));assert(!html.includes('<script>alert'));assert.equal((html.match(/Chci novou příšeru/g)||[]).length,1);
    r=await client.post('/api/feedback-admin.php',{headers:{Origin:config.origin},form:{csrf,action:'review',id:data.id}});assert(!(await r.text()).includes('Chci novou příšeru'));
    html=await (await client.get('/api/feedback-admin.php?filter=all')).text();assert(html.includes('Chci novou příšeru'));
    await client.post('/api/feedback-admin.php',{headers:{Origin:config.origin},form:{csrf,action:'logout'}});
    html=await (await client.get('/api/feedback-admin.php?filter=all')).text();assert(!html.includes('Chci novou příšeru'));
  } finally {await guest.dispose();}
  // Use a real form submission too: manually supplied Origin headers cannot
  // detect a Referrer-Policy that strips Origin in the browser.
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  try {
    const page=await browser.newPage(),origins=[];
    page.on('request',r=>{if(r.method()==='POST')origins.push(r.headers().origin);});
    await page.goto(config.origin+'/api/feedback-admin.php');
    await page.locator('[name="password"]').fill('wrong-test-password');
    await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Heslo nesouhlasí.'}).waitFor();
    await page.locator('[name="password"]').fill(password);
    await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();
    await page.getByRole('button',{name:'Odhlásit se',exact:true}).waitFor();
    await page.getByRole('button',{name:'Odhlásit se',exact:true}).click();
    await page.getByRole('button',{name:'Přihlásit se',exact:true}).waitFor();
    assert.equal(origins.length,3);assert(origins.every(origin=>origin===config.origin));
  } finally {await browser.close();}
  console.log('PASS: real feedback API, guest submission, validation, CSRF, retry deduplication, rate limit, private admin and escaped content');
};
