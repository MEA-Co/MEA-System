import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { writeLinkDraft, readLinkDrafts, deleteLinkDraft, linkDraftPrefix, layoutLink } from '../lib/exploration-links/drafts.ts';
class MemoryStorage {
  data = new Map();
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}
const owner = randomUUID(), id = randomUUID(), a = randomUUID(), b = randomUUID(), c = randomUUID(), skill = randomUUID();
const prefix = linkDraftPrefix('test', owner);
const content = () => ({ name: '', description: '', graph: { nodes: [a,b,c].map(explorationId => ({ explorationId, title: '탐구', position: { x: 999, y: 99 } })), edges: [{from:a,to:b,skillId:skill},{from:a,to:c,skillId:skill},{from:b,to:c}], skills: [{id:skill,name:'분석',description:'분석을 통해 후속 탐구로 연결'}] } });
test('incomplete draft roundtrip keeps references and reusable skills, strips coordinates', () => {
  const store = new MemoryStorage();
  const saved = writeLinkDraft(store,prefix,owner,id,0,content());
  assert.equal(saved.localRevision,1);
  assert.equal(saved.content.name,'');
  assert.equal(saved.content.graph.nodes[0].position,undefined);
  assert.deepEqual(readLinkDrafts(store,prefix,owner).drafts,[saved]);
  assert.equal(saved.content.graph.edges[0].skillId,saved.content.graph.edges[1].skillId);
  assert.deepEqual(layoutLink(saved.content.graph.nodes,saved.content.graph.edges).map(n=>n.column),[0,1,2]);
});
test('accounts and environments are isolated', () => {
  const store = new MemoryStorage(); writeLinkDraft(store,prefix,owner,id,0,content());
  assert.equal(readLinkDrafts(store,linkDraftPrefix('test',randomUUID()),randomUUID()).drafts.length,0);
  assert.equal(readLinkDrafts(store,linkDraftPrefix('other',owner),owner).drafts.length,0);
});
test('stale update and delete preserve latest draft, deletion cannot be resurrected', () => {
  const store = new MemoryStorage(); const first = writeLinkDraft(store,prefix,owner,id,0,content());
  const latest = writeLinkDraft(store,prefix,owner,id,1,{...content(),name:'수정'});
  assert.throws(()=>writeLinkDraft(store,prefix,owner,id,1,content()));
  assert.throws(()=>deleteLinkDraft(store,prefix,first));
  assert.equal(readLinkDrafts(store,prefix,owner).drafts[0].content.name,'수정');
  deleteLinkDraft(store,prefix,latest);
  assert.throws(()=>writeLinkDraft(store,prefix,owner,id,2,content()));
});
test('corrupt draft is reported and never overwritten', () => {
  const store = new MemoryStorage(); store.setItem(prefix+id,'broken');
  assert.equal(readLinkDrafts(store,prefix,owner).errors.length,1);
  assert.throws(()=>writeLinkDraft(store,prefix,owner,id,0,content()));
  assert.equal(store.getItem(prefix+id),'broken');
});
test('invalid references, duplicate nodes and cycles fail without changing saved data', () => {
  const store = new MemoryStorage(); writeLinkDraft(store,prefix,owner,id,0,content());
  const before = store.getItem(prefix+id);
  for (const mutate of [v=>v.graph.edges.push({from:c,to:a}),v=>v.graph.nodes.push(v.graph.nodes[0]),v=>v.graph.edges.push({from:c,to:randomUUID()}),v=>v.graph.edges[0].skillId=randomUUID()]) {
    const value = content(); mutate(value); assert.throws(()=>writeLinkDraft(store,prefix,owner,id,1,value));
    assert.equal(store.getItem(prefix+id),before);
  }
});
test('quota failure preserves previous stored draft', () => {
  const store = new MemoryStorage(); writeLinkDraft(store,prefix,owner,id,0,content());
  const before = store.getItem(prefix+id);
  store.setItem = () => { throw new DOMException('full','QuotaExceededError'); };
  assert.throws(()=>writeLinkDraft(store,prefix,owner,id,1,content()));
  assert.equal(store.getItem(prefix+id),before);
});
test('disconnected nodes and empty graph can be laid out', () => {
  assert.deepEqual(layoutLink([],[]),[]);
  assert.deepEqual(layoutLink([{explorationId:a},{explorationId:b}],[]).map(n=>n.position),[{x:0,y:0},{x:0,y:160}]);
});
