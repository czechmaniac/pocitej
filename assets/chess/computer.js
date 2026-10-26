import {Chess} from './chess-engine.js';
const values={p:100,n:320,b:330,r:500,q:900,k:0};
export function evaluate(chess) {
 if(chess.isCheckmate())return -100000;
 if(chess.isStalemate()||chess.isInsufficientMaterial())return 0;
 let score=0;
 for(const row of chess.board())for(const p of row)if(p){
  const file=p.square.charCodeAt(0)-97,rank=Number(p.square[1])-1,center=3.5-Math.abs(file-3.5)+3.5-Math.abs(rank-3.5);
  const positional=p.type==='p'?(p.color==='w'?rank:7-rank)*7:p.type==='n'||p.type==='b'?center*8:p.type==='k'?-center*4:center*2;
  score+=(p.color==='w'?1:-1)*(values[p.type]+positional);
 }
 return chess.turn()==='w'?score:-score;
}
function ordered(chess) {return chess.moves({verbose:true}).sort((a,b)=>((values[b.captured]||0)*10-(b.captured?values[b.piece]:0)+(b.promotion?800:0))-((values[a.captured]||0)*10-(a.captured?values[a.piece]:0)+(a.promotion?800:0)));}
export function bestMove(fen,level=2,budget=700) {
 const chess=new Chess(fen),moves=ordered(chess);if(!moves.length)return null;
 const start=performance.now();let nodes=0;
 const timeout={};
 function search(depth,alpha,beta,ply){
  if(++nodes%16===0&&(performance.now()-start>budget||nodes>20000))throw timeout;
  const legal=ordered(chess);
  if(!legal.length)return chess.isCheck()?-100000+ply:0;
  if(chess.isInsufficientMaterial())return 0;
  if(depth===0)return evaluate(chess);
  let score=-Infinity;
  for(const move of legal){chess.move(move);let value;try{value=-search(depth-1,-beta,-alpha,ply+1);}finally{chess.undo();}score=Math.max(score,value);alpha=Math.max(alpha,value);if(alpha>=beta)break;}
  return score;
 }
 let best=moves[Math.floor(Math.random()*moves.length)];
 if(level===1&&Math.random()<0.55)return {from:best.from,to:best.to,promotion:best.promotion};
 for(let depth=1;depth<=Math.max(1,Math.min(3,level));depth++){
  let chosen=best,score=-Infinity,completed=true;
  try{for(const move of moves){chess.move(move);let value;try{value=-search(depth-1,-Infinity,-score,1);}finally{chess.undo();}if(value>score){score=value;chosen=move;}}}
  catch(error){if(error!==timeout)throw error;completed=false;}
  if(completed)best=chosen;else break;
 }
 return {from:best.from,to:best.to,promotion:best.promotion};
}
