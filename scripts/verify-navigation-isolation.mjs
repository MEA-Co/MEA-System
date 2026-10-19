import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const viewPath =
  'app/(private)/dashboard/_views/exploration/ExplorationView.tsx';
const element = (type, props, key) => ({ type, props, key });
const jsx = { jsx: element, jsxs: element, Fragment: 'Fragment' };
const stub = new Proxy({}, { get: (_, key) => key });
function load(path, imports, globals = {}, append = '') {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8') + append, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      URL,
      URLSearchParams,
      crypto: globalThis.crypto,
      Event,
      CustomEvent,
      ...globals,
      require: (name) =>
        imports[name] ?? (name === 'react/jsx-runtime' ? jsx : stub),
    },
  );
  return exports;
}
function renderView(query, props = {}) {
  let storageCalls = 0;
  const module = load(viewPath, {
    'next/navigation': { useSearchParams: () => new URLSearchParams(query) },
    react: {
      useRef: (value) => ({ current: value }),
      useState: (value) => [value, () => {}],
      useEffect() {},
    },
    './hooks/useExplorationStorage': {
      useExplorationStorage() {
        storageCalls++;
        return { draft: null, local: [], ready: true };
      },
    },
    './components/ExplorationLinkView': { ExplorationLinkView: 'LinkView' },
  });
  let tree = module.ExplorationView({ userId: 'owner', ...props });
  if (typeof tree.type === 'function') tree = tree.type(tree.props);
  return { tree, storageCalls };
}
test('link management/editor never mounts the activity storage hook even with a stale activity URL', () => {
  for (const query of [
    'tab=links',
    'tab=stems',
    'tab=links&linkEditor=new&explorationEditor=new',
  ]) {
    const result = renderView(query);
    assert.equal(result.tree.type, 'LinkView');
    assert.equal(
      result.storageCalls,
      0,
      'hidden activity recovery/listeners must not run',
    );
  }
});
test('activity management and embedded registration still use their original storage path', () => {
  for (const [query, props] of [
    ['tab=activities', {}],
    ['tab=links', { onSelect() {} }],
    ['tab=links', { registrationOnly: true }],
  ]) {
    const result = renderView(query, props);
    assert.equal(result.storageCalls, 1);
    assert.equal(result.tree.type, 'section');
  }
});

