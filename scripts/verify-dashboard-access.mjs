import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync('app/(private)/dashboard/_lib/dashboard-access.ts', 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports },
);
const { getDashboardNavigation, resolveDashboardView } = exports;

test('each role can open its menus and forbidden direct URLs fall back to consulting', () => {
  const expected = {
    student: ['profile'],
    consultant: ['profile', 'questionnaire', 'exploration'],
    consultant_lead: [
      'consultants',
      'questionnaire',
      'exploration',
      'consulting',
    ],
    admin: ['students', 'consultants', 'questionnaire', 'consulting'],
  };
  for (const [role, views] of Object.entries(expected)) {
    assert.deepEqual(
      Array.from(getDashboardNavigation(role), (page) => page.view),
      views,
    );
    for (const view of [
      'profile',
      'students',
      'consultants',
      'questionnaire',
      'exploration',
      'consulting',
    ]) {
      assert.equal(
        resolveDashboardView(role, view),
        views.includes(view) ? view : 'consulting',
      );
    }
    for (const invalid of [
      undefined,
      ['questionnaire'],
      'unknown',
      '__proto__',
      'constructor',
    ]) {
      assert.equal(resolveDashboardView(role, invalid), 'consulting');
    }
  }
});
