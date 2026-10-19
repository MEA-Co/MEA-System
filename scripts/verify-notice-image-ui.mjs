import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
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
const model = load('lib/questionnaire-notice-images/model.ts', {
  zod: require('zod'),
});
const { processNoticeImage } = load(
  'lib/questionnaire-notice-images/process.ts',
  { sharp: { default: sharp }, './model': model },
);
test('image metadata keeps ordered references and rejects duplicates/oversized collections', () => {
  const images = [
    { id: randomUUID(), name: 'one.png' },
    { id: randomUUID(), name: 'two.jpg' },
  ];
  assert.equal(model.noticeImagesSchema.safeParse(images).success, true);
  assert.equal(
    model.noticeImagesSchema.safeParse([...images, images[0]]).success,
    false,
  );
  assert.equal(
    model.noticeImagesSchema.safeParse(
      Array.from({ length: 11 }, () => ({ id: randomUUID(), name: 'x' })),
    ).success,
    false,
  );
  assert.equal(
    model.noticeImagesSchema.safeParse([
      { id: randomUUID(), name: 'x'.repeat(201) },
    ]).success,
    false,
  );
});
test('server re-encodes actual pixels, limits resolution, and strips metadata', async () => {
  const original = await sharp({
    create: { width: 2600, height: 1200, channels: 3, background: '#123456' },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'private' } } })
    .toBuffer();
  const output = await processNoticeImage(original);
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 2000);
  assert.equal(meta.exif, undefined);
  assert.ok(output.length <= model.NOTICE_IMAGE_MAX_BYTES);
});
test('invalid bytes, active SVG, and oversized requests are rejected', async () => {
  await assert.rejects(() => processNoticeImage(Buffer.from('not an image')));
  await assert.rejects(() =>
    processNoticeImage(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
      ),
    ),
  );
  await assert.rejects(() =>
    processNoticeImage(new Uint8Array(model.NOTICE_IMAGE_MAX_BYTES + 1)),
  );
});
function mount(images) {
  const state = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], (value) => (state[i] = value)];
    },
    useRef(value) {
      return (state[cursor++] ??= { current: value });
    },
  };
  const { ImageGallery } = load('components/ui/image-gallery.tsx', {
    react,
    '@/lib/utils': { cn: (...v) => v.filter(Boolean).join(' ') },
  });
  return {
    render(next = images) {
      cursor = 0;
      return ImageGallery({ images: next });
    },
  };
}
function walk(node) {
  if (!node) return [];
  if (Array.isArray(node)) return Array.from(node).flatMap(walk);
  return [node, ...walk(node.props?.children)];
}
const images = [
  { id: 'one', src: '/one', alt: '첫 사진' },
  { id: 'two', src: '/two', alt: '두 번째 사진' },
];
test('single photo has no carousel controls and opens the shared enlargement dialog', () => {
  const view = mount(images.slice(0, 1));
  let nodes = walk(view.render());
  assert.equal(
    nodes.some((n) => n.props?.['aria-label'] === '다음 사진'),
    false,
  );
  nodes
    .find((n) => n.props?.['aria-label'] === '첨부 사진 1 크게 보기')
    .props.onClick();
  nodes = walk(view.render());
  assert.equal(nodes.find((n) => n.type === 'Dialog').props.open, true);
});
test('multiple thumbnails open the chosen photo and support modal navigation', () => {
  const view = mount(images);
  let nodes = walk(view.render());
  const region = walk(nodes.find((n) => n.props?.role === 'region'));
  assert.deepEqual(
    region.filter((n) => n.type === 'img').map((n) => n.props.src),
    ['/one', '/two'],
  );
  assert.equal(
    region.some((n) => n.props?.['aria-label'] === '다음 사진'),
    false,
  );
  region
    .find((n) => n.props?.['aria-label'] === '첨부 사진 2 크게 보기')
    .props.onClick();
  const modal = () =>
    walk(walk(view.render()).find((n) => n.type === 'DialogContent'));
  assert.equal(
    walk(view.render()).find((n) => n.type === 'Dialog').props.open,
    true,
  );
  assert.equal(modal().find((n) => n.type === 'img').props.src, '/two');
  assert.equal(
    modal().find((n) => n.props?.['aria-label'] === '다음 사진').props.disabled,
    true,
  );
  modal()[0].props.onKeyDown({ key: 'ArrowLeft', preventDefault() {} });
  assert.equal(modal().find((n) => n.type === 'img').props.src, '/one');
  const swipe = modal()[0];
  swipe.props.onPointerDown({ pointerType: 'touch', clientX: 200 });
  swipe.props.onPointerUp({ clientX: 100 });
  assert.equal(modal().find((n) => n.type === 'img').props.src, '/two');
  modal()
    .find((n) => n.props?.['aria-label'] === '이전 사진')
    .props.onClick();
  assert.equal(modal().find((n) => n.type === 'img').props.src, '/one');
  nodes = walk(view.render(images.slice(1)));
  assert.equal(nodes.find((n) => n.type === 'img').props.src, '/two');
  assert.equal(view.render([]), null);
});

