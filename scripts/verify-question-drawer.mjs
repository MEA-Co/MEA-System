import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

// Exercise state/history/requests without running a browser.
function mount({
  delayedBack = false,
  failSave = false,
  embedded = false,
  guideFields = [],
  saveResults = [],
  purpose = 'response',
} = {}) {
  const placed = [];
  const saves = [];
  const reported = [];
  let cancelled = false;
  let autoSave;
  let pendingBack = null;
  const timers = [];
  const detailRequests = [];
  const toasts = [];
  const row = {
    id: randomUUID(),
    created_by: 'owner',
    title: '질문',
    prompt: '본문',
    purpose,
    button_label: purpose === 'study_registration' ? '학습법 추가' : null,
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
    purpose: q.purpose ?? 'response',
    buttonLabel:
      q.purpose === 'study_registration'
        ? (q.button_label ?? '학습법 추가')
        : undefined,
    fields: q.fields,
    rowMode: q.row_mode,
    answerLayout: q.answer_layout ?? 'cards',
    flowInsertAfter: q.flow_insert_after ?? [],
    initialRows: q.initial_rows ?? 1,
    minRows: q.min_rows ?? 1,
    maxRows: q.max_rows,
    rowLabels: q.row_labels ?? [],
    sourceBlockId: q.source_block_id,
    sourceFieldId: q.source_field_id,
    afterBlockId: q.after_block_id,
    condition: q.condition,
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
    setTimeout: (callback) => {
      timers.push(callback);
      return timers.length;
    },
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
        if (url.endsWith('/guide-answer-fields'))
          return { ok: true, json: async () => ({ fieldIds: guideFields }) };
        if (failSave && options?.method) throw new Error('offline');
        if (options?.method) {
          saves.push({
            url,
            method: options.method,
            body: JSON.parse(options.body),
          });
          const result = saveResults.shift();
          if (result instanceof Error) throw result;
          if (result)
            return {
              ok: false,
              status: result.status,
              json: async () => result.data,
            };
          const doc = JSON.parse(options.body).document;
          return {
            ok: true,
            json: async () => ({
              block: {
                ...row,
                id: doc.id,
                title: doc.title,
                prompt: doc.prompt,
                purpose: doc.purpose ?? 'response',
                button_label: doc.buttonLabel ?? null,
                fields: doc.fields,
                row_mode: doc.rowMode,
                answer_layout: doc.answerLayout ?? 'cards',
                flow_insert_after: doc.flowInsertAfter ?? [],
                initial_rows: doc.initialRows ?? 1,
                min_rows: doc.minRows ?? 1,
                max_rows: doc.maxRows,
                row_labels: doc.rowLabels ?? [],
                source_block_id: doc.sourceBlockId,
                source_field_id: doc.sourceFieldId,
                after_block_id: doc.afterBlockId,
                condition: doc.condition,
                revision: 2,
              },
            }),
          };
        }
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
        if (name === '@/lib/utils')
          return { cn: (...values) => values.filter(Boolean).join(' ') };
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
        tree = exports.QuestionLibraryView(
          embedded
            ? {
                embedded: {
                  questionId: embedded === 'existing' ? row.id : undefined,
                  onPlace: (q) => placed.push(q),
                  onCancel: () => {
                    cancelled = true;
                  },
                  onStateChange: (state) => reported.push(state),
                },
              }
            : {},
        );
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
        if (child == null) continue;
        const found = find(type, predicate, child);
        if (found) return found;
      }
      return null;
    }
    if (typeof node !== 'object') return null;
    if (
      (node.type === type ||
        (typeof node.type === 'function' && node.type.name === type)) &&
      predicate(node.props)
    )
      return node;
    return (
      find(type, predicate, node.props?.children ?? null) ??
      find(type, predicate, node.props?.action ?? null)
    );
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
    runTimers: () => timers.splice(0).forEach((callback) => callback()),
    placed,
    saves,
    reported,
    isCancelled: () => cancelled,
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
        props.children.some(
          (child) => child?.props?.children === '새 질문 만들기',
        ),
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
  const dialog = app.find('AlertDialog', (props) => props.open);
  assert.ok(dialog);
  assert.equal(app.find('Drawer').props.open, true);
  dialog.props.onOpenChange(false);
  await app.flush();
  assert.equal(
    new URL(app.window.location.href).searchParams.get('question'),
    id,
  );
  app.find('Drawer').props.onOpenChange(false);
  await app.flush();
  app
    .find('AlertDialogAction', (props) => props.children === '변경 내용 버리기')
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
        props.children.some(
          (child) => child?.props?.children === '새 질문 만들기',
        ),
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
  assert.ok(app.find('AlertDialog', (props) => props.open));
  app
    .find('AlertDialogAction', (props) => props.children === '변경 내용 버리기')
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
        Array.isArray(p.children) &&
        p.children.some((child) => child?.props?.children === '새 질문 만들기'),
    )
    .props.onClick();
  await app.flush();
  app
    .find('Input', (p) => p.id === 'block-title')
    .props.onChange({ target: { value: '작성 중' } });
  await app.flush();
  app.find('Drawer').props.onOpenChange(false);
  await app.flush();
  app
    .find('AlertDialogAction', (p) => p.children === '변경 내용 버리기')
    .props.onClick();
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
        Array.isArray(p.children) &&
        p.children.some((child) => child?.props?.children === '새 질문 만들기'),
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
    app.find('AlertDialog', (p) => p.open),
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
        Array.isArray(p.children) &&
        p.children.some((child) => child?.props?.children === '새 질문 만들기'),
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
  const dialog = app.find('AlertDialog', (p) => p.open);
  assert.match(
    app.find('AlertDialogDescription', () => true, dialog).props.children,
    /저장하지 않은 변경 내용이 사라집니다/,
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

test('inline question creation shares editor and only places a saved question without changing URL', async () => {
  const app = mount({ embedded: true });
  const url = app.window.location.href;
  await app.flush();
  assert.equal(app.find('Drawer'), null);
  assert.equal(app.find('QuestionManagementTable'), null);
  assert.ok(app.find('QuestionRichTextEditor'));
  assert.equal(
    app.find('Button', (p) => p.children === '질문지에 배치').props.disabled,
    true,
  );
  app.find('QuestionRichTextEditor').props.onChange('새 질문 본문');
  await app.flush();
  assert.equal(app.reported.at(-1).dirty, true);
  await app
    .find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    )
    .props.onClick();
  await app.flush();
  assert.equal(
    app.find('Button', (p) => p.children === '질문지에 배치').props.disabled,
    false,
  );
  app.find('Button', (p) => p.children === '질문지에 배치').props.onClick();
  assert.equal(app.placed.length, 1);
  assert.equal(app.placed[0].prompt, '새 질문 본문');
  assert.equal(app.window.location.href, url);
});
test('inline question omits return button and nested scroll container', async () => {
  const app = mount({ embedded: true });
  await app.flush();
  assert.equal(
    app.find('Button', (p) => p.children === '질문지로 돌아가기'),
    null,
  );
  assert.equal(
    app.find('div', (p) => p.className?.includes('overscroll-contain')),
    null,
  );
  assert.equal(
    app.find('AlertDialog', (p) => p.open),
    null,
  );
});

