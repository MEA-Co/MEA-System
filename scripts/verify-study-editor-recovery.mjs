import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const memory = new Map();
const sessionStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
function load(name, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(`app/(private)/dashboard/_views/study/lib/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: (id) => imports[id] ?? require(id), process, sessionStorage });
  return exports;
}
const fields = load('fields');
const model = load('storage-model');
const local = load('local-drafts', { './storage-model': model });
const baseline = {
  clientKey: '10000000-0000-4000-8000-000000000001',
  revision: 0, status: 'draft', updatedAt: '2026-10-13T00:00:00.000Z',
  values: fields.emptyValues(), reports: [],
};
test('reload restores new unsaved input and its original baseline separately', () => {
  const draft = { ...baseline, values: { ...baseline.values, title: '작성 중', problem: '문제 상황' } };
  local.writeEditor('one', draft, baseline);
  const restored = local.readEditor('one');
  assert.equal(restored.draft.values.title, '작성 중');
  assert.equal(restored.baseline.values.title, '');
  assert.notEqual(model.activityFingerprint(restored.draft), model.activityFingerprint(restored.baseline));
  assert.equal(restored.draft.localVersion, undefined);
});
test('recovery is account scoped and explicit close removes it', () => {
  assert.equal(local.readEditor('two'), null);
  local.clearEditor('one');
  assert.equal(local.readEditor('one'), null);
});
test('manual save baseline and version survive reload', () => {
  const saved = { ...baseline, localVersion: '10000000-0000-4000-8000-000000000002' };
  local.writeEditor('one', saved, saved);
  const restored = local.readEditor('one');
  assert.equal(restored.draft.localVersion, saved.localVersion);
  assert.equal(model.activityFingerprint(restored.draft), model.activityFingerprint(restored.baseline));
});
