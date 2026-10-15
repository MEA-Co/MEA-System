import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const directory = 'app/(private)/dashboard/_views/questions/';
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadSource(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      crypto: globalThis.crypto,
      require: (name) => {
        if (!(name in dependencies))
          throw new Error(`Unexpected import: ${name}`);
        return dependencies[name];
      },
    },
  );
  return exports;
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [tree, ...nodes(tree.props.children)];
}

function content(tree) {
  if (Array.isArray(tree)) return tree.map(content).join('');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree?.props ? content(tree.props.children) : '';
}

const fixedRows = () => [
  { id: 11, flowIndex: 1, answers: { score: '기존 성적' } },
  { id: 12, flowIndex: 2, answers: {} },
  { id: 13, flowIndex: 3, answers: { note: '기존 대응' } },
];

function createHarness({
  initialRows = fixedRows(),
  disabled = false,
  waiting = false,
  insertAfter = [1, 3],
  answerLayout = 'flow',
  rowMode = 'repeatable',
  fields = [
    { id: 'score', label: '성적', kind: 'text' },
    { id: 'note', label: '대응', kind: 'text' },
  ],
} = {}) {
  const scopes = new Map();
  let active = null;
  let effects = [];
  let stored;
  let answered;
  const focusHistory = [];
  const dependencyEqual = (a, b) =>
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((item, index) => Object.is(item, b[index]));
  function hook(initial) {
    const { slots, cursor } = active;
    active.cursor++;
    if (!(cursor in slots)) slots[cursor] = initial();
    return { slots, cursor, value: slots[cursor] };
  }
  const react = {
    Fragment: 'fragment',
    useState(initial) {
      const current = hook(() =>
        typeof initial === 'function' ? initial() : initial,
      );
      return [
        current.value,
        (next) => {
          current.slots[current.cursor] =
            typeof next === 'function'
              ? next(current.slots[current.cursor])
              : next;
        },
      ];
    },
    useRef(initial) {
      return hook(() => ({ current: initial })).value;
    },
    useId() {
      const name = active.name;
      const cursor = active.cursor;
      return hook(() => `${name}-${cursor}`).value;
    },
    useMemo(factory, dependencies) {
      const current = hook(() => ({ value: factory(), dependencies }));
      if (!dependencyEqual(current.value.dependencies, dependencies))
        current.slots[current.cursor] = { value: factory(), dependencies };
      return current.slots[current.cursor].value;
    },
    useEffect(callback, dependencies) {
      const current = hook(() => ({ dependencies: null }));
      if (!dependencyEqual(current.value.dependencies, dependencies)) {
        current.slots[current.cursor] = { dependencies };
        effects.push(callback);
      }
    },
  };
  const element = (type, props, key) => ({ type, props, key });
  const jsx = { jsx: element, jsxs: element, Fragment: 'fragment' };
  const icons = {
    Plus: 'PlusIcon',
    Trash2: 'TrashIcon',
    ChevronDown: 'ChevronIcon',
  };
  const dialog = Object.fromEntries(
    [
      'Dialog',
      'DialogContent',
      'DialogDescription',
      'DialogFooter',
      'DialogHeader',
      'DialogTitle',
    ].map((name) => [name, name]),
  );
  const richText = loadSource(`${directory}lib/rich-text.ts`);
  const questionTypes = loadSource(`${directory}lib/question-types.ts`);
  const referenceRows = loadSource(`${directory}lib/reference-rows.ts`);
  const flowRows = loadSource(`${directory}lib/flow-rows.ts`);
  const { QuestionGridInput } = loadSource(
    `${directory}components/question/QuestionGridInput.tsx`,
    {
      react,
      'react/jsx-runtime': jsx,
      'lucide-react': icons,
      '@/components/ui/button': { Button: 'button' },
      '@/components/ui/dialog': dialog,
      '@/components/ui/input': { Input: 'input' },
      '../../lib/flow-rows': flowRows,
      '../../lib/rich-text': richText,
    },
  );
  const { QuestionBlockPreview } = loadSource(
    `${directory}components/question/QuestionBlockPreview.tsx`,
    {
      react,
      'react/jsx-runtime': jsx,
      'lucide-react': icons,
      '@/components/ui/badge': { Badge: 'badge' },
      '@/components/ui/detail-value': { DetailValue: 'dd' },
      '../../lib/submitted-row-label': loadSource(
        directory + 'lib/submitted-row-label.ts',
      ),
      './question-styles': loadSource(
        `${directory}components/question/question-styles.ts`,
      ),
      '@/components/ui/button': { Button: 'button' },
      '../../lib/career-flow-placeholders': {
        CAREER_FLOW_QUESTION_ID: 'legacy-career',
      },
      '../../lib/choice-condition': loadSource(
        `${directory}lib/choice-condition.ts`,
      ),
      '../../lib/field-question': loadSource(
        `${directory}lib/field-question.ts`,
        { './question-types': questionTypes },
      ),
      '../../lib/flow-rows': flowRows,
      '../../lib/question-blocks': {
        documentFromRow() {
          throw new Error('Unexpected source preview');
        },
      },
      '../../lib/question-types': questionTypes,
      '../../lib/reference-rows': referenceRows,
      '../../lib/rich-text': richText,
      './ExplorationCommands': {
        ExplorationReferenceContent: 'ExplorationReferenceContent',
      },
      './QuestionAnswerTable': { QuestionAnswerTable: 'QuestionAnswerTable' },
      './QuestionChoiceInput': { QuestionChoiceInput: 'QuestionChoiceInput' },
      './QuestionGridInput': { QuestionGridInput },
      './QuestionGuideAnswerTable': {
        QuestionGuideAnswerTable: 'QuestionGuideAnswerTable',
      },
      './QuestionRichTextEditor': { QuestionRichTextEditor: 'RichTextEditor' },
      './ReferenceRecommendations': {
        ReferenceRecommendations: 'ReferenceRecommendations',
      },
      './RichTextContent': { RichTextContent: 'RichTextContent' },
      './StudyCommands': { StudyReferenceContent: 'StudyReferenceContent' },
      './StudyRegistrationCard': {
        StudyRegistrationCard: 'StudyRegistrationCard',
      },
    },
  );
  const document = {
    id: 'flow-question',
    title: '성적 흐름',
    prompt: '시기별 성적과 대응',
    purpose: 'response',
    answerLayout,
    rowMode,
    minRows: 2,
    maxRows: 3,
    initialRows: 3,
    rowLabels: ['고1 1학기', '고1 2학기', '고2 1학기'],
    flowInsertAfter: insertAfter,
    fields,
    condition: null,
    sourceBlockId: null,
    sourceFieldId: null,
    afterBlockId: null,
  };
  let props = {
    document,
    initialRows,
    disabled,
    runtime: { waiting, matchedRows: [] },
    onStoredRowsChange: (rows) => {
      stored = plain(rows);
    },
    onAnsweredRowsChange: (rows) => {
      answered = plain(rows);
    },
  };
  function run(name, component, componentProps) {
    if (!scopes.has(name)) scopes.set(name, []);
    active = { name, slots: scopes.get(name), cursor: 0 };
    const rendered = component(componentProps);
    active = null;
    return rendered;
  }
  function render(changes = {}) {
    props = { ...props, ...changes };
    const inner = run('wrapper', QuestionBlockPreview, props);
    const response = run('preview', inner.type, inner.props);
    const grid = nodes(response).find(
      (item) => item.type === QuestionGridInput,
    );
    if (props.document.answerLayout !== 'cards')
      assert.ok(grid, 'The real preview must render the real grid');
    const tree = grid ? run('grid', QuestionGridInput, grid.props) : response;
    for (const item of nodes(tree)) {
      const ref = item.props.ref;
      if (!ref) continue;
      const target = {
        isConnected: true,
        focus() {
          focusHistory.push(item.props.id ?? item.props['aria-label']);
        },
        scrollIntoView() {},
      };
      if (typeof ref === 'function') ref(target);
      else ref.current = target;
    }
    const pending = effects;
    effects = [];
    pending.forEach((callback) => callback());
    return { tree, grid: grid?.props, stored, answered, focusHistory };
  }
  return { render, document };
}

