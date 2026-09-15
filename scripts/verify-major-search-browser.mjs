/* eslint-disable no-console -- Standalone verification script reports its results. */
// Isolated browser component tests: TEST_TOOLS points at temporary test dependencies.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve(process.env.TEST_TOOLS, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('@playwright/test');
const root = process.cwd();
const bundle = await build({
  stdin: {
    contents: `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'; import {BrandingMajorSearchInput} from './app/(private)/consulting/branding/_components/BrandingMajorSearchInput'; import {BrandingMajorSearchProvider} from './app/(private)/consulting/branding/_context/BrandingMajorSearchContext'; function App(){const [value,setValue]=useState('');const [others,show]=useState(false); return <><BrandingMajorSearchInput label="1순위 희망 전공" value={value} onChange={v=>{window.draft=JSON.parse(v);setValue(v)}}/><button onClick={()=>show(true)}>추가 순위</button>{others&&<><BrandingMajorSearchInput label="2순위" value="" onChange={()=>{}}/><BrandingMajorSearchInput label="3순위" value="" onChange={()=>{}}/></>}</>};createRoot(document.getElementById('root')).render(<BrandingMajorSearchProvider><App/></BrandingMajorSearchProvider>);`,
    resolveDir: root,
    loader: 'tsx',
  },
  plugins: [
    {
      name: 'mock-server-actions',
      setup(build) {
        build.onResolve({ filter: /^\.\/actions$/ }, (args) =>
          args.importer.includes('features/keywords/major-search')
            ? { path: 'actions', namespace: 'mock-actions' }
            : null,
        );
        build.onLoad({ filter: /.*/, namespace: 'mock-actions' }, () => ({
          loader: 'js',
          contents: `export async function getMajorCatalog(){return (await fetch('/test-actions/catalog')).json()}; export async function recordMajorSearch(input){return (await fetch('/test-actions/record',{method:'POST',body:JSON.stringify(input)})).json()}`,
        }));
      },
    },
  ],
  bundle: true,
  write: false,
  outfile: 'major-search-browser-test.js',
  format: 'iife',
  jsx: 'automatic',
  alias: { '@': root },
  define: { 'process.env.NODE_ENV': '"development"' },
});
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.error(e.message);
});
await page.route('http://localhost:4174/**', (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: '<html><body><div id="root"></div></body></html>',
  }),
);
const candidate = {
  id: '33333333-3333-4333-8333-333333333333',
  name: '컴퓨터공학',
  field_name: '공학계열',
  description: '컴퓨터와 소프트웨어를 연구합니다.',
  aliases: [{ name: '컴공', alias_type: 'abbreviation' }],
  field_id: 'field',
  sort_order: 1,
  group_name: null,
  item_type: 'major',
  matched_alias: { name: '컴공', alias_type: 'abbreviation' },
  rank: 1,
};
async function setup(mode = 'db') {
  await page.goto('http://localhost:4174/');
  await page.evaluate(
    ({ candidate, mode }) => {
      window.calls = [];
      window.mode = mode;
      window.fetch = async (_url, options) => {
        if (!options?.body) {
          window.calls.push({ op: 'catalog' });
          if (window.mode === 'catalog-error')
            return { ok: false, json: async () => ({ error: '목록 오류' }) };
          return {
            ok: true,
            json: async () => ({
              version: 'v1',
              catalog: [
                candidate,
                {
                  ...candidate,
                  id: '44444444-4444-4444-8444-444444444444',
                  name: '새 전공',
                  aliases: [{ name: 'new', alias_type: 'alternative_name' }],
                },
              ],
            }),
          };
        }
        const body = JSON.parse(options.body);
        window.calls.push({ ...body, url: _url, at: performance.now() });
        if (body.op === 'no_match') return {ok:true,json:async()=>({noMatch:{requestId:body.requestId}})};
        if (body.op === 'confirm') {
          await new Promise((r) => setTimeout(r, 150));
          if (window.mode === 'save-error')
            return { ok: true, json: async () => ({ error: '저장 실패' }) };
          return {
            ok: true,
            json: async () => ({
              confirmed: {
                id: candidate.id,
                name: candidate.name,
                requestId: body.requestId,
              },
            }),
          };
        }
        return { ok: true, json: async () => ({ ok: true }) };
      };
    },
    { candidate, mode },
  );
  const css = bundle.outputFiles.find((file) => file.path.endsWith('.css'));
  if (css) await page.addStyleTag({ content: css.text });
  await page.addScriptTag({
    content: bundle.outputFiles.find((file) => file.path.endsWith('.js')).text,
  });
  await page.locator('input').waitFor();
}
const input = () => page.locator('input').first();
const writes = () =>
  page.evaluate(() =>
    window.calls.filter((c) => c.url === '/test-actions/record'),
  );
