import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || '/data';
const FILE = path.join(DATA_DIR, 'postfact-real-use.json');
const FALLBACK = path.join(process.cwd(), '.postfact-real-use.json');

function filePath(){ try { fs.mkdirSync(DATA_DIR,{recursive:true}); fs.accessSync(DATA_DIR,fs.constants.W_OK); return FILE; } catch { return FALLBACK; } }
function blank(){ return { version:1, createdAt:new Date().toISOString(), realUse:[], strangers:[] }; }
export function loadLedger(){ const f=filePath(); try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch { return blank(); } }
function save(x){ fs.writeFileSync(filePath(),JSON.stringify(x,null,2)); }
export function fingerprint(req){ const raw = req.headers['x-postfact-caller'] || req.headers['user-agent'] || req.socket.remoteAddress || 'unknown'; return crypto.createHash('sha256').update(String(raw)).digest('hex').slice(0,12); }
export function recordRealUse({req, transport, input, result}) {
  if (req.headers['x-postfact-demo'] === '1' || req.headers['x-postfact-internal'] === '1' || input?.demo === true) return {recorded:false};
  const ledger=loadLedger(); const caller=fingerprint(req); const now=new Date().toISOString();
  ledger.realUse.push({at:now,caller,transport,state:result.state,method:input?.method||null,failure:input?.failure||input?.error||null});
  if (!ledger.strangers.some(s=>s.caller===caller) && ledger.strangers.length<10) ledger.strangers.push({number:ledger.strangers.length+1,at:now,caller,transport,state:result.state});
  save(ledger); return {recorded:true,caller,strangerNumber:ledger.strangers.find(s=>s.caller===caller)?.number||null};
}
export function publicStats(){ const l=loadLedger(); return {allTimeRealUse:l.realUse.length,convertedStrangers:l.strangers.length,uniqueRealCallers:new Set(l.realUse.map(x=>x.caller)).size,first10:Array.from({length:10},(_,i)=>l.strangers[i]||{number:i+1,status:'WAITING'})}; }