const button = (tree, ariaLabel) =>
  nodes(tree).find(
    (node) => node.type === 'button' && node.props['aria-label'] === ariaLabel,
  );
const labelInput = (tree) => nodes(tree).find((node) => node.type === 'input');
const dialogRoot = (tree) => nodes(tree).find((node) => node.type === 'Dialog');
const click = (node) => {
  assert.ok(node, 'Expected the action to be rendered');
  node.props.onClick({
    currentTarget: { isConnected: true, focus() {} },
    stopPropagation() {},
  });
};

const cardToggles = (tree) =>
  nodes(tree).filter((node) => node.props['aria-expanded'] !== undefined);

test('repeated cards open the first saved row and retain explicit collapse and selection', () => {
  const harness = createHarness({ answerLayout: 'cards' });
  let view = harness.render();
  assert.deepEqual(
    cardToggles(view.tree).map((node) => node.props['aria-expanded']),
    [true, false, false],
  );
  assert.equal(
    nodes(view.tree).find((node) => node.type === 'RichTextEditor').props.value,
    '기존 성적',
  );

  click(cardToggles(view.tree)[0]);
  view = harness.render();
  assert.ok(
    cardToggles(view.tree).every((node) => !node.props['aria-expanded']),
  );
  click(cardToggles(view.tree)[1]);
  view = harness.render();
  nodes(view.tree)
    .find((node) => node.type === 'RichTextEditor')
    .props.onChange('둘째 행 수정');
  view = harness.render();
  assert.deepEqual(
    cardToggles(view.tree).map((node) => node.props['aria-expanded']),
    [false, true, false],
  );
  assert.equal(view.stored[1].answers.score, '둘째 행 수정');
  assert.equal(view.stored[0].answers.score, '기존 성적');
});

