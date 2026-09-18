import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/questionnaire/lib/answer-session.ts',
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports, structuredClone },
);
const { AnswerSessionState } = exports;
const snapshot = {
  revision: 0,
  status: 'assigned',
  savedAt: null,
  answers: { question: 'initial' },
};
test('saving a snapshot retains newer typing and excludes overlapping saves', () => {
  const session = new AnswerSessionState(snapshot);
  const answers = { question: 'first' };
  const request = session.begin(answers, false, () => 'request-1');
  answers.question = 'typed during save';
  assert.equal(
    session.begin(answers, false, () => 'request-2'),
    null,
  );
  session.accept(1, request);
  session.finish();
  assert.equal(JSON.parse(session.saved).question, 'first');
  assert.notEqual(session.saved, JSON.stringify(answers));
  assert.equal(session.begin(answers, false, () => 'request-2').revision, 1);
});
test('uncertain completion retries exact body and ID, never silently substitutes later text', () => {
  const session = new AnswerSessionState(snapshot);
  const original = session.begin(
    { question: 'final' },
    true,
    () => 'complete-1',
  );
  session.finish();
  const retry = session.begin({ question: 'different' }, false, () => 'save-2');
  assert.equal(retry, original);
  assert.equal(retry.complete, true);
  assert.equal(retry.answers.question, 'final');
  session.accept(1, retry);
  session.finish();
  assert.equal(session.retry, null);
});
test('conflict blocks further writes without destroying unsaved answers', () => {
  const session = new AnswerSessionState(snapshot);
  const answers = { question: 'unsaved' };
  session.block();
  assert.equal(
    session.begin(answers, false, () => 'blocked'),
    null,
  );
  assert.equal(answers.question, 'unsaved');
});
