import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

function navigation(initial) {
  const entries = [{ url: initial, state: null }];
  let position = 0;
  const window = {
    location: {
      get href() {
        return entries[position].url;
      },
    },
    history: {
      get state() {
        return entries[position].state;
      },
      pushState(state, _, url) {
        entries.splice(++position, Infinity, { state, url: String(url) });
      },
      replaceState(state, _, url) {
        entries[position] = { state, url: String(url) };
      },
      back() {
        if (position > 0) position--;
      },
      forward() {
        if (position + 1 < entries.length) position++;
      },
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        'app/(private)/dashboard/_views/questions/lib/questionnaire/submitted-navigation.ts',
        'utf8',
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    { exports, window, URL },
  );
  return { ...exports, window };
}
const list =
  'https://example.com/dashboard?view=questions&draft=q1&questionnairePanel=responses';
test('detail back/forward retains questionnaire and submission list, including repeated visits', () => {
  const n = navigation(list);
  n.openSubmittedResponse('person1');
  assert.equal(
    new URL(n.window.location.href).searchParams.get('submittedResponse'),
    'person1',
  );
  n.window.history.back();
  assert.equal(n.window.location.href, list);
  n.window.history.forward();
  n.closeSubmittedResponse();
  assert.equal(n.window.location.href, list);
  n.openSubmittedResponse('person2');
  n.closeSubmittedResponse();
  assert.equal(n.window.location.href, list);
});
test('direct detail close stays in the same questionnaire instead of leaving the app', () => {
  const n = navigation(list + '&submittedResponse=person1');
  n.closeSubmittedResponse();
  assert.equal(n.window.location.href, list);
});