test('new repeated cards open the first empty row without saving generated rows', () => {
  const harness = createHarness({ answerLayout: 'cards', initialRows: [] });
  const view = harness.render();
  assert.deepEqual(
    cardToggles(view.tree).map((node) => node.props['aria-expanded']),
    [true, false],
  );
  assert.deepEqual(view.stored, []);
  assert.deepEqual(view.answered, []);
});

test('reference cards open the first row when the condition becomes available', () => {
  const harness = createHarness({
    answerLayout: 'cards',
    rowMode: 'reference',
    initialRows: [],
    waiting: true,
  });
  assert.equal(cardToggles(harness.render().tree).length, 0);
  const matchedRows = [
    { id: 57, answers: {} },
    { id: 92, answers: {} },
  ];
  let view = harness.render({ runtime: { waiting: false, matchedRows } });
  assert.deepEqual(
    cardToggles(view.tree).map((node) => node.props['aria-expanded']),
    [true, false],
  );
  click(cardToggles(view.tree)[0]);
  harness.render({ runtime: { waiting: true, matchedRows: [] } });
  view = harness.render({ runtime: { waiting: false, matchedRows } });
  assert.ok(
    cardToggles(view.tree).every((node) => !node.props['aria-expanded']),
  );
});

// A row-spanning cell can cross ordinary rows, but never a thead/tbody boundary.
function directChildren(node) {
  function unwrap(children) {
    if (Array.isArray(children)) return children.flatMap(unwrap);
    if (!children?.props) return [];
    if (children.type === 'fragment') return unwrap(children.props.children);
    return [children];
  }
  return unwrap(node.props.children);
}

const rowCells = (row) =>
  directChildren(row).filter(
    (node) => node.type === 'th' || node.type === 'td',
  );
const insertionCells = (tree) =>
  nodes(tree).filter(
    (node) => node.type === 'td' && node.props.rowSpan !== undefined,
  );

