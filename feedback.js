'use strict';
(() => {
  const dialog=document.querySelector('#feedback-dialog');
  if (!dialog||typeof dialog.showModal!=='function') return;
  const form=dialog.querySelector('form'),message=dialog.querySelector('textarea'),status=dialog.querySelector('[role="status"]'),submit=form.querySelector('[type="submit"]'),openButton=document.querySelector('#feedback-open');
  const KEY='pocitame-feedback-prompt-v1',WEEK=7*24*60*60*1000;
  let csrf='',enabled=false,pending=false,requestId='',shownThisVisit=false;
  const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  function remember() { try { localStorage.setItem(KEY,String(Date.now())); } catch { /* Still suppress repeats within this visit. */ } }
  function due() { try { const last=Number(localStorage.getItem(KEY));return !Number.isFinite(last)||last<=0||Date.now()-last>=WEEK; } catch { return true; } }
  function open() {
    if (!enabled||dialog.open||document.querySelector('dialog[open]')) return;
    dialog.showModal();shownThisVisit=true;remember();
  }
  function close() { dialog.close(); }
  function autoOpen() {
    if (!shownThisVisit&&due()&&!document.hidden&&!document.body.classList.contains('battle-active')) open();
  }
  openButton.addEventListener('click',open);
  dialog.querySelector('[data-feedback-close]').addEventListener('click',close);
  // Closing the dialog must never leave keyboard focus behind an inert modal.
  dialog.addEventListener('close',()=>{openButton.focus({preventScroll:true});});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending||!form.reportValidity())return;
    const text=message.value.trim();
    if(Array.from(text).length<3){status.textContent='Napiš prosím alespoň 3 znaky.';message.focus();return;}
    pending=true;submit.disabled=true;status.textContent='Odesílám…';
    requestId ||= randomId();
    const payload={id:requestId,message:text,category:form.elements.category.value,website:form.elements.website.value};
    message.readOnly=true;form.elements.category.disabled=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch('api/feedback.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(payload),signal:controller.signal});
      const result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.error||'Odeslání se nepodařilo. Zkus to později.');
      form.reset();requestId='';status.textContent='Děkujeme za nápad! Pomůže nám Počítáme vylepšit.';
    } catch(error){status.textContent=error.name==='AbortError'?'Server neodpověděl včas. Text zůstal vyplněný, zkus odeslání znovu.':error.message||'Odeslání se nepodařilo. Text zůstal vyplněný.';}
    finally{clearTimeout(timeout);pending=false;submit.disabled=false;message.readOnly=false;form.elements.category.disabled=false;}
  });
  // Editing a failed proposal creates a new submission, while an unchanged retry is idempotent.
  form.addEventListener('input',()=>{if(!pending)requestId='';});
  fetch('api/feedback.php',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(result=>{
    if(!result?.enabled||typeof result.csrf!=='string')return;
    csrf=result.csrf;enabled=true;openButton.hidden=false;autoOpen();
  }).catch(()=>{}); // An unavailable feedback service must not block the app.
  document.addEventListener('visibilitychange',autoOpen);
})();
