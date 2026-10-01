import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import * as tiptapCore from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { splitListItem, wrapInList } from '@tiptap/pm/schema-list';
import { EditorState, Plugin, TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/questions/lib/rich-text.ts',
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports },
);
const {
  toEditorDocument,
  serializeRichText,
  parseRichText,
  richTextPlainText,
  normalizeRichTextValue,
  showRichTextPlaceholder,
  RICH_TEXT_PREFIX,
} = exports;
const listExports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/questions/lib/questionnaire/list-extension.ts',
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports: listExports, require: () => tiptapCore },
);
const { QuestionnaireList } = listExports;
const schema = getSchema([
  StarterKit.configure({ bulletList: false }),
  QuestionnaireList,
  Highlight,
]);

test('placeholder disappears in empty bullet, plus, and numbered lists', () => {
  const blank = schema.nodeFromJSON(toEditorDocument(''));
  assert.equal(showRichTextPlaceholder(true, blank), true);

  for (const [list, attributes] of [
    [schema.nodes.bulletList, { marker: 'bullet' }],
    [schema.nodes.bulletList, { marker: 'plus' }],
    [schema.nodes.orderedList, { start: 1 }],
  ]) {
    let state = EditorState.create({ schema, doc: blank });
    assert.equal(
      wrapInList(list, attributes)(state, (transaction) => {
        state = state.apply(transaction);
      }),
      true,
    );
    assert.equal(showRichTextPlaceholder(true, state.doc), false);
  }
});

test('dash and plus rules match separately and preserve distinct markers through saving', () => {
  const rules = QuestionnaireList.config.addInputRules.call({
    type: schema.nodes.bulletList,
  });
  for (const [index, marker, input] of [
    [0, 'bullet', '- '],
    [1, 'plus', '+ '],
  ]) {
    assert.ok(rules[index].find.test(input));
    assert.equal(rules[1 - index].find.test(input), false);
    let state = EditorState.create({
      schema,
      doc: schema.nodeFromJSON(toEditorDocument('내용')),
    });
    wrapInList(schema.nodes.bulletList, { marker })(state, (tr) => {
      state = state.apply(tr);
    });
    const saved = serializeRichText(state.doc.toJSON());
    assert.equal(
      schema.nodeFromJSON(toEditorDocument(saved)).eq(state.doc),
      true,
    );
    assert.equal(
      parseRichText(saved).content[0].attrs?.marker ?? 'bullet',
      marker,
    );
  }
});

test('legacy text, blank lines and literal HTML survive an edit/save/reload', () => {
  for (const value of [
    '',
    '안녕하세요\n\n다음 질문',
    '<img src=x onerror=alert(1)>',
    '  앞뒤 공백  ',
  ]) {
    assert.equal(serializeRichText(toEditorDocument(value)), value);
  }
});

test('real editor list and highlight transactions survive save/reload and plain-text extraction', () => {
  let state = EditorState.create({
    schema,
    doc: schema.nodeFromJSON(toEditorDocument('질문 내용')),
  });
  assert.equal(
    wrapInList(schema.nodes.bulletList)(state, (tr) => {
      state = state.apply(tr);
    }),
    true,
  );
  state = state.apply(state.tr.addMark(3, 5, schema.marks.highlight.create()));
  const saved = serializeRichText(state.doc.toJSON());
  assert.ok(saved.startsWith(RICH_TEXT_PREFIX));
  const reloaded = schema.nodeFromJSON(toEditorDocument(saved));
  assert.equal(reloaded.eq(state.doc), true);
  assert.equal(richTextPlainText(saved), '질문 내용');
  assert.equal(
    serializeRichText(reloaded.toJSON()),
    saved,
    'autosave echoes remain identical',
  );
});

test('removing highlights returns plain text; empty formatted input is still empty', () => {
  let state = EditorState.create({
    schema,
    doc: schema.nodeFromJSON(toEditorDocument('내용')),
  });
  state = state.apply(state.tr.addMark(1, 3, schema.marks.highlight.create()));
  assert.ok(parseRichText(serializeRichText(state.doc.toJSON())));
  state = state.apply(state.tr.removeMark(1, 3, schema.marks.highlight));
  assert.equal(serializeRichText(state.doc.toJSON()), '내용');
  const blank =
    RICH_TEXT_PREFIX +
    JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    });
  assert.equal(normalizeRichTextValue(blank), '');
});

test('untrusted attributes are discarded and unsupported structures remain literal text', () => {
  const unsafe =
    RICH_TEXT_PREFIX +
    JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { onclick: 'alert(1)' },
          content: [
            {
              type: 'text',
              text: '설명',
              marks: [{ type: 'highlight', attrs: { color: 'url(evil)' } }],
            },
          ],
        },
      ],
    });
  assert.equal(JSON.stringify(parseRichText(unsafe)).includes('attrs'), false);
  for (const value of [
    RICH_TEXT_PREFIX + '{broken',
    RICH_TEXT_PREFIX +
      JSON.stringify({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'evil' } }],
      }),
  ]) {
    assert.equal(parseRichText(value), null);
    assert.equal(richTextPlainText(toEditorDocument(value)), value);
  }
});