function assertInsertionLayout(view, expectedOrder) {
  const table = nodes(view.tree).find((node) => node.type === 'table');
  assert.ok(table);
  assert.equal(
    nodes(table).filter((node) => node.type === 'thead').length,
    0,
    'Flow header and answer rows must share one row group',
  );
  const bodies = nodes(table).filter((node) => node.type === 'tbody');
  assert.equal(bodies.length, 1);
  const rows = directChildren(bodies[0]).filter((node) => node.type === 'tr');
  assert.equal(rows.length, view.grid.document.fields.length + 1);
  const headerCells = rowCells(rows[0]);
  assert.equal(headerCells.length, expectedOrder.length);
  const actualOrder = headerCells.map((cell, index) => {
    if (index === 0) return 'items';
    const add = nodes(cell).find(
      (node) =>
        node.type === 'button' &&
        /뒤 시기 추가$/.test(node.props['aria-label'] ?? ''),
    );
    if (add) return add.props['aria-label'];
    const period = view.grid.rows.find((row) =>
      cell.props.id?.endsWith(`-row-${row.id}`),
    );
    assert.ok(period, 'Every ordinary header must retain its period ID');
    assert.equal(cell.type, 'th');
    assert.equal(cell.props.scope, 'col');
    return period.id;
  });
  assert.deepEqual(plain(actualOrder), expectedOrder);
  const slots = insertionCells(table);
  const expectedSlots = expectedOrder.filter(
    (item) => typeof item === 'string' && item !== 'items',
  );
  assert.equal(slots.length, expectedSlots.length);
  for (const cell of slots) {
    assert.ok(
      headerCells.includes(cell),
      'Each insertion cell exists once in the first row',
    );
    assert.equal(cell.props.rowSpan, view.grid.document.fields.length + 1);
    assert.equal(
      nodes(cell).filter((node) => node.type === 'button').length,
      1,
    );
    assert.equal(
      nodes(cell).filter((node) => node.type === 'PlusIcon').length,
      1,
    );
    assert.equal(nodes(cell).filter((node) => node.type === 'input').length, 0);
    assert.equal(
      content(cell),
      '',
      'The narrow insertion cell contains only its plus control',
    );
  }
  for (const cell of headerCells.filter((node) => node.type === 'th'))
    assert.equal(
      nodes(cell).filter((node) => node.type === 'PlusIcon').length,
      0,
      'Insertion plus must not be inside a period header',
    );
  for (const row of rows.slice(1)) {
    assert.equal(
      rowCells(row).length,
      view.grid.rows.length + 1,
      'Answer rows must not repeat insertion placeholders',
    );
    assert.equal(
      nodes(row).filter((node) => node.type === 'PlusIcon').length,
      0,
    );
  }
  const colgroup = nodes(table).find((node) => node.type === 'colgroup');
  assert.ok(colgroup);
  const widths = directChildren(colgroup).map((col) => {
    assert.equal(col.type, 'col');
    return Number.parseFloat(String(col.props.style.width));
  });
  const expectedWidths = expectedOrder.map((item, index) =>
    index === 0 ? 160 : typeof item === 'number' ? 240 : 48,
  );
  assert.deepEqual(plain(widths), expectedWidths);
  assert.equal(
    table.props.style.minWidth,
    widths.reduce((sum, width) => sum + width, 0),
  );
}

test('actual grid actions insert and edit a period through preview callbacks without moving fixed answers', () => {
  const harness = createHarness();
  let view = harness.render();
  assert.ok(button(view.tree, '고1 1학기 뒤 시기 추가'));
  assert.equal(button(view.tree, '고1 2학기 뒤 시기 추가'), undefined);
  click(button(view.tree, '고1 1학기 뒤 시기 추가'));
  view = harness.render();
  const custom = view.stored.find((row) => row.flowAfter === 1);
  assert.ok(custom);
  assert.ok(
    view.focusHistory.at(-1).endsWith(`-flow-label-${custom.id}`),
    'Insertion must focus the custom name input',
  );
  assert.equal(custom.label, '');
  labelInput(view.tree).props.onChange({ target: { value: '중간고사 직후' } });
  view = harness.render();
  assert.equal(
    view.stored.find((row) => row.id === custom.id).label,
    '중간고사 직후',
  );
  assert.equal(
    view.answered.length,
    2,
    'A label alone must not become an answered period',
  );
  const field = nodes(view.tree).find(
    (node) =>
      node.type === 'RichTextEditor' &&
      node.props.ariaLabel === '중간고사 직후 · 성적',
  );
  assert.ok(field);
  field.props.onChange('2등급');
  view = harness.render();
  assert.deepEqual(
    view.stored.filter((row) => row.flowIndex !== undefined),
    fixedRows(),
  );
  assert.deepEqual(
    view.stored.find((row) => row.id === custom.id),
    {
      id: custom.id,
      flowAfter: 1,
      label: '중간고사 직후',
      answers: { score: '2등급' },
    },
  );
  assert.equal(view.answered.length, 3);
  assert.deepEqual(
    view.stored.map((row) => row.id),
    [11, custom.id, 12, 13],
  );
});