test('editing a loaded question saves to the original ID rather than creating a copy', async () => {
  const app = mount({ embedded: 'existing' });
  await app.flush();
  app.find('QuestionRichTextEditor').props.onChange('원본 수정');
  await app.flush();
  await app
    .find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    )
    .props.onClick();
  await app.flush();
  assert.equal(app.saves.length, 1);
  assert.equal(app.saves[0].method, 'PUT');
  assert.equal(app.saves[0].url, '/api/questions/' + app.row.id);
  assert.equal(app.saves[0].body.document.id, app.row.id);
});

test('occupied guide field deletion asks once and cancellation preserves the field', async () => {
  const fieldId = randomUUID();
  const app = mount({ guideFields: [fieldId] });
  app.row.fields = [
    { id: fieldId, label: '첫째', kind: 'text' },
    { id: randomUUID(), label: '둘째', kind: 'text' },
  ];
  app.window.confirm = () => assert.fail('Use the shared confirmation dialog');
  await app.flush();
  app.find('QuestionManagementTable').props.onOpen(app.row);
  await app.flush();
  app
    .find('QuestionBlockFieldEditor', (p) => p.field.id === fieldId)
    .props.onRemove();
  await app.flush();
  assert.ok(app.find('AlertDialog', (p) => p.open));
  assert.ok(
    app.find('QuestionBlockFieldEditor', (p) => p.field.id === fieldId),
  );
  app.window.history.back();
  await app.flush();
  assert.equal(
    new URL(app.window.location.href).searchParams.get('question'),
    app.row.id,
  );
  const guideDialog = app.find('AlertDialog', (p) => p.open);
  assert.equal(
    app.find('AlertDialogTitle', () => true, guideDialog).props.children,
    '가이드 응답을 삭제하고 변경할까요?',
  );
  app.find('AlertDialogCancel', (p) => p.children === '취소').props.onClick();
  await app.flush();
  assert.ok(
    app.find('QuestionBlockFieldEditor', (p) => p.field.id === fieldId),
  );
  app
    .find('QuestionBlockFieldEditor', (p) => p.field.id === fieldId)
    .props.onRemove();
  await app.flush();
  app
    .find('AlertDialogAction', (p) => p.children === '삭제하고 계속')
    .props.onClick();
  await app.flush();
  assert.equal(
    app.find('QuestionBlockFieldEditor', (p) => p.field.id === fieldId),
    null,
  );
  app.tick();
  await app.flush();
  assert.deepEqual(app.saves[0].body.confirmedGuideAnswerFields, [fieldId]);
});

