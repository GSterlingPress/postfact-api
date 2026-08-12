import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOutcome } from '../src/resolver.js';

test('timeout after side effect is UNKNOWN, never guessed',()=>{const r=resolveOutcome({method:'POST',status:503,failure:'timeout',sideEffect:true});assert.equal(r.state,'UNKNOWN');assert.equal(r.retry_safe,false);});
test('idempotency key alone does not prove outcome',()=>{const r=resolveOutcome({method:'POST',failure:'timeout',sideEffect:true,idempotencyKey:'k'});assert.equal(r.state,'UNKNOWN');assert.equal(r.retry_safe,false);});
test('affirmative resource existence proves DONE',()=>{const r=resolveOutcome({method:'POST',sideEffect:true,evidence:{resourceExists:true}});assert.equal(r.state,'DONE');assert.equal(r.retry_safe,false);});
test('affirmative absence proves NOT_DONE',()=>{const r=resolveOutcome({method:'POST',sideEffect:true,evidence:{resourceExists:false}});assert.equal(r.state,'NOT_DONE');assert.equal(r.retry_safe,true);});
test('settled transaction proves DONE',()=>assert.equal(resolveOutcome({evidence:{transactionStatus:'settled'}}).state,'DONE'));
test('rejected transaction proves NOT_DONE',()=>assert.equal(resolveOutcome({evidence:{transactionStatus:'rejected'}}).state,'NOT_DONE'));
test('unknown side effect defaults UNKNOWN',()=>assert.equal(resolveOutcome({method:'POST',sideEffect:true}).state,'UNKNOWN'));