test('repeated plus actions retain insertion order, including after the final fixed period', () => {
  const harness = createHarness();
  let view = harness.render();
  click(button(view.tree, '고1 1학기 뒤 시기 추가'));
  view = harness.render();
  const first = view.stored[1].id;
  labelInput(view.tree).props.onChange({ target: { value: '첫 추가 시기' } });
  view = harness.render();
  click(button(view.tree, '고1 1학기 뒤 시기 추가'));
  view = harness.render();
  const second = view.stored[2].id;
  click(button(view.tree, '고2 1학기 뒤 시기 추가'));
  view = harness.render();
  assert.deepEqual(view.stored.map((row) => row.id).slice(0, 5), [
    11,
    first,
    second,
    12,
    13,
  ]);
  assert.equal(view.stored[1].label, '첫 추가 시기');
  assert.equal(view.stored.at(-1).flowAfter, 3);
  assert.notEqual(first, second);
});

test('deleting a named period requires confirmation and cancellation preserves every row', () => {
  const custom = { id: 100, flowAfter: 1, label: '방학', answers: {} };
  const rows = [fixedRows()[0], custom, ...fixedRows().slice(1)];
  const harness = createHarness({ initialRows: rows });
  let view = harness.render();
  assert.equal(button(view.tree, '고1 1학기 시기 삭제'), undefined);
  view.grid.onRemove(11);
  view = harness.render();
  assert.deepEqual(view.stored, rows, 'A fixed period must reject deletion');
  click(button(view.tree, '방학 시기 삭제'));
  view = harness.render();
  assert.equal(dialogRoot(view.tree).props.open, true);
  assert.deepEqual(view.stored, rows);
  click(
    nodes(view.tree).find(
      (node) => node.type === 'button' && content(node) === '취소',
    ),
  );
  view = harness.render();
  assert.equal(dialogRoot(view.tree).props.open, false);
  assert.deepEqual(view.stored, rows);
  click(button(view.tree, '방학 시기 삭제'));
  view = harness.render();
  click(
    nodes(view.tree).find(
      (node) => node.type === 'button' && content(node) === '시기 삭제',
    ),
  );
  view = harness.render();
  assert.deepEqual(view.stored, fixedRows());
  assert.equal(dialogRoot(view.tree).props.open, false);
});

test('an empty custom period can be removed directly and renaming cannot change a fixed label', () => {
  const custom = { id: 101, flowAfter: 1, label: '', answers: {} };
  const harness = createHarness({
    initialRows: [fixedRows()[0], custom, ...fixedRows().slice(1)],
  });
  let view = harness.render();
  view.grid.onFlowLabelChange(11, '바뀌면 안 되는 기본 이름');
  view = harness.render();
  assert.equal(view.stored[0].label, undefined);
  click(button(view.tree, '추가 시기 시기 삭제'));
  view = harness.render();
  assert.equal(dialogRoot(view.tree).props.open, false);
  assert.deepEqual(view.stored, fixedRows());
});

for (const state of ['readonly', 'waiting'])
  test(`${state} hides insertion/name/removal controls and rejects all preview mutations`, () => {
    const custom = {
      id: 102,
      flowAfter: 1,
      label: '여름 방학',
      answers: { score: '2등급' },
    };
    const rows = [fixedRows()[0], custom, ...fixedRows().slice(1)];
    const harness = createHarness({
      initialRows: rows,
      disabled: state === 'readonly',
      waiting: state === 'waiting',
    });
    let view = harness.render();
    assert.equal(button(view.tree, '고1 1학기 뒤 시기 추가'), undefined);
    assert.equal(labelInput(view.tree), undefined);
    assert.equal(button(view.tree, '여름 방학 시기 삭제'), undefined);
    assert.equal(insertionCells(view.tree).length, 0);
    assert.equal(view.grid.onInsertFlow(1), undefined);
    view.grid.onFlowLabelChange(102, '변경 금지');
    view.grid.onRemove(102);
    view = harness.render();
    assert.deepEqual(view.stored, rows);
    if (state === 'readonly')
      assert.ok(content(view.tree).includes('여름 방학'));
  });

