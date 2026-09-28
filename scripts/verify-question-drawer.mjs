import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise state/history/requests without running a browser.
function mount({ delayedBack = false, failSave = false } = {}) {
  let autoSave;
  let pendingBack = null;
  const detailRequests = [];
  const toasts = [];
  const row = {
    id: randomUUID(),
    created_by: 'owner',
    title: '질문',
    prompt: '본문',
    fields: [],
    row_mode: 'single',
    max_rows: null,
    source_block_id: null,
    source_field_id: null,
    after_block_id: null,
    condition: null,
    revision: 1,
    updated_at: '2026-09-28T00:00:00Z',
    archived_at: null,
    details: [],
  };
  const documentFromRow = (q) => ({
    id: q.id,
    title: q.title,
    prompt: q.prompt,
    fields: q.fields,
    rowMode: q.row_mode,
    maxRows: null,
    sourceBlockId: null,
    sourceFieldId: null,
    afterBlockId: null,
    condition: null,
    details: q.details,
  });
  const setters = [];
  const slots = [];
  let index = 0;
  let changed = true;
  let tree;
  let effects = [];
  const calls = [];
  const history = ['https://example.test/dashboard?view=questions'];
  let position = 0;
  const local = new Map();
  const same = (a, b) =>
    !!a &&
    !!b &&
    a.length === b.length &&
    a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState: (initial) => {
      const i = index++;
      if (!(i in slots))
        slots[i] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[i],
        (setters[i] ??= (v) => {
          const next = typeof v === 'function' ? v(slots[i]) : v;
          if (!Object.is(next, slots[i])) {
            slots[i] = next;
            changed = true;
          }
        }),
      ];
    },
    useRef: (value) => {
      const i = index++;
      return (slots[i] ??= { current: value });
    },
    useMemo: (fn, deps) => {
      const i = index++;
      if (!slots[i] || !same(slots[i].deps, deps))
        slots[i] = { deps, value: fn() };
      return slots[i].value;
    },
    useEffect: (fn, deps) => {
      const i = index++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const previous = slots[i];
        slots[i] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  react.useEffectEvent = (fn) => {
    const ref = react.useRef(fn);
    ref.current = fn;
    return react.useCallback((...args) => ref.current(...args), []);
  };
  const jsx = (type, props) => ({ type, props });
  const window = {
    location: { href: history[0] },
    history: {
      pushState: (_s, _t, url) => {
        history.splice(position + 1);
        history.push(String(url));
        position++;
        window.location.href = String(url);
        changed = true;
      },
      replaceState: (_s, _t, url) => {
        history[position] = String(url);
        window.location.href = String(url);
        changed = true;
      },
      back: () => {
        if (position > 0) {
          const complete = () => {
            window.location.href = history[--position];
            changed = true;
          };
          if (delayedBack) pendingBack = complete;
          else complete();
        }
      },
    },
    localStorage: {
      getItem: (k) => local.get(k) ?? null,
      setItem: (k, v) => local.set(k, v),
      removeItem: (k) => local.delete(k),
    },
    document: {
      activeElement: null,
      addEventListener() {},
      removeEventListener() {},
    },
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: (callback) => {
      autoSave = callback;
      return 1;
    },
    clearInterval() {},
    addEventListener() {},
    removeEventListener() {},
  };
  const imports = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': {
      useSearchParams: () => new URL(window.location.href).searchParams,
    },
    '@base-ui/react/tabs': {
      Tabs: { Root: 'TabsRoot', List: 'TabsList', Tab: 'Tab', Panel: 'Panel' },
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        'app/(private)/dashboard/_views/questions/components/question/QuestionLibraryView.tsx',
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    {
      exports,
      window,
      URL,
      crypto: { randomUUID },
      HTMLElement: class {},
      HTMLAnchorElement: class {},
      Element: class {},
      fetch: async (url, options) => {
        calls.push(url);
        if (failSave && options?.method) throw new Error('offline');
        return {
          ok: true,
          json: async () => ({
            blocks: [row],
            references: [],
            total: 1,
            page: 1,
            userId: 'owner',
            role: 'consultant_lead',
          }),
        };
      },
      require: (name) => {
        if (imports[name]) return imports[name];
        if (name.endsWith('useQuestionEditorData'))
          return {
            useQuestionEditorData: (id, unsaved) => {
              if (id && id !== 'new' && !unsaved) detailRequests.push(id);
              return {
                detail: {
                  data: id === row.id ? row : undefined,
                  isLoading: false,
                  mutate: async () => {},
                },
                relationships: {
                  data: [row],
                  isLoading: false,
                  mutate: async () => {},
                },
              };
            },
          };
        if (name.endsWith('question-blocks'))
          return {
            documentFromRow,
            emptyQuestionBlock: () => ({
              ...documentFromRow(row),
              id: randomUUID(),
              title: '',
              prompt: '',
            }),
            questionBlockSchema: {
              safeParse: (value) => ({ success: true, data: value }),
            },
            questionName: (q) => q.title || q.prompt,
          };
        if (name.endsWith('rich-text')) return { richTextPlainText: (s) => s };
        if (name.endsWith('/toast'))
          return {
            toast: {
              add(value) {
                toasts.push(value);
              },
            },
          };
        return new Proxy({}, { get: (_t, key) => key });
      },
    },
  );
  async function flush() {
    for (let i = 0; i < 25; i++) {
      if (changed) {
        changed = false;
        index = 0;
        tree = exports.QuestionLibraryView();
        const run = effects;
        effects = [];
        run.forEach((fn) => fn());
      }
      await Promise.resolve();
    }
    assert.equal(changed, false, 'render settles');
  }
  function find(type, predicate = () => true, node = tree) {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = find(type, predicate, child);
        if (found) return found;
      }
      return null;
    }
    if (typeof node !== 'object') return null;
    if (node.type === type && predicate(node.props)) return node;
    return node.props?.children == null
      ? null
      : find(type, predicate, node.props.children);
  }
  return {
    flush,
    find,
    calls,
    row,
    window,
    local,
    detailRequests,
    toasts,
    completeBack: () => pendingBack?.(),
    tick: () => autoSave?.(),
  };
}

