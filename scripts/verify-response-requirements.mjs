import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { z } from 'zod';

import { loadQuestionModule } from './helpers/load-question-module.mjs';
const root = 'app/(private)/dashboard/_views/questions/lib/';
const mock = (name) =>
  name === 'zod'
    ? { z }
    : name.endsWith('rich-text')
      ? { richTextPlainText: (s) => s.replace(/<[^>]*>/g, '') }
      : undefined;
const { responseRequirementsMessage } = loadQuestionModule(
  root + 'responses/requirements.ts',
  {},
  mock,
);
const { questionBlockSchema } = loadQuestionModule(
  root + 'question-blocks.ts',
  {},
  mock,
);
const ids = [randomUUID(), randomUUID(), randomUUID()];
const rule = {
  kind: 'career_flow',
  startFieldIds: ids.slice(0, 2),
  admissionFieldId: ids[2],
};
const definition = { response_requirements: rule };
test('each career flow required group must have a nonempty answer, either starting period works', () => {
  assert.ok(responseRequirementsMessage(definition, []));
  assert.ok(
    responseRequirementsMessage(definition, [
      { id: 1, answers: { [ids[0]]: 'start' } },
    ]),
  );
  assert.ok(
    responseRequirementsMessage(definition, [
      { id: 1, answers: { [ids[2]]: 'admission' } },
    ]),
  );
  assert.ok(
    responseRequirementsMessage(definition, [
      { id: 1, answers: { [ids[0]]: '<p> </p>', [ids[2]]: 'admission' } },
    ]),
  );
  for (const start of ids.slice(0, 2)) {
    assert.equal(
      responseRequirementsMessage(definition, [
        { id: 1, answers: { [start]: 'start', [ids[2]]: 'admission' } },
      ]),
      null,
    );
  }
  assert.equal(responseRequirementsMessage({}, []), null);
});
test('question schema rejects missing, duplicate and non-text required fields', () => {
  const document = {
    id: randomUUID(),
    title: '진로',
    prompt: '질문',
    fields: ids.map((id) => ({ id, label: '시기', kind: 'text' })),
    responseRequirements: rule,
    rowMode: 'single',
    maxRows: null,
    sourceBlockId: null,
    sourceFieldId: null,
    afterBlockId: null,
    condition: null,
  };
  assert.equal(questionBlockSchema.safeParse(document).success, true);
  assert.equal(
    questionBlockSchema.safeParse({
      ...document,
      responseRequirements: { ...rule, admissionFieldId: randomUUID() },
    }).success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...document,
      responseRequirements: { ...rule, admissionFieldId: ids[0] },
    }).success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...document,
      fields: document.fields.slice(1),
    }).success,
    false,
  );
  assert.equal(
    questionBlockSchema.safeParse({
      ...document,
      fields: document.fields.map((f) => ({
        ...f,
        kind: 'scale',
        scaleMax: 5,
      })),
    }).success,
    false,
  );
});
