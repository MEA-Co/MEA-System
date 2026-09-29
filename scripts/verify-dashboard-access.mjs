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

test('each role can open its menus and forbidden direct URLs fall back to the role home', () => {
  const expected = {
    student: ['profile'],
    consultant: ['profile', 'questions', 'exploration'],
    consultant_lead: ['consultants', 'questions', 'exploration', 'consulting'],
    admin: [
      'students',
      'consultants',
      'questions',
      'exploration',
      'consulting',
    ],
  };
  const homes = {
    student: 'consulting',
    consultant: 'questions',
    consultant_lead: 'consultants',
    admin: 'consultants',
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
      'questions',
      'exploration',
      'consulting',
    ]) {
      assert.equal(
        resolveDashboardView(role, view),
        views.includes(view) ? view : homes[role],
      );
    }
    for (const invalid of [
      undefined,
      ['questions'],
      'unknown',
      '__proto__',
      'constructor',
    ]) {
      assert.equal(resolveDashboardView(role, invalid), homes[role]);
    }
  }
});

test('questionnaires and explorations belong to data management', () => {
  for (const role of ['consultant', 'consultant_lead', 'admin']) {
    for (const page of getDashboardNavigation(role)) {
      if (['questions', 'exploration'].includes(page.view))
        assert.equal(page.group, 'data');
    }
  }
  assert.equal(resolveDashboardView('consultant', 'consulting'), 'questions');
});

test('removed questionnaire entry is neither a page nor a role permission', () => {
  assert.equal(Object.hasOwn(exports.DASHBOARD_PAGES, 'questionnaire'), false);
  for (const [role, pages] of Object.entries(exports.DASHBOARD_ROLES)) {
    assert.equal(Object.hasOwn(pages, 'questionnaire'), false);
    assert.equal(
      resolveDashboardView(role, 'questionnaire'),
      exports.DASHBOARD_DEFAULT_VIEWS[role],
    );
    if (role !== 'student')
      assert.equal(
        getDashboardNavigation(role).filter((page) => page.view === 'questions')
          .length,
        1,
      );
  }
});
