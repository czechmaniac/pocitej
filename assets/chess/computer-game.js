import {Chess} from './chess-engine.js';
const key=chess=>chess.fen().split(' ').slice(0,4).join(' ');
export class ComputerGame {
 constructor({side='w',level=2,moves=[],reason=null,winner=null,timeSeconds=0,remaining=null,clockStartedMs=null}={}){
  this.engine=new Chess();this.side=side==='b'?'b':'w';this.level=[1,2,3].includes(level)?level:2;this.moves=[];this.keys=[key(this.engine)];this.reason=null;this.winner=null;this.worker=null;this.pendingResolve=null;
  this.timeSeconds=0;this.remaining={w:0,b:0};this.clockStartedMs=0;
  for(const move of moves)this.move(move);
  this.timeSeconds=[0,300,600,900].includes(timeSeconds)?timeSeconds:0;const base=this.timeSeconds*1000;
  this.remaining={w:Number.isFinite(remaining?.w)?Math.max(0,Math.min(base,remaining.w)):base,b:Number.isFinite(remaining?.b)?Math.max(0,Math.min(base,remaining.b)):base};
  this.clockStartedMs=this.timeSeconds?(Number.isFinite(clockStartedMs)&&clockStartedMs>0?clockStartedMs:Date.now()):0;
  if(['resigned','fifty','threefold','timeout','timeout_draw'].includes(reason)){this.reason=reason;this.winner=winner==='w'||winner==='b'?winner:null;}
  this.checkTimeout();
 }
 static restore(storageKey){try{const data=JSON.parse(localStorage.getItem(storageKey));if(!data||!Array.isArray(data.moves)||data.moves.length>3000)return null;return new ComputerGame(data);}catch{return null;}}
 save(storageKey){try{localStorage.setItem(storageKey,JSON.stringify({side:this.side,level:this.level,moves:this.moves,reason:this.reason,winner:this.winner,timeSeconds:this.timeSeconds,remaining:this.remaining,clockStartedMs:this.clockStartedMs}));return true;}catch{return false;}}
 move(input){
  const now=Date.now();this.checkTimeout(now);if(this.reason)throw Error('Partie už skončila.');
  const clock=this.clockSnapshot(now);
  const move=this.engine.move({from:input.from,to:input.to,...(input.promotion?{promotion:input.promotion}:{})});
  if(clock){this.remaining={w:clock.whiteMs,b:clock.blackMs};this.clockStartedMs=now;}
  this.moves.push({from:move.from,to:move.to,promotion:move.promotion||null,san:move.san});this.keys.push(key(this.engine));
  if(this.engine.isCheckmate()){this.reason='checkmate';this.winner=this.engine.turn()==='w'?'b':'w';}
  else if(this.engine.isStalemate())this.reason='stalemate';
  else if(this.engine.isInsufficientMaterial())this.reason='material';
  else if(Number(this.engine.fen().split(' ')[4])>=150)this.reason='seventyfive';
  else if(this.keys.filter(k=>k===key(this.engine)).length>=5)this.reason='fivefold';
  return move;
 }
 clockSnapshot(now=Date.now()){
  if(!this.timeSeconds)return null;let {w,b}=this.remaining;const active=this.reason?null:this.engine.turn();
  if(active&&this.clockStartedMs){const elapsed=Math.max(0,now-this.clockStartedMs);if(active==='w')w-=elapsed;else b-=elapsed;}
  return {limitSeconds:this.timeSeconds,whiteMs:Math.max(0,w),blackMs:Math.max(0,b),active,asOf:now};
 }
 checkTimeout(now=Date.now()){
  const clock=this.clockSnapshot(now);if(!clock||this.reason||(clock.active==='w'?clock.whiteMs:clock.blackMs)>0)return false;
  const winner=clock.active==='w'?'b':'w',canMate=!this.engine.isInsufficientMaterial()&&this.engine.board().flat().some(p=>p?.color===winner&&p.type!=='k');
  this.remaining={w:clock.whiteMs,b:clock.blackMs};this.clockStartedMs=now;this.reason=canMate?'timeout':'timeout_draw';this.winner=canMate?winner:null;return true;
 }
 get snapshot(){
  const turn=this.engine.turn(),active=!this.reason;
  return {id:'computer',computer:true,fen:this.engine.fen(),you:this.side,turn,white:this.side==='w'?'Ty':'Počítač',black:this.side==='b'?'Ty':'Počítač',status:active?'active':'finished',reason:this.reason,winner:this.winner,drawOffer:null,clock:this.clockSnapshot(),
   canClaimDraw:active&&turn===this.side&&(this.engine.isThreefoldRepetition()||this.engine.isDrawByFiftyMoves()),check:this.engine.isCheck(),revision:this.moves.length,legal:active&&turn===this.side?this.engine.moves({verbose:true}).map(m=>({from:m.from,to:m.to,promotion:m.promotion||null})):[],moves:this.moves};
 }
 action(op,extra){
  const now=Date.now();this.checkTimeout(now);if(this.reason)throw Error('Partie už skončila.');
  if(op==='move'){if(this.engine.turn()!==this.side)throw Error('Teď je na tahu počítač.');this.move(extra);}
  else if(op==='resign'){const clock=this.clockSnapshot(now);if(clock){this.remaining={w:clock.whiteMs,b:clock.blackMs};this.clockStartedMs=now;}this.reason='resigned';this.winner=this.side==='w'?'b':'w';}
  else if(op==='claim_draw'&&this.snapshot.canClaimDraw){const clock=this.clockSnapshot(now);if(clock){this.remaining={w:clock.whiteMs,b:clock.blackMs};this.clockStartedMs=now;}this.reason=this.engine.isDrawByFiftyMoves()?'fifty':'threefold';}
  else throw Error('Tato akce teď není možná.');
 }
 stop(){if(this.worker){this.worker.terminate();this.worker=null;}this.pendingResolve?.();this.pendingResolve=null;}
 think(){
  this.checkTimeout();
  if(this.reason||this.engine.turn()===this.side)return Promise.resolve();
  this.stop();const fen=this.engine.fen();
  return new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('../../chess-worker.js',import.meta.url),{type:'module'});this.worker=worker;this.pendingResolve=resolve;
   worker.onmessage=event=>{worker.terminate();if(this.worker!==worker)return;this.worker=null;this.pendingResolve=null;if(event.data.error){reject(Error(event.data.error));return;}try{this.checkTimeout();if(!this.reason&&this.engine.fen()===fen&&event.data.move)this.move(event.data.move);resolve();}catch(error){reject(error);}};
   worker.onerror=()=>{worker.terminate();if(this.worker===worker)this.worker=null;this.pendingResolve=null;reject(Error('Nepodařilo se spustit počítačového soupeře. Zkus pokračovat znovu.'));};
   worker.postMessage({fen,level:this.level});
  });
 }
}