function eventSurface() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
      if (!listeners.get(type)?.size) listeners.delete(type);
    },
    dispatchEvent(event) {
      for (const listener of [...(listeners.get(event.type) ?? [])])
        listener(event);
      return !event.defaultPrevented;
    },
  };
}
function find(tree, match) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (match(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = find(child, match);
    if (found) return found;
  }
}
function editorHarness(options = {}) {
  const slots = [];
  let cursor = 0,
    tasks = [],
    tree;
  const window = {
    ...eventSurface(),
    location: {
      href: 'https://example.test/dashboard?tab=links&linkEditor=existing',
    },
    history: { state: { __NA: true } },
  };
  const document = eventSurface();
  const hook = (initialize) => {
    const index = cursor++;
    return slots[index] ?? (slots[index] = initialize());
  };
  const react = {
    useState(initial) {
      const slot = hook(() => ({
        value: typeof initial === 'function' ? initial() : initial,
      }));
      return [
        slot.value,
        (value) => {
          slot.value = typeof value === 'function' ? value(slot.value) : value;
        },
      ];
    },
    useRef(initial) {
      return hook(() => ({ current: initial }));
    },
    useEffect(run, deps) {
      const slot = hook(() => ({}));
      if (
        !slot.deps ||
        deps.some((value, i) => !Object.is(value, slot.deps[i]))
      ) {
        tasks.push(() => {
          slot.cleanup?.();
          slot.cleanup = run();
          slot.deps = deps;
        });
      }
    },
  };
  const historyGuard = load(
    'app/(private)/dashboard/_views/exploration/lib/link-history-guard.ts',
    {},
  );
  const policy = load(
    'app/(private)/dashboard/_views/exploration/lib/link-exit-policy.ts',
    {},
  );
  const requests = load('lib/navigation/exit-request.ts', {}, { window });
  const module = load(
    'app/(private)/dashboard/_views/exploration/components/ExplorationLinkView.tsx',
    {
      react,
      'next/dynamic': { default: () => 'Graph' },
      'next/navigation': {
        usePathname: () => '/dashboard',
        useSearchParams: () =>
          new URLSearchParams('tab=links&linkEditor=existing'),
      },
      '@/lib/navigation/exit-request': requests,
      '../lib/link-history-guard': historyGuard,
      '../lib/link-exit-policy': policy,
      '../lib/link-drafts': { layoutLink: (nodes) => nodes.map((n,i)=>({column:i,position:{x:i*400,y:0}})) },
      '../lib/list-model': {explorationTitle: activity=>activity.values.topic.trim()},
      '../lib/link-api': {linkRequest: options.request},
      '@/lib/exploration-links/model': {recordDraft: record=>({id:record.id,ownerId:record.owner_id,localRevision:0,serverRevision:record.revision,updatedAt:record.updated_at,content:{name:record.name,description:record.description,graph:{...record.graph,skills:record.skills}}})},
      '@/components/ui/toast': {toast:{add:options.toast ?? (()=>{})}},
      '@/lib/exploration/fields': { emptyValues: () => ({}) },
    },
    { window, document },
    '\nexports.EditorForAudit = LinkEditor;',
  );
  const initial = options.initial ?? {
    ownerId: 'owner',
    id: 'existing',
    localRevision: 1,
    updatedAt: '2026-10-19T00:00:00Z',
    content: {
      name: '저장본',
      description: '',
      graph: { nodes: [], edges: [], skills: [] },
    },
  };
  function render() {
    cursor = 0;
    tasks = [];
    tree = module.EditorForAudit({
      initial,
      userId: 'owner',
      save: options.save ?? (async () => {}),
      remove: options.remove ?? (async () => {}),
      onSaved: options.onSaved ?? (() => {}),
      onBack() {},
    });
    tasks.forEach((run) => run());
    return tree;
  }
  render();
  return {
    window,
    document,
    requests,
    edit(value) {
      find(tree, (node) => node.props?.id === 'link-name').props.onChange({
        target: { value },
      });
      render();
    },
    unmount() {
      slots.forEach((slot) => slot.cleanup?.());
    },
    get tree() {
      return tree;
    },
    render,
  };
}
test('actual editor cleans up all global listeners; subsequent role changes and unload belong to the next screen', () => {
  const harness = editorHarness();
  assert.equal(harness.window.listeners.has('beforeunload'), false);
  harness.edit('미저장 변경');
  const unload = new Event('beforeunload', { cancelable: true });
  harness.window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, true);
  let roleCalls = 0;
  harness.requests.requestNavigationExit(() => roleCalls++);
  assert.equal(roleCalls, 0);
  harness.render();
  const dialog = find(harness.tree, (node) => node.type === 'AlertDialog');
  assert.equal(dialog.props.open, true);
  dialog.props.onOpenChange(false);
  harness.render();
  assert.equal(
    find(harness.tree, (node) => node.props?.id === 'link-name').props.value,
    '미저장 변경',
  );
  harness.unmount();
  assert.equal(harness.window.listeners.size, 0);
  assert.equal(harness.document.listeners.size, 0);
  harness.requests.requestNavigationExit(() => roleCalls++);
  assert.equal(roleCalls, 1);
  const nextUnload = new Event('beforeunload', { cancelable: true });
  harness.window.dispatchEvent(nextUnload);
  assert.equal(nextUnload.defaultPrevented, false);
});
test('returning to the saved content removes navigation warnings without leaving the editor', () => {
  const harness = editorHarness();
  harness.edit('변경');
  harness.edit('저장본');
  assert.equal(harness.window.listeners.has('beforeunload'), false);
  assert.equal(harness.window.listeners.has('popstate'), false);
  assert.equal(harness.document.listeners.has('click'), false);
  let calls = 0;
  harness.requests.requestNavigationExit(() => calls++);
  assert.equal(calls, 1);
  harness.unmount();
});