test('disabling a slot preserves custom labels, field names and reopened answer metadata', () => {
  const custom = {
    id: 103,
    flowAfter: 1,
    label: '중간 시기',
    answers: { note: '학습 전략' },
  };
  const rows = [fixedRows()[0], custom, ...fixedRows().slice(1)];
  const harness = createHarness({ initialRows: rows });
  const view = harness.render({
    document: { ...harness.document, flowInsertAfter: [] },
  });
  assert.equal(button(view.tree, '고1 1학기 뒤 시기 추가'), undefined);
  assert.equal(insertionCells(view.tree).length, 0);
  assert.ok(
    nodes(view.tree).some(
      (node) =>
        node.type === 'RichTextEditor' &&
        node.props.ariaLabel === '고1 2학기 · 성적',
    ),
  );
  assert.ok(
    nodes(view.tree).some(
      (node) =>
        node.type === 'RichTextEditor' &&
        node.props.ariaLabel === '중간 시기 · 대응' &&
        node.props.value === '학습 전략',
    ),
  );
  const reopened = createHarness({
    initialRows: plain(view.stored),
    disabled: true,
    insertAfter: [],
  }).render();
  assert.deepEqual(reopened.stored, rows);
  assert.ok(content(reopened.tree).includes('중간 시기'));
});

test('the actual preview callback and grid both stop insertion at twenty total periods', () => {
  const rows = [
    fixedRows()[0],
    ...Array.from({ length: 17 }, (_, index) => ({
      id: 1000 + index,
      flowAfter: 1,
      label: `추가 ${index + 1}`,
      answers: {},
    })),
    ...fixedRows().slice(1),
  ];
  const harness = createHarness({ initialRows: rows });
  let view = harness.render();
  assert.equal(view.grid.rows.length, 20);
  assert.equal(button(view.tree, '고1 1학기 뒤 시기 추가'), undefined);
  assert.equal(view.grid.onInsertFlow(1), undefined);
  view = harness.render();
  assert.deepEqual(view.stored, rows);
});

test('a narrow insertion cell spans the period header and all three answer rows', () => {
  const fields = [
    { id: 'score', label: '성적', kind: 'text' },
    { id: 'note', label: '특이사항', kind: 'text' },
    { id: 'plan', label: '대응', kind: 'text' },
  ];
  const view = createHarness({ fields }).render();
  assertInsertionLayout(view, [
    'items',
    11,
    '고1 1학기 뒤 시기 추가',
    12,
    13,
    '고2 1학기 뒤 시기 추가',
  ]);
  assert.ok(
    insertionCells(view.tree).every((cell) => cell.props.rowSpan === 4),
  );
});

test('the narrow insertion cell moves after the anchor custom group and keeps the following fixed period aligned', () => {
  const harness = createHarness();
  let view = harness.render();
  click(button(view.tree, '고1 1학기 뒤 시기 추가'));
  view = harness.render();
  const first = view.stored[1].id;
  labelInput(view.tree).props.onChange({ target: { value: '첫 추가' } });
  view = harness.render();
  click(button(view.tree, '고1 1학기 뒤 시기 추가'));
  view = harness.render();
  const second = view.stored[2].id;
  assertInsertionLayout(view, [
    'items',
    11,
    first,
    second,
    '고1 1학기 뒤 시기 추가',
    12,
    13,
    '고2 1학기 뒤 시기 추가',
  ]);
  assert.equal(view.stored[1].label, '첫 추가');
  click(button(view.tree, '고2 1학기 뒤 시기 추가'));
  view = harness.render();
  const last = view.stored.at(-1).id;
  assertInsertionLayout(view, [
    'items',
    11,
    first,
    second,
    '고1 1학기 뒤 시기 추가',
    12,
    13,
    last,
    '고2 1학기 뒤 시기 추가',
  ]);
  assert.deepEqual(
    view.stored.filter((row) => row.flowIndex !== undefined),
    fixedRows(),
  );
});

test('ordinary response tables keep the separate header and never render insertion spacer columns', () => {
  const harness = createHarness({
    initialRows: [{ id: 50, answers: { score: '일반 표 답변' } }],
  });
  const view = harness.render({
    document: {
      ...harness.document,
      answerLayout: 'table',
      flowInsertAfter: [],
    },
  });
  const table = nodes(view.tree).find((node) => node.type === 'table');
  assert.ok(table);
  assert.equal(nodes(table).filter((node) => node.type === 'thead').length, 1);
  assert.equal(insertionCells(table).length, 0);
  const widths = directChildren(
    nodes(table).find((node) => node.type === 'colgroup'),
  ).map((col) => col.props.style.width);
  assert.deepEqual(plain(widths), [112, 240, 240]);
});
