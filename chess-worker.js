import {bestMove} from './assets/chess/computer.js';
self.onmessage=event=>{
 try{self.postMessage({move:bestMove(event.data.fen,event.data.level)});}
 catch(error){self.postMessage({error:'Počítač teď nemohl vybrat tah. Zkus pokračovat znovu.'});}
};
