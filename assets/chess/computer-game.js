import {Chess} from './chess-engine.js';
const key=chess=>chess.fen().split(' ').slice(0,4).join(' ');
export class ComputerGame {
 constructor({side='w',level=2,moves=[],reason=null,winner=null}={}){
  this.engine=new Chess();this.side=side==='b'?'b':'w';this.level=[1,2,3].includes(level)?level:2;this.moves=[];this.keys=[key(this.engine)];this.reason=null;this.winner=null;this.worker=null;this.pendingResolve=null;
  for(const move of moves)this.move(move);
  if(['resigned','fifty','threefold'].includes(reason)){this.reason=reason;this.winner=winner==='w'||winner==='b'?winner:null;}
 }
 static restore(storageKey){try{const data=JSON.parse(localStorage.getItem(storageKey));if(!data||!Array.isArray(data.moves)||data.moves.length>3000)return null;return new ComputerGame(data);}catch{return null;}}
 save(storageKey){try{localStorage.setItem(storageKey,JSON.stringify({side:this.side,level:this.level,moves:this.moves,reason:this.reason,winner:this.winner}));return true;}catch{return false;}}
 move(input){
  if(this.reason)throw Error('Partie už skončila.');
  const move=this.engine.move({from:input.from,to:input.to,...(input.promotion?{promotion:input.promotion}:{})});
  this.moves.push({from:move.from,to:move.to,promotion:move.promotion||null,san:move.san});this.keys.push(key(this.engine));
  if(this.engine.isCheckmate()){this.reason='checkmate';this.winner=this.engine.turn()==='w'?'b':'w';}
  else if(this.engine.isStalemate())this.reason='stalemate';
  else if(this.engine.isInsufficientMaterial())this.reason='material';
  else if(Number(this.engine.fen().split(' ')[4])>=150)this.reason='seventyfive';
  else if(this.keys.filter(k=>k===key(this.engine)).length>=5)this.reason='fivefold';
  return move;
 }
 get snapshot(){
  const turn=this.engine.turn(),active=!this.reason;
  return {id:'computer',computer:true,fen:this.engine.fen(),you:this.side,turn,white:this.side==='w'?'Ty':'Počítač',black:this.side==='b'?'Ty':'Počítač',status:active?'active':'finished',reason:this.reason,winner:this.winner,drawOffer:null,
   canClaimDraw:active&&turn===this.side&&(this.engine.isThreefoldRepetition()||this.engine.isDrawByFiftyMoves()),check:this.engine.isCheck(),revision:this.moves.length,legal:active&&turn===this.side?this.engine.moves({verbose:true}).map(m=>({from:m.from,to:m.to,promotion:m.promotion||null})):[],moves:this.moves};
 }
 action(op,extra){
  if(op==='move'){if(this.engine.turn()!==this.side)throw Error('Teď je na tahu počítač.');this.move(extra);}
  else if(op==='resign'){this.reason='resigned';this.winner=this.side==='w'?'b':'w';}
  else if(op==='claim_draw'&&this.snapshot.canClaimDraw)this.reason=this.engine.isDrawByFiftyMoves()?'fifty':'threefold';
  else throw Error('Tato akce teď není možná.');
 }
 stop(){if(this.worker){this.worker.terminate();this.worker=null;}this.pendingResolve?.();this.pendingResolve=null;}
 think(){
  if(this.reason||this.engine.turn()===this.side)return Promise.resolve();
  this.stop();const fen=this.engine.fen();
  return new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('../../chess-worker.js',import.meta.url),{type:'module'});this.worker=worker;this.pendingResolve=resolve;
   worker.onmessage=event=>{worker.terminate();if(this.worker!==worker)return;this.worker=null;this.pendingResolve=null;if(event.data.error){reject(Error(event.data.error));return;}if(this.engine.fen()===fen&&event.data.move)this.move(event.data.move);resolve();};
   worker.onerror=()=>{worker.terminate();if(this.worker===worker)this.worker=null;this.pendingResolve=null;reject(Error('Nepodařilo se spustit počítačového soupeře. Zkus pokračovat znovu.'));};
   worker.postMessage({fen,level:this.level});
  });
 }
}
