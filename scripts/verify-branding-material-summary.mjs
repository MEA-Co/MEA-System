import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';


const element = (type, props) => ({ type, props });
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      Buffer,
      ...globals,
      require: (name) =>
        imports[name] ??
        (name === 'react/jsx-runtime'
          ? { jsx: element, jsxs: element, Fragment: 'Fragment' }
          : new Proxy({}, { get: (_, key) => key })),
    },
  );
  return exports;
}
const { BrandingMaterialSummary, MATERIAL_TABLES, BRANDING_QUESTIONNAIRE_ID } = load('app/(private)/dashboard/_views/questions/components/questionnaire/BrandingMaterialSummary.tsx', {});
function walk(n) { if (!n) return []; if (Array.isArray(n)) return Array.from(n).flatMap(walk); return [n, ...walk(n.props?.children)]; }
test('fixed questionnaire and six distinct source mappings', () => {
 assert.equal(BRANDING_QUESTIONNAIRE_ID, '01832b27-3408-409d-a635-bd4a913562f2');
 assert.equal(MATERIAL_TABLES.length, 2);
 assert.equal(new Set(MATERIAL_TABLES.flatMap(t => t.items.map(i => i.question))).size, 6);
});
test('summary edits preserve row IDs, metadata, sibling fields and other rows', () => {
 const item=MATERIAL_TABLES[0].items[0];
 const rows=[{id:7,label:'keep',answers:{[item.field]:'original',other:'attachment'}},{id:9,answers:{[item.field]:'second'}}];
 let result;
 const nodes=walk(BrandingMaterialSummary({rows:{[item.question]:rows},availableIds:new Set([item.question]),disabled:false,onChange:(...args)=>result=args}));
 const editor=nodes.find(n=>n.type==='QuestionRichTextEditor');
 assert.equal(editor.props.value,'original');
 editor.props.onChange('edited');
 assert.equal(result[0],item.question);
 assert.equal(result[1][0].id,7);
 assert.equal(result[1][0].label,'keep');
 assert.equal(result[1][0].answers.other,'attachment');
 assert.equal(result[1][0].answers[item.field],'edited');
 assert.equal(result[1][1],rows[1]);
 assert.equal(rows[0].answers[item.field],'original');
});
test('readonly views and unavailable sources do not expose editors',()=>{
 for(const disabled of [true,false]) {
 const nodes=walk(BrandingMaterialSummary({rows:{},availableIds:disabled?new Set(MATERIAL_TABLES.flatMap(t=>t.items.map(i=>i.question))):new Set(),disabled,onChange:()=>assert.fail()}));
 assert.equal(nodes.some(n=>n.type==='QuestionRichTextEditor'),false);
 }
});
