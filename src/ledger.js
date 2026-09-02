import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || '/data';
const FILE = path.join(DATA_DIR, 'postfact-real-use.json');
const FALLBACK = path.join(process.cwd(), '.postfact-real-use.json');
const VALIDATOR_RE=/(smithery|glama|pulsemcp|pulse-mcp|mcp[- ]?registry|registry\.modelcontextprotocol|verifymcp|mcp-verifier|github-actions|curl|healthcheck)/i;
const INTERACTIVE_RE=/(claude|cursor|windsurf|vscode|visual studio code|chatgpt|openai|cline|roo|zed)/i;

function filePath(){ try { fs.mkdirSync(DATA_DIR,{recursive:true}); fs.accessSync(DATA_DIR,fs.constants.W_OK); return FILE; } catch { return FALLBACK; } }
function blank(){ return { version:2, createdAt:new Date().toISOString(), realUse:[], strangers:[], discovery:[] }; }
export function loadLedger(){ const f=filePath(); try { const x=JSON.parse(fs.readFileSync(f,'utf8')); return {...blank(),...x,realUse:Array.isArray(x.realUse)?x.realUse:[],strangers:Array.isArray(x.strangers)?x.strangers:[],discovery:Array.isArray(x.discovery)?x.discovery:[]}; } catch { return blank(); } }
function save(x){ fs.writeFileSync(filePath(),JSON.stringify(x,null,2)); }
export function fingerprint(req){ const raw = req.headers['x-postfact-caller'] || req.headers['user-agent'] || req.socket?.remoteAddress || 'unknown'; return crypto.createHash('sha256').update(String(raw)).digest('hex').slice(0,12); }
function safe(v,max=80){ const s=String(v||'').trim(); return s?s.replace(/[^a-zA-Z0-9._:/ -]/g,'').slice(0,max):null; }
function agentClass(req){ const ua=String(req.headers['user-agent']||''); for(const name of ['smithery','glama','pulsemcp','verifymcp','mcp-verifier','github-actions','curl','claude','cursor','windsurf','vscode','chatgpt','openai','cline','roo','zed']) if(ua.toLowerCase().includes(name)) return name; return /modelcontextprotocol|mcp/i.test(ua)?'mcp-client':'other'; }
function sourceClass(req){ const s=String(req.headers['x-postfact-source']||req.headers['x-postfact-directory']||'').trim(); if(!s)return null; return safe(s,64); }
function isInternal(req,input){ return req.headers['x-postfact-demo']==='1'||req.headers['x-postfact-internal']==='1'||input?.demo===true; }
function evidenceText(x){ return [x.agentClass,x.clientName,x.sourceClass].filter(Boolean).join(' '); }
function classify(event,discovery){
  if(event.auditVersion!==3)return {classification:'UNKNOWN_MACHINE',reasons:['historical event predates auditable evidence envelope']};
  const text=evidenceText(event);
  if(VALIDATOR_RE.test(text))return {classification:'KNOWN_VALIDATOR',reasons:['validator/directory/client evidence']};
  const prior=[...discovery].reverse().find(d=>d.caller===event.caller&&new Date(d.at)<=new Date(event.at));
  const delay=prior?Math.max(0,new Date(event.at)-new Date(prior.at)):null;
  if(event.transport==='mcp'&&INTERACTIVE_RE.test(String(event.clientName||'')))return {classification:'CREDIBLE_REAL_USE',reasons:[`interactive MCP client: ${event.clientName}`,...(delay==null?[]:[`discovery-to-core ${delay}ms`])]};
  if(delay!=null&&delay<=15000)return {classification:'LIKELY_VALIDATOR',reasons:[`discovery-to-core only ${delay}ms`,'no interactive client evidence']};
  return {classification:'UNKNOWN_MACHINE',reasons:['core operation observed','insufficient evidence to prove genuine stranger']};
}
export function recordDiscovery({req,route,clientInfo=null}){
  if(isInternal(req,null))return {recorded:false};
  const ledger=loadLedger(), caller=fingerprint(req), now=new Date().toISOString();
  const item={at:now,caller,route:safe(route,40),agentClass:agentClass(req),clientName:safe(clientInfo?.name,80),clientVersion:safe(clientInfo?.version,40),sourceClass:sourceClass(req)};
  ledger.discovery.push(item); if(ledger.discovery.length>5000)ledger.discovery=ledger.discovery.slice(-5000); ledger.version=2; save(ledger); return {recorded:true,caller};
}
export function recordRealUse({req, transport, input, result}) {
  if (isInternal(req,input)) return {recorded:false};
  const ledger=loadLedger(), caller=fingerprint(req), now=new Date().toISOString();
  const prior=[...ledger.discovery].reverse().find(d=>d.caller===caller);
  const event={at:now,caller,transport,state:result.state,method:input?.method||null,failure:input?.failure||input?.error||null,auditVersion:3,agentClass:agentClass(req),clientName:prior?.clientName||null,clientVersion:prior?.clientVersion||null,sourceClass:sourceClass(req)||prior?.sourceClass||null};
  const c=classify(event,ledger.discovery); event.classification=c.classification; event.classificationReasons=c.reasons; ledger.realUse.push(event); ledger.version=2; save(ledger);
  const verified=verifiedMilestones(ledger); const milestone=verified.find(s=>s.caller===caller);
  return {recorded:true,caller,classification:event.classification,strangerNumber:milestone?.number||null};
}
function normalizedEvents(l){ return l.realUse.map(e=>{ if(e.auditVersion===3&&e.classification)return e; const c=classify(e,l.discovery||[]); return {...e,classification:c.classification,classificationReasons:c.reasons}; }); }
function verifiedMilestones(l){ const seen=new Set(), out=[]; for(const e of normalizedEvents(l)){ if(e.classification!=='CREDIBLE_REAL_USE'||seen.has(e.caller))continue; seen.add(e.caller); out.push({number:out.length+1,at:e.at,caller:e.caller,transport:e.transport,state:e.state,classification:e.classification,reasons:e.classificationReasons||[]}); if(out.length===10)break; } return out; }
export function publicStats(){ const l=loadLedger(), events=normalizedEvents(l), verified=verifiedMilestones(l); const first10=Array.from({length:10},(_,i)=>verified[i]||{number:i+1,status:'WAITING'}); const candidates=[...new Set(events.map(e=>e.caller))].map(caller=>{const xs=events.filter(e=>e.caller===caller);return {caller,calls:xs.length,firstAt:xs[0]?.at,lastAt:xs.at(-1)?.at,classification:xs.some(x=>x.classification==='CREDIBLE_REAL_USE')?'CREDIBLE_REAL_USE':xs[0]?.classification||'UNKNOWN_MACHINE'};}); return {allTimeRealUse:events.length,convertedStrangers:verified.length,verifiedStrangers:verified.length,uniqueRealCallers:new Set(events.map(x=>x.caller)).size,first10,candidateRealUse:candidates,legacyMilestoneClaims:l.strangers.length,verificationPolicy:{version:3,rule:'Core-tool invocation is evidence of use, not automatically evidence of a real stranger. Only CREDIBLE_REAL_USE advances stranger milestones.',classes:['KNOWN_VALIDATOR','LIKELY_VALIDATOR','CONTROLLED_TEST','UNKNOWN_MACHINE','CREDIBLE_REAL_USE'],historicalEventsDefault:'UNKNOWN_MACHINE'}}; }