test('type changes ask only for occupied guide fields; labels do not ask', async () => {
  const fieldId = randomUUID();
  const app = mount({ guideFields: [fieldId] });
  app.row.fields = [
    { id: fieldId, label: '첫째', kind: 'text' },
    { id: randomUUID(), label: '둘째', kind: 'text' },
  ];
  app.window.confirm = () => assert.fail('Use the shared confirmation dialog');
  await app.flush();
  app.find('QuestionManagementTable').props.onOpen(app.row);
  await app.flush();
  let field = app.find(
    'QuestionBlockFieldEditor',
    (p) => p.field.id === fieldId,
  );
  field.props.onChange({ ...field.props.field, label: '새 이름' });
  await app.flush();
  assert.equal(
    app.find('AlertDialog', (p) => p.open),
    null,
  );
  field = app.find('QuestionBlockFieldEditor', (p) => p.field.id === fieldId);
  field.props.onChange({ ...field.props.field, kind: 'scale' });
  await app.flush();
  assert.ok(app.find('AlertDialog', (p) => p.open));
  assert.equal(
    app.find('QuestionBlockFieldEditor', (p) => p.field.id === fieldId).props
      .field.kind,
    'text',
  );
  app.find('AlertDialogCancel', (p) => p.children === '취소').props.onClick();
  await app.flush();
  app
    .find('QuestionBlockFieldEditor', (p) => p.field.id !== fieldId)
    .props.onRemove();
  await app.flush();
  assert.equal(
    app.find('AlertDialog', (p) => p.open),
    null,
  );
});

test('dependency rejection keeps edits available for another save after the dependency is removed', async () => {
  const app = mount({
    embedded: 'existing',
    saveResults: [
      {
        status: 409,
        data: {
          error: '연결된 질문의 조건을 해제해 주세요.',
          code: 'question_edit_restricted',
        },
      },
    ],
  });
  await app.flush();
  app.find('QuestionRichTextEditor').props.onChange('보존할 수정 내용');
  await app.flush();
  const saveButton = () =>
    app.find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    );
  await saveButton().props.onClick();
  await app.flush();
  assert.equal(app.saves.length, 1);
  assert.equal(
    app.find('QuestionRichTextEditor').props.value,
    '보존할 수정 내용',
  );
  assert.equal(saveButton().props.disabled, false);
  await saveButton().props.onClick();
  await app.flush();
  assert.equal(app.saves.length, 2);
  assert.equal(
    app.saves[1].body.expectedRevision,
    app.saves[0].body.expectedRevision,
  );
  assert.notEqual(app.saves[1].body.saveId, app.saves[0].body.saveId);
  assert.equal(app.saves[1].body.document.prompt, '보존할 수정 내용');
});

