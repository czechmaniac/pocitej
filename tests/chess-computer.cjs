const assert=require('node:assert/strict');
(async()=>{
 const {Chess}=await import('../assets/chess/chess-engine.js');const {bestMove}=await import('../assets/chess/computer.js');const {ComputerGame}=await import('../assets/chess/computer-game.js');
 for(const level of [1,2,3]){const c=new Chess(),start=performance.now(),move=bestMove(c.fen(),level,100);assert(c.move(move));assert(performance.now()-start<3000);}
 const mate=new Chess('6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1');mate.move(bestMove(mate.fen(),2,1000));assert(mate.isCheckmate(),'computer should find immediate mate');
 const storage=new Map();global.localStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)};
 const game=new ComputerGame({side:'w',level:3});game.action('move',{from:'e2',to:'e4'});assert.equal(game.snapshot.turn,'b');assert.equal(game.snapshot.legal.length,0);assert.throws(()=>game.action('move',{from:'d2',to:'d4'}));
 game.move({from:'e7',to:'e5'});assert(game.save('test'));const restored=ComputerGame.restore('test');assert.equal(restored.snapshot.fen,game.snapshot.fen);assert.equal(restored.moves.length,2);assert.equal(restored.level,3);
 restored.action('resign');assert.equal(restored.snapshot.winner,'b');assert.equal(restored.snapshot.status,'finished');
 console.log('PASS: three computer levels, bounded search, mate, legal turn handling, local persistence and resignation');
})().catch(error=>{console.error(error);process.exitCode=1;});