test('shared logout keeps Next redirects intact and only handles real errors', async () => {
  const redirectError =
    require('next/dist/client/components/redirect').getRedirectError(
      '/auth/login',
      'replace',
    );
  const { unstable_rethrow } = require('next/navigation');
  for (const failure of [
    undefined,
    redirectError,
    new Error('network failure'),
  ]) {
    let calls = 0,
      rearmed = 0;
    const toasts = [];
    const module = load(
      'app/(private)/dashboard/_components/DashboardSignOut.tsx',
      {
        'next/navigation': { unstable_rethrow },
        '@/lib/navigation/exit-request': {
          navigationExitFailed: () => rearmed++,
        },
        '@/components/ui/toast': {
          toast: { add: (message) => toasts.push(message) },
        },
        '../../_actions/sign-out': {
          signOut: async () => {
            calls++;
            if (failure) throw failure;
          },
        },
      },
    );
    const action = module.DashboardSignOut().props.action;
    if (failure === redirectError)
      await assert.rejects(action(), (error) => error === redirectError);
    else await action();
    assert.equal(calls, 1);
    assert.equal(toasts.length, failure && failure !== redirectError ? 1 : 0);
    assert.equal(rearmed, toasts.length);
  }
});

test('shared role switch executes unchanged without a guard, waits when guarded, and rearms on failure', async () => {
  for (const failure of [
    undefined,
    { error: 'denied' },
    new Error('network'),
  ]) {
    const events = eventSurface();
    const requests = load(
      'lib/navigation/exit-request.ts',
      {},
      { window: events },
    );
    let pending,
      rearmed = 0;
    const saves = [],
      routes = [],
      tasks = [],
      notices = [];
    const listener = (event) => {
      event.preventDefault();
      pending = event.detail.proceed;
    };
    events.addEventListener(requests.NAVIGATION_EXIT_REQUEST, listener);
    events.addEventListener(requests.NAVIGATION_EXIT_FAILED, () => rearmed++);
    const module = load(
      'app/(private)/dashboard/_components/AdminRoleTabs.tsx',
      {
        react: {
          useTransition: () => [false, (operation) => tasks.push(operation())],
        },
        'next/navigation': {
          useRouter: () => ({ replace: (path) => routes.push(path) }),
        },
        '@/lib/navigation/exit-request': requests,
        '@/lib/profile': {
          MEMBER_ROLE_LABELS: {
            student: '학생',
            consultant: '컨설턴트',
            consultant_lead: '리드',
            admin: '관리자',
          },
        },
        '@/components/ui/toast': {
          toast: { add: (message) => notices.push(message) },
        },
        '../_actions/set-admin-view': {
          setAdminView: async (role) => {
            saves.push(role);
            if (failure instanceof Error) throw failure;
            return failure ?? {};
          },
        },
      },
    );
    const tree = module.AdminRoleTabs({ role: 'admin' });
    find(
      tree,
      (node) => node.type === 'Button' && node.props?.children === '학생',
    ).props.onClick();
    assert.equal(saves.length, 0);
    pending();
    await Promise.all(tasks);
    assert.deepEqual(saves, ['student']);
    assert.deepEqual(routes, failure ? [] : ['/dashboard']);
    assert.equal(rearmed, failure ? 1 : 0);
    assert.equal(notices.length, rearmed);
    events.removeEventListener(requests.NAVIGATION_EXIT_REQUEST, listener);
    tasks.length = 0;
    find(
      tree,
      (node) => node.type === 'Button' && node.props?.children === '컨설턴트',
    ).props.onClick();
    await Promise.all(tasks);
    assert.deepEqual(saves, ['student', 'consultant']);
  }
});