const imageRoute =
  'app/api/questionnaire-notice-images/[questionnaireId]/[noticeId]/[imageId]/route.ts';
function route({
  role = 'consultant_lead',
  signedIn = true,
  readDenied = false,
  editable = true,
} = {}) {
  const uploads = [];
  const storage = {
    download: async () =>
      readDenied
        ? { error: new Error('denied') }
        : { data: new Blob(['image'], { type: 'image/webp' }) },
    upload: async (...args) => {
      uploads.push(args);
      return { error: null };
    },
  };
  const client = {
    storage: { from: () => storage },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: editable
              ? {
                  id: 'questionnaire',
                  status: 'draft',
                  created_by: 'owner',
                  archived_at: null,
                }
              : null,
          }),
        }),
      }),
    }),
  };
  const module = load(
    imageRoute,
    {
      zod: require('zod'),
      'next/headers': { cookies: async () => ({}) },
      '@/lib/auth': {
        getUserAccess: async () => ({
          user: signedIn ? { id: 'owner' } : null,
          isOnboarded: true,
          role,
        }),
      },
      '@/lib/admin': { getViewRole: async () => role },
      '@/lib/supabase/server': { createClient: () => client },
      '@/lib/questionnaire-notice-images/model': model,
      '@/lib/questionnaire-notice-images/process': { processNoticeImage },
    },
    { Response, Request, Blob, URL },
  );
  return { ...module, uploads };
}
const context = () => ({
  params: Promise.resolve({
    questionnaireId: randomUUID(),
    noticeId: randomUUID(),
    imageId: randomUUID(),
  }),
});
const endpoint = 'https://app.example/api/questionnaire-notice-images/example';
test('photo endpoints require authentication and deny unavailable reads or non-author uploads', async () => {
  assert.equal(
    (await route({ signedIn: false }).GET(new Request(endpoint), context()))
      .status,
    401,
  );
  assert.equal(
    (await route({ readDenied: true }).GET(new Request(endpoint), context()))
      .status,
    404,
  );
  assert.equal(
    (
      await route({ role: 'consultant' }).PUT(
        new Request(endpoint, { method: 'PUT' }),
        context(),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await route().PUT(
        new Request(endpoint, {
          method: 'PUT',
          headers: { Origin: 'https://other.example' },
        }),
        context(),
      )
    ).status,
    403,
  );
});
test('upload endpoint re-encodes before private immutable upload and rejects oversized bodies', async () => {
  const bytes = await sharp({
    create: { width: 20, height: 20, channels: 3, background: '#abcdef' },
  })
    .webp()
    .toBuffer();
  const handlers = route();
  const response = await handlers.PUT(
    new Request(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/webp',
        'X-Questionnaire-Workflow': '2',
      },
      body: bytes,
    }),
    context(),
  );
  assert.equal(response.status, 200);
  assert.equal(handlers.uploads.length, 1);
  assert.equal(handlers.uploads[0][2].upsert, false);
  assert.equal((await sharp(handlers.uploads[0][1]).metadata()).format, 'webp');
  const oversized = await handlers.PUT(
    new Request(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/webp',
        'X-Questionnaire-Workflow': '2',
      },
      body: new Uint8Array(model.NOTICE_IMAGE_MAX_BYTES + 1),
    }),
    context(),
  );
  assert.equal(oversized.status, 413);
  assert.equal(handlers.uploads.length, 1);
});