test('opening an existing question keeps the paged list mounted and closing returns to the same URL', async () => {
  const app = mount();
  await app.flush();
  assert.ok(app.find('QuestionManagementTable'));
  const before = app.calls.length;
  app.find('QuestionManagementTable').props.onOpen(app.row);
  await app.flush();
  assert.ok(app.find('QuestionManagementTable'));
  assert.equal(app.find('Drawer').props.open, true);
  assert.equal(
    app.calls.length,
    before,
    'opening drawer does not refetch the full list',
  );
  app.find('Drawer').props.onOpenChange(false);
  await app.flush();
  assert.equal(app.find('Drawer').props.open, false);
  assert.equal(
    new URL(app.window.location.href).searchParams.get('question'),
    null,
  );
});

test('new question close asks before discarding and cancel retains the draft', async () => {
  const app = mount();
  await app.flush();
  app
    .find(
      'Button',
      (props) =>
        Array.isArray(props.children) &&
        props.children.includes(' 새 질문 만들기'),
    )
    .props.onClick();
  await app.flush();
  const id = new URL(app.window.location.href).searchParams.get('question');
  assert.ok(id);
  assert.ok(app.find('Input', (props) => props.id === 'block-title'));
  app
    .find('Input', (p) => p.id === 'block-title')
    .props.onChange({ target: { value: '작성 중' } });
  await app.flush();
  app.find('Drawer').props.onOpenChange(false);
  await app.flush();
  const dialog = app.find('Dialog', (props) => props.open);
  assert.ok(dialog);
  assert.equal(app.find('Drawer').props.open, true);
  app
    .find('Button', (props) => props.children === '계속 작성', dialog)
    .props.onClick();
  await app.flush();
  assert.equal(
    new URL(app.window.location.href).searchParams.get('question'),
    id,
  );
  app.find('Drawer').props.onOpenChange(false);
  await app.flush();
  app
    .find('Button', (props) => props.children === '변경 내용 버리기')
    .props.onClick();
  await app.flush();
  assert.equal(app.find('Drawer').props.open, false);
  assert.equal(app.local.size, 0);
});