test('link save/delete leaves existing study, activity, question and session drafts byte-for-byte intact', () => {
  const map = new Map();
  const localStorage = {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
  const userId = crypto.randomUUID(),
    draftId = crypto.randomUUID();
  const sessionData = new Map([
    ['study-editor', '학습법 복원'],
    ['exploration-editor', '탐구 복원'],
  ]);
  const sessionStorage = {
    getItem: (key) => sessionData.get(key) ?? null,
    setItem: (key, value) => sessionData.set(key, value),
    removeItem: (key) => sessionData.delete(key),
  };
  const globals = {
    localStorage,
    sessionStorage,
    TextEncoder,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'audit' } },
  };
  const readers = [];
  for (const domain of ['study', 'exploration']) {
    const payload = load(`lib/${domain}/payload-size.ts`, {}, globals);
    const model = load(
      `lib/${domain}/storage-model.ts`,
      { zod: require('zod'), './payload-size': payload },
      globals,
    );
    const fields = load(`lib/${domain}/fields.ts`, {}, globals);
    const drafts = load(
      `app/(private)/dashboard/_views/${domain}/lib/local-drafts.ts`,
      { [`@/lib/${domain}/storage-model`]: model },
      globals,
    );
    const values = fields.emptyValues();
    values[domain === 'study' ? 'strategy' : 'topic'] = '보존할 내용';
    const record = {
      clientKey: draftId,
      revision: 0,
      status: 'draft',
      updatedAt: new Date().toISOString(),
      localVersion: crypto.randomUUID(),
      values,
      reports: [],
    };
    localStorage.setItem(
      `mea:${domain}:v1:audit:${userId}:${draftId}`,
      JSON.stringify(record),
    );
    readers.push(() => drafts.readDrafts(userId));
  }
  localStorage.setItem(
    `question-block-draft:${userId}:${draftId}`,
    '질문 원문',
  );
  const before = [...map],
    sessionBefore = [...sessionData];
  const links = load(
    'lib/exploration-links/drafts.ts',
    { zod: require('zod') },
    globals,
  );
  const prefix = links.linkDraftPrefix('audit', userId);
  const saved = links.writeLinkDraft(localStorage, prefix, userId, draftId, 0, {
    name: '줄기',
    description: '',
    graph: { nodes: [], edges: [], skills: [] },
  });
  assert.equal(
    links.readLinkDrafts(localStorage, prefix, userId).drafts.length,
    1,
  );
  for (const read of readers) {
    assert.equal(read().length, 1);
    assert.equal(read()[0].clientKey, draftId);
  }
  for (const [key, value] of before)
    assert.equal(localStorage.getItem(key), value);
  links.deleteLinkDraft(localStorage, prefix, saved);
  assert.deepEqual([...map], before);
  assert.deepEqual([...sessionData], sessionBefore);
});