test('numbered lists continue on Enter and preserve start numbers after saving', () => {
  for (const start of [1, 3]) {
    let state = EditorState.create({
      schema,
      doc: schema.nodeFromJSON(toEditorDocument('첫 항목')),
    });
    wrapInList(schema.nodes.orderedList, { start })(state, (tr) => {
      state = state.apply(tr);
    });
    state = state.apply(
      state.tr.setSelection(
        TextSelection.create(state.doc, 3 + '첫 항목'.length),
      ),
    );
    assert.equal(
      splitListItem(schema.nodes.listItem)(state, (tr) => {
        state = state.apply(tr);
      }),
      true,
    );
    state = state.apply(state.tr.insertText('다음 항목'));
    assert.equal(state.doc.firstChild.childCount, 2);
    const saved = serializeRichText(state.doc.toJSON());
    assert.equal(parseRichText(saved).content[0].attrs.start, start);
    assert.equal(
      schema.nodeFromJSON(toEditorDocument(saved)).eq(state.doc),
      true,
    );
    assert.equal(richTextPlainText(saved), '첫 항목\n다음 항목');
    assert.equal(serializeRichText(toEditorDocument(saved)), saved);
  }
});

test('ordered list start attributes are bounded and arbitrary attributes removed', () => {
  for (const start of [-1, 1.5, '3', 1000000000]) {
    const saved = serializeRichText({
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { start, onclick: 'bad' },
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '항목' }],
                },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(parseRichText(saved).content[0].attrs.start, 1);
    assert.equal(saved.includes('onclick'), false);
  }
});

const referenceExports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/questions/lib/exploration-reference.ts',
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: referenceExports,
    require: (name) =>
      name === '@tiptap/core'
        ? tiptapCore
        : name === '@tiptap/pm/state'
          ? { Plugin }
          : exports,
  },
);
const referenceSchema = getSchema([
  StarterKit,
  Highlight,
  referenceExports.ExplorationReference,
]);
const activityId = '11111111-1111-4111-8111-111111111111';

test('activity references survive rich text, editor schema and plain text extraction', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '참고한 활동: ' },
          {
            type: 'text',
            text: '@물리 탐구',
            marks: [
              { type: 'explorationReference', attrs: { id: activityId } },
              { type: 'highlight' },
            ],
          },
          { type: 'text', text: '을 분석했다.' },
        ],
      },
    ],
  };
  const saved = serializeRichText(doc);
  assert.ok(saved.startsWith(RICH_TEXT_PREFIX));
  assert.equal(richTextPlainText(saved), '참고한 활동: @물리 탐구을 분석했다.');
  const restored = referenceSchema.nodeFromJSON(toEditorDocument(saved));
  const savedAgain = serializeRichText(restored.toJSON());
  assert.equal(
    parseRichText(savedAgain).content[0].content[1].marks.find(
      (m) => m.type === 'explorationReference',
    ).attrs.id,
    activityId,
  );
  assert.equal(
    parseRichText(savedAgain).content[0].content[1].marks.some(
      (m) => m.type === 'highlight',
    ),
    true,
  );
});

test('activity reference IDs reject unsafe values and extra attributes are discarded', () => {
  for (const id of ['javascript:alert(1)', '', null, '../secret']) {
    assert.equal(
      exports.normalizeRichText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'activity',
                marks: [{ type: 'explorationReference', attrs: { id } }],
              },
            ],
          },
        ],
      }),
      null,
    );
  }
  const doc = exports.normalizeRichText({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'activity',
            marks: [
              {
                type: 'explorationReference',
                attrs: { id: activityId, secret: 'discard' },
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(JSON.stringify(doc).includes('secret'), false);
});

test('@ commands work at the caret, filter Korean input and ignore email addresses', () => {
  for (const [text, match, matched] of [
    ['@', true, true],
    ['답변 @탐', true, true],
    ['@탐구활동', true, true],
    ['name@example.com', false, undefined],
    ['@다른명령', true, false],
    ['@탐구활동 ', false, undefined],
  ]) {
    const doc = referenceSchema.nodeFromJSON(toEditorDocument(text));
    const state = EditorState.create({
      schema: referenceSchema,
      doc,
      selection: TextSelection.create(doc, text.length + 1),
    });
    const command = referenceExports.explorationCommand({ state });
    assert.equal(!!command, match, text);
    assert.equal(command?.matched, matched, text);
    if (command)
      assert.equal(
        doc.textBetween(command.from, command.to).startsWith('@'),
        true,
      );
  }
});

test('reference deletion is atomic from either edge, inside text and partial selections', () => {
  const doc = referenceSchema.nodeFromJSON({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '앞 ' },
          {
            type: 'text',
            text: '@물리',
            marks: [
              { type: 'explorationReference', attrs: { id: activityId } },
            ],
          },
          {
            type: 'text',
            text: ' 탐구',
            marks: [
              { type: 'explorationReference', attrs: { id: activityId } },
              { type: 'highlight' },
            ],
          },
          { type: 'text', text: ' 뒤' },
        ],
      },
    ],
  });
  for (const [from, to, direction] of [
    [9, 9, 'backward'],
    [3, 3, 'forward'],
    [5, 5, 'backward'],
    [5, 7, 'forward'],
    [2, 5, 'backward'],
  ]) {
    let state = EditorState.create({
      schema: referenceSchema,
      doc,
      selection: TextSelection.create(doc, from, to),
    });
    assert.equal(
      referenceExports.deleteExplorationReference(
        state,
        (tr) => {
          state = state.apply(tr);
        },
        direction,
      ),
      true,
    );
    assert.equal(state.doc.textContent, from === 2 ? '앞 뒤' : '앞  뒤');
    state = state.apply(state.tr.insertText('새 글'));
    state.doc.descendants((node) =>
      assert.equal(
        node.marks.some((mark) => mark.type.name === 'explorationReference'),
        false,
      ),
    );
  }
  for (const [position, direction] of [
    [3, 'backward'],
    [9, 'forward'],
    [1, 'backward'],
  ]) {
    const state = EditorState.create({
      schema: referenceSchema,
      doc,
      selection: TextSelection.create(doc, position),
    });
    assert.equal(
      referenceExports.deleteExplorationReference(
        state,
        () => assert.fail('ordinary text should use default deletion'),
        direction,
      ),
      false,
    );
  }
});
