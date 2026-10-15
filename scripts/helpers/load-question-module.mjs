import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

import ts from 'typescript';

// Execute real domain modules with explicit boundary mocks; never load Next runtime.
export function loadQuestionModule(file, globals, mock, cache = new Map()) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      ...globals,
      exports,
      require(name) {
        const value = mock(name);
        if (value !== undefined) return value;
        const path = name.startsWith('@/')
          ? resolve(name.slice(2))
          : resolve(dirname(file), name);
        return loadQuestionModule(
          path + (name.endsWith('QuestionEditorContent') ? '.tsx' : '.ts'),
          globals,
          mock,
          cache,
        );
      },
    },
  );
  return exports;
}
