import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'postfact-ledger-'));
process.env.DATA_DIR=dir;
const {publicStats,recordDiscovery,recordRealUse}=await import('../src/ledger.js');
const file=path.join(dir,'postfact-real-use.json');

function req({ua='mcp-client',caller='caller-a',source=null}={}){return {headers:{'user-agent':ua,'x-postfact-caller':caller,...(source?{'x-postfact-source':source}:{})},socket:{remoteAddress:'127.0.0.1'}};}

function seed(x){fs.writeFileSync(file,JSON.stringify(x,null,2));}

test('historical real-use events are preserved but do not earn verified stranger milestones',()=>{
  const old={version:1,createdAt:'2026-08-12T00:00:00.000Z',realUse:Array.from({length:16},(_,i)=>({at:`2026-08-12T00:${String(i).padStart(2,'0')}:00.000Z`,caller:'4fa14c7fd12b',transport:'mcp',state:'UNKNOWN',method:'POST',failure:'timeout'})),strangers:[{number:1,at:'2026-08-12T00:00:00.000Z',caller:'4fa14c7fd12b',transport:'mcp',state:'UNKNOWN'}]};
  seed(old); const s=publicStats();
  assert.equal(s.allTimeRealUse,16); assert.equal(s.uniqueRealCallers,1); assert.equal(s.verifiedStrangers,0); assert.equal(s.legacyMilestoneClaims,1); assert.equal(s.candidateRealUse[0].classification,'UNKNOWN_MACHINE');
  const after=JSON.parse(fs.readFileSync(file,'utf8')); assert.deepEqual(after,old);
});

test('known validator core use never advances stranger milestone',()=>{
  seed({version:2,createdAt:new Date().toISOString(),realUse:[],strangers:[],discovery:[]});
  const r=req({ua:'Glama MCP validator',caller:'validator'}); recordDiscovery({req:r,route:'initialize',clientInfo:{name:'glama-validator',version:'1'}}); const u=recordRealUse({req:r,transport:'mcp',input:{method:'POST',failure:'timeout'},result:{state:'UNKNOWN'}}); const s=publicStats();
  assert.equal(u.classification,'KNOWN_VALIDATOR'); assert.equal(s.verifiedStrangers,0);
});

test('interactive MCP client core use can become CREDIBLE_REAL_USE',()=>{
  seed({version:2,createdAt:new Date().toISOString(),realUse:[],strangers:[],discovery:[]});
  const r=req({ua:'ModelContextProtocol',caller:'human-client'}); recordDiscovery({req:r,route:'initialize',clientInfo:{name:'Claude Desktop',version:'1.0'}}); const u=recordRealUse({req:r,transport:'mcp',input:{method:'POST',failure:'timeout'},result:{state:'UNKNOWN'}}); const s=publicStats();
  assert.equal(u.classification,'CREDIBLE_REAL_USE'); assert.equal(s.verifiedStrangers,1); assert.equal(s.first10[0].caller,u.caller);
});

test('fast discovery-to-core with no interactive evidence is LIKELY_VALIDATOR',()=>{
  seed({version:2,createdAt:new Date().toISOString(),realUse:[],strangers:[],discovery:[]});
  const r=req({ua:'generic-mcp-client',caller:'fast-probe'}); recordDiscovery({req:r,route:'tools/list'}); const u=recordRealUse({req:r,transport:'mcp',input:{method:'POST',failure:'timeout'},result:{state:'UNKNOWN'}}); assert.equal(u.classification,'LIKELY_VALIDATOR'); assert.equal(publicStats().verifiedStrangers,0);
});