function savedLinkFixture() {
 const initial={id:'link',ownerId:'owner',localRevision:2,serverRevision:0,updatedAt:'2026-10-19T00:00:00Z',content:{name:'확정 테스트',description:'',graph:{nodes:['a','b','c'].map(explorationId=>({explorationId,title:explorationId})),edges:[{from:'a',to:'b',skillId:'skill'}],skills:[{id:'skill',name:'분석',description:'연계 설명'}]}}};
 const link={id:'link',owner_id:'owner',revision:1,updated_at:'2026-10-19T01:00:00Z',name:initial.content.name,description:'',graph:{nodes:initial.content.graph.nodes.slice(0,2),edges:initial.content.graph.edges},skills:initial.content.graph.skills};
 return {initial,link};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function confirmEditor(harness) {
 find(harness.tree,n=>n.type==='Button' && n.props.children==='확정하기').props.onClick();
 await settle(); harness.render();
}
test('DB confirmation removes only its saved draft, prunes isolated cards and preserves surviving positions',async()=>{
 const {initial,link}=savedLinkFixture();const removed=[],saved=[];
 const h=editorHarness({initial,request:async()=>({link}),remove:async d=>removed.push(d),onSaved:(...args)=>saved.push(args)});
 find(h.tree,n=>n.type==='Graph').props.onMove([{id:'a',position:{x:777,y:222}}]);h.render();
 await confirmEditor(h);
 const graph=find(h.tree,n=>n.type==='Graph').props.graph;
 assert.equal(graph.nodes.length,2);assert.equal(graph.nodes[0].position.x,777);assert.equal(removed[0].localRevision,2);assert.deepEqual(saved,[['link',true]]);assert.equal(h.window.listeners.has('beforeunload'),false);
 h.unmount();
});
test('failed confirmation keeps input and isolated cards, retries the same save ID',async()=>{
 const {initial,link}=savedLinkFixture();const requests=[];let removed=0;
 const h=editorHarness({initial,request:async(url,init)=>{requests.push(JSON.parse(init.body));if(requests.length===1)throw new Error('통신 실패');return {link};},remove:async()=>removed++});
 h.edit('수정된 이름');link.name='수정된 이름';
 await confirmEditor(h);
 assert.equal(find(h.tree,n=>n.type==='Graph').props.graph.nodes.length,3);assert.equal(removed,0);assert.equal(find(h.tree,n=>n.props?.id==='link-name').props.value,'수정된 이름');
 await confirmEditor(h);assert.equal(requests[0].saveId,requests[1].saveId);assert.equal(removed,1);
 h.unmount();
});
test('draft cleanup conflict does not turn successful DB confirmation into a failed save',async()=>{
 const {initial,link}=savedLinkFixture();let confirmed=false;
 const h=editorHarness({initial,request:async()=>({link}),remove:async()=>{throw new Error('other tab changed');},onSaved:()=>confirmed=true});
 await confirmEditor(h);assert.equal(confirmed,true);assert.equal(find(h.tree,n=>n.type==='Graph').props.graph.nodes.length,2);
 assert.match(find(h.tree,n=>n.props?.role==='alert').props.children,/DB에는 확정했습니다/);
 h.unmount();
});

test('missing edge skill shows a toast without calling DB or deleting the draft',async()=>{
 const {initial}=savedLinkFixture();delete initial.content.graph.edges[0].skillId;
 let calls=0,removed=0;const messages=[];
 const h=editorHarness({initial,request:async()=>{calls++;},remove:async()=>removed++,toast:message=>messages.push(message)});
 await confirmEditor(h);
 assert.equal(calls,0);assert.equal(removed,0);assert.equal(messages.length,1);assert.match(messages[0].title,/연계 스킬이 없는 연결이 1개/);
 assert.equal(find(h.tree,n=>n.type==='Graph').props.graph.nodes.length,3);h.unmount();
});

test('JSONB key ordering and normalized titles do not mark a confirmed editor dirty',async()=>{
 const {initial,link}=savedLinkFixture();
 link.graph={edges:link.graph.edges.map(e=>({to:e.to,from:e.from,skillId:e.skillId})),nodes:link.graph.nodes.map(n=>({title:`  ${n.title}  `,explorationId:n.explorationId}))};
 const h=editorHarness({initial,request:async()=>({link})});
 await confirmEditor(h);
 assert.equal(h.window.listeners.has('beforeunload'),false);
 assert.equal(find(h.tree,n=>n.type==='Button' && n.props.children==='확정하기').props.disabled,true);
 h.edit('확정 후 새 변경');
 assert.equal(h.window.listeners.has('beforeunload'),true);
 assert.equal(find(h.tree,n=>n.type==='Button' && n.props.children==='확정하기').props.disabled,false);
 h.unmount();
});
