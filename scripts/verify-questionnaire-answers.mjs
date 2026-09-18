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
const { AnswerSessionState, answerContentKey } = exports;
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
  assert.equal(JSON.parse(session.saved).answers.question, 'first');
  assert.notEqual(session.saved, answerContentKey(answers));
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

test('free response edits participate in saving and uncertain retries without becoming required questions', () => {
  const session = new AnswerSessionState({
    ...snapshot,
    freeResponse: 'saved note',
  });
  assert.notEqual(
    session.saved,
    answerContentKey(snapshot.answers, 'edited note'),
  );
  const request = session.begin(
    snapshot.answers,
    false,
    () => 'note-save',
    'edited note',
  );
  session.finish();
  assert.equal(
    session.begin(snapshot.answers, true, () => 'note-complete', 'newer note'),
    request,
  );
  assert.equal(request.freeResponse, 'edited note');
  session.accept(1, request);
  session.finish();
  assert.equal(
    session.saved,
    answerContentKey(snapshot.answers, 'edited note'),
  );
  assert.notEqual(
    session.saved,
    answerContentKey(snapshot.answers, 'newer note'),
  );
  const complete = session.begin(
    snapshot.answers,
    true,
    () => 'empty-note-complete',
    '',
  );
  assert.equal(complete.freeResponse, '');
  assert.equal(Object.keys(complete.answers).length, 1);
});
