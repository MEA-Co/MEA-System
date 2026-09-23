import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import * as tiptapCore from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { splitListItem, wrapInList } from '@tiptap/pm/schema-list';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/questionnaire/lib/rich-text.ts',
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
      'app/(private)/dashboard/_views/questionnaire/lib/list-extension.ts',
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