test('a revision conflict still blocks another save and keeps the unsaved content', async () => {
  const app = mount({
    embedded: 'existing',
    saveResults: [
      {
        status: 409,
        data: { error: '수정 번호 충돌', code: 'revision_conflict' },
      },
    ],
  });
  await app.flush();
  app.find('QuestionRichTextEditor').props.onChange('충돌 중 보존할 내용');
  await app.flush();
  const saveButton = () =>
    app.find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    );
  await saveButton().props.onClick();
  await app.flush();
  assert.equal(saveButton().props.disabled, true);
  assert.equal(
    app.find('QuestionRichTextEditor').props.value,
    '충돌 중 보존할 내용',
  );
  app.tick();
  await saveButton().props.onClick();
  await app.flush();
  assert.equal(app.saves.length, 1);
});

test('an uncertain save retries with the same save ID, revision and content', async () => {
  const app = mount({
    embedded: 'existing',
    saveResults: [new Error('offline')],
  });
  await app.flush();
  app.find('QuestionRichTextEditor').props.onChange('재시도할 내용');
  await app.flush();
  const saveButton = () =>
    app.find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    );
  await saveButton().props.onClick();
  await app.flush();
  assert.equal(app.saves.length, 1);
  assert.equal(saveButton().props.disabled, false);
  await saveButton().props.onClick();
  await app.flush();
  assert.equal(app.saves.length, 2);
  assert.deepEqual(app.saves[1].body, app.saves[0].body);
});

test('question creation no longer exposes a card purpose selector', async () => {
  const app = mount({ embedded: true });
  await app.flush();
  assert.equal(
    app.find(
      'Select',
      (p) => p.value === 'response' || p.value === 'study_registration',
    ),
    null,
  );
  assert.ok(app.find('SelectTrigger', (p) => p.id === 'answer-layout'));
  assert.ok(app.find('QuestionConditionEditor'));
  app.find('QuestionRichTextEditor').props.onChange('새 질문');
  await app.flush();
  await app
    .find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    )
    .props.onClick();
  await app.flush();
  assert.equal(app.saves[0].body.document.purpose, 'response');
});

for (const confirmed of [false, true]) {
  test(`save-time guide confirmation ${confirmed ? 'retries the same save' : 'pauses autosave'} without changing the closing message`, async () => {
    const fieldId = randomUUID();
    const app = mount({
      embedded: 'existing',
      saveResults: [
        {
          status: 409,
          data: {
            code: 'guide_answer_confirmation_required',
            fieldIds: [fieldId],
          },
        },
      ],
    });
    await app.flush();
    app.find('QuestionRichTextEditor').props.onChange('보존할 내용');
    await app.flush();
    const save = app
      .find(
        'Button',
        (p) => Array.isArray(p.children) && p.children.includes('저장'),
      )
      .props.onClick();
    await app.flush();
    const dialog = app.find('AlertDialog', (p) => p.open);
    assert.ok(dialog);
    const message = app.find('AlertDialogDescription', () => true, dialog).props
      .children;
    assert.match(message, /새로 저장된 가이드 응답/);
    assert.ok(
      app.find('div', (p) => p.inert && p.style?.overflow === 'hidden'),
    );
    assert.equal(app.saves.length, 1);
    app
      .find(
        confirmed ? 'AlertDialogAction' : 'AlertDialogCancel',
        (p) => p.children === (confirmed ? '삭제하고 계속' : '취소'),
        dialog,
      )
      .props.onClick();
    await save;
    await app.flush();
    assert.equal(
      app.find('AlertDialog', (p) => p.open),
      null,
    );
    assert.ok(
      app.find('AlertDialogDescription', (p) => p.children === message),
    );
    app.runTimers();
    await app.flush();
    if (confirmed) {
      assert.equal(app.saves.length, 2);
      assert.equal(app.saves[1].body.saveId, app.saves[0].body.saveId);
      assert.deepEqual(app.saves[1].body.confirmedGuideAnswerFields, [fieldId]);
      assert.equal(app.saves[1].body.document.prompt, '보존할 내용');
    } else {
      app.tick();
      await app.flush();
      assert.equal(app.saves.length, 1);
      assert.equal(
        app.find('QuestionRichTextEditor').props.value,
        '보존할 내용',
      );
    }
  });
}