await setup();
await input().fill(' 컴 공 ');
await page.waitForTimeout(400);
assert.equal((await writes()).length, 0);
await input().press('ArrowDown');
await page.keyboard.press('Enter');
await page.getByRole('heading', { name: '이 학과가 맞나요?' }).waitFor();
assert.equal((await writes()).length, 0);
await page.getByRole('button', { name: '아니요, 다시 찾을게요' }).click();
await page.getByRole('button', { name: '찾는 학과가 없어요' }).click();
await page.getByText(/찾는 학과가 없다는 의견을 기록했어요/).waitFor();
assert.equal((await writes()).length, 1);
assert.equal((await writes())[0].op, 'no_match');
assert.equal((await writes())[0].input, ' 컴 공 ');
assert.equal(await input().inputValue(), ' 컴 공 ');
await input().fill('컴공');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /컴퓨터공학/ }).click();
await page.getByRole('button', { name: '네, 이 학과예요' }).click();
await page.waitForTimeout(200);
assert.equal((await writes()).length, 2);
assert.equal((await writes())[1].op, 'confirm');
assert.equal((await writes())[1].input, '컴공');
assert.equal(
  await page.evaluate(() => window.draft.confirmed.id),
  candidate.id,
);
console.log(
  'PASS: search/select/reject make zero writes; explicit no_match and confirmation write',
);
await setup();
await input().focus();
await input().dispatchEvent('compositionstart');
await input().fill('소프트웨어');
await page
  .getByText('일치하는 전공을 찾지 못했어요. 다른 명칭으로 검색해 주세요.')
  .waitFor();
await page.waitForTimeout(1200);
assert.equal(
  await input().evaluate((el) => document.activeElement === el),
  true,
);
assert.equal(await page.evaluate(() => window.calls.length), 1);
assert.equal((await writes()).length, 0);
console.log(
  'PASS: unmatched input stays local after debounce and never calls LLM',
);
await setup('save-error');
await input().fill(' 컴 공 ');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /컴퓨터공학/ }).click();
await page.getByRole('button', { name: '네, 이 학과예요' }).click();
await page.getByText('저장 실패').waitFor();
await page.evaluate(() => (window.mode = 'db'));
await page.getByRole('button', { name: '네, 이 학과예요' }).click();
await page.waitForTimeout(200);
const attempts = await writes();
assert.equal(attempts.length, 2);
assert.equal(attempts[0].requestId, attempts[1].requestId);
assert.equal(attempts[1].input, ' 컴 공 ');
console.log(
  'PASS: confirmation retry retains idempotency key and original input',
);
await setup();
await input().fill('old');
await page.waitForTimeout(100);
await input().fill('new');
await page.waitForTimeout(1300);
assert.equal(await page.getByRole('button', { name: /새 전공/ }).count(), 1);
assert.equal((await writes()).length, 0);
await page.getByRole('button', { name: '추가 순위' }).click();
assert.equal(await page.locator('input').count(), 3);
assert.equal(
  await page.evaluate(
    () => window.calls.filter((c) => c.op === 'catalog').length,
  ),
  1,
);
await setup('catalog-error');
await input().fill('소프트웨어');
await page.waitForTimeout(1000);
assert.equal(
  await page.evaluate(() => window.calls.some((c) => c.op === 'model')),
  false,
);
assert.deepEqual(errors, []);
console.log(
  'PASS: stale results ignored without logging; shared catalog and error handling',
);
await browser.close();
