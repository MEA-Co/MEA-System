import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

function mount({
  component = 'QuestionnaireView',
  props = {},
  imports = {},
} = {}) {
  const slots = [];
  let cursor = 0;
  let changed = true;
  let effects = [];
  let tree;
  const window = {
    location: {
      href: 'https://example.test/dashboard?view=questions&tab=questionnaires&draft=new',
    },
    history: {
      replaceState: (_a, _b, url) => {
        window.location.href = String(url);
        changed = true;
      },
    },
  };
  const same = (a, b) =>
    a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[i],
        (v) => {
          const next = typeof v === 'function' ? v(slots[i]) : v;
          if (!Object.is(next, slots[i])) {
            slots[i] = next;
            changed = true;
          }
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (slots[i] ??= { current: initial });
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i], deps)) {
        slots[i] = deps;
        effects.push(fn);
      }
    },
  };
  react.useEffectEvent = (fn) => {
    const ref = react.useRef(fn);
    ref.current = fn;
    return (...args) => ref.current(...args);
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        'app/(private)/dashboard/_views/questions/components/questionnaire/' +
          component +
          '.tsx',
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
      structuredClone,
      require: (name) => {
        if (imports[name]) return imports[name];
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'next/navigation')
          return {
            useSearchParams: () => new URL(window.location.href).searchParams,
          };
        return new Proxy({}, { get: (_target, key) => key });
      },
    },
  );
  function flush() {
    for (let n = 0; changed && n < 20; n++) {
      changed = false;
      cursor = 0;
      tree = exports[component](props);
      const run = effects;
      effects = [];
      run.forEach((fn) => fn());
    }
    assert.equal(changed, false);
  }
  function walk(node, type, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child, type, predicate);
        if (found) return found;
      }
      return null;
    }
    if (
      (node.type === type || node.type?.name === type) &&
      predicate(node.props)
    )
      return node;
    return walk(node.props?.children, type, predicate);
  }
  const find = (type, predicate = () => true) => walk(tree, type, predicate);
  return {
    flush,
    find,
    route(id) {
      window.location.href =
        'https://example.test/dashboard?view=questions&tab=questionnaires' +
        (id ? '&draft=' + id : '');
      changed = true;
    },
    report(state) {
      find('QuestionnairePanel', (p) => !!p.id).props.onEditorState(state);
    },
  };
}
test('untouched questionnaire returns immediately while list remains mounted', () => {
  const app = mount();
  app.flush();
  assert.ok(app.find('QuestionnairePanel', (p) => !p.id));
  app
    .find(
      'Button',
      (p) =>
        Array.isArray(p.children) && p.children.includes('질문지 목록으로'),
    )
    .props.onClick();
  app.flush();
  assert.equal(
    app.find('QuestionnairePanel', (p) => !!p.id),
    null,
  );
  assert.equal(app.find('Dialog').props.open, false);
});
test('changed untitled questionnaire confirms closing and pauses autosave', () => {
  const app = mount();
  app.flush();
  app.report({ dirty: true, saving: false, emptyTitle: true });
  app
    .find(
      'Button',
      (p) =>
        Array.isArray(p.children) && p.children.includes('질문지 목록으로'),
    )
    .props.onClick();
  app.flush();
  assert.equal(app.find('Dialog').props.open, true);
  assert.match(app.find('DialogDescription').props.children, /제목이 비어/);
  assert.equal(
    app.find('QuestionnairePanel', (p) => !!p.id).props.paused,
    true,
  );
  app.find('Button', (p) => p.children === '계속 작성').props.onClick();
  app.flush();
  assert.ok(app.find('QuestionnairePanel', (p) => !!p.id));
  app
    .find(
      'Button',
      (p) =>
        Array.isArray(p.children) && p.children.includes('질문지 목록으로'),
    )
    .props.onClick();
  app.flush();
  app.find('Button', (p) => p.children === '변경 내용 버리기').props.onClick();
  app.flush();
  assert.equal(
    app.find('QuestionnairePanel', (p) => !!p.id),
    null,
  );
});
test('Back cannot discard edited questionnaire and saving prevents close', () => {
  const app = mount();
  app.flush();
  app.report({ dirty: true, saving: true, emptyTitle: false });
  app
    .find(
      'Button',
      (p) =>
        Array.isArray(p.children) && p.children.includes('질문지 목록으로'),
    )
    .props.onClick();
  app.flush();
  assert.ok(app.find('QuestionnairePanel', (p) => !!p.id));
  app.report({ dirty: true, saving: false, emptyTitle: false });
  app.route();
  app.flush();
  assert.ok(app.find('QuestionnairePanel', (p) => !!p.id));
  assert.equal(app.find('Dialog').props.open, true);
});
test('first save URL replacement retains the active questionnaire panel', () => {
  const app = mount();
  app.flush();
  app.report({ dirty: false, saving: false, emptyTitle: false });
  app.route('saved-id');
  app.flush();
  assert.equal(
    app.find('QuestionnairePanel', (p) => !!p.id).props.id,
    'saved-id',
  );
  assert.equal(app.find('Dialog').props.open, false);
});

