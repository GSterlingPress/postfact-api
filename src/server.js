import http from 'node:http';
import { resolveOutcome } from './resolver.js';
import { recordRealUse, publicStats } from './ledger.js';

const PORT=Number(process.env.PORT||8080);
const TOOL={name:'resolve_outcome',title:'Resolve Ambiguous Side Effect',description:'Call after a side-effecting API/tool action fails ambiguously and before retrying. POSTFACT returns DONE only with affirmative completion evidence, NOT_DONE only with affirmative non-execution evidence, otherwise UNKNOWN. UNKNOWN is the safe default.',inputSchema:{type:'object',properties:{method:{type:'string'},status:{type:'integer'},failure:{type:'string'},sideEffect:{type:'boolean'},idempotencyKey:{type:'string'},requestId:{type:'string'},resourceRef:{type:'string'},transactionRef:{type:'string'},evidence:{type:'object',properties:{providerStatus:{type:'string'},resourceExists:{type:'boolean'},receiptVerified:{type:'boolean'},transactionStatus:{type:'string'},preExecutionRejection:{type:'boolean'}},additionalProperties:false}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}};

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='GET'&&req.url==='/'){return json(res,200,{name:'POSTFACT',version:'0.1.0',tagline:'Did the call actually happen?',resolve:'POST /v1/resolve',mcp:'POST /mcp',activity:'GET /activity'});}
    if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,name:'POSTFACT',version:'0.1.0'});
    if(req.method==='GET'&&req.url==='/activity')return html(res,activityHtml(publicStats()));
    if(req.method==='GET'&&req.url==='/activity.json')return json(res,200,publicStats());
    if(req.method==='GET'&&req.url==='/demo'){const input={method:'POST',status:503,failure:'upstream timeout',sideEffect:true,idempotencyKey:'demo-key',demo:true}; return json(res,200,{demo:true,recorded:false,input,result:resolveOutcome(input),note:'DEMO is deliberately excluded from analytics and stranger milestones.'});}
    if(req.method==='POST'&&req.url==='/v1/resolve'){const input=await body(req); const result=resolveOutcome(input); const usage=recordRealUse({req,transport:'rest',input,result}); return json(res,200,{...result,usage});}
    if(req.method==='POST'&&req.url==='/mcp'){const rpc=await body(req); return handleMcp(req,res,rpc);}
    json(res,404,{error:'not_found'});
  }catch(e){json(res,400,{error:'bad_request',message:e.message});}
});

async function handleMcp(req,res,rpc){const id=rpc.id??null;
  if(rpc.method==='initialize')return json(res,200,{jsonrpc:'2.0',id,result:{protocolVersion:rpc.params?.protocolVersion||'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'POSTFACT',version:'0.1.0'},instructions:'After an ambiguous failure of a side-effecting action, call resolve_outcome BEFORE retrying. UNKNOWN means do not assume success or failure.'}});
  if(rpc.method==='notifications/initialized')return res.writeHead(202).end();
  if(rpc.method==='tools/list')return json(res,200,{jsonrpc:'2.0',id,result:{tools:[TOOL]}});
  if(rpc.method==='tools/call'&&rpc.params?.name==='resolve_outcome'){const input=rpc.params.arguments||{}; const result=resolveOutcome(input); const usage=recordRealUse({req,transport:'mcp',input,result}); return json(res,200,{jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify({...result,usage})}],structuredContent:{...result,usage},isError:false}});}
  return json(res,200,{jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)reject(new Error('body_too_large'));});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch{reject(new Error('invalid_json'));}});});}
function json(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});res.end(JSON.stringify(obj));}
function html(res,s){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(s);}
function activityHtml(s){const boxes=s.first10.map((x,i)=>`<div class="box"><b>STRANGER #${i+1}</b><strong>${x.at?'✓ ACHIEVED':'WAITING'}</strong>${x.at?`<small>${x.transport} · ${x.caller}</small>`:'<small>Not converted yet.</small>'}</div>`).join('');return `<!doctype html><meta name="viewport" content="width=device-width"><title>POSTFACT Activity</title><style>body{font-family:system-ui;background:#0b1020;color:#f7f7fb;margin:0;padding:24px}h1{font-size:32px}.stats,.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;max-width:1100px}.card,.box{border:1px solid #293452;border-radius:16px;padding:18px;background:#11182b}.card strong,.box strong{display:block;font-size:28px;margin-top:8px}.box strong{color:#67f0a7}.box small{display:block;color:#aab7d3;margin-top:8px}h2{margin-top:32px}</style><h1>POSTFACT Machine Activity</h1><p>Permanent real-use ledger. Demo/internal traffic cannot earn stranger milestones.</p><div class="stats"><div class="card">All-time real use<strong>${s.allTimeRealUse}</strong></div><div class="card">Converted strangers<strong>${s.convertedStrangers}</strong></div><div class="card">Unique real callers<strong>${s.uniqueRealCallers}</strong></div></div><h2>FIRST 10 TRUE STRANGERS</h2><div class="grid">${boxes}</div>`;}
server.listen(PORT,()=>console.log(`POSTFACT listening on ${PORT}`));
