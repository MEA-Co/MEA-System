import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = 'app/(private)/dashboard/_views/questionnaire/lib/';
function load(name) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(root + name + '.ts', 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      TextEncoder,
      require: (path) =>
        path === 'zod' ? require('zod') : load(path.replace('./', '')),
    },
  );
  return exports;
}
const {
  validTypedAnswer,
  selectedOptions,
  scaleLabel,
  scaleAnswer,
  encodeScaleAnswer,
} = load('question-types');
const { questionnaireDocumentSchema } = load('schema');
const options = [
  { id: randomUUID(), label: '팀 프로젝트' },
  { id: randomUUID(), label: '발표' },
];
test('scale and selection validation reject invalid, duplicate and missing answers', () => {
  assert.equal(validTypedAnswer({ kind: 'scale' }, '5', true), true);
  for (const value of ['0', '6', '1.5', '매우 그렇다'])
    assert.equal(validTypedAnswer({ kind: 'scale' }, value, true), false);
  assert.equal(
    validTypedAnswer({ kind: 'single', options }, options[0].id, true),
    true,
  );
  assert.equal(
    validTypedAnswer({ kind: 'single', options }, randomUUID(), true),
    false,
  );
  assert.equal(
    validTypedAnswer(
      { kind: 'multiple', options },
      JSON.stringify(options.map((o) => o.id)),
      true,
    ),
    true,
  );
  assert.equal(
    validTypedAnswer(
      { kind: 'multiple', options },
      JSON.stringify([options[0].id, options[0].id]),
      true,
    ),
    false,
  );
  for (const kind of ['scale', 'single', 'multiple']) {
    assert.equal(validTypedAnswer({ kind, options }, '', false), true);
    assert.equal(validTypedAnswer({ kind, options }, '', true), false);
  }
  assert.equal(
    validTypedAnswer({ kind: 'multiple', options }, '[]', true),
    false,
  );
  assert.equal(selectedOptions('invalid').length, 0);
});
test('configurable scales label the endpoints and odd midpoint, with optional written answers', () => {
  const even = {
    max: 2,
    low: '낮음',
    middle: '보통',
    high: '높음',
    allowText: false,
  };
  const odd = { ...even, max: 9, allowText: true };
  assert.equal(scaleLabel(even, 1), '낮음');
  assert.equal(scaleLabel(even, 2), '높음');
  assert.equal(scaleLabel(odd, 5), '보통');
  assert.equal(scaleLabel(odd, 4), '');
  assert.equal(
    validTypedAnswer({ kind: 'scale', scaleConfig: even }, '2', true),
    true,
  );
  assert.equal(
    validTypedAnswer({ kind: 'scale', scaleConfig: even }, '3', true),
    false,
  );
  const answer = encodeScaleAnswer({ score: 9, text: '자세한 이유' }, true);
  assert.equal(scaleAnswer(answer).text, '자세한 이유');
  assert.equal(
    validTypedAnswer({ kind: 'scale', scaleConfig: odd }, answer, true),
    true,
  );
  assert.equal(
    validTypedAnswer({ kind: 'scale', scaleConfig: odd }, '9', true),
    true,
  );
  assert.equal(
    validTypedAnswer({ kind: 'scale', scaleConfig: even }, answer, true),
    false,
  );
  assert.equal(
    validTypedAnswer(
      { kind: 'scale', scaleConfig: odd },
      encodeScaleAnswer({ score: 9, text: 'x'.repeat(5001) }, true),
    ),
    false,
  );
});
test('question schema preserves option identity, permits draft labels and supports legacy text', () => {
  const q = {
    id: randomUUID(),
    logicalKey: randomUUID(),
    text: '질문',
    details: [],
  };
  const doc = {
    questionnaireId: randomUUID(),
    versionId: randomUUID(),
    title: '제목',
    sections: [{ id: randomUUID(), title: '섹션', questions: [q] }],
  };
  assert.equal(questionnaireDocumentSchema.safeParse(doc).success, true);
  q.kind = 'single';
  q.options = options;
  assert.equal(
    questionnaireDocumentSchema.parse(doc).sections[0].questions[0].options[0]
      .id,
    options[0].id,
  );
  q.options = [{ ...options[0], label: '' }, options[1]];
  assert.equal(questionnaireDocumentSchema.safeParse(doc).success, true);
  q.options = [options[0], options[0]];
  assert.equal(questionnaireDocumentSchema.safeParse(doc).success, false);
  q.options = options;
  q.kind = 'unexpected';
  assert.equal(questionnaireDocumentSchema.safeParse(doc).success, false);
  q.kind = 'scale';
  q.options = [];
  q.scaleConfig = {
    max: 9,
    low: '낮음',
    middle: '보통',
    high: '높음',
    allowText: true,
  };
  assert.equal(questionnaireDocumentSchema.safeParse(doc).success, true);
  q.scaleConfig.max = 10;
  assert.equal(questionnaireDocumentSchema.safeParse(doc).success, false);
});

test('other choices preserve free text and require it only on completion', () => {
  const other = { id: randomUUID(), label: '기타', isOther: true };
  for (const kind of ['single', 'multiple']) {
    const question = { kind, options: [...options, other] };
    const encode = (answer) =>
      JSON.stringify(kind === 'multiple' ? [options[0].id, answer] : answer);
    assert.equal(
      validTypedAnswer(question, encode({ id: other.id, text: '' }), false),
      true,
    );
    assert.equal(
      validTypedAnswer(question, encode({ id: other.id, text: ' ' }), true),
      false,
    );
    assert.equal(
      validTypedAnswer(
        question,
        encode({ id: other.id, text: '직접 입력한 경험' }),
        true,
      ),
      true,
    );
    assert.equal(
      validTypedAnswer(
        question,
        encode({ id: other.id, text: 'x'.repeat(5001) }),
        false,
      ),
      false,
    );
    assert.equal(
      validTypedAnswer(
        question,
        encode({ id: options[0].id, text: '잘못된 자유 응답' }),
        true,
      ),
      false,
    );
    assert.equal(
      validTypedAnswer(
        question,
        kind === 'single' ? other.id : JSON.stringify([other.id]),
        true,
      ),
      false,
    );
  }
});
