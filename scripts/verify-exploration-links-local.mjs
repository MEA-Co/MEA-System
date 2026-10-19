// Explicit opt-in local integration test. Creates and removes only its own fixture user.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd(),true);
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(url,'http://127.0.0.1:54321','Local Supabase only');
const auth={persistSession:false,autoRefreshToken:false};
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth});
const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth});
const credentials={email:`link-regression-${randomUUID()}@example.test`,password:randomBytes(24).toString('base64url')};
let owner;
try {
 const created=await admin.auth.admin.createUser({...credentials,email_confirm:true});if(created.error)throw created.error;owner=created.data.user.id;
 const profile=await admin.from('profiles').insert({id:owner,role:'consultant',name:'Temporary link regression'});if(profile.error)throw profile.error;
 const login=await client.auth.signInWithPassword(credentials);if(login.error)throw login.error;
 const nodes=[];
 for(let i=0;i<3;i++) {
  const id=randomUUID();nodes.push({explorationId:id,title:`활동 ${i}`});
  const saved=await client.rpc('save_exploration',{p_id:id,p_values:{grade:'1',semester:'1',recordType:'세특',recordArea:'국어',schoolContext:'수업',topic:`활동 ${i}`,record:'내용',competencies:'역량',motivation:'기획',story:'수행',result:'결과',followup:'',references:[]},p_reports:[],p_expected_revision:0,p_save_id:randomUUID()});if(saved.error)throw saved.error;
 }
 const id=randomUUID(),skillId=randomUUID();
 const content={name:'HTTP 회귀',description:'',graph:{nodes,edges:[{from:nodes[0].explorationId,to:nodes[1].explorationId,skillId}],skills:[{id:skillId,name:'분석',description:'근거 비교'}]}};
 const args={p_id:id,p_content:content,p_expected_revision:0,p_save_id:randomUUID()};
 const incomplete=structuredClone(args);delete incomplete.p_content.graph.edges[0].skillId;
 const denied=await client.rpc('save_exploration_link',incomplete).abortSignal(AbortSignal.timeout(5000));assert.equal(denied.status,400);
 const first=await client.rpc('save_exploration_link',args).abortSignal(AbortSignal.timeout(5000));assert.ifError(first.error);assert.equal(first.data.graph.nodes.length,2);
 const retry=await client.rpc('save_exploration_link',args).abortSignal(AbortSignal.timeout(5000));assert.ifError(retry.error);assert.equal(retry.data.revision,1);
 const started=Date.now();
 const conflict=await client.rpc('save_exploration_link',{...args,p_save_id:randomUUID()}).abortSignal(AbortSignal.timeout(5000));
 assert.equal(conflict.status,409,JSON.stringify(conflict.error));assert.equal(conflict.error.code,'40001');
 const elapsed=Date.now()-started;assert.ok(elapsed<5000);
 const list=await client.rpc('read_exploration_link_page',{p_scope:'own',p_query:'HTTP',p_page:1});assert.ifError(list.error);assert.equal(list.data.items.length,1);assert.equal(list.data.items[0].graph,undefined);
 const removed=await client.rpc('delete_exploration',{p_id:nodes[0].explorationId,p_expected_revision:1});assert.ifError(removed.error);
 const retained=await client.from('exploration_links').select('graph').eq('id',id).single();assert.ifError(retained.error);assert.equal(retained.data.graph.nodes.length,2);
 console.log(`Local HTTP: save, retry, bounded list, unchanged activity deletion passed; conflict HTTP409 in ${elapsed}ms.`);
} finally {
 if(owner) {const cleanup=await admin.auth.admin.deleteUser(owner);if(cleanup.error)throw cleanup.error;}
}