test('flow insertion permissions follow fixed period indices and keep original field IDs', async () => {
  const app = mount({ embedded: 'existing' });
  app.row.fields = [{ id: randomUUID(), label: '성적', kind: 'text' }];
  const fieldId = app.row.fields[0].id;
  await app.flush();
  app.find('Select', (p) => p.value === 'cards').props.onValueChange('flow');
  await app.flush();
  assert.equal(app.find('QuestionBlockFieldEditor').props.field.id, fieldId);
  app
    .find('Checkbox', (p) => p.id === 'flow-insert-after-6')
    .props.onCheckedChange(true);
  app
    .find('Checkbox', (p) => p.id === 'flow-insert-after-2')
    .props.onCheckedChange(true);
  await app.flush();
  assert.equal(
    app.find('Checkbox', (p) => p.id === 'flow-insert-after-2').props.checked,
    true,
  );
  app
    .find('Input', (p) => p.id === 'row-label-1')
    .props.onChange({ target: { value: '고1 겨울' } });
  await app.flush();
  await app
    .find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    )
    .props.onClick();
  await app.flush();
  assert.deepEqual(app.saves[0].body.document.flowInsertAfter, [2, 6]);
  assert.equal(app.saves[0].body.document.rowLabels[1], '고1 겨울');
  assert.equal(app.saves[0].body.document.maxRows, 6);
  assert.equal(app.saves[0].body.document.fields[0].id, fieldId);
});

test('reducing fixed periods removes only out-of-range insertion positions and switching to a table clears them', async () => {
  const app = mount({ embedded: 'existing' });
  app.row.answer_layout = 'flow';
  app.row.row_mode = 'repeatable';
  app.row.max_rows = 6;
  app.row.flow_insert_after = [2, 6];
  await app.flush();
  app.find('MaxItemsInput').props.onChange(3);
  await app.flush();
  assert.equal(
    app.find('Checkbox', (p) => p.id === 'flow-insert-after-2').props.checked,
    true,
  );
  assert.equal(
    app.find('Checkbox', (p) => p.id === 'flow-insert-after-6'),
    null,
  );
  await app
    .find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    )
    .props.onClick();
  await app.flush();
  assert.deepEqual(app.saves[0].body.document.flowInsertAfter, [2]);
  assert.equal(app.saves[0].body.document.maxRows, 3);
  app.find('Select', (p) => p.value === 'flow').props.onValueChange('table');
  await app.flush();
  assert.equal(
    app.find('Checkbox', (p) => p.id === 'flow-insert-after-2'),
    null,
  );
  await app
    .find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('저장'),
    )
    .props.onClick();
  await app.flush();
  assert.deepEqual(app.saves[1].body.document.flowInsertAfter, []);
  assert.equal(app.saves[1].body.document.maxRows, 3);
});

test('registration role and full fixed-period capacity do not expose new insertion choices', async () => {
  const app = mount({ embedded: true });
  await app.flush();
  app.find('Select', (p) => p.value === 'cards').props.onValueChange('flow');
  await app.flush();
  app
    .find('Checkbox', (p) => p.id === 'flow-insert-after-2')
    .props.onCheckedChange(true);
  await app.flush();
  app.find('MaxItemsInput').props.onChange(20);
  await app.flush();
  assert.equal(
    app.find('Checkbox', (p) => p.id === 'flow-insert-after-2').props.checked,
    false,
  );
  assert.equal(
    app.find('Checkbox', (p) => p.id === 'flow-insert-after-1').props.disabled,
    true,
  );
  app
    .find('Checkbox', (p) => p.id === 'flow-insert-after-1')
    .props.onCheckedChange(true);
  await app.flush();
  assert.equal(
    app.find('Checkbox', (p) => p.id === 'flow-insert-after-1').props.checked,
    false,
  );
  const legacy = mount({ embedded: 'existing', purpose: 'study_registration' });
  await legacy.flush();
  assert.equal(
    legacy.find('Checkbox', (p) => p.id?.startsWith('flow-insert-after-')),
    null,
  );
});