test('Back with unsaved content restores the editor until discard is confirmed', async () => {
  const app = mount();
  await app.flush();
  app
    .find(
      'Button',
      (props) =>
        Array.isArray(props.children) &&
        props.children.includes(' 새 질문 만들기'),
    )
    .props.onClick();
  await app.flush();
  app
    .find('Input', (p) => p.id === 'block-title')
    .props.onChange({ target: { value: '작성 중' } });
  await app.flush();
  app.window.history.back();
  await app.flush();
  assert.equal(app.find('Drawer').props.open, true);
  assert.ok(app.find('Dialog', (props) => props.open));
  app
    .find('Button', (props) => props.children === '변경 내용 버리기')
    .props.onClick();
  await app.flush();
  assert.equal(app.find('Drawer').props.open, false);
  assert.equal(
    new URL(app.window.location.href).searchParams.get('view'),
    'questions',
  );
});

test('discard does not request an unsaved question while history Back is pending', async () => {
  const app = mount({ delayedBack: true });
  await app.flush();
  app
    .find(
      'Button',
      (p) =>
        Array.isArray(p.children) && p.children.includes(' 새 질문 만들기'),
    )
    .props.onClick();
  await app.flush();
  app
    .find('Input', (p) => p.id === 'block-title')
    .props.onChange({ target: { value: '작성 중' } });
  await app.flush();
  app.find('Drawer').props.onOpenChange(false);
  await app.flush();
  app.find('Button', (p) => p.children === '변경 내용 버리기').props.onClick();
  await app.flush();
  assert.deepEqual(app.detailRequests, []);
  app.completeBack();
  await app.flush();
  assert.equal(app.find('Drawer').props.open, false);
  assert.deepEqual(app.detailRequests, []);
});

test('untouched new question disables save and closes without confirmation or detail fetch', async () => {
  const app = mount({ delayedBack: true });
  await app.flush();
  app
    .find(
      'Button',
      (p) =>
        Array.isArray(p.children) && p.children.includes(' 새 질문 만들기'),
    )
    .props.onClick();
  await app.flush();
  assert.equal(
    app.find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    ).props.disabled,
    true,
  );
  app.find('Drawer').props.onOpenChange(false);
  await app.flush();
  assert.equal(
    app.find('Dialog', (p) => p.open),
    null,
  );
  assert.equal(app.local.size, 0);
  assert.deepEqual(app.detailRequests, []);
  app.completeBack();
  await app.flush();
  assert.equal(app.find('Drawer').props.open, false);
});
test('edited new question enables save but empty prompt prevents requests and explains why', async () => {
  const app = mount();
  await app.flush();
  app
    .find(
      'Button',
      (p) =>
        Array.isArray(p.children) && p.children.includes(' 새 질문 만들기'),
    )
    .props.onClick();
  await app.flush();
  app
    .find('Input', (p) => p.id === 'block-title')
    .props.onChange({ target: { value: '작성 중' } });
  await app.flush();
  const button = app.find(
    'Button',
    (p) => Array.isArray(p.children) && p.children.includes('저장'),
  );
  assert.equal(button.props.disabled, false);
  const before = app.calls.length;
  await button.props.onClick();
  await app.flush();
  assert.equal(app.calls.length, before);
  assert.match(app.toasts.at(-1).title, /질문 본문이 비어/);
  app.find('Drawer').props.onOpenChange(false);
  await app.flush();
  const dialog = app.find('Dialog', (p) => p.open);
  assert.match(
    app.find('DialogDescription', () => true, dialog).props.children,
    /저장할 수 없어요/,
  );
});

test('automatic save failure shows a toast, preserves input, and does not repeat the same error toast', async () => {
  const app = mount({ failSave: true });
  await app.flush();
  app.find('QuestionManagementTable').props.onOpen(app.row);
  await app.flush();
  app.find('QuestionRichTextEditor').props.onChange('변경한 본문');
  await app.flush();
  app.tick();
  await app.flush();
  assert.match(app.toasts.at(-1).title, /저장 결과를 확인하지 못했어요/);
  const count = app.toasts.length;
  assert.equal(app.find('QuestionRichTextEditor').props.value, '변경한 본문');
  app.tick();
  await app.flush();
  assert.equal(app.toasts.length, count);
});
