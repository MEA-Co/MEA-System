import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshResponseIfChanged, responseVersionKey } from '../app/(private)/dashboard/_views/questions/lib/responses/polling.ts';
const initial={id:'session',revision:1,definitionToken:'one',status:'in_progress',savedAt:null,sourceDeleted:false,questions:[],sections:[],title:'test'};
test('unchanged version does not fetch answers or apply state',async()=>{
 let reads=0,applied=0;
 await refreshResponseIfChanged({current:initial,readVersion:async()=>({...initial,hasUnsubmittedChanges:false,submittedAt:null,startNotice:null}),readSnapshot:async()=>{reads++;return initial},isCurrent:()=>true,apply:()=>applied++});
 assert.equal(reads,0);assert.equal(applied,0);
});
test('definition changes with same revision still fetch',async()=>{
 const changed={...initial,definitionToken:'two'};let applied;
 await refreshResponseIfChanged({current:initial,readVersion:async()=>changed,readSnapshot:async()=>changed,isCurrent:()=>true,apply:x=>applied=x});
 assert.equal(applied,changed);
});
test('save or hide during version request prevents full fetch',async()=>{
 let valid=true;
 await refreshResponseIfChanged({current:initial,readVersion:async()=>{valid=false;return {...initial,revision:2}},readSnapshot:async()=>{throw new Error('unexpected fetch')},isCurrent:()=>valid,apply:()=>assert.fail()});
});
test('save or hide during full fetch prevents stale overwrite',async()=>{
 let valid=true;
 await refreshResponseIfChanged({current:initial,readVersion:async()=>({...initial,revision:2}),readSnapshot:async()=>{valid=false;return {...initial,revision:2}},isCurrent:()=>valid,apply:()=>assert.fail()});
});
test('older response is never adopted',async()=>{
 await refreshResponseIfChanged({current:initial,readVersion:async()=>({...initial,revision:2}),readSnapshot:async()=>({...initial,revision:0}),isCurrent:()=>true,apply:()=>assert.fail()});
});
test('submission and notice changes are visible',()=>{
 for(const patch of [{submittedAt:'now'},{hasUnsubmittedChanges:true},{sourceDeleted:true},{startNotice:{title:'new'}},{status:'submitted'}]) assert.notEqual(responseVersionKey(initial),responseVersionKey({...initial,...patch}));
});