function composer() {
  const source = {
    id: randomUUID(),
    title: '저장된 질문',
    prompt: '본문',
    fields: [],
    condition: null,
    source_block_id: null,
    after_block_id: null,
  };
  const initialDraft = {
    questionnaireId: randomUUID(),
    title: '작성한 질문지',
    revision: 0,
    savedAt: null,
    sections: [{ id: randomUUID(), title: '작성한 섹션', questions: [] }],
  };
  let current;
  const placements = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        'app/(private)/dashboard/_views/questions/lib/questionnaire/question-placement.ts',
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports: placements, crypto: { randomUUID } },
  );
  const library = {
    data: [source],
    mutate: async () => [source],
    isLoading: false,
  };
  const app = mount({
    component: 'QuestionnaireComposer',
    props: { initialDraft },
    imports: {
      '../../hooks/questionnaire/useQuestionLibrary': {
        useQuestionLibrary: () => library,
      },
      '../../hooks/questionnaire/useQuestionnaireSave': {
        useQuestionnaireSave: (doc) => {
          current = doc;
          return { save() {}, dirty: true, saving: false, blocked: false };
        },
      },
      '../../lib/questionnaire/question-placement': placements,
      '../../lib/questionnaire/api-client': {
        useQuestionnaireResource: () => ({ data: {}, error: null }),
      },
      '@/components/ui/toast': { toast: { add() {} } },
      '@base-ui/react/tabs': {
        Tabs: {
          Root: 'TabsRoot',
          List: 'TabsList',
          Tab: 'Tab',
          Panel: 'Panel',
        },
      },
    },
  });
  return { ...app, source, document: () => current };
}
test('question addition defaults to shared inline creator and preserves questionnaire edits', async () => {
  const app = composer();
  app.flush();
  app
    .find('Input', (p) => p.id === 'questionnaire-title')
    .props.onChange({ target: { value: '수정한 질문지' } });
  app.flush();
  app
    .find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('질문 추가하기'),
    )
    .props.onClick({ currentTarget: { focus() {} } });
  app.flush();
  const editor = app.find('QuestionLibraryView');
  assert.ok(editor);
  assert.equal(app.find('Dialog'), null);
  assert.equal(app.find('QuestionLibraryPicker'), null);
  const created = { ...app.source, id: randomUUID(), title: '새 질문' };
  await editor.props.embedded.onPlace(created);
  app.flush();
  assert.equal(app.find('QuestionLibraryView'), null);
  assert.equal(app.document().title, '수정한 질문지');
  assert.equal(app.document().sections[0].title, '작성한 섹션');
  assert.equal(
    app.document().sections[0].questions[0].sourceQuestionId,
    created.id,
  );
});
test('existing question loads into Drawer editor before placement and can reopen for original edits', async () => {
  const app = composer();
  app.flush();
  app
    .find(
      'Button',
      (p) => Array.isArray(p.children) && p.children.includes('질문 추가하기'),
    )
    .props.onClick({ currentTarget: { focus() {} } });
  app.flush();
  app
    .find('TabsRoot', (p) => p.value === 'new')
    .props.onValueChange('existing');
  app.flush();
  assert.ok(
    app.find('QuestionLibraryView'),
    'switching modes retains new question input',
  );
  app.find('QuestionLibraryPicker').props.onAdd(app.source.id);
  app.flush();
  assert.equal(app.find('Drawer').props.open, true);
  assert.equal(
    app.find('QuestionLibraryView').props.embedded.questionId,
    app.source.id,
  );
  assert.equal(app.document().sections[0].questions.length, 0);
  await app.find('QuestionLibraryView').props.embedded.onPlace(app.source);
  app.flush();
  assert.equal(
    app.document().sections[0].questions[0].sourceQuestionId,
    app.source.id,
  );
  assert.equal(app.find('QuestionLibraryPicker'), null);
  app
    .find('Button', (p) => p.title === '질문 수정')
    .props.onClick({ currentTarget: { focus() {} } });
  app.flush();
  assert.equal(
    app.find('QuestionLibraryView').props.embedded.questionId,
    app.source.id,
  );
  assert.equal(
    app.find('QuestionLibraryView').props.embedded.actionLabel,
    '완료',
  );
  await app.find('QuestionLibraryView').props.embedded.onPlace(app.source);
  app.flush();
  assert.equal(app.document().sections[0].questions.length, 1);
});
