/* eslint-disable no-console -- Standalone verification reports its results. */
// Component browser verification with a mocked AI response; no real student data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(
  resolve(
    process.env.TEST_TOOLS || '/tmp/major-search-validation',
    'package.json',
  ),
);
const { build } = require('esbuild');
const { chromium } = require('@playwright/test');
const root = process.cwd();
const bundle = await build({
  stdin: {
    contents: `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'; import {MajorValuesChat} from './features/major-values/components/MajorValuesChat'; import {ValuesSessionProvider} from './features/major-values/components/ValuesSessionProvider'; import {createValuesContext} from './features/major-values/domain'; const context=createValuesContext({first:'컴퓨터공학'},'[컴퓨터공학]\\nHCI\\n그래픽'); function App(){const [draft,setDraft]=useState(''); return <ValuesSessionProvider ownerId="test-owner"><MajorValuesChat context={context} draftValue={draft} onDraftChange={setDraft} onBack={()=>{}} onComplete={v=>window.result=v}/></ValuesSessionProvider>};createRoot(document.getElementById('root')).render(<App/>);`,
    resolveDir: root,
    loader: 'tsx',
  },
  plugins: [
    {
      name: 'mock-values-action',
      setup(build) {
        build.onResolve({ filter: /features\/major-values\/actions$/ }, () => ({
          path: 'mock-actions',
          namespace: 'mock',
        }));
        build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
          loader: 'js',
          resolveDir: root,
          contents: `import {applyValuesReply} from '${root}/features/major-values/domain.ts'; let attempts=0; export async function continueMajorValues({state}) { attempts++; if(attempts===1) return {error:'시험용 연결 오류. 답변은 보존됩니다.'}; const turn=state.conversation.at(-1), interestId=state.context.interests[0].id; const evidence=[{turnId:turn.id,quote:turn.content}]; return {data:applyValuesReply(state,{observations:state.observations.map(o=>o.interestId===interestId?{...o,focus:'사용자의 혼란',direction:'이해',reason:'이유를 이해하는 과정 자체가 좋아서',evidence}:o),hypotheses:[{id:'h1',statement:'사용자가 혼란을 겪는 이유를 이해하는 데 의미를 둔다.',interestIds:[interestId],coreValueIds:[],basis:'student-explicit',pattern:'specific',evidence,conditions:[],revisionEvidence:[]}],connections:[],next:{stage:'next-interest',interestIds:[state.context.interests[1].id],message:'그래픽에서는 어떤 부분이 궁금한가요?',metadataIds:[]}},{coreValueIds:[],metadataIds:[],version:'mock'})}; }`,
        }));
      },
    },
  ],
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  alias: { '@': root },
  define: { 'process.env.NODE_ENV': '"development"' },
});
const browser = await chromium.launch({
  executablePath:
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('http://localhost:4174/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>',
    }),
  );
  await page.goto('http://localhost:4174');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page
    .getByLabel('내 관심과 생각')
    .fill('사용자가 왜 헷갈리는지 이해하는 과정 자체가 좋아요.');
  await page.getByRole('button', { name: '답변 보내기' }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(
    await page
      .getByRole('log')
      .getByText('사용자가 왜 헷갈리는지 이해하는 과정 자체가 좋아요.', {
        exact: true,
      })
      .count(),
    1,
  );
  await page.getByRole('button', { name: '보존된 답변으로 다시 시도' }).click();
  await page
    .getByRole('log')
    .getByText('그래픽에서는 어떤 부분이 궁금한가요?')
    .waitFor();
  assert.equal(
    await page
      .getByRole('log')
      .getByText('사용자가 왜 헷갈리는지 이해하는 과정 자체가 좋아요.', {
        exact: true,
      })
      .count(),
    1,
  );
  await page.reload();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page
    .getByRole('log')
    .getByText('그래픽에서는 어떤 부분이 궁금한가요?')
    .waitFor();
  await page
    .getByRole('button', { name: '건너뛰기', exact: true })
    .nth(1)
    .click();
  await page.getByRole('button', { name: '지금까지의 결과 확인' }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '확인한 내용으로 다음' })
      .isDisabled(),
    true,
  );
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page
    .getByLabel('내 말로 가치관 수정')
    .fill('내가 직접 이유를 이해하는 과정을 소중하게 여긴다.');
  await page
    .getByLabel('조건과 예외 수정')
    .fill('시간이 충분하지 않아도 근거는 확인한다.');
  await page.getByRole('button', { name: '수정 반영' }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '확인한 내용으로 다음' })
      .isDisabled(),
    true,
  );
  await page.getByRole('button', { name: '내 생각과 맞아요' }).click();
  await page.getByRole('button', { name: '확인한 내용으로 다음' }).click();
  assert.match(await page.evaluate(() => window.result), /내가 직접 이유/);
  assert.match(await page.evaluate(() => window.result), /그래픽 \(건너뜀\)/);
  assert.match(
    await page.evaluate(() => window.result),
    /시간이 충분하지 않아도/,
  );
  await page.screenshot({
    path: '/tmp/major-values-results-mobile.png',
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: preserved failed answer, retry without duplication, reload/resume, skip, edit conditions, confirm, final output',
  );
} finally {
  await browser.close();
}
