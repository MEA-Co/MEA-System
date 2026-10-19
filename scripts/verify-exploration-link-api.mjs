import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,imports) {
 const exports={}; vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>imports[n]??require(n),Response,Request,URL,TextEncoder,AbortSignal}); return exports;
}
const drafts=load('lib/exploration-links/drafts.ts',{});
const model=load('lib/exploration-links/model.ts',{'./drafts':drafts});
const userId=randomUUID(),id=randomUUID(),a=randomUUID(),b=randomUUID(),c=randomUUID(),skill=randomUUID();
const content=()=>({name:' 줄기 ',description:'',graph:{nodes:[a,b,c].map(explorationId=>({explorationId,title:'탐구',position:{x:55,y:66}})),edges:[{from:a,to:b,skillId:skill}],skills:[{id:skill,name:'분석',description:'연결 설명'}]}});
function harness({role='consultant',view=role,user=true,rpcError=null}={}) {
 const calls=[];
 const route=load('app/api/exploration-links/[[...path]]/route.ts',{
 'next/headers':{cookies:async()=>({})},'@/lib/admin':{getViewRole:async()=>view},'@/lib/auth':{getUserAccess:async()=>({user:user?{id:userId}:null,isOnboarded:true,role})},'@/lib/exploration-links/model':model,
 '@/lib/supabase/server':{createClient:()=>({rpc:(name,args)=>{calls.push({name,args});return {abortSignal:async()=>({data:{id,revision:1},error:rpcError})};}})}});
 return {calls,send:(method,body,path=[id],origin='https://test.local')=>route[method](new Request(`https://test.local/api/exploration-links/${path.join('/')}`,{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({path})})};
}
test('confirmation prunes isolated nodes and coordinates before one atomic RPC',async()=>{
 const h=harness();const r=await h.send('PUT',{content:content(),expectedRevision:0,saveId:randomUUID()});assert.equal(r.status,200);assert.equal(h.calls.length,1);const saved=h.calls[0].args.p_content;
 assert.equal(saved.name,'줄기');assert.equal(saved.graph.nodes.length,2);assert.equal(saved.graph.nodes[0].position,undefined);assert.equal(content().graph.nodes.length,3);
});
test('unauthenticated, students and cross-origin writes never reach DB',async()=>{
 for(const options of [{user:false},{role:'student'},{}]) {const h=harness(options);const response=await h.send('PUT',{},[id],options.user===false||options.role?'https://test.local':'https://evil.test');assert.ok([401,403].includes(response.status));assert.equal(h.calls.length,0);}
});
test('missing name, empty connections and invalid skills are rejected without RPC',async()=>{
 for(const change of [c=>c.name=' ',c=>c.graph.edges=[],c=>c.graph.skills[0].description=' ',c=>delete c.graph.edges[0].skillId]) {const h=harness();const value=content();change(value);assert.equal((await h.send('PUT',{content:value,expectedRevision:0,saveId:randomUUID()})).status,400);assert.equal(h.calls.length,0);}
});
test('preview role restricts others list and list metadata remains bounded',async()=>{
 const h=harness({role:'admin',view:'consultant'});assert.equal((await h.send('POST',{scope:'others'},[])).status,403);assert.equal(h.calls.length,0);
 assert.equal((await h.send('POST',{scope:'own',page:100001},[])).status,400);
 assert.equal((await h.send('POST',{scope:'own',page:2,localCount:12,excluded:[id]},[])).status,200);
 assert.equal(h.calls[0].args.p_local_count,12);
});
test('conflict is returned once as HTTP409 without application retries',async()=>{
 const h=harness({rpcError:{code:'40001'}});assert.equal((await h.send('PUT',{content:content(),expectedRevision:1,saveId:randomUUID()})).status,409);assert.equal(h.calls.length,1);
});
test('server revision and skill timestamp survive local draft roundtrip',()=>{
 const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const value=content();value.graph.skills[0].updatedAt='2026-10-19T10:00:00.123456+00:00';
 const saved=drafts.writeLinkDraft(storage,'test:',userId,id,0,value,7);
 assert.equal(saved.serverRevision,7);assert.equal(saved.content.graph.skills[0].updatedAt,value.graph.skills[0].updatedAt);assert.equal(saved.content.graph.nodes.length,3);
});
